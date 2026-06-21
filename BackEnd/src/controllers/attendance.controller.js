const prisma = require('../config/db');
const { calcularDistancia } = require('../utils/haversine');
const dayjs = require('dayjs');
const customParseFormat = require('dayjs/plugin/customParseFormat');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');

dayjs.extend(customParseFormat);
dayjs.extend(utc);
dayjs.extend(timezone);

// Configurar la zona horaria de la empresa (Ej: America/Bogota, America/Lima, America/Mexico_City)
const EMPRESA_TZ = process.env.TZ || 'America/Bogota';
dayjs.tz.setDefault(EMPRESA_TZ);

const getAttendanceStatus = async (req, res) => {
  try {
    const usuarioId = req.usuario.id;
    const hoy = new Date(dayjs.tz().format('YYYY-MM-DD') + 'T00:00:00.000Z');
    
    const asistencia = await prisma.asistencia.findFirst({
      where: { usuarioId, fecha: hoy },
      include: { estado: true, sede: true }
    });

    const usuario = await prisma.usuario.findUnique({
      where: { id: usuarioId },
      include: { horario: true, sede: true }
    });

    const causasTardanza = await prisma.causaTardanza.findMany({
      where: { activo: true },
      orderBy: { nombre: 'asc' }
    });

    const tieneAlmuerzo = true; // El almuerzo está disponible para todos
    
    let infoSede = null;
    if (asistencia && asistencia.sede) {
      infoSede = {
        latitud: asistencia.sede.latitud,
        longitud: asistencia.sede.longitud,
        radioPermitido: asistencia.sede.radioPermitido
      };
    } else if (usuario?.sede) {
      infoSede = { 
        latitud: usuario.sede.latitud, 
        longitud: usuario.sede.longitud, 
        radioPermitido: usuario.sede.radioPermitido 
      };
    }

    const timeLimits = {
      horaInicioAlmuerzo: null,
      horaFinAlmuerzo: null,
      horaFinJornada: usuario?.horario?.horaFin
    };

    if (!asistencia) {
      return res.json({ status: 'PENDIENTE_ENTRADA', asistencia: null, tieneAlmuerzo, sede: infoSede, timeLimits, causasTardanza });
    }

    if (asistencia.estado?.nombre === 'AUSENTE') {
      return res.json({ status: 'AUSENTE', asistencia, tieneAlmuerzo, sede: infoSede, timeLimits, causasTardanza });
    }

    const requireJustification = asistencia?.estado?.nombre === 'TARDE' && !asistencia.observaciones && !asistencia.evidenciaUrl;
    const yaAlmorzo = !!asistencia?.horaSalidaAlmuerzo;
    
    let requireLunchJustification = false; // Ya no se calcula la tardanza del almuerzo

    if (asistencia.horaSalida) {
      return res.json({ status: 'JORNADA_FINALIZADA', asistencia, tieneAlmuerzo, sede: infoSede, timeLimits, requireJustification, requireLunchJustification, yaAlmorzo, causasTardanza });
    }

    if (asistencia.horaSalidaAlmuerzo && !asistencia.horaEntradaAlmuerzo) {
      return res.json({ status: 'EN_ALMUERZO', asistencia, tieneAlmuerzo, sede: infoSede, timeLimits, requireJustification, requireLunchJustification, yaAlmorzo, causasTardanza });
    }

    return res.json({ status: 'TRABAJANDO', asistencia, tieneAlmuerzo, sede: infoSede, timeLimits, requireJustification, requireLunchJustification, yaAlmorzo, causasTardanza });

  } catch (error) {
    console.error('Error en getAttendanceStatus:', error);
    res.status(500).json({ error: 'Error al obtener el estado de asistencia', details: error.message });
  }
};

