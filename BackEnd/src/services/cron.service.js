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
  // Ejecutar todos los días a las 23:59
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
};

module.exports = { startCronJobs };
