require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();

// CORS
app.use(
  cors({
    origin: "*",
    methods: "GET, POST, PUT, DELETE",
    allowedHeaders: "Content-Type",
  })
);
app.use(express.json());

// PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on("error", (err) => console.error("❌ Error en PostgreSQL:", err));

/* ===================== INIT DB ===================== */
async function initDb() {
  // Tablas base (lactancia, etc) se asumen creadas; aquí creamos las nuevas
  await pool.query(`
    CREATE TABLE IF NOT EXISTS food (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      category TEXT NOT NULL, -- 'fruta' | 'verdura' | 'proteina' | 'cereal'
      allergen BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS exposure (
      id SERIAL PRIMARY KEY,
      date DATE NOT NULL,
      food_id INT NOT NULL REFERENCES food(id) ON DELETE CASCADE,
      notes TEXT,
      tolerated BOOLEAN,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE (date, food_id)
    );
    CREATE INDEX IF NOT EXISTS idx_exposure_date ON exposure(date);

    -- outcome de la valoración tras el 3er día
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'exposure' AND column_name = 'outcome'
      ) THEN
        ALTER TABLE exposure
          ADD COLUMN outcome TEXT CHECK (outcome IN ('ok','dudoso','malo')) NULL;
      END IF;
    END$$;

    CREATE TABLE IF NOT EXISTS daily_food_check (
      id SERIAL PRIMARY KEY,
      date DATE NOT NULL,
      food_id INT NOT NULL REFERENCES food(id) ON DELETE CASCADE,
      meal TEXT NOT NULL, -- 'manana' | 'comida' | 'merienda' | 'cena'
      checked BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE (date, food_id, meal)
    );
    CREATE INDEX IF NOT EXISTS idx_daily_food_check_date ON daily_food_check(date);

    CREATE TABLE IF NOT EXISTS recipe (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      suitable_from INT NOT NULL, -- mes recomendado (6..12)
      steps TEXT NOT NULL,
      freeze_ok BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS recipe_food (
      recipe_id INT NOT NULL REFERENCES recipe(id) ON DELETE CASCADE,
      food_id INT NOT NULL REFERENCES food(id) ON DELETE CASCADE,
      PRIMARY KEY (recipe_id, food_id)
    );
  `);

  // Seed mínimo (solo si food está vacío)
  const { rows } = await pool.query(`SELECT COUNT(*)::int AS c FROM food`);
  if (rows[0].c === 0) {
    await pool.query(`
      INSERT INTO food (name, category, allergen) VALUES
      -- frutas
      ('Plátano','fruta',false),
      ('Manzana','fruta',false),
      ('Pera','fruta',false),
      ('Melocotón','fruta',false),
      ('Mandarina','fruta',false),
      ('Uva','fruta',false),
      ('Mango','fruta',false),
      -- verduras (sin hojas verdes <12m)
      ('Patata','verdura',false),
      ('Zanahoria','verdura',false),
      ('Calabacín','verdura',false),
      ('Calabaza','verdura',false),
      ('Brócoli','verdura',false),
      ('Judías verdes','verdura',false),
      ('Boniato','verdura',false),
      -- proteínas
      ('Pollo','proteina',false),
      ('Pavo','proteina',false),
      ('Ternera','proteina',false),
      ('Merluza','proteina',true), -- pescado = alérgeno
      ('Huevo','proteina',true),
      -- cereales / gluten
      ('Galleta maría (sin azúcar)','cereal',true),
      ('Pan','cereal',true),
      ('Arroz','cereal',false),
      ('Avena','cereal',false)
      ON CONFLICT (name) DO NOTHING;
    `);

    // Recetas de ejemplo
    const r1 = await pool.query(
      `INSERT INTO recipe (title, suitable_from, steps, freeze_ok)
       VALUES ($1,$2,$3,$4) RETURNING id`,
      [
        "Calabacín + Patata (6m)",
        6,
        "Cocer al vapor ½ calabacín y ½ patata (10–12 min). Triturar fino. Añadir 1 cdita AOVE.",
        true,
      ]
    );
    const r2 = await pool.query(
      `INSERT INTO recipe (title, suitable_from, steps, freeze_ok)
       VALUES ($1,$2,$3,$4) RETURNING id`,
      [
        "Pollo + Calabacín + Patata (6m)",
        6,
        "Cocer 20–25 g de pechuga con calabacín y patata. Triturar muy fino.",
        true,
      ]
    );

    await pool.query(
      `INSERT INTO recipe_food (recipe_id, food_id)
       SELECT $1, id FROM food WHERE name IN ('Calabacín','Patata')`,
      [r1.rows[0].id]
    );
    await pool.query(
      `INSERT INTO recipe_food (recipe_id, food_id)
       SELECT $1, id FROM food WHERE name IN ('Pollo','Calabacín','Patata')`,
      [r2.rows[0].id]
    );
  }

  console.log("✅ Tablas OK y seed aplicado (si hacía falta)");
}

