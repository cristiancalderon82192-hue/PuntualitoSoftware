const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Borrando todos los registros de Asistencia...');
  const deleted = await prisma.asistencia.deleteMany({});
  console.log(`Se eliminaron ${deleted.count} registros de asistencia.`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
