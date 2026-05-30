const prisma = require('../config/db');
const dayjs = require('dayjs');
const bcrypt = require('bcrypt');

const getDashboardStats = async (req, res) => {
  try {
    const hoy = new Date(dayjs().format('YYYY-MM-DD') + 'T00:00:00.000Z');

    // 1. Empleados Activos
    const empleadosActivos = await prisma.usuario.findMany({
      where: {
        activo: true,
        rol: { nombre: 'EMPLEADO' } // Solo contamos empleados, no admins
      },
      select: {
        id: true,
        nombre: true,
        apellido: true,
        sede: { select: { nombre: true } }
      }
    });
    const totalEmpleados = empleadosActivos.length;

    // 2. Asistencias de hoy
    const asistenciasHoy = await prisma.asistencia.findMany({
      where: { fecha: hoy },
      include: {
        usuario: {
          select: { id: true, nombre: true, apellido: true }
        },
        sede: { select: { nombre: true } },
        estado: { select: { nombre: true } }
      },
      orderBy: { horaEntrada: 'desc' }
    });

    // 3. Cálculos de Puntuales y Tardes
    const puntuales = asistenciasHoy.filter(a => a.estado.nombre === 'PUNTUAL').length;
    const tardes = asistenciasHoy.filter(a => a.estado.nombre === 'TARDE').length;
    const enAlmuerzo = asistenciasHoy.filter(a => a.horaSalidaAlmuerzo && !a.horaEntradaAlmuerzo && !a.horaSalida).length;
    
    // 4. Ausentes
    const asistenciasIds = new Set(asistenciasHoy.map(a => a.usuario.id));
    const listaAusentes = empleadosActivos.filter(emp => !asistenciasIds.has(emp.id));
    const ausentes = listaAusentes.length;

    const empleadosAusentesData = listaAusentes.map(emp => ({
      usuario: { nombre: emp.nombre, apellido: emp.apellido },
      sede: { nombre: emp.sede?.nombre || 'No asignada' },
      horaEntrada: null,
      estado: { nombre: 'AUSENTE' }
    }));

    res.json({
      estadisticas: {
        totalEmpleados,
        asistenciasHoy: asistenciasHoy.length,
        puntuales,
        tardes,
        enAlmuerzo,
        ausentes
      },
      registrosRecientes: asistenciasHoy.slice(0, 10),
      empleadosAusentes: empleadosAusentesData
    });

  } catch (error) {
    console.error('Error en getDashboardStats:', error);
    res.status(500).json({ error: 'Error al obtener estadísticas del dashboard' });
  }
};

const getAttendances = async (req, res) => {
  try {
    const { fechaInicio, fechaFin, usuarioId, sedeId } = req.query;
    
    let whereClause = {};

    if (fechaInicio && fechaFin) {
      whereClause.fecha = {
        gte: new Date(fechaInicio),
        lte: new Date(fechaFin)
      };
    }

    if (usuarioId) {
      whereClause.usuarioId = Number(usuarioId);
    }

    if (sedeId) {
      whereClause.sedeId = Number(sedeId);
    }

    const asistencias = await prisma.asistencia.findMany({
      where: whereClause,
      include: {
        usuario: { select: { nombre: true, apellido: true, documento: true } },
        sede: { select: { nombre: true } },
        estado: { select: { nombre: true } }
      },
      orderBy: { fecha: 'desc' }
    });
    
    res.json(asistencias);
  } catch (error) {
    console.error('Error en getAttendances:', error);
    res.status(500).json({ error: 'Error al obtener historial de asistencias' });
  }
};

const deleteAttendance = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.asistencia.delete({
      where: { id: Number(id) }
    });
    res.json({ message: 'Registro de asistencia eliminado correctamente' });
  } catch (error) {
    console.error('Error en deleteAttendance:', error);
    res.status(500).json({ error: 'Error al eliminar el registro de asistencia' });
  }
};

