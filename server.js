require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();

// ✅ Configurar CORS
app.use(cors({
    origin: "*",
    methods: "GET, POST, PUT, DELETE",
    allowedHeaders: "Content-Type"
}));
app.use(express.json());

// ✅ Conectar a PostgreSQL con manejo de errores
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000
});

pool.on("error", (err) => console.error("❌ Error en PostgreSQL:", err));

// ✅ Ruta de prueba
app.get("/", (req, res) => res.send("API funcionando correctamente"));

// ✅ TABLA LACTANCIA
app.get("/lactancia", async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM lactancia ORDER BY fecha_hora DESC');
        res.json(result.rows);
    } catch (error) {
        console.error("❌ Error en GET /lactancia:", error);
        res.status(500).json({ error: "Error obteniendo registros de lactancia" });
    }
});

app.post("/lactancia", async (req, res) => {
    try {
        const { tipo, tiempo, cantidad, fecha_hora } = req.body;
        if (!tipo || !fecha_hora) return res.status(400).json({ error: "El tipo y la fecha/hora son obligatorios" });

        const result = await pool.query(
            `INSERT INTO lactancia (tipo, tiempo, cantidad, fecha_hora) VALUES ($1, $2, $3, $4) RETURNING *`,
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

        // Validar que se envíen los campos requeridos
        if (!tipo || !fecha_hora) {
            return res.status(400).json({ error: "El tipo y la fecha/hora son obligatorios" });
        }

        // Convertir valores vacíos a null
        const tiempoFinal = tiempo ? parseInt(tiempo) : null;
        const cantidadFinal = cantidad ? parseInt(cantidad) : null;

        const result = await pool.query(
            `UPDATE lactancia 
             SET tipo = $1, tiempo = $2, cantidad = $3, fecha_hora = $4 
             WHERE id = $5 
             RETURNING *`,
            [tipo, tiempoFinal, cantidadFinal, fecha_hora, id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: "Registro de lactancia no encontrado" });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error("❌ Error en PUT /lactancia:", error);
        res.status(500).json({ error: "Error interno al actualizar lactancia" });
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

// ✅ TABLA PAÑALES
app.get("/panales", async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM "pañales" ORDER BY fecha_hora DESC');
        res.json(result.rows);
    } catch (error) {
        console.error("❌ Error en GET /panales:", error);
        res.status(500).json({ error: "Error obteniendo registros de pañales" });
    }
});

app.post("/panales", async (req, res) => {
    try {
        const { tipo, fecha_hora } = req.body;
        const result = await pool.query(
            `INSERT INTO "pañales" (tipo, fecha_hora) VALUES ($1, $2) RETURNING *`,
            [tipo, fecha_hora]
        );
        res.json(result.rows[0]);
    } catch (error) {
        console.error("❌ Error en POST /panales:", error);
        res.status(500).json({ error: "Error registrando pañales" });
    }
});

app.put("/panales/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { tipo, fecha_hora } = req.body;

        if (!tipo || !fecha_hora) {
            return res.status(400).json({ error: "El tipo y la fecha/hora son obligatorios" });
        }

        const result = await pool.query(
            `UPDATE "pañales" SET tipo=$1, fecha_hora=$2 WHERE id=$3 RETURNING *`,
            [tipo, fecha_hora, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Registro no encontrado" });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error("❌ Error en PUT /panales:", error);
        res.status(500).json({ error: "Error actualizando el registro de pañales" });
    }
});

app.delete("/panales/:id", async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query(`DELETE FROM "pañales" WHERE id=$1`, [id]);
        res.json({ message: "Registro de pañal eliminado correctamente" });
    } catch (error) {
        console.error("❌ Error en DELETE /panales:", error);
        res.status(500).json({ error: "Error al eliminar pañal" });
    }
});

// ✅ TABLA BAÑOS
app.get("/banos", async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM baños ORDER BY fecha_hora DESC");
        res.json(result.rows);
    } catch (error) {
        console.error("❌ Error en GET /banos:", error);
        res.status(500).json({ error: "Error obteniendo registros de baños" });
    }
});

app.post("/banos", async (req, res) => {
    try {
        const { fecha_hora } = req.body;
        const result = await pool.query(`INSERT INTO baños (fecha_hora) VALUES ($1) RETURNING *`, [fecha_hora]);
        res.json(result.rows[0]);
    } catch (error) {
        console.error("❌ Error en POST /banos:", error);
        res.status(500).json({ error: "Error registrando baño" });
    }
});
app.put("/banos/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { fecha_hora } = req.body;

        if (!fecha_hora) {
            return res.status(400).json({ error: "La fecha y hora son obligatorias" });
        }

        const result = await pool.query(
            `UPDATE baños SET fecha_hora=$1 WHERE id=$2 RETURNING *`,
            [fecha_hora, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Registro de baño no encontrado" });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error("❌ Error en PUT /banos:", error);
        res.status(500).json({ error: "Error actualizando el registro de baño" });
    }
});


app.delete("/banos/:id", async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query("DELETE FROM baños WHERE id=$1", [id]);
        res.json({ message: "Registro de baño eliminado correctamente" });
    } catch (error) {
        console.error("❌ Error en DELETE /banos:", error);
        res.status(500).json({ error: "Error eliminando baño" });
    }
});

