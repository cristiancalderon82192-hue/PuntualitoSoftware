const express = require('express');
const { login, loginEmpleado, register } = require('../controllers/auth.controller');

const router = express.Router();

// Ruta: POST /api/auth/login
router.post('/login', login);

// Ruta: POST /api/auth/login-empleado
router.post('/login-empleado', loginEmpleado);

// Ruta: POST /api/auth/register
// (Idealmente deberíamos proteger esta ruta para que solo ADMIN pueda usarla después)
router.post('/register', register);

module.exports = router;