const checkIn = async (req, res) => {
  try {
    const { latitud, longitud, action = 'ENTRADA' } = req.body;
    const usuarioId = req.usuario.id;

    if (!latitud || !longitud) {
      return res.status(400).json({ error: 'La ubicación GPS es requerida' });
    }

    const usuario = await prisma.usuario.findUnique({
      where: { id: usuarioId },
      include: { sede: true, horario: true }
    });

    if (!usuario || !usuario.activo) {
      return res.status(403).json({ error: 'Usuario inactivo o no encontrado' });
    }

    let sedeDetectada = usuario.sede;
    let distancia = calcularDistancia(
      Number(sedeDetectada.latitud), Number(sedeDetectada.longitud), 
      Number(latitud), Number(longitud)
    );

    let dentroDeGeocerca = distancia <= sedeDetectada.radioPermitido;

    // Si no está en su sede asignada, buscar en todas las demás sedes activas
    if (action !== 'SALIDA' && !dentroDeGeocerca) {
      const todasLasSedes = await prisma.sede.findMany({ where: { activo: true } });
      for (const otraSede of todasLasSedes) {
        if (otraSede.id === sedeDetectada.id) continue;
        const d = calcularDistancia(
          Number(otraSede.latitud), Number(otraSede.longitud), 
          Number(latitud), Number(longitud)
        );
        if (d <= otraSede.radioPermitido) {
          sedeDetectada = otraSede;
          distancia = d;
          dentroDeGeocerca = true;
          break;
        }
      }
    }

    if (action !== 'SALIDA' && !dentroDeGeocerca) {
      return res.status(403).json({ 
        error: `No estás dentro de la geocerca de ninguna sede. Estás a ${Math.round(distancia)} metros de tu sede principal.` 
      });
    }

    const hoy = new Date(dayjs.tz().format('YYYY-MM-DD') + 'T00:00:00.000Z');
    const asistenciaExistente = await prisma.asistencia.findFirst({
      where: { usuarioId, fecha: hoy }
    });

    if (action === 'ENTRADA') {
      if (asistenciaExistente) return res.status(400).json({ error: 'Ya registraste tu llegada hoy' });
      if (!horario) return res.status(400).json({ error: 'No tienes un horario asignado. Contacta al administrador.' });

      const horaActualStr = dayjs.tz().format('HH:mm:ss');
      const limitePuntual = dayjs(horario.horaInicio, 'HH:mm:ss').tz().add(horario.minutosTolerancia, 'minute');
      const isTarde = dayjs(horaActualStr, 'HH:mm:ss').tz().isAfter(limitePuntual);
      const estadoAsistencia = isTarde ? 'TARDE' : 'PUNTUAL';
      
      let minutosTarde = 0;
      if (isTarde) {
        const horaInicioObj = dayjs(horario.horaInicio, 'HH:mm:ss').tz();
        const horaActualObj = dayjs(horaActualStr, 'HH:mm:ss').tz();
        minutosTarde = horaActualObj.diff(horaInicioObj, 'minute');
        if (minutosTarde < 0) minutosTarde = 0;
      }
      
      const estadoObj = await prisma.estadoAsistencia.findUnique({ where: { nombre: estadoAsistencia } });

      const nuevaAsistencia = await prisma.asistencia.create({
        data: {
          fecha: hoy,
          horaEntrada: new Date(),
          latitudEntrada: latitud,
          longitudEntrada: longitud,
          usuarioId,
          sedeId: sedeDetectada.id,
          estadoId: estadoObj.id,
          minutosTarde
        },
        include: { estado: true }
      });

      return res.status(201).json({
        mensaje: `Entrada registrada. Estado: ${estadoAsistencia}`,
        asistencia: nuevaAsistencia,
        isTarde: estadoAsistencia === 'TARDE',
        distancia: Math.round(distancia)
      });
    }

    if (!asistenciaExistente) return res.status(400).json({ error: 'No has registrado tu entrada' });

    if (action === 'SALIDA_ALMUERZO') {
      if (asistenciaExistente.horaSalidaAlmuerzo) return res.status(400).json({ error: 'Ya saliste a almorzar' });
      
      const asistenciaActualizada = await prisma.asistencia.update({
        where: { id: asistenciaExistente.id },
        data: { horaSalidaAlmuerzo: new Date(), latitudSalidaAlmuerzo: latitud, longitudSalidaAlmuerzo: longitud }
      });
      return res.json({ mensaje: 'Salida a almorzar registrada', asistencia: asistenciaActualizada });
    }

    if (action === 'ENTRADA_ALMUERZO') {
      if (!asistenciaExistente.horaSalidaAlmuerzo) return res.status(400).json({ error: 'No has registrado tu salida a almorzar' });
      if (asistenciaExistente.horaEntradaAlmuerzo) return res.status(400).json({ error: 'Ya regresaste de almorzar' });
      
      const asistenciaActualizada = await prisma.asistencia.update({
        where: { id: asistenciaExistente.id },
        data: { 
          horaEntradaAlmuerzo: new Date(), 
          latitudEntradaAlmuerzo: latitud, 
          longitudEntradaAlmuerzo: longitud
        }
      });
      return res.json({ 
        mensaje: 'Regreso de almuerzo registrado', 
        asistencia: asistenciaActualizada
      });
    }

    if (action === 'SALIDA') {
      if (asistenciaExistente.horaSalida) return res.status(400).json({ error: 'Ya registraste tu salida' });
      
      let minutosExtra = 0;
      if (horario && horario.horaFin && usuario.puedeAcumularExtras) {
        const horaActualObj = dayjs().tz();
        const horaFinArr = horario.horaFin.split(':');
        let limiteSalidaObj = dayjs().tz()
          .hour(parseInt(horaFinArr[0]))
          .minute(parseInt(horaFinArr[1]))
          .second(parseInt(horaFinArr[2] || 0));
        
        const diffMinutes = horaActualObj.diff(limiteSalidaObj, 'minute');
        if (diffMinutes > 0) {
          minutosExtra = diffMinutes;
        }
      }

      const asistenciaActualizada = await prisma.asistencia.update({
        where: { id: asistenciaExistente.id },
        data: { 
          horaSalida: new Date(), 
          latitudSalida: latitud, 
          longitudSalida: longitud,
          minutosExtra 
        }
      });
      return res.json({ mensaje: 'Salida registrada correctamente', asistencia: asistenciaActualizada });
    }

    return res.status(400).json({ error: 'Acción inválida' });

  } catch (error) {
    console.error('Error en checkIn:', error);
    res.status(500).json({ error: `Error interno: ${error.message}` });
  }
};

