const prisma = require('../config/db');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');

dayjs.extend(utc);
dayjs.extend(timezone);
const EMPRESA_TZ = process.env.TZ || 'America/Bogota';
dayjs.tz.setDefault(EMPRESA_TZ);

const getDashboardStats = async (req, res) => {
  try {
    const hoy = new Date(dayjs.tz().format('YYYY-MM-DD') + 'T00:00:00.000Z');

    // 1. Total Empleados Activos (Consulta Count)
    const totalEmpleados = await prisma.usuario.count({
      where: {
        activo: true,
        rol: { nombre: 'EMPLEADO' } // Solo contamos empleados, no admins
      }
    });

    // 2. Asistencias Hoy (Count total)
    const totalAsistenciasHoy = await prisma.asistencia.count({
      where: { fecha: hoy, usuario: { rol: { nombre: 'EMPLEADO' } } }
    });

    // 3. Cálculos de Puntuales, Tardes y Almuerzo (Delegados a la BD)
    const puntuales = await prisma.asistencia.count({
      where: { fecha: hoy, estado: { nombre: 'PUNTUAL' }, usuario: { rol: { nombre: 'EMPLEADO' } } }
    });

    const tardes = await prisma.asistencia.count({
      where: { fecha: hoy, estado: { nombre: 'TARDE' }, usuario: { rol: { nombre: 'EMPLEADO' } } }
    });

    const enAlmuerzo = await prisma.asistencia.count({
      where: {
        fecha: hoy,
        horaSalidaAlmuerzo: { not: null },
        horaEntradaAlmuerzo: null,
        horaSalida: null,
        usuario: { rol: { nombre: 'EMPLEADO' } }
      }
    });

    // 4. Ausentes (Usuarios activos sin registro hoy o con registro AUSENTE)
    const listaAusentes = await prisma.usuario.findMany({
      where: {
        activo: true,
        rol: { nombre: 'EMPLEADO' },
        OR: [
          { asistencias: { none: { fecha: hoy } } },
          { asistencias: { some: { fecha: hoy, estado: { nombre: 'AUSENTE' } } } }
        ]
      },
      select: {
        nombre: true,
        apellido: true,
        sede: { select: { nombre: true } }
      }
    });

    const ausentes = listaAusentes.length;

    const empleadosAusentesData = listaAusentes.map(emp => ({
      usuario: { nombre: emp.nombre, apellido: emp.apellido },
      sede: { nombre: emp.sede?.nombre || 'No asignada' },
      horaEntrada: null,
      estado: { nombre: 'AUSENTE' }
    }));

    // 5. Registros Recientes (Paginados con take: 10, excluyendo ausencias automáticas/manuales)
    const registrosRecientes = await prisma.asistencia.findMany({
      where: {
        fecha: hoy,
        usuario: { rol: { nombre: 'EMPLEADO' } },
        estado: { nombre: { not: 'AUSENTE' } }
      },
      take: 10,
      include: {
        usuario: {
          select: { id: true, nombre: true, apellido: true }
        },
        sede: { select: { nombre: true } },
        estado: { select: { nombre: true } }
      },
      orderBy: { horaEntrada: 'desc' }
    });

    res.json({
      estadisticas: {
        totalEmpleados,
        asistenciasHoy: totalAsistenciasHoy,
        puntuales,
        tardes,
        enAlmuerzo,
        ausentes
      },
      registrosRecientes,
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
        usuario: { select: { nombre: true, apellido: true, documento: true, horaFinAlmuerzo: true } },
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
    const { documento, nombre, apellido, correo, contrasena, rolId, sedeId, horarioId, horaInicioAlmuerzo, horaFinAlmuerzo, activo, rostroDescriptor } = req.body;

    const hashedPassword = await bcrypt.hash(contrasena, 10);

    const dataToCreate = {
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
      activo: Boolean(activo),
      rostroDescriptor: rostroDescriptor || null
    };

    const nuevoUsuario = await prisma.usuario.create({
      data: dataToCreate
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
    const { documento, nombre, apellido, correo, contrasena, rolId, sedeId, horarioId, horaInicioAlmuerzo, horaFinAlmuerzo, activo, rostroDescriptor, fotoBase64 } = req.body;

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

    if (rostroDescriptor) {
      dataToUpdate.rostroDescriptor = rostroDescriptor;
    }

    if (fotoBase64) {
      const base64Data = fotoBase64.replace(/^data:image\/\w+;base64,/, "");
      const filename = `perfil_${documento}_${Date.now()}.jpg`;
      const uploadPath = path.join(__dirname, '../../public/uploads/perfiles', filename);

      const dir = path.dirname(uploadPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(uploadPath, base64Data, 'base64');
      dataToUpdate.fotoPerfilUrl = `/uploads/perfiles/${filename}`;
    }

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

const getLateArrivalsReport = async (req, res) => {
  try {
    const causas = await prisma.causaTardanza.findMany({
      where: { activo: true }
    });

    let reportData = causas.map(c => ({ name: c.nombre, count: 0 }));
    let otrosCount = 0;

    const tardanzas = await prisma.asistencia.findMany({
      where: {
        OR: [
          { causaTardanza: { not: null } },
          { causaTardanzaAlmuerzo: { not: null } }
        ]
      },
      select: { causaTardanza: true, causaTardanzaAlmuerzo: true }
    });

    tardanzas.forEach(t => {
      if (t.causaTardanza) {
        const reportItem = reportData.find(item => item.name === t.causaTardanza);
        if (reportItem) reportItem.count += 1;
        else otrosCount += 1;
      }
      if (t.causaTardanzaAlmuerzo) {
        const reportItem = reportData.find(item => item.name === t.causaTardanzaAlmuerzo);
        if (reportItem) reportItem.count += 1;
        else otrosCount += 1;
      }
    });

    if (otrosCount > 0) {
      reportData.push({ name: 'Otros / Sin especificar', count: otrosCount });
    }

    res.json(reportData.filter(item => item.count > 0));
  } catch (error) {
    console.error('Error en getLateArrivalsReport:', error);
    res.status(500).json({ error: 'Error al obtener reporte de tardanzas' });
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
  approveExtras,
  getLateArrivalsReport
};
