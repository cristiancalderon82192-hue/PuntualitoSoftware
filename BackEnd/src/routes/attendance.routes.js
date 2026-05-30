const express = require('express');
const { checkIn, justifyAttendance, getAttendanceStatus } = require('../controllers/attendance.controller');
const { verifyToken } = require('../middlewares/auth.middleware');
const upload = require('../middlewares/upload.middleware');

const router = express.Router();

// Ruta: GET /api/attendance/status
// Protegida: Obtiene el estado actual del empleado en el día
router.get('/status', verifyToken, getAttendanceStatus);

// Ruta: POST /api/attendance/check-in
// Protegida: Solo usuarios con token JWT válido pueden registrar su asistencia
router.post('/check-in', verifyToken, checkIn);

// Ruta: PATCH /api/attendance/:id/justify
// Protegida: Sube foto y observación si llegó tarde
router.patch('/:id/justify', verifyToken, upload.single('evidencia'), justifyAttendance);

module.exports = router;
