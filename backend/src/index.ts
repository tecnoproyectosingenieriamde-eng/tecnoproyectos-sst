import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Conexión a la Base de Datos PostgreSQL (Supabase)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Ruta de Estado del Servidor (Salud del Sistema)
app.get('/api/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ 
      status: 'success', 
      message: 'Servidor del SG-SST operando correctamente para TECNOPROYECTOS INGENIERÍA S.A.S.',
      timestamp: result.rows[0].now 
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Iniciar Servidor
app.listen(port, () => {
  console.log(`Servidor corriendo en el puerto ${port}`);
});
