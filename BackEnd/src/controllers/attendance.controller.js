const prisma = require('../config/db');
const { calcularDistancia } = require('../utils/haversine');
const dayjs = require('dayjs');
const customParseFormat = require('dayjs/plugin/customParseFormat');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const Holidays = require('date-holidays');

const hd = new Holidays('CO');

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
      include: { sede: true }
    });

    const causasTardanza = await prisma.causaTardanza.findMany({
      where: { activo: true },
      orderBy: { nombre: 'asc' }
    });

    const dayOfWeek = dayjs.tz().day();
    const configDia = usuario?.horarioDetalles?.[dayOfWeek] || { laboral: false };
    
    // Si la configuración del día incluye 'tieneAlmuerzo', se respeta. Si no, por defecto es true.
    const tieneAlmuerzo = configDia.tieneAlmuerzo ?? true;
    
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
      horaFinJornada: configDia.laboral ? configDia.fin : null
    };

    if (!asistencia) {
      return res.json({ status: 'PENDIENTE_ENTRADA', asistencia: null, tieneAlmuerzo, sede: infoSede, timeLimits, causasTardanza });
    }

    if (asistencia.estado?.nombre === 'AUSENTE') {
      if (!asistencia.horaEntrada) {
        return res.json({ status: 'PENDIENTE_ENTRADA', asistencia, tieneAlmuerzo, sede: infoSede, timeLimits, causasTardanza });
      }
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
      include: { sede: true }
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
      where: { usuarioId, fecha: hoy },
      include: { estado: true }
    });

    const dayOfWeek = dayjs.tz().day();
    const isHoliday = hd.isHoliday(new Date(dayjs.tz().format('YYYY-MM-DD') + 'T12:00:00Z'));
    const horarioDetalles = usuario.horarioDetalles || {};
    const configDia = horarioDetalles[dayOfWeek] || { laboral: false };
    const isFreeDay = !configDia.laboral || isHoliday;

    if (action === 'ENTRADA') {
      if (asistenciaExistente && asistenciaExistente.horaEntrada) return res.status(400).json({ error: 'Ya registraste tu llegada hoy' });

      const horaActualStr = dayjs.tz().format('HH:mm:ss');
      let estadoAsistencia = 'PUNTUAL';
      let minutosTarde = 0;
      
      if (!isFreeDay && configDia.inicio) {
        const limitePuntual = dayjs(configDia.inicio, 'HH:mm').tz().add(usuario.minutosTolerancia || 15, 'minute');
        const isTarde = dayjs(horaActualStr, 'HH:mm:ss').tz().isAfter(limitePuntual);
        if (isTarde) {
          estadoAsistencia = 'TARDE';
          const horaInicioObj = dayjs(configDia.inicio, 'HH:mm').tz();
          const horaActualObj = dayjs(horaActualStr, 'HH:mm:ss').tz();
          minutosTarde = horaActualObj.diff(horaInicioObj, 'minute');
          if (minutosTarde < 0) minutosTarde = 0;
        }
      }
      
      const estadoObj = await prisma.estadoAsistencia.findUnique({ where: { nombre: estadoAsistencia } });

      let nuevaAsistencia;
      if (asistenciaExistente) {
        nuevaAsistencia = await prisma.asistencia.update({
          where: { id: asistenciaExistente.id },
          data: {
            horaEntrada: new Date(),
            latitudEntrada: latitud,
            longitudEntrada: longitud,
            sedeId: sedeDetectada.id,
            estadoId: estadoObj.id,
            minutosTarde,
            observaciones: null
          },
          include: { estado: true }
        });
      } else {
        nuevaAsistencia = await prisma.asistencia.create({
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
      }

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
      if (usuario.puedeAcumularExtras) {
        const horaActualObj = dayjs().tz();
        
        if (isFreeDay) {
          if (asistenciaExistente.horaEntrada) {
            const horaEntradaObj = dayjs(asistenciaExistente.horaEntrada).tz();
            minutosExtra = horaActualObj.diff(horaEntradaObj, 'minute');
          }
        } else if (configDia.fin) {
          const horaFinArr = configDia.fin.split(':');
          let limiteSalidaObj = dayjs().tz()
            .hour(parseInt(horaFinArr[0]))
            .minute(parseInt(horaFinArr[1]))
            .second(parseInt(horaFinArr[2] || 0));
          
          const diffMinutes = horaActualObj.diff(limiteSalidaObj, 'minute');
          if (diffMinutes > 0) {
            minutosExtra = diffMinutes;
          }
        }
        if (minutosExtra < 0) minutosExtra = 0;
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
