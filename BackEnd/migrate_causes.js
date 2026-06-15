const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const causas = await prisma.causaTardanza.findMany();
  const asistencias = await prisma.asistencia.findMany({
    where: {
      estado: { nombre: 'TARDE' }
    }
  });

  let count = 0;
  for (const a of asistencias) {
    if (a.causaTardanza) continue; // Ya tiene la causa guardada
    
    if (a.observaciones) {
      let matchedCausa = null;
      let cleanObs = a.observaciones;

      for (const c of causas) {
        if (a.observaciones.startsWith(c.nombre)) {
          matchedCausa = c.nombre;
          cleanObs = a.observaciones.replace(c.nombre, '').replace(/^:\s*/, '').trim();
          break;
        }
      }

      if (!matchedCausa) {
        matchedCausa = 'OTRO'; // Si era un texto libre sin la causa concatenada
      }

      await prisma.asistencia.update({
        where: { id: a.id },
        data: {
          causaTardanza: matchedCausa,
          observaciones: cleanObs || 'Sin justificación adicional'
        }
      });
      count++;
    }
  }

  console.log(`Se migraron ${count} registros antiguos de entrada tarde.`);

  const asistenciasAlmuerzo = await prisma.asistencia.findMany({
    where: { observacionesAlmuerzo: { not: null } }
  });

  let countAlm = 0;
  for (const a of asistenciasAlmuerzo) {
    if (a.causaTardanzaAlmuerzo) continue;
    
    let matchedCausa = null;
    let cleanObs = a.observacionesAlmuerzo;

    for (const c of causas) {
      if (a.observacionesAlmuerzo.startsWith(c.nombre)) {
        matchedCausa = c.nombre;
        cleanObs = a.observacionesAlmuerzo.replace(c.nombre, '').replace(/^:\s*/, '').trim();
        break;
      }
    }

    if (!matchedCausa) {
      matchedCausa = 'OTRO';
    }

    await prisma.asistencia.update({
      where: { id: a.id },
      data: {
        causaTardanzaAlmuerzo: matchedCausa,
        observacionesAlmuerzo: cleanObs || 'Sin justificación adicional'
      }
    });
    countAlm++;
  }

  console.log(`Se migraron ${countAlm} registros antiguos de almuerzo tarde.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