const justifyAttendance = async (req, res) => {
  try {
    const { id } = req.params;
    const { observaciones, causa, tipo } = req.body;
    const evidenciaUrl = req.file ? `/uploads/${req.file.filename}` : null;

    if (!observaciones) {
      return res.status(400).json({ error: 'Debes enviar una observación obligatoria' });
    }

    const dataToUpdate = {};
    if (tipo === 'ALMUERZO') {
      if (causa) dataToUpdate.causaTardanzaAlmuerzo = causa;
      if (observaciones) dataToUpdate.observacionesAlmuerzo = observaciones;
      if (evidenciaUrl) dataToUpdate.evidenciaAlmuerzoUrl = evidenciaUrl;
    } else {
      if (causa) dataToUpdate.causaTardanza = causa;
      if (observaciones) dataToUpdate.observaciones = observaciones;
      if (evidenciaUrl) dataToUpdate.evidenciaUrl = evidenciaUrl;
    }

    const asistenciaActualizada = await prisma.asistencia.update({
      where: { id: parseInt(id) },
      data: dataToUpdate
    });

    res.json({
      mensaje: 'Justificación guardada correctamente',
      asistencia: asistenciaActualizada
    });

  } catch (error) {
    console.error('Error en justifyAttendance:', error);
    res.status(500).json({ error: 'Error interno al guardar la justificación' });
  }
};

module.exports = {
  getAttendanceStatus,
  checkIn,
  justifyAttendance
};
