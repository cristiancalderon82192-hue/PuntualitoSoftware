const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando carga de datos iniciales...');

  // 1. Crear Roles
  const rolAdmin = await prisma.rol.upsert({
    where: { nombre: 'ADMIN' },
    update: {},
    create: { nombre: 'ADMIN', descripcion: 'Administrador del sistema' }
  });

  const rolEmpleado = await prisma.rol.upsert({
    where: { nombre: 'EMPLEADO' },
    update: {},
    create: { nombre: 'EMPLEADO', descripcion: 'Empleado regular' }
  });

  // 2. Crear Estados de Asistencia
  const estados = ['PUNTUAL', 'TARDE', 'TEMPRANO', 'AUSENTE'];
  for (const estado of estados) {
    await prisma.estadoAsistencia.upsert({
      where: { nombre: estado },
      update: {},
      create: { nombre: estado }
    });
  }

  // 3. Crear una Sede de prueba
  const sede = await prisma.sede.create({
    data: {
      nombre: 'Sede Principal',
      direccion: 'Av. Siempre Viva 123',
      latitud: -12.046374, // Ejemplo (Lima, Perú)
      longitud: -77.042793,
      radioPermitido: 100 // 100 metros
    }
  });

  // 4. Crear un Horario de prueba
  const horario = await prisma.horario.create({
    data: {
      nombre: 'Turno Mañana Completo',
      horaInicio: '08:00:00',
      horaFin: '17:00:00',
      minutosTolerancia: 15
    }
  });

  // 5. Crear el Usuario Administrador
  const contrasenaEncriptada = await bcrypt.hash('admin123', 10);
  
  const admin = await prisma.usuario.upsert({
    where: { correo: 'admin@empresa.com' },
    update: {},
    create: {
      documento: '00000000',
      nombre: 'Admin',
      apellido: 'Sistema',
      correo: 'admin@empresa.com',
      contrasena: contrasenaEncriptada,
      rolId: rolAdmin.id,
      sedeId: sede.id,
      horarioId: horario.id
    }
  });

  console.log('¡Base de datos inicializada correctamente!');
  console.log('--------------------------------------------------');
  console.log('Puedes iniciar sesión con las siguientes credenciales:');
  console.log('Correo: admin@empresa.com');
  console.log('Contraseña: admin123');
  console.log('--------------------------------------------------');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
