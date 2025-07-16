import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';

import boqRoutes from './routes/boqRoutes.js';
import { sequelize } from './models/index.js'; // ⬅️ pastikan ini benar

dotenv.config();

const app = express();

// Aktifkan CORS agar bisa diakses dari React
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true,
}));

app.use(express.json());

// Sync DB
sequelize.sync({ alter: true }) // ⬅️ auto create/update tabel dari model
  .then(() => console.log('✅ Database synced'))
  .catch(err => console.error('❌ Failed to sync DB:', err));

app.use('/api/boq', boqRoutes);

const PORT = process.env.PORT || 3005;
app.listen(PORT, () => {
  console.log(`🚀 BOQ Service running on http://localhost:${PORT}`);
});
