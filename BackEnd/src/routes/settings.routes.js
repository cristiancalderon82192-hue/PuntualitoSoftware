const express = require('express');
const {
  getSedes,
  createSede,
  updateSede,
  toggleSedeStatus,
  getCausas,
  createCausa,
  updateCausa,
  toggleCausaStatus
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
// RUTAS PARA CAUSAS
// =======================
router.get('/causas', getCausas);
router.post('/causas', createCausa);
router.put('/causas/:id', updateCausa);
router.patch('/causas/:id/status', toggleCausaStatus);

module.exports = router;
