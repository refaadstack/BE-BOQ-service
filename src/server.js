import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';

import boqRoutes from './routes/boqRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import { sequelize } from './models/index.js';

dotenv.config();

const app = express();

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));

app.use(express.json());
// Health check (Docker/K8s)
app.get('/health', (req, res) => {
  res.status(200).json({ success: true, timestamp: new Date().toISOString() });
});


// Sync Sequelize Models
sequelize.sync({ alter: true })
  .then(() => console.log('✅ Database synced'))
  .catch(err => console.error('❌ Failed to sync DB:', err));

// ROUTES
app.use('/api/boq', boqRoutes);
app.use('/api/categories', categoryRoutes);

const PORT = process.env.PORT || 3005;
app.listen(PORT, () => {
  console.log(`🚀 BOQ Service running on http://localhost:${PORT}`);
});
