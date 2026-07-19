const cron = require('node-cron');
const prisma = require('../config/db');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const Holidays = require('date-holidays');

const hd = new Holidays('CO');

dayjs.extend(utc);
dayjs.extend(timezone);

const EMPRESA_TZ = process.env.TZ || 'America/Bogota';
dayjs.tz.setDefault(EMPRESA_TZ);

const startCronJobs = () => {
  // 1. Ejecutar de Lunes a Sábado a las 00:05 (Creación diaria de ausencias, omitiendo domingos)
  cron.schedule('5 0 * * 1-6', async () => {
    console.log('[CRON] Iniciando proceso de verificación de ausencias...', new Date());

    try {
      const hoyStr = dayjs.tz().format('YYYY-MM-DD');
      const hoy = new Date(hoyStr + 'T00:00:00.000Z');

      // Validación adicional: si es domingo (0), no hacer nada
      if (dayjs.tz().day() === 0) {
        console.log('[CRON] Hoy es domingo, se omite la verificación de ausencias.');
        return;
      }

      // Validación adicional: si es festivo en Colombia, no hacer nada
      if (hd.isHoliday(new Date(hoyStr + 'T12:00:00Z'))) {
        console.log(`[CRON] Hoy es festivo, se omite la verificación de ausencias.`);
        return;
      }

      // 1. Asegurar que el estado "VACACIONES" exista
      let estadoVacaciones = await prisma.estadoAsistencia.findUnique({
        where: { nombre: 'VACACIONES' }
      });
      if (!estadoVacaciones) {
        estadoVacaciones = await prisma.estadoAsistencia.create({
          data: { nombre: 'VACACIONES', descripcion: 'Día de vacaciones autorizado' }
        });
      }

      // 2. Obtener el ID del estado "AUSENTE"
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
      let vacacionesMarcadas = 0;

      for (const usuario of usuariosActivos) {
        // Verificar si el usuario ya tiene un registro de asistencia hoy
        const asistenciaHoy = await prisma.asistencia.findFirst({
          where: {
            usuarioId: usuario.id,
            fecha: hoy
          }
        });

        // Verificar fecha de inicio de labores
        if (usuario.fechaInicioLabores) {
          const fechaInicio = dayjs.utc(usuario.fechaInicioLabores).tz(EMPRESA_TZ, true).startOf('day');
          const hoyTz = dayjs(hoy).tz();
          if (hoyTz.isBefore(fechaInicio)) {
            continue; // El empleado aún no ingresa a laborar, omitir
          }
        }

        const dayOfWeek = dayjs(hoy).day();
        const configDia = usuario.horarioDetalles?.[dayOfWeek] || { laboral: false };
        if (!configDia.laboral) {
          continue; // El empleado tiene el día libre hoy, no marcar ausencia
        }

        // Si no tiene asistencia, evaluamos si está de vacaciones
        if (!asistenciaHoy) {
          let esVacacion = false;
          if (usuario.enVacaciones && usuario.vacacionesInicio && usuario.vacacionesFin) {
            const inicio = dayjs.utc(usuario.vacacionesInicio).tz(EMPRESA_TZ, true).startOf('day');
            const fin = dayjs.utc(usuario.vacacionesFin).tz(EMPRESA_TZ, true).endOf('day');
            const hoyTz = dayjs(hoy).tz();

            if (hoyTz.isAfter(inicio.subtract(1, 'second')) && hoyTz.isBefore(fin.add(1, 'second'))) {
              esVacacion = true;
            }
          }

          if (esVacacion) {
            await prisma.asistencia.create({
              data: {
                fecha: hoy,
                usuarioId: usuario.id,
                sedeId: usuario.sedeId,
                estadoId: estadoVacaciones.id,
                observaciones: 'Ausencia por vacaciones autorizadas'
              }
            });
            vacacionesMarcadas++;
          } else {
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
      }

      console.log(`[CRON] Verificación completada. Ausentes: ${ausentesMarcados}, Vacaciones: ${vacacionesMarcadas}.`);

    } catch (error) {
      console.error('[CRON] Error al verificar ausencias:', error);
    }
  }, {
    scheduled: true,
    timezone: EMPRESA_TZ
  });

  // 1.5. Ejecutar de Lunes a Sábado a las 19:00 (Auto-salida para quienes no acumulan extras)
  cron.schedule('0 19 * * 1-6', async () => {
    console.log('[CRON] Iniciando proceso de auto-salida (19:00)...', new Date());

    try {
      const hoyStr = dayjs.tz().format('YYYY-MM-DD');
      const hoy = new Date(hoyStr + 'T00:00:00.000Z');

      if (dayjs.tz().day() === 0 || hd.isHoliday(new Date(hoyStr + 'T12:00:00Z'))) {
        return;
      }

      const asistenciasPendientes = await prisma.asistencia.findMany({
        where: {
          fecha: hoy,
          horaSalida: null,
          usuario: {
            puedeAcumularExtras: false,
            rol: { nombre: 'EMPLEADO' },
            activo: true
          }
        },
        include: {
          usuario: true
        }
      });

      let autoSalidasMarcadas = 0;

      for (const asistencia of asistenciasPendientes) {
        const dayOfWeek = dayjs.tz().day();
        const configDia = asistencia.usuario.horarioDetalles?.[dayOfWeek];
        
        if (configDia && configDia.laboral && configDia.fin) {
          const horaFinStr = configDia.fin;

          const fullDateSalidaObj = dayjs.tz(`${hoyStr}T${horaFinStr}`).toDate();

          let observaciones = asistencia.observaciones || '';
          observaciones += '\n[Sistema] Salida marcada automáticamente a la hora de fin de turno asignada.';
          
          await prisma.asistencia.update({
            where: { id: asistencia.id },
            data: {
              horaSalida: fullDateSalidaObj,
              observaciones: observaciones.trim()
            }
          });
          autoSalidasMarcadas++;
        }
      }

      console.log(`[CRON] Auto-salida completada. Registros actualizados: ${autoSalidasMarcadas}.`);

    } catch (error) {
      console.error('[CRON] Error al ejecutar auto-salida:', error);
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
  // Deshabilitado temporalmente a petición del usuario para evitar llenar de ausentismos viejos.
  console.log('[STARTUP] La verificación de inasistencias pasadas está deshabilitada.');
  return;

  console.log(`[STARTUP] Verificando inasistencias pasadas (últimos ${daysBack} días)...`);
  try {
    // Asegurar estado VACACIONES en verificación retroactiva
    let estadoVacaciones = await prisma.estadoAsistencia.findUnique({
      where: { nombre: 'VACACIONES' }
    });
    if (!estadoVacaciones) {
      estadoVacaciones = await prisma.estadoAsistencia.create({
        data: { nombre: 'VACACIONES', descripcion: 'Día de vacaciones autorizado' }
      });
    }

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
    let totalVacacionesRetroactivos = 0;

    for (let i = 1; i <= daysBack; i++) {
      const fechaCheckTz = dayjs.tz().subtract(i, 'day');
      const fechaCheckStr = fechaCheckTz.format('YYYY-MM-DD');
      const fechaObj = new Date(fechaCheckStr + 'T00:00:00.000Z');

      // Omitir la validación si la fecha a evaluar es domingo
      if (fechaCheckTz.day() === 0) {
        continue;
      }

      // Omitir la validación si la fecha a evaluar es festivo en Colombia
      if (hd.isHoliday(new Date(fechaCheckStr + 'T12:00:00Z'))) {
        continue;
      }

      for (const usuario of usuariosActivos) {
        // Ignorar si el usuario fue creado después de esa fecha
        const userCreated = dayjs(usuario.creadoEn).tz().format('YYYY-MM-DD');
        if (fechaCheckStr < userCreated) continue;

        // Verificar fecha de inicio de labores
        if (usuario.fechaInicioLabores) {
          const fechaInicio = dayjs.utc(usuario.fechaInicioLabores).tz(EMPRESA_TZ, true).startOf('day');
          if (fechaCheckTz.isBefore(fechaInicio)) continue;
        }

        // Verificar horarioDetalles para este día de la semana
        const dayOfWeek = fechaCheckTz.day();
        const configDia = usuario.horarioDetalles?.[dayOfWeek] || { laboral: false };
        if (!configDia.laboral) continue;

        const asistencia = await prisma.asistencia.findFirst({
          where: {
            usuarioId: usuario.id,
            fecha: fechaObj
          }
        });

        if (!asistencia) {
          let esVacacion = false;
          if (usuario.enVacaciones && usuario.vacacionesInicio && usuario.vacacionesFin) {
            const inicio = dayjs(usuario.vacacionesInicio).tz().startOf('day');
            const fin = dayjs(usuario.vacacionesFin).tz().endOf('day');
            const targetTz = dayjs(fechaObj).tz();

            if (targetTz.isAfter(inicio.subtract(1, 'second')) && targetTz.isBefore(fin.add(1, 'second'))) {
              esVacacion = true;
            }
          }

          if (esVacacion) {
            await prisma.asistencia.create({
              data: {
                fecha: fechaObj,
                usuarioId: usuario.id,
                sedeId: usuario.sedeId,
                estadoId: estadoVacaciones.id,
                observaciones: 'Ausencia por vacaciones autorizadas (auto-recuperado)'
              }
            });
            totalVacacionesRetroactivos++;
          } else {
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
    }

    if (totalAusentesRetroactivos > 0 || totalVacacionesRetroactivos > 0) {
      console.log(`[STARTUP] Auto-recuperación: ${totalAusentesRetroactivos} Ausentes, ${totalVacacionesRetroactivos} Vacaciones.`);
    } else {
      console.log(`[STARTUP] El historial de asistencias está al día.`);
    }

  } catch (error) {
    console.error('[STARTUP] Error al verificar ausencias pasadas:', error);
  }
};

module.exports = { startCronJobs, checkPastAbsences };
