const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function main() {
  const backupData = JSON.parse(fs.readFileSync('horarios_backup.json', 'utf8'));
  let count = 0;

  for (const b of backupData) {
    // Generar JSON para horarioDetalles
    // Asumiremos que el horario aplicaba de Lunes a Sábado (1 al 6), Domingo (0) libre.
    const detalles = {};
    for (let i = 0; i <= 6; i++) {
      if (i === 0) {
        detalles[i] = { laboral: false };
      } else {
        detalles[i] = {
          laboral: true,
          inicio: (b.horaInicio || "08:00:00").substring(0, 5), // Convert to HH:mm
          fin: (b.horaFin || "17:00:00").substring(0, 5)
        };
      }
    }

    await prisma.usuario.update({
      where: { id: b.id },
      data: {
        minutosTolerancia: b.minutosTolerancia || 15,
        horarioDetalles: detalles
      }
    });
    count++;
  }

  console.log(`Restored schedules for ${count} users.`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
