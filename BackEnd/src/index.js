const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

const authRoutes = require('./routes/auth.routes');
const { startCronJobs } = require('./services/cron.service');

// Middlewares
app.use(cors());
app.use(express.json());

// Servir archivos estáticos (evidencias fotográficas)
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

// Basic Route
app.get('/', (req, res) => {
  res.json({ message: 'Puntualito API is running' });
});

// Rutas de la API
app.use('/api/auth', authRoutes);
app.use('/api/attendance', require('./routes/attendance.routes'));
app.use('/api/admin', require('./routes/admin.routes'));
app.use('/api/admin/settings', require('./routes/settings.routes'));

// Inicializar tareas programadas (Cron Jobs)
startCronJobs();

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
