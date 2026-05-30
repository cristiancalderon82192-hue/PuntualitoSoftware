const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const prisma = require('../config/db');

// Controlador para el Login
const login = async (req, res) => {
  try {
    const { correo, contrasena } = req.body;

    // 1. Verificar si el usuario existe (buscamos por correo e incluimos su Rol y Sede)
    const usuario = await prisma.usuario.findUnique({
      where: { correo },
      include: {
        rol: true,
        sede: true,
      }
    });

    if (!usuario) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    if (!usuario.activo) {
      return res.status(403).json({ error: 'El usuario está desactivado' });
    }

    // 2. Verificar la contraseña encriptada
    const passwordValido = await bcrypt.compare(contrasena, usuario.contrasena);
    if (!passwordValido) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // 3. Generar token JWT
    // Solo guardamos datos esenciales (payload) en el token
    const payload = {
      id: usuario.id,
      rol: usuario.rol.nombre,
      sedeId: usuario.sedeId,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: '8h' // El token expira en 8 horas (una jornada laboral)
    });

    // 4. Enviar respuesta exitosa (sin incluir la contraseña)
    res.json({
      mensaje: 'Login exitoso',
      token,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        correo: usuario.correo,
        rol: usuario.rol.nombre,
        sede: usuario.sede.nombre
      }
    });

  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Controlador para Registrar Usuarios (Normalmente solo el ADMIN puede hacer esto)
const register = async (req, res) => {
  try {
    const { documento, nombre, apellido, correo, contrasena, rolId, sedeId, horarioId } = req.body;

    // 1. Verificar si el correo o documento ya existen
    const usuarioExistente = await prisma.usuario.findFirst({
      where: {
        OR: [
          { correo },
          { documento }
        ]
      }
    });

    if (usuarioExistente) {
      return res.status(400).json({ error: 'El correo o documento ya están registrados' });
    }

    // 2. Encriptar contraseña
    const saltRounds = 10;
    const contrasenaEncriptada = await bcrypt.hash(contrasena, saltRounds);

    // 3. Crear el usuario en la BD (El Modelo)
    const nuevoUsuario = await prisma.usuario.create({
      data: {
        documento,
        nombre,
        apellido,
        correo,
        contrasena: contrasenaEncriptada,
        rolId,
        sedeId,
        horarioId
      },
      // Devolvemos la info del usuario sin la contraseña para seguridad
      select: {
        id: true,
        nombre: true,
        apellido: true,
        correo: true
      }
    });

    res.status(201).json({
      mensaje: 'Usuario creado exitosamente',
      usuario: nuevoUsuario
    });

  } catch (error) {
    console.error('Error en register:', error);
    res.status(500).json({ error: 'Error al registrar el usuario' });
  }
};

module.exports = {
  login,
  register
};