// CRUD Empleados
const getUsers = async (req, res) => {
  try {
    const usuarios = await prisma.usuario.findMany({
      include: {
        rol: true,
        sede: true,
        horario: true
      },
      orderBy: { creadoEn: 'desc' }
    });
    res.json(usuarios);
  } catch (error) {
    console.error('Error en getUsers:', error);
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
};

const createUser = async (req, res) => {
  try {
    const { documento, nombre, apellido, correo, contrasena, rolId, sedeId, horarioId, horaInicioAlmuerzo, horaFinAlmuerzo, activo } = req.body;
    
    const hashedPassword = await bcrypt.hash(contrasena, 10);
    
    const nuevoUsuario = await prisma.usuario.create({
      data: {
        documento,
        nombre,
        apellido,
        correo,
        contrasena: hashedPassword,
        rolId: Number(rolId),
        sedeId: Number(sedeId),
        horarioId: Number(horarioId),
        horaInicioAlmuerzo: horaInicioAlmuerzo || null,
        horaFinAlmuerzo: horaFinAlmuerzo || null,
        activo: activo !== undefined ? activo : true
      }
    });
    
    res.status(201).json(nuevoUsuario);
  } catch (error) {
    console.error('Error en createUser:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'El documento o correo ya existe' });
    }
    res.status(500).json({ error: 'Error al crear usuario' });
  }
};

const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { documento, nombre, apellido, correo, contrasena, rolId, sedeId, horarioId, horaInicioAlmuerzo, horaFinAlmuerzo, activo } = req.body;
    
    let dataToUpdate = {
      documento,
      nombre,
      apellido,
      correo,
      rolId: Number(rolId),
      sedeId: Number(sedeId),
      horarioId: Number(horarioId),
      horaInicioAlmuerzo: horaInicioAlmuerzo || null,
      horaFinAlmuerzo: horaFinAlmuerzo || null,
    };

    if (activo !== undefined) {
      dataToUpdate.activo = activo;
    }

    if (contrasena && contrasena.trim() !== '') {
      dataToUpdate.contrasena = await bcrypt.hash(contrasena, 10);
    }

    const usuarioActualizado = await prisma.usuario.update({
      where: { id: Number(id) },
      data: dataToUpdate
    });
    
    res.json(usuarioActualizado);
  } catch (error) {
    console.error('Error en updateUser:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'El documento o correo ya existe' });
    }
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
};

const toggleUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    
    const usuario = await prisma.usuario.findUnique({ where: { id: Number(id) } });
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });

    const usuarioActualizado = await prisma.usuario.update({
      where: { id: Number(id) },
      data: { activo: !usuario.activo }
    });
    
    res.json(usuarioActualizado);
  } catch (error) {
    console.error('Error en toggleUserStatus:', error);
    res.status(500).json({ error: 'Error al cambiar estado del usuario' });
  }
};

const getFormData = async (req, res) => {
  try {
    const roles = await prisma.rol.findMany();
    const sedes = await prisma.sede.findMany({ where: { activo: true } });
    const horarios = await prisma.horario.findMany({ where: { activo: true } });
    
    res.json({ roles, sedes, horarios });
  } catch (error) {
    console.error('Error en getFormData:', error);
    res.status(500).json({ error: 'Error al obtener datos para el formulario' });
  }
};

const approveExtras = async (req, res) => {
  try {
    const { id } = req.params;
    const { minutosAprobados } = req.body;
    
    if (minutosAprobados === undefined) {
      return res.status(400).json({ error: 'Faltan los minutos aprobados' });
    }

    const asistenciaActualizada = await prisma.asistencia.update({
      where: { id: Number(id) },
      data: { minutosExtraAprobados: Number(minutosAprobados) }
    });
    
    res.json({ mensaje: 'Horas extras aprobadas correctamente', asistencia: asistenciaActualizada });
  } catch (error) {
    console.error('Error en approveExtras:', error);
    res.status(500).json({ error: 'Error al aprobar horas extras' });
  }
};

module.exports = {
  getDashboardStats,
  getAttendances,
  deleteAttendance,
  getUsers,
  createUser,
  updateUser,
  toggleUserStatus,
  getFormData,
  approveExtras
};
