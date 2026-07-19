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
// CRUD CAUSAS TARDANZA
// ==========================================

const getCausas = async (req, res) => {
  try {
    const causas = await prisma.causaTardanza.findMany({
      orderBy: { creadoEn: 'desc' }
    });
    res.json(causas);
  } catch (error) {
    console.error('Error en getCausas:', error);
    res.status(500).json({ error: 'Error al obtener causas de tardanza' });
  }
};

const createCausa = async (req, res) => {
  try {
    const { nombre } = req.body;
    
    const nuevaCausa = await prisma.causaTardanza.create({
      data: {
        nombre,
        activo: true
      }
    });
    
    res.status(201).json(nuevaCausa);
  } catch (error) {
    console.error('Error en createCausa:', error);
    res.status(500).json({ error: 'Error al crear causa de tardanza' });
  }
};

const updateCausa = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre } = req.body;

    const causaActualizada = await prisma.causaTardanza.update({
      where: { id: Number(id) },
      data: { nombre }
    });

    res.json(causaActualizada);
  } catch (error) {
    console.error('Error en updateCausa:', error);
    res.status(500).json({ error: 'Error al actualizar causa de tardanza' });
  }
};

const toggleCausaStatus = async (req, res) => {
  try {
    const { id } = req.params;
    
    const causa = await prisma.causaTardanza.findUnique({ where: { id: Number(id) } });
    if (!causa) return res.status(404).json({ error: 'Causa no encontrada' });

    const causaActualizada = await prisma.causaTardanza.update({
      where: { id: Number(id) },
      data: { activo: !causa.activo }
    });
    
    res.json(causaActualizada);
  } catch (error) {
    console.error('Error en toggleCausaStatus:', error);
    res.status(500).json({ error: 'Error al cambiar estado de la causa' });
  }
};

module.exports = {
  getSedes,
  createSede,
  updateSede,
  toggleSedeStatus,
  getCausas,
  createCausa,
  updateCausa,
  toggleCausaStatus
};
