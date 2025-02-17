require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();

// ✅ Configurar CORS para permitir peticiones del frontend y otras opciones
app.use(cors({
    origin: "*", // Permitir todas las conexiones (o cambia a ["http://localhost:5173"] si quieres solo el frontend)
    methods: "GET, POST, PUT, DELETE",
    allowedHeaders: "Content-Type"
}));

app.use(express.json());

// ✅ Conectar a PostgreSQL
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
});

pool.connect()
    .then(() => console.log("✅ Conectado a PostgreSQL"))
    .catch((err) => {
        console.error("❌ Error de conexión a PostgreSQL:", err);
        process.exit(1);
    });

// ✅ Ruta de prueba
app.get("/", (req, res) => {
    res.send("API funcionando");
});


// **TABLA LACTANCIA**
app.get("/lactancia", async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM lactancia ORDER BY fecha_hora DESC");
        res.json(result.rows);
    } catch (error) {
        console.error("❌ Error en GET /lactancia:", error);
        res.status(500).json({ error: "Error obteniendo registros de lactancia" });
    }
});

app.post("/lactancia", async (req, res) => {
    try {
        const { tipo, tiempo, cantidad, fecha_hora } = req.body;

        // ✅ Validar que los datos obligatorios están presentes
        if (!tipo || !fecha_hora) {
            return res.status(400).json({ error: "El tipo y la fecha/hora son obligatorios" });
        }

        // ✅ Si `tiempo` está vacío o es una cadena vacía, lo convertimos a `null`
        const tiempoFinal = tiempo && tiempo.trim() !== "" ? tiempo : null;
        const cantidadFinal = cantidad && cantidad.trim() !== "" ? cantidad : null;

        const result = await pool.query(
            `INSERT INTO lactancia (tipo, tiempo, cantidad, fecha_hora) VALUES ($1, $2, $3, $4) RETURNING *`,
            [tipo, tiempoFinal, cantidadFinal, fecha_hora]
        );
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error("❌ Error en POST /lactancia:", error);
        res.status(500).json({ error: "Error interno al registrar lactancia" });
    }
});


// ✅ EDITAR REGISTRO DE LACTANCIA
app.put("/lactancia/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { tipo, tiempo, cantidad, fecha_hora } = req.body;
        const result = await pool.query(
            `UPDATE lactancia SET tipo=$1, tiempo=$2, cantidad=$3, fecha_hora=$4 WHERE id=$5 RETURNING *`,
            [tipo, tiempo, cantidad, fecha_hora, id]
        );
        res.json(result.rows[0]);
    } catch (error) {
        console.error("❌ Error al actualizar lactancia:", error);
        res.status(500).json({ error: "Error al actualizar lactancia" });
    }
});

// ✅ ELIMINAR REGISTRO DE LACTANCIA
app.delete("/lactancia/:id", async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query(`DELETE FROM lactancia WHERE id=$1`, [id]);
        res.json({ message: "Registro de lactancia eliminado correctamente" });
    } catch (error) {
        console.error("❌ Error al eliminar lactancia:", error);
        res.status(500).json({ error: "Error al eliminar lactancia" });
    }
});


// **TABLA PAÑALES**
app.get("/pañales", async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM pañales ORDER BY fecha_hora DESC");
        res.json(result.rows);
    } catch (error) {
        console.error("❌ Error en GET /pañales:", error);
        res.status(500).json({ error: "Error obteniendo registros de pañales" });
    }
});

app.post("/pañales", async (req, res) => {
    try {
        const { tipo, fecha_hora } = req.body;
        const result = await pool.query(
            `INSERT INTO pañales (tipo, fecha_hora) VALUES ($1, $2) RETURNING *`,
            [tipo, fecha_hora]
        );
        res.json(result.rows[0]);
    } catch (error) {
        console.error("❌ Error en POST /pañales:", error);
        res.status(500).json({ error: "Error registrando pañales" });
    }
});

// ✅ EDITAR REGISTRO DE PAÑALES
app.put("/pañales/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { tipo, fecha_hora } = req.body;
        const result = await pool.query(
            `UPDATE pañales SET tipo=$1, fecha_hora=$2 WHERE id=$3 RETURNING *`,
            [tipo, fecha_hora, id]
        );
        res.json(result.rows[0]);
    } catch (error) {
        console.error("❌ Error al actualizar pañales:", error);
        res.status(500).json({ error: "Error al actualizar pañales" });
    }
});

// ✅ ELIMINAR REGISTRO DE PAÑALES
app.delete("/pañales/:id", async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query(`DELETE FROM pañales WHERE id=$1`, [id]);
        res.json({ message: "Registro de pañal eliminado correctamente" });
    } catch (error) {
        console.error("❌ Error al eliminar pañal:", error);
        res.status(500).json({ error: "Error al eliminar pañal" });
    }
});

// **TABLAS BAÑOS Y VITAMINA D (MISMA LÓGICA PARA EDITAR Y ELIMINAR)**
app.get("/baños", async (req, res) => {
    const result = await pool.query("SELECT * FROM baños ORDER BY fecha_hora DESC");
    res.json(result.rows);
});

app.post("/baños", async (req, res) => {
    const { fecha_hora } = req.body;
    const result = await pool.query(
        `INSERT INTO baños (fecha_hora) VALUES ($1) RETURNING *`,
        [fecha_hora]
    );
    res.json(result.rows[0]);
});

app.delete("/baños/:id", async (req, res) => {
    const { id } = req.params;
    await pool.query(`DELETE FROM baños WHERE id=$1`, [id]);
    res.json({ message: "Registro de baño eliminado correctamente" });
});

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

app.delete("/vitamina_d/:id", async (req, res) => {
    const { id } = req.params;
    await pool.query(`DELETE FROM vitamina_d WHERE id=$1`, [id]);
    res.json({ message: "Registro de vitamina D eliminado correctamente" });
});

// ✅ Iniciar el servidor en el puerto correcto para Railway
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Servidor corriendo en el puerto ${PORT}`));
