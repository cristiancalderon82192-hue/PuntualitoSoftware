const express = require('express');
const { 
  getDashboardStats, 
  getAttendances,
  deleteAttendance,
  getUsers,
  createUser,
  updateUser,
  toggleUserStatus,
  getFormData,
  approveExtras,
  getLateArrivalsReport
} = require('../controllers/admin.controller');
const { verifyToken, isAdmin } = require('../middlewares/auth.middleware');

const router = express.Router();

// Todas las rutas de administración están protegidas por token y rol ADMIN
router.use(verifyToken, isAdmin);

// Estadísticas y Dashboard
router.get('/stats', getDashboardStats);
router.get('/attendances', getAttendances);
router.delete('/attendances/:id', deleteAttendance);
router.put('/attendances/:id/approve-extras', approveExtras);
router.get('/reports/tardanzas', getLateArrivalsReport);

// Gestión de Empleados (CRUD)
router.get('/form-data', getFormData);
router.get('/users', getUsers);
router.post('/users', createUser);
router.put('/users/:id', updateUser);
router.patch('/users/:id/status', toggleUserStatus);

module.exports = router;
