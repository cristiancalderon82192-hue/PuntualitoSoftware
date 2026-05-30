const jwt = require('jsonwebtoken');

// Middleware para proteger rutas
const verifyToken = (req, res, next) => {
  // 1. Obtener el token del header 'Authorization'
  const authHeader = req.headers['authorization'];
  
  if (!authHeader) {
    return res.status(403).json({ error: 'No se proporcionó un token de seguridad' });
  }

  // El header usualmente viene como "Bearer <token>"
  const token = authHeader.split(' ')[1];

  if (!token) {
    return res.status(403).json({ error: 'Formato de token inválido' });
  }

  try {
    // 2. Verificar y decodificar el token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // 3. Adjuntar la información del usuario a la request para usarla en los siguientes controladores
    req.usuario = decoded;
    
    // Continuar con la siguiente función (controlador)
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
};

// Middleware para proteger rutas exclusivas de Administradores
const isAdmin = (req, res, next) => {
  if (req.usuario && req.usuario.rol === 'ADMIN') {
    next();
  } else {
    return res.status(403).json({ error: 'Acceso denegado. Requiere privilegios de Administrador' });
  }
};

module.exports = {
  verifyToken,
  isAdmin
};