// ✅ TABLA VITAMINA D
app.get("/vitamina_d", async (req, res) => {
    const result = await pool.query("SELECT * FROM vitamina_d ORDER BY fecha_hora DESC");
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
            return res.status(400).json({ error: "La fecha y hora son obligatorias" });
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
        res.status(500).json({ error: "Error actualizando el registro de vitamina D" });
    }
});


app.delete("/vitamina_d/:id", async (req, res) => {
    const { id } = req.params;
    await pool.query(`DELETE FROM vitamina_d WHERE id=$1`, [id]);
    res.json({ message: "Registro de vitamina D eliminado correctamente" });
});

// ✅ TABLA PESO DEL BEBÉ
app.get("/peso_bebe", async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM peso_bebe ORDER BY fecha DESC");
        res.json(result.rows);
    } catch (error) {
        console.error("❌ Error en GET /peso_bebe:", error);
        res.status(500).json({ error: "Error obteniendo registros de peso" });
    }
});

app.put("/peso_bebe/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { fecha, peso } = req.body;

        if (!fecha || !peso) {
            return res.status(400).json({ error: "La fecha y el peso son obligatorios" });
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
        res.status(500).json({ error: "Error actualizando el registro de peso del bebé" });
    }
});


app.post("/peso_bebe", async (req, res) => {
    try {
        const { fecha, peso } = req.body;
        const result = await pool.query(`INSERT INTO peso_bebe (fecha, peso) VALUES ($1, $2) RETURNING *`, [fecha, peso]);
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
            return res.status(400).json({ error: "La fecha y el peso son obligatorios" });
        }

        // Convertir fecha a TIMESTAMP sin modificar la zona horaria
        const result = await pool.query(
            `UPDATE peso_bebe SET fecha = $1, peso = $2 WHERE id = $3 RETURNING *`,
            [fecha, peso, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Registro de peso no encontrado" });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error("❌ Error en PUT /peso_bebe:", error);
        res.status(500).json({ error: "Error actualizando el registro de peso del bebé" });
    }
});



// ✅ TABLA CITAS DEL BEBÉ
app.get("/citas_bebe", async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM citas_bebe ORDER BY fecha_hora DESC");
        res.json(result.rows);
    } catch (error) {
        console.error("❌ Error en GET /citas_bebe:", error);
        res.status(500).json({ error: "Error obteniendo registros de citas" });
    }
});

app.post("/citas_bebe", async (req, res) => {
    try {
        const { fecha_hora, descripcion } = req.body;
        const result = await pool.query(`INSERT INTO citas_bebe (fecha_hora, descripcion) VALUES ($1, $2) RETURNING *`, [fecha_hora, descripcion]);
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
            return res.status(400).json({ error: "La fecha/hora y la descripción son obligatorias" });
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

        const result = await pool.query(`DELETE FROM citas_bebe WHERE id=$1 RETURNING *`, [id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: "Cita no encontrada" });
        }

        res.json({ message: "Cita eliminada correctamente" });
    } catch (error) {
        console.error("❌ Error en DELETE /citas_bebe:", error);
        res.status(500).json({ error: "Error eliminando la cita del bebé" });
    }
});



// ✅ ENDPOINT DE RECORDATORIOS
app.get("/recordatorios", async (req, res) => {
    try {
        // 📌 Última toma de lactancia
        const lactancia = await pool.query("SELECT * FROM lactancia ORDER BY fecha_hora DESC LIMIT 1");
        const ultimaLactancia = lactancia.rows[0] || null;

        // 📌 Último baño registrado
        const banos = await pool.query("SELECT fecha_hora FROM baños ORDER BY fecha_hora DESC LIMIT 1");
        const ultimoBaño = banos.rows.length ? new Date(banos.rows[0].fecha_hora) : null;

        // 📌 Última toma de Vitamina D
        const vitaminaD = await pool.query("SELECT fecha_hora FROM vitamina_d ORDER BY fecha_hora DESC LIMIT 1");
        const ultimaVitaminaD = vitaminaD.rows.length ? new Date(vitaminaD.rows[0].fecha_hora) : null;

        // 📌 Citas en los próximos 7 días
        const citas = await pool.query(`
            SELECT * FROM citas_bebe 
            WHERE fecha_hora >= NOW() 
            AND fecha_hora <= NOW() + INTERVAL '7 days'
            ORDER BY fecha_hora ASC
        `);
        const citasProximas = citas.rows;

        // 📅 Fecha de referencia para el baño (hace 2 días)
        const hoy = new Date();
        const fechaReferenciaBaño = new Date(hoy);
        fechaReferenciaBaño.setDate(hoy.getDate() - 2);

        // 📌 Determinar si se necesita un baño
        const necesitaBaño = !ultimoBaño || ultimoBaño < fechaReferenciaBaño;

        // 📌 Determinar si se necesita vitamina D (diario)
        const necesitaVitaminaD = !ultimaVitaminaD || ultimaVitaminaD.toDateString() !== hoy.toDateString();

        res.json({
            lactancia_ultima: ultimaLactancia || "No hay registros",
            necesita_baño: necesitaBaño,
            necesita_vitamina_d: necesitaVitaminaD,
            citas_proximas: citasProximas
        });
    } catch (error) {
        console.error("❌ Error en GET /recordatorios:", error);
        res.status(500).json({ error: "Error en recordatorios" });
    }
});



// ✅ Iniciar el servidor
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`✅ Servidor corriendo en el puerto ${PORT}`));
