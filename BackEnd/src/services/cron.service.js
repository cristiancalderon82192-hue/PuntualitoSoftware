const cron = require('node-cron');
const prisma = require('../config/db');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');

dayjs.extend(utc);
dayjs.extend(timezone);

const EMPRESA_TZ = process.env.TZ || 'America/Bogota';
dayjs.tz.setDefault(EMPRESA_TZ);

const startCronJobs = () => {
  // 1. Ejecutar todos los días a las 23:59 (Verificación diaria de ausencias)
  cron.schedule('59 23 * * *', async () => {
    console.log('[CRON] Iniciando proceso de verificación de ausencias...', new Date());
    
    try {
      const hoy = new Date(dayjs.tz().format('YYYY-MM-DD') + 'T00:00:00.000Z');

      // Obtener el ID del estado "AUSENTE"
      const estadoAusente = await prisma.estadoAsistencia.findUnique({
        where: { nombre: 'AUSENTE' }
      });

      if (!estadoAusente) {
        console.error('[CRON] ERROR: No se encontró el estado de asistencia "AUSENTE".');
        return;
      }

      // Obtener usuarios activos que sean empleados
      const usuariosActivos = await prisma.usuario.findMany({
        where: { 
          activo: true,
          rol: { nombre: 'EMPLEADO' }
        }
      });

      let ausentesMarcados = 0;

      for (const usuario of usuariosActivos) {
        // Verificar si el usuario ya tiene un registro de asistencia hoy
        const asistenciaHoy = await prisma.asistencia.findFirst({
          where: {
            usuarioId: usuario.id,
            fecha: hoy
          }
        });

        // Si no tiene asistencia, se marca como AUSENTE
        if (!asistenciaHoy) {
          await prisma.asistencia.create({
            data: {
              fecha: hoy,
              usuarioId: usuario.id,
              sedeId: usuario.sedeId,
              estadoId: estadoAusente.id,
              observaciones: 'ausentismo laboral'
            }
          });
          ausentesMarcados++;
        }
      }

      console.log(`[CRON] Verificación completada. Se marcaron ${ausentesMarcados} empleados como ausentes.`);
      
    } catch (error) {
      console.error('[CRON] Error al verificar ausencias:', error);
    }
  }, {
    scheduled: true,
    timezone: EMPRESA_TZ
  });

  // 2. Auto-Ping cada 14 minutos para mantener Render despierto (solo en producción)
  cron.schedule('*/14 * * * *', async () => {
    // RENDER_EXTERNAL_URL es proporcionada automáticamente por Render
    const url = process.env.RENDER_EXTERNAL_URL || process.env.SERVER_URL || `http://localhost:${process.env.PORT || 5000}`;
    
    // Solo hacemos ping si realmente estamos en la nube (o si hay URL externa)
    if (process.env.RENDER_EXTERNAL_URL || process.env.SERVER_URL) {
      try {
        await fetch(url);
        console.log(`[PING] Auto-ping exitoso a ${url} para mantener el servidor activo.`);
      } catch (err) {
        console.error(`[PING] Error en auto-ping a ${url}:`, err.message);
      }
    }
  });
};

const checkPastAbsences = async (daysBack = 15) => {
  console.log(`[STARTUP] Verificando inasistencias pasadas (últimos ${daysBack} días)...`);
  try {
    const estadoAusente = await prisma.estadoAsistencia.findUnique({
      where: { nombre: 'AUSENTE' }
    });

    if (!estadoAusente) {
      console.error('[STARTUP] ERROR: No se encontró el estado de asistencia "AUSENTE".');
      return;
    }

    const usuariosActivos = await prisma.usuario.findMany({
      where: { 
        activo: true,
        rol: { nombre: 'EMPLEADO' }
      }
    });

    let totalAusentesRetroactivos = 0;

    for (let i = 1; i <= daysBack; i++) {
      const fechaCheckStr = dayjs.tz().subtract(i, 'day').format('YYYY-MM-DD');
      const fechaObj = new Date(fechaCheckStr + 'T00:00:00.000Z');

      for (const usuario of usuariosActivos) {
        // Ignorar si el usuario fue creado después de esa fecha
        const userCreated = dayjs(usuario.creadoEn).tz().format('YYYY-MM-DD');
        if (fechaCheckStr < userCreated) continue;

        const asistencia = await prisma.asistencia.findFirst({
          where: {
            usuarioId: usuario.id,
            fecha: fechaObj
          }
        });

        if (!asistencia) {
          await prisma.asistencia.create({
            data: {
              fecha: fechaObj,
              usuarioId: usuario.id,
              sedeId: usuario.sedeId,
              estadoId: estadoAusente.id,
              observaciones: 'ausentismo laboral (auto-recuperado)'
            }
          });
          totalAusentesRetroactivos++;
        }
      }
    }

    if (totalAusentesRetroactivos > 0) {
      console.log(`[STARTUP] Se generaron ${totalAusentesRetroactivos} inasistencias pasadas que no estaban registradas.`);
    } else {
      console.log(`[STARTUP] El historial de asistencias está al día.`);
    }

  } catch (error) {
    console.error('[STARTUP] Error al verificar ausencias pasadas:', error);
  }
};

module.exports = { startCronJobs, checkPastAbsences };