initDb().catch((err) => {
  console.error("❌ Error en initDb:", err);
  process.exit(1);
});

/* ===================== RUTA TEST ===================== */
app.get("/", (req, res) => res.send("API funcionando correctamente"));

/* ===================== LACTANCIA ===================== */
app.get("/lactancia", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM lactancia ORDER BY fecha_hora DESC"
    );
    res.json(result.rows);
  } catch (error) {
    console.error("❌ Error en GET /lactancia:", error);
    res.status(500).json({ error: "Error obteniendo registros de lactancia" });
  }
});

app.post("/lactancia", async (req, res) => {
  try {
    const { tipo, tiempo, cantidad, fecha_hora } = req.body;
    if (!tipo || !fecha_hora)
      return res
        .status(400)
        .json({ error: "El tipo y la fecha/hora son obligatorios" });

    const result = await pool.query(
      `INSERT INTO lactancia (tipo, tiempo, cantidad, fecha_hora)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [tipo, tiempo || null, cantidad || null, fecha_hora]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error("❌ Error en POST /lactancia:", error);
    res.status(500).json({ error: "Error interno al registrar lactancia" });
  }
});

app.put("/lactancia/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { tipo, tiempo, cantidad, fecha_hora } = req.body;

    if (!tipo || !fecha_hora) {
      return res
        .status(400)
        .json({ error: "El tipo y la fecha/hora son obligatorios" });
    }

    const tiempoFinal = tiempo ? parseInt(tiempo) : null;
    const cantidadFinal = cantidad ? parseInt(cantidad) : null;

    const result = await pool.query(
      `UPDATE lactancia
       SET tipo=$1, tiempo=$2, cantidad=$3, fecha_hora=$4
       WHERE id=$5
       RETURNING *`,
      [tipo, tiempoFinal, cantidadFinal, fecha_hora, id]
    );

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ error: "Registro de lactancia no encontrado" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("❌ Error en PUT /lactancia:", error);
    res
      .status(500)
      .json({ error: "Error interno al actualizar lactancia" });
  }
});

app.delete("/lactancia/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM lactancia WHERE id=$1", [id]);
    res.json({ message: "Registro de lactancia eliminado correctamente" });
  } catch (error) {
    console.error("❌ Error en DELETE /lactancia:", error);
    res.status(500).json({ error: "Error al eliminar lactancia" });
  }
});

/* ================ VITAMINA D ================= */
app.get("/vitamina_d", async (req, res) => {
  const result = await pool.query(
    "SELECT * FROM vitamina_d ORDER BY fecha_hora DESC"
  );
  res.json(result.rows);
});

app.post("/vitamina_d", async (req, res) => {
  const { fecha_hora } = req.body;
  const result = await pool.query(
    `INSERT INTO vitamina_d (fecha_hora) VALUES ($1) RETURNING *`,
    [fecha_hora]
  );
  res.json(result.rows[0]);
});

app.put("/vitamina_d/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { fecha_hora } = req.body;

    if (!fecha_hora) {
      return res
        .status(400)
        .json({ error: "La fecha y hora son obligatorias" });
    }

    const result = await pool.query(
      `UPDATE vitamina_d SET fecha_hora=$1 WHERE id=$2 RETURNING *`,
      [fecha_hora, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Registro no encontrado" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("❌ Error en PUT /vitamina_d:", error);
    res
      .status(500)
      .json({ error: "Error actualizando el registro de vitamina D" });
  }
});

app.delete("/vitamina_d/:id", async (req, res) => {
  const { id } = req.params;
  await pool.query(`DELETE FROM vitamina_d WHERE id=$1`, [id]);
  res.json({ message: "Registro de vitamina D eliminado correctamente" });
});

/* ================ PESO BEBÉ ================= */
app.get("/peso_bebe", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM peso_bebe ORDER BY fecha DESC"
    );
    res.json(result.rows);
  } catch (error) {
    console.error("❌ Error en GET /peso_bebe:", error);
    res.status(500).json({ error: "Error obteniendo registros de peso" });
  }
});

app.post("/peso_bebe", async (req, res) => {
  try {
    const { fecha, peso } = req.body;
    const result = await pool.query(
      `INSERT INTO peso_bebe (fecha, peso) VALUES ($1,$2) RETURNING *`,
      [fecha, peso]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error("❌ Error en POST /peso_bebe:", error);
    res.status(500).json({ error: "Error registrando peso" });
  }
});

app.put("/peso_bebe/:id", async (req, res) => {
  try {
    const { id } = req.params;
    let { fecha, peso } = req.body;

    if (!fecha || !peso) {
      return res
        .status(400)
        .json({ error: "La fecha y el peso son obligatorios" });
    }

    const result = await pool.query(
      `UPDATE peso_bebe SET fecha=$1, peso=$2 WHERE id=$3 RETURNING *`,
      [fecha, peso, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Registro de peso no encontrado" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("❌ Error en PUT /peso_bebe:", error);
    res.status(500).json({
      error: "Error actualizando el registro de peso del bebé",
    });
  }
});

app.delete("/peso_bebe/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `DELETE FROM peso_bebe WHERE id=$1 RETURNING *`,
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Registro de peso no encontrado" });
    }

    res.json({ message: "Registro de peso eliminado correctamente" });
  } catch (error) {
    console.error("❌ Error en DELETE /peso_bebe:", error);
    res.status(500).json({ error: "Error eliminando el registro de peso" });
  }
});

/* ================ CITAS BEBÉ ================= */
app.get("/citas_bebe", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM citas_bebe ORDER BY fecha_hora DESC"
    );
    res.json(result.rows);
  } catch (error) {
    console.error("❌ Error en GET /citas_bebe:", error);
    res.status(500).json({ error: "Error obteniendo registros de citas" });
  }
});

app.post("/citas_bebe", async (req, res) => {
  try {
    const { fecha_hora, descripcion } = req.body;
    const result = await pool.query(
      `INSERT INTO citas_bebe (fecha_hora, descripcion) VALUES ($1,$2) RETURNING *`,
      [fecha_hora, descripcion]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error("❌ Error en POST /citas_bebe:", error);
    res.status(500).json({ error: "Error registrando cita" });
  }
});

app.put("/citas_bebe/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { fecha_hora, descripcion } = req.body;

    if (!fecha_hora || !descripcion) {
      return res
        .status(400)
        .json({ error: "La fecha/hora y la descripción son obligatorias" });
    }

    const result = await pool.query(
      `UPDATE citas_bebe SET fecha_hora=$1, descripcion=$2 WHERE id=$3 RETURNING *`,
      [fecha_hora, descripcion, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Cita no encontrada" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("❌ Error en PUT /citas_bebe:", error);
    res.status(500).json({ error: "Error actualizando la cita del bebé" });
  }
});

app.delete("/citas_bebe/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `DELETE FROM citas_bebe WHERE id=$1 RETURNING *`,
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Cita no encontrada" });
    }

    res.json({ message: "Cita eliminada correctamente" });
  } catch (error) {
    console.error("❌ Error en DELETE /citas_bebe:", error);
    res.status(500).json({ error: "Error eliminando la cita del bebé" });
  }
});

/* ================ FOODS ================= */
app.get("/foods", async (req, res) => {
  try {
    const { category } = req.query;
    const sql = category
      ? `SELECT * FROM food WHERE category=$1 ORDER BY name`
      : `SELECT * FROM food ORDER BY category, name`;
    const params = category ? [String(category)] : [];
    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (e) {
    console.error("GET /foods", e);
    res.status(500).json({ error: "Error obteniendo alimentos" });
  }
});

app.post("/foods", async (req, res) => {
  try {
    const { name, category, allergen = false } = req.body;
    if (!name || !category)
      return res.status(400).json({ error: "name y category obligatorios" });
    const { rows } = await pool.query(
      `INSERT INTO food (name, category, allergen)
       VALUES ($1,$2,$3)
       ON CONFLICT (name) DO UPDATE
         SET category=EXCLUDED.category, allergen=EXCLUDED.allergen
       RETURNING *`,
      [name, category, !!allergen]
    );
    res.json(rows[0]);
  } catch (e) {
    console.error("POST /foods", e);
    res.status(500).json({ error: "Error creando alimento" });
  }
});

/* ================ EXPOSURES (3 días + valoración) ================= */
app.get("/exposures", async (req, res) => {
  try {
    const { from, to } = req.query;
    const params = [];
    const where = [];
    if (from) {
      params.push(from);
      where.push(`date >= $${params.length}`);
    }
    if (to) {
      params.push(to);
      where.push(`date <= $${params.length}`);
    }
    const sql = `
      SELECT e.*, f.name AS food_name, f.category, f.allergen
      FROM exposure e
      JOIN food f ON f.id = e.food_id
      ${where.length ? "WHERE " + where.join(" AND ") : ""}
      ORDER BY date DESC, food_name ASC
    `;
    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (e) {
    console.error("GET /exposures", e);
    res.status(500).json({ error: "Error obteniendo exposiciones" });
  }
});

// Crear exposición; si es exactamente la 3ª en 7 días, pedir valoración
app.post("/exposures", async (req, res) => {
  const client = await pool.connect();
  try {
    const { date, foodId, notes } = req.body;
    if (!date || !foodId)
      return res.status(400).json({ error: "date y foodId obligatorios" });

    await client.query("BEGIN");

    const ins = await client.query(
      `INSERT INTO exposure (date, food_id, notes)
       VALUES ($1,$2,$3)
       ON CONFLICT (date, food_id) DO UPDATE SET notes=EXCLUDED.notes
       RETURNING *`,
      [date, foodId, notes || null]
    );

    // cuántas exposiciones en ventana de 7 días (incluye hoy)
    const count = await client.query(
      `SELECT COUNT(*)::int AS c
       FROM exposure
       WHERE food_id=$1
         AND date >= (DATE($2) - INTERVAL '6 days')
         AND date <= DATE($2)`,
      [foodId, date]
    );

    const c = count.rows[0].c;
    const needsOutcome = c === 3; // EXACTAMENTE la 3ª => pedimos valoración

    await client.query("COMMIT");
    res.json({ ...ins.rows[0], needsOutcome });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("POST /exposures", e);
    res.status(500).json({ error: "Error creando exposición" });
  } finally {
    client.release();
  }
});

// Guardar valoración tras el 3er día
// outcome: 'ok' | 'dudoso' | 'malo'
app.post("/exposures/outcome", async (req, res) => {
  try {
    const { foodId, outcome } = req.body;
    if (!foodId || !["ok", "dudoso", "malo"].includes(outcome)) {
      return res
        .status(400)
        .json({ error: "foodId y outcome válidos son obligatorios" });
    }

    // Verifica que esté exactamente en 3 exposiciones en los últimos 7 días
    const count = await pool.query(
      `SELECT COUNT(*)::int AS c
       FROM exposure
       WHERE food_id=$1
         AND date >= (CURRENT_DATE - INTERVAL '6 days')
         AND date <= CURRENT_DATE`,
      [foodId]
    );
    if (count.rows[0].c !== 3) {
      return res
        .status(400)
        .json({ error: "El alimento no está exactamente en la 3ª exposición" });
    }

    // Guarda outcome en la ventana y setea tolerated global según resultado
    await pool.query(
      `UPDATE exposure
         SET outcome=$1
       WHERE food_id=$2
         AND date >= (CURRENT_DATE - INTERVAL '6 days')
         AND date <= CURRENT_DATE`,
      [outcome, foodId]
    );

    await pool.query(
      `UPDATE exposure
         SET tolerated = CASE WHEN $1='ok' THEN true ELSE false END
       WHERE food_id=$2`,
      [outcome, foodId]
    );

    res.json({ ok: true });
  } catch (e) {
    console.error("POST /exposures/outcome", e);
    res.status(500).json({ error: "Error guardando valoración" });
  }
});

/* ================ CHECKS DIARIOS (calendario) ================= */
app.get("/checks", async (req, res) => {
  try {
    const { month } = req.query; // 'YYYY-MM'
    if (!month || !/^\d{4}-\d{2}$/.test(String(month))) {
      return res.status(400).json({ error: "month=YYYY-MM es obligatorio" });
    }
    const start = `${month}-01`;
    const { rows } = await pool.query(
      `SELECT c.*, f.name AS food_name, f.category, f.allergen
       FROM daily_food_check c
       JOIN food f ON f.id = c.food_id
       WHERE c.date >= DATE($1)
         AND c.date < (DATE($1) + INTERVAL '1 month')
       ORDER BY c.date, meal, food_name`,
      [start]
    );
    res.json(rows);
  } catch (e) {
    console.error("GET /checks", e);
    res.status(500).json({ error: "Error obteniendo checks" });
  }
});

app.post("/checks", async (req, res) => {
  try {
    const { date, foodId, meal, checked } = req.body;
    if (!date || !foodId || !meal) {
      return res
        .status(400)
        .json({ error: "date, foodId y meal son obligatorios" });
    }
    const { rows } = await pool.query(
      `INSERT INTO daily_food_check (date, food_id, meal, checked)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (date, food_id, meal)
       DO UPDATE SET checked=EXCLUDED.checked
       RETURNING *`,
      [date, foodId, String(meal), !!checked]
    );
    res.json(rows[0]);
  } catch (e) {
    console.error("POST /checks", e);
    res.status(500).json({ error: "Error guardando check" });
  }
});

/* ================ RECIPES ================= */
app.get("/recipes", async (req, res) => {
  try {
    const { suitableTo, foodId } = req.query;
    const params = [];
    const where = [];

    if (suitableTo) {
      params.push(+suitableTo);
      where.push(`r.suitable_from <= $${params.length}`);
    }
    if (foodId) {
      params.push(+foodId);
      where.push(
        `EXISTS (SELECT 1 FROM recipe_food rf WHERE rf.recipe_id=r.id AND rf.food_id=$${params.length})`
      );
    }

    const sql = `
      SELECT r.*
      FROM recipe r
      ${where.length ? "WHERE " + where.join(" AND ") : ""}
      ORDER BY r.suitable_from, r.title
    `;
    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (e) {
    console.error("GET /recipes", e);
    res.status(500).json({ error: "Error obteniendo recetas" });
  }
});

app.post("/recipes", async (req, res) => {
  const client = await pool.connect();
  try {
    const { title, suitable_from, steps, freeze_ok = true, foodIds = [] } =
      req.body;
    if (!title || !suitable_from || !steps) {
      return res
        .status(400)
        .json({ error: "title, suitable_from y steps son obligatorios" });
    }

    await client.query("BEGIN");

    const r = await client.query(
      `INSERT INTO recipe (title, suitable_from, steps, freeze_ok)
       VALUES ($1,$2,$3,$4) RETURNING id`,
      [title, +suitable_from, steps, !!freeze_ok]
    );

    if (Array.isArray(foodIds) && foodIds.length) {
      const values = foodIds.map((_, i) => `($1, $${i + 2})`).join(",");
      await client.query(
        `INSERT INTO recipe_food (recipe_id, food_id) VALUES ${values} ON CONFLICT DO NOTHING`,
        [r.rows[0].id, ...foodIds]
      );
    }

    await client.query("COMMIT");
    res.json({ id: r.rows[0].id });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("POST /recipes", e);
    res.status(500).json({ error: "Error creando receta" });
  } finally {
    client.release();
  }
});

/* ================ RECORDATORIOS (sin baños/pañales) ================= */
app.get("/recordatorios", async (req, res) => {
  try {
    // Última lactancia
    const lactancia = await pool.query(
      "SELECT * FROM lactancia ORDER BY fecha_hora DESC LIMIT 1"
    );
    const ultimaLactancia = lactancia.rows[0] || null;

    // Vitamina D (día actual)
    const vitaminaD = await pool.query(
      "SELECT fecha_hora FROM vitamina_d ORDER BY fecha_hora DESC LIMIT 1"
    );
    const ultimaVitaminaD = vitaminaD.rows.length
      ? new Date(vitaminaD.rows[0].fecha_hora)
      : null;

    // Citas próximos 7 días
    const citas = await pool.query(
      `
        SELECT * FROM citas_bebe
        WHERE fecha_hora >= NOW()
          AND fecha_hora <= NOW() + INTERVAL '7 days'
        ORDER BY fecha_hora ASC
      `
    );
    const citasProximas = citas.rows;

    const hoy = new Date();

    const necesitaVitaminaD =
      !ultimaVitaminaD || ultimaVitaminaD.toDateString() !== hoy.toDateString();

    // Como quitamos "baños", lo dejamos siempre en false para no romper la Home.
    const necesitaBaño = false;

    res.json({
      lactancia_ultima: ultimaLactancia || "No hay registros",
      necesita_baño: necesitaBaño,
      necesita_vitamina_d: necesitaVitaminaD,
      citas_proximas: citasProximas,
    });
  } catch (error) {
    console.error("❌ Error en GET /recordatorios:", error);
    res.status(500).json({ error: "Error en recordatorios" });
  }
});

/* ================ BOOT ================= */
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`✅ Servidor corriendo en el puerto ${PORT}`));
