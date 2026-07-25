const prisma = require('./src/config/db');

async function main() {
  const users = await prisma.usuario.findMany({
    where: { activo: true },
    select: { id: true, nombre: true, horarioDetalles: true }
  });
  
  const weirdUsers = users.filter(u => {
    if (!u.horarioDetalles) return false;
    return Object.values(u.horarioDetalles).some(d => d && typeof d === 'object' && d.laboral === false);
  });
  
  console.log('Users with false laboral:', JSON.stringify(weirdUsers.slice(0, 2), null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
