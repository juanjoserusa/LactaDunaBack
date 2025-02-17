require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

// Rutas de prueba
app.get("/", (req, res) => {
    res.send("API funcionando");
});

// **TABLA LACTANCIA**
app.get("/lactancia", async (req, res) => {
    const result = await pool.query("SELECT * FROM lactancia ORDER BY fecha_hora DESC");
    res.json(result.rows);
});

app.post("/lactancia", async (req, res) => {
    const { tipo, tiempo, cantidad, fecha_hora } = req.body;
    const result = await pool.query(
        `INSERT INTO lactancia (tipo, tiempo, cantidad, fecha_hora) 
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [tipo, tiempo, cantidad, fecha_hora]
    );
    res.json(result.rows[0]);
});

// **TABLA PAÑALES**
app.get("/pañales", async (req, res) => {
    const result = await pool.query("SELECT * FROM pañales ORDER BY fecha_hora DESC");
    res.json(result.rows);
});

app.post("/pañales", async (req, res) => {
    const { tipo, fecha_hora } = req.body;
    const result = await pool.query(
        `INSERT INTO pañales (tipo, fecha_hora) VALUES ($1, $2) RETURNING *`,
        [tipo, fecha_hora]
    );
    res.json(result.rows[0]);
});

// **TABLA BAÑOS**
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

// **TABLA VITAMINA D**
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

// Iniciar el servidor
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Servidor corriendo en el puerto ${PORT}`));
