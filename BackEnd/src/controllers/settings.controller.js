const prisma = require('../config/db');

// ==========================================
// CRUD SEDES
// ==========================================

const getSedes = async (req, res) => {
  try {
    const sedes = await prisma.sede.findMany({
      orderBy: { creadoEn: 'desc' }
    });
    res.json(sedes);
  } catch (error) {
    console.error('Error en getSedes:', error);
    res.status(500).json({ error: 'Error al obtener sedes' });
  }
};

const createSede = async (req, res) => {
  try {
    const { nombre, direccion, latitud, longitud, radioPermitido } = req.body;
    
    const nuevaSede = await prisma.sede.create({
      data: {
        nombre,
        direccion,
        latitud: parseFloat(latitud),
        longitud: parseFloat(longitud),
        radioPermitido: parseInt(radioPermitido, 10),
        activo: true
      }
    });
    
    res.status(201).json(nuevaSede);
  } catch (error) {
    console.error('Error en createSede:', error);
    res.status(500).json({ error: 'Error al crear sede' });
  }
};

const updateSede = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, direccion, latitud, longitud, radioPermitido } = req.body;

    const sedeActualizada = await prisma.sede.update({
      where: { id: Number(id) },
      data: {
        nombre,
        direccion,
        latitud: parseFloat(latitud),
        longitud: parseFloat(longitud),
        radioPermitido: parseInt(radioPermitido, 10)
      }
    });

    res.json(sedeActualizada);
  } catch (error) {
    console.error('Error en updateSede:', error);
    res.status(500).json({ error: 'Error al actualizar sede' });
  }
};

const toggleSedeStatus = async (req, res) => {
  try {
    const { id } = req.params;
    
    const sede = await prisma.sede.findUnique({ where: { id: Number(id) } });
    if (!sede) return res.status(404).json({ error: 'Sede no encontrada' });

    const sedeActualizada = await prisma.sede.update({
      where: { id: Number(id) },
      data: { activo: !sede.activo }
    });
    
    res.json(sedeActualizada);
  } catch (error) {
    console.error('Error en toggleSedeStatus:', error);
    res.status(500).json({ error: 'Error al cambiar estado de la sede' });
  }
};


// ==========================================
// CRUD HORARIOS
// ==========================================

const getHorarios = async (req, res) => {
  try {
    const horarios = await prisma.horario.findMany();
    res.json(horarios);
  } catch (error) {
    console.error('Error en getHorarios:', error);
    res.status(500).json({ error: 'Error al obtener horarios' });
  }
};

const createHorario = async (req, res) => {
  try {
    const { nombre, horaInicio, horaFin, minutosTolerancia } = req.body;
    
    const nuevoHorario = await prisma.horario.create({
      data: {
        nombre,
        horaInicio,
        horaFin,
        minutosTolerancia: parseInt(minutosTolerancia, 10),
        activo: true
      }
    });
    
    res.status(201).json(nuevoHorario);
  } catch (error) {
    console.error('Error en createHorario:', error);
    res.status(500).json({ error: 'Error al crear horario' });
  }
};

const updateHorario = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, horaInicio, horaFin, minutosTolerancia } = req.body;

    const horarioActualizado = await prisma.horario.update({
      where: { id: Number(id) },
      data: {
        nombre,
        horaInicio,
        horaFin,
        minutosTolerancia: parseInt(minutosTolerancia, 10)
      }
    });

    res.json(horarioActualizado);
  } catch (error) {
    console.error('Error en updateHorario:', error);
    res.status(500).json({ error: 'Error al actualizar horario' });
  }
};

const toggleHorarioStatus = async (req, res) => {
  try {
    const { id } = req.params;
    
    const horario = await prisma.horario.findUnique({ where: { id: Number(id) } });
    if (!horario) return res.status(404).json({ error: 'Horario no encontrado' });

    const horarioActualizado = await prisma.horario.update({
      where: { id: Number(id) },
      data: { activo: !horario.activo }
    });
    
    res.json(horarioActualizado);
  } catch (error) {
    console.error('Error en toggleHorarioStatus:', error);
    res.status(500).json({ error: 'Error al cambiar estado del horario' });
  }
};

module.exports = {
  getSedes,
  createSede,
  updateSede,
  toggleSedeStatus,
  getHorarios,
  createHorario,
  updateHorario,
  toggleHorarioStatus
};
