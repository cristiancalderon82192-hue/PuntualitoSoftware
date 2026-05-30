const express = require('express');
const {
  getSedes,
  createSede,
  updateSede,
  toggleSedeStatus,
  getHorarios,
  createHorario,
  updateHorario,
  toggleHorarioStatus
} = require('../controllers/settings.controller');
const { verifyToken, isAdmin } = require('../middlewares/auth.middleware');

const router = express.Router();

// Rutas de configuración protegidas por token y rol ADMIN
router.use(verifyToken, isAdmin);

// =======================
// RUTAS PARA SEDES
// =======================
router.get('/sedes', getSedes);
router.post('/sedes', createSede);
router.put('/sedes/:id', updateSede);
router.patch('/sedes/:id/status', toggleSedeStatus);

// =======================
// RUTAS PARA HORARIOS
// =======================
router.get('/horarios', getHorarios);
router.post('/horarios', createHorario);
router.put('/horarios/:id', updateHorario);
router.patch('/horarios/:id/status', toggleHorarioStatus);

module.exports = router;
