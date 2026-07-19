const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function main() {
  const usuarios = await prisma.usuario.findMany({
    include: {
      horario: true
    }
  });

  const backup = usuarios.map(u => ({
    id: u.id,
    horarioId: u.horarioId,
    horarioNombre: u.horario?.nombre,
    horaInicio: u.horario?.horaInicio,
    horaFin: u.horario?.horaFin,
    minutosTolerancia: u.horario?.minutosTolerancia || 15
  }));

  fs.writeFileSync('horarios_backup.json', JSON.stringify(backup, null, 2));
  console.log(`Backup completed for ${backup.length} users.`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
