import { useEffect, useState } from 'react';
import api from '../services/api';
import { Plus, Edit2, Trash2, X, Check, MapPin, Clock, List } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import MapSelector from '../components/MapSelector';

export default function AdminConfig() {
  const [activeTab, setActiveTab] = useState('sedes');
  
  const [sedes, setSedes] = useState([]);
  const [horarios, setHorarios] = useState([]);
  const [causas, setCausas] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [isSedeModalOpen, setIsSedeModalOpen] = useState(false);
  const [isHorarioModalOpen, setIsHorarioModalOpen] = useState(false);
  const [isCausaModalOpen, setIsCausaModalOpen] = useState(false);
  
  const [editingSede, setEditingSede] = useState(null);
  const [editingHorario, setEditingHorario] = useState(null);
  const [editingCausa, setEditingCausa] = useState(null);

  // Form states
  const [sedeForm, setSedeForm] = useState({ nombre: '', direccion: '', latitud: '', longitud: '', radioPermitido: '' });
  const [horarioForm, setHorarioForm] = useState({ nombre: '', horaInicio: '', horaFin: '', minutosTolerancia: '' });
  const [causaForm, setCausaForm] = useState({ nombre: '' });

  const loadData = async () => {
    try {
      setLoading(true);
      const [resSedes, resHorarios, resCausas] = await Promise.all([
        api.get('/admin/settings/sedes'),
        api.get('/admin/settings/horarios'),
        api.get('/admin/settings/causas')
      ]);
      setSedes(resSedes.data);
      setHorarios(resHorarios.data);
      setCausas(resCausas.data);
    } catch (error) {
      console.error('Error cargando configuración:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // ==========================
  // SEDES HANDLERS
  // ==========================
  const openSedeModal = (sede = null) => {
    if (sede) {
      setEditingSede(sede);
      setSedeForm({
        nombre: sede.nombre,
        direccion: sede.direccion || '',
        latitud: sede.latitud,
        longitud: sede.longitud,
        radioPermitido: sede.radioPermitido
      });
    } else {
      setEditingSede(null);
      setSedeForm({ nombre: '', direccion: '', latitud: '', longitud: '', radioPermitido: '100' });
    }
    setIsSedeModalOpen(true);
  };

  const closeSedeModal = () => setIsSedeModalOpen(false);

  const handleSedeSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingSede) {
        await api.put(`/admin/settings/sedes/${editingSede.id}`, sedeForm);
      } else {
        await api.post('/admin/settings/sedes', sedeForm);
      }
      await loadData();
      closeSedeModal();
    } catch (error) {
      alert('Error guardando sede');
    }
  };

  const toggleSedeStatus = async (id) => {
    if (window.confirm('¿Cambiar estado de esta sede?')) {
      await api.patch(`/admin/settings/sedes/${id}/status`);
      loadData();
    }
  };

  // ==========================
  // HORARIOS HANDLERS
  // ==========================
  const openHorarioModal = (horario = null) => {
    if (horario) {
      setEditingHorario(horario);
      setHorarioForm({
        nombre: horario.nombre,
        horaInicio: horario.horaInicio,
        horaFin: horario.horaFin,
        minutosTolerancia: horario.minutosTolerancia
      });
    } else {
      setEditingHorario(null);
      setHorarioForm({ nombre: '', horaInicio: '08:00', horaFin: '17:00', minutosTolerancia: '15' });
    }
    setIsHorarioModalOpen(true);
  };

  const closeHorarioModal = () => setIsHorarioModalOpen(false);

  const handleHorarioSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingHorario) {
        await api.put(`/admin/settings/horarios/${editingHorario.id}`, horarioForm);
      } else {
        await api.post('/admin/settings/horarios', horarioForm);
      }
      await loadData();
      closeHorarioModal();
    } catch (error) {
      alert('Error guardando horario');
    }
  };

  const toggleHorarioStatus = async (id) => {
    if (window.confirm('¿Cambiar estado de este horario?')) {
      await api.patch(`/admin/settings/horarios/${id}/status`);
      loadData();
    }
  };

  // ==========================
  // CAUSAS HANDLERS
  // ==========================
  const openCausaModal = (causa = null) => {
    if (causa) {
      setEditingCausa(causa);
      setCausaForm({ nombre: causa.nombre });
    } else {
      setEditingCausa(null);
      setCausaForm({ nombre: '' });
    }
    setIsCausaModalOpen(true);
  };

  const closeCausaModal = () => setIsCausaModalOpen(false);

  const handleCausaSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingCausa) {
        await api.put(`/admin/settings/causas/${editingCausa.id}`, causaForm);
      } else {
        await api.post('/admin/settings/causas', causaForm);
      }
      await loadData();
      closeCausaModal();
    } catch (error) {
      alert('Error guardando causa de tardanza');
    }
  };

  const toggleCausaStatus = async (id) => {
    if (window.confirm('¿Cambiar estado de esta causa?')) {
      await api.patch(`/admin/settings/causas/${id}/status`);
      loadData();
    }
  };

  return (
    <div className="p-4 pb-24 md:p-8 md:pb-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Configuración</h2>
            <p className="text-slate-500">Administra las sedes físicas y los horarios de la empresa.</p>
          </div>
          <button 
            onClick={() => {
              if (activeTab === 'sedes') openSedeModal();
              else if (activeTab === 'horarios') openHorarioModal();
              else openCausaModal();
            }}
            className="flex items-center justify-center space-x-2 bg-slate-800 text-white px-5 py-2.5 rounded-xl hover:bg-slate-700 transition-colors shadow-sm font-medium"
          >
            <Plus className="w-5 h-5" />
            <span>
              {activeTab === 'sedes' ? 'Nueva Sede' : activeTab === 'horarios' ? 'Nuevo Horario' : 'Nueva Causa'}
            </span>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex space-x-1 bg-slate-200/50 p-1 rounded-xl w-full max-w-lg mb-6">
          <button
            onClick={() => setActiveTab('sedes')}
            className={`flex-1 flex items-center justify-center space-x-2 py-2.5 text-sm font-medium rounded-lg transition-all ${
              activeTab === 'sedes' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <MapPin className="w-4 h-4" />
            <span>Sedes</span>
          </button>
          <button
            onClick={() => setActiveTab('horarios')}
            className={`flex-1 flex items-center justify-center space-x-2 py-2.5 text-sm font-medium rounded-lg transition-all ${
              activeTab === 'horarios' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Horarios</span>
          </button>
          <button
            onClick={() => setActiveTab('causas')}
            className={`flex-1 flex items-center justify-center space-x-2 py-2.5 text-sm font-medium rounded-lg transition-all ${
              activeTab === 'causas' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <List className="w-4 h-4" />
            <span>Causas Tardanza</span>
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center p-10">
            <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            {activeTab === 'sedes' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-sm font-medium text-slate-500 uppercase tracking-wider">
                      <th className="px-6 py-4">Nombre de Sede</th>
                      <th className="px-6 py-4">Coordenadas</th>
                      <th className="px-6 py-4">Radio</th>
                      <th className="px-6 py-4">Estado</th>
                      <th className="px-6 py-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {sedes.map((sede) => (
                      <tr key={sede.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <p className="font-medium text-slate-800">{sede.nombre}</p>
                          <p className="text-xs text-slate-500">{sede.direccion}</p>
                        </td>
                        <td className="px-6 py-4 text-slate-600 font-mono text-xs">
                          {sede.latitud}, {sede.longitud}
                        </td>
                        <td className="px-6 py-4 text-slate-600 text-sm">
                          {sede.radioPermitido} metros
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
                            sede.activo ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-600 border-slate-200'
                          }`}>
                            {sede.activo ? 'Activa' : 'Inactiva'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right space-x-2">
                          <button onClick={() => openSedeModal(sede)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => toggleSedeStatus(sede.id)} className={`p-2 rounded-lg ${sede.activo ? 'text-red-600 hover:bg-red-50' : 'text-emerald-600 hover:bg-emerald-50'}`}>
                            {sede.activo ? <Trash2 className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                          </button>
                        </td>
                      </tr>
                    ))}
                    {sedes.length === 0 && (
                      <tr><td colSpan="5" className="px-6 py-10 text-center text-slate-500">No hay sedes registradas.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'horarios' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-sm font-medium text-slate-500 uppercase tracking-wider">
                      <th className="px-6 py-4">Nombre del Horario</th>
                      <th className="px-6 py-4">Rango</th>
                      <th className="px-6 py-4">Tolerancia</th>
                      <th className="px-6 py-4">Estado</th>
                      <th className="px-6 py-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {horarios.map((horario) => (
                      <tr key={horario.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 font-medium text-slate-800">
                          {horario.nombre}
                        </td>
                        <td className="px-6 py-4 text-slate-600 font-mono text-sm">
                          {horario.horaInicio} - {horario.horaFin}
                        </td>
                        <td className="px-6 py-4 text-slate-600 text-sm">
                          {horario.minutosTolerancia} min
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
                            horario.activo ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-600 border-slate-200'
                          }`}>
                            {horario.activo ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right space-x-2">
                          <button onClick={() => openHorarioModal(horario)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => toggleHorarioStatus(horario.id)} className={`p-2 rounded-lg ${horario.activo ? 'text-red-600 hover:bg-red-50' : 'text-emerald-600 hover:bg-emerald-50'}`}>
                            {horario.activo ? <Trash2 className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                          </button>
                        </td>
                      </tr>
                    ))}
                    {horarios.length === 0 && (
                      <tr><td colSpan="5" className="px-6 py-10 text-center text-slate-500">No hay horarios registrados.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'causas' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-sm font-medium text-slate-500 uppercase tracking-wider">
                      <th className="px-6 py-4">Nombre de la Causa</th>
                      <th className="px-6 py-4">Estado</th>
                      <th className="px-6 py-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {causas.map((causa) => (
                      <tr key={causa.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 font-medium text-slate-800">
                          {causa.nombre}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
                            causa.activo ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-600 border-slate-200'
                          }`}>
                            {causa.activo ? 'Activa' : 'Inactiva'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right space-x-2">
                          <button onClick={() => openCausaModal(causa)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => toggleCausaStatus(causa.id)} className={`p-2 rounded-lg ${causa.activo ? 'text-red-600 hover:bg-red-50' : 'text-emerald-600 hover:bg-emerald-50'}`}>
                            {causa.activo ? <Trash2 className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                          </button>
                        </td>
                      </tr>
                    ))}
                    {causas.length === 0 && (
                      <tr><td colSpan="3" className="px-6 py-10 text-center text-slate-500">No hay causas registradas.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAL SEDES */}
      <AnimatePresence>
        {isSedeModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h3 className="text-lg font-bold text-slate-800">
                  {editingSede ? 'Editar Sede' : 'Nueva Sede'}
                </h3>
                <button onClick={closeSedeModal} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleSedeSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nombre</label>
                  <input required type="text" value={sedeForm.nombre} onChange={e => setSedeForm({...sedeForm, nombre: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Dirección (Opcional)</label>
                  <input type="text" value={sedeForm.direccion} onChange={e => setSedeForm({...sedeForm, direccion: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Radio Permitido (metros)</label>
                  <input required type="number" min="10" value={sedeForm.radioPermitido} onChange={e => setSedeForm({...sedeForm, radioPermitido: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Ubicación Geográfica (Haz clic en el mapa)</label>
                  <MapSelector 
                    lat={sedeForm.latitud} 
                    lng={sedeForm.longitud} 
                    radius={sedeForm.radioPermitido} 
                    onChange={(lat, lng) => setSedeForm({...sedeForm, latitud: lat, longitud: lng})}
                  />
                  <div className="flex space-x-2 mt-2">
                    <input type="text" readOnly value={sedeForm.latitud || ''} placeholder="Latitud" className="w-1/2 text-xs px-2 py-1 bg-slate-50 border border-slate-200 rounded text-slate-500" />
                    <input type="text" readOnly value={sedeForm.longitud || ''} placeholder="Longitud" className="w-1/2 text-xs px-2 py-1 bg-slate-50 border border-slate-200 rounded text-slate-500" />
                  </div>
                </div>
                <div className="pt-4 flex justify-end space-x-3">
                  <button type="button" onClick={closeSedeModal} className="px-4 py-2 text-slate-600 border border-slate-300 rounded-lg">Cancelar</button>
                  <button type="submit" className="px-4 py-2 text-white bg-slate-800 rounded-lg">{editingSede ? 'Guardar' : 'Crear Sede'}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL HORARIOS */}
      <AnimatePresence>
        {isHorarioModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h3 className="text-lg font-bold text-slate-800">
                  {editingHorario ? 'Editar Horario' : 'Nuevo Horario'}
                </h3>
                <button onClick={closeHorarioModal} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleHorarioSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nombre del Horario</label>
                  <input required type="text" placeholder="Ej: Lunes a Viernes" value={horarioForm.nombre} onChange={e => setHorarioForm({...horarioForm, nombre: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Hora Inicio</label>
                    <input required type="time" step="2" value={horarioForm.horaInicio} onChange={e => setHorarioForm({...horarioForm, horaInicio: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Hora Fin</label>
                    <input required type="time" step="2" value={horarioForm.horaFin} onChange={e => setHorarioForm({...horarioForm, horaFin: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Minutos Tolerancia</label>
                  <input required type="number" value={horarioForm.minutosTolerancia} onChange={e => setHorarioForm({...horarioForm, minutosTolerancia: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none" />
                </div>
                <div className="pt-4 flex justify-end space-x-3">
                  <button type="button" onClick={closeHorarioModal} className="px-4 py-2 text-slate-600 border border-slate-300 rounded-lg">Cancelar</button>
                  <button type="submit" className="px-4 py-2 text-white bg-slate-800 rounded-lg">{editingHorario ? 'Guardar' : 'Crear Horario'}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL CAUSAS */}
      <AnimatePresence>
        {isCausaModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h3 className="text-lg font-bold text-slate-800">
                  {editingCausa ? 'Editar Causa' : 'Nueva Causa'}
                </h3>
                <button onClick={closeCausaModal} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleCausaSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nombre de la causa</label>
                  <input required type="text" placeholder="Ej: Tráfico Pesado" value={causaForm.nombre} onChange={e => setCausaForm({...causaForm, nombre: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none" />
                </div>
                <div className="pt-4 flex justify-end space-x-3">
                  <button type="button" onClick={closeCausaModal} className="px-4 py-2 text-slate-600 border border-slate-300 rounded-lg">Cancelar</button>
                  <button type="submit" className="px-4 py-2 text-white bg-slate-800 rounded-lg">{editingCausa ? 'Guardar' : 'Crear Causa'}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
