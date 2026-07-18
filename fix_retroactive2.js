const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { checkPastAbsences } = require('./BackEnd/src/services/cron.service.js');

async function run() {
  console.log('Eliminando asistencias retroactivas previas al 13 de julio (11 y 12)...');
  const deleted = await prisma.asistencia.deleteMany({
    where: {
      fecha: {
        lt: new Date('2026-07-13T00:00:00.000Z')
      },
      estado: {
        nombre: 'AUSENTE'
      }
    }
  });
  console.log(`Borrados: ${deleted.count} registros de ausentismo del 11/12 de julio.`);
  
  console.log('Re-ejecutando recuperación de ausentismos para poblar el 13 de julio...');
  await checkPastAbsences(7);
  console.log('Recuperación terminada.');
  
  process.exit(0);
}

run();
