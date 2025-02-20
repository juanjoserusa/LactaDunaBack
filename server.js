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

// ✅ ENDPOINT DE RECORDATORIOS
app.get("/recordatorios", async (req, res) => {
    try {
        const lactancia = await pool.query("SELECT * FROM lactancia ORDER BY fecha_hora DESC LIMIT 1");
        const ultimaLactancia = lactancia.rows[0] || null;

        // 🕒 Obtener última fecha de baño
        const banos = await pool.query("SELECT fecha_hora FROM baños ORDER BY fecha_hora DESC LIMIT 1");
        const ultimoBaño = banos.rows.length ? new Date(banos.rows[0].fecha_hora) : null;

        // 🕒 Obtener última fecha de vitamina D
        const vitaminaD = await pool.query("SELECT fecha_hora FROM vitamina_d ORDER BY fecha_hora DESC LIMIT 1");
        const ultimaVitaminaD = vitaminaD.rows.length ? new Date(vitaminaD.rows[0].fecha_hora) : null;

        // 📅 Calcular fecha de referencia (hace 2 días)
        const hoy = new Date();
        const fechaReferenciaBaño = new Date(hoy);
        fechaReferenciaBaño.setDate(hoy.getDate() - 2); // Retroceder 2 días

        // 📌 Determinar si se necesita un baño
        const necesitaBaño = !ultimoBaño || ultimoBaño < fechaReferenciaBaño;

        // 📌 Determinar si se necesita vitamina D (diario)
        const necesitaVitaminaD = !ultimaVitaminaD || ultimaVitaminaD.toDateString() !== hoy.toDateString();

        res.json({
            lactancia_ultima: ultimaLactancia || "No hay registros",
            necesita_baño: necesitaBaño,
            necesita_vitamina_d: necesitaVitaminaD
        });
    } catch (error) {
        console.error("❌ Error en GET /recordatorios:", error);
        res.status(500).json({ error: "Error en recordatorios" });
    }
});


// ✅ Iniciar el servidor
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`✅ Servidor corriendo en el puerto ${PORT}`));
