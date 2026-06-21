import { useEffect, useState } from 'react';
import api from '../services/api';
import { Plus, Edit2, Trash2, X, Check, Search, Camera, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import FaceScanner from '../components/FaceScanner';

export default function AdminEmployees() {
  const [employees, setEmployees] = useState([]);
  const [formData, setFormData] = useState({ roles: [], sedes: [], horarios: [] });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [isScanningFace, setIsScanningFace] = useState(false);

  // Form State
  const [formValues, setFormValues] = useState({
    documento: '',
    nombre: '',
    apellido: '',
    correo: '',
    contrasena: '',
    rolId: '',
    sedeId: '',
    sedeId: '',
    horarioId: '',
    activo: true,
    rostroDescriptor: '',
    enVacaciones: false,
    vacacionesInicio: '',
    vacacionesFin: '',
    puedeAcumularExtras: true
  });
  const [formError, setFormError] = useState('');

  const loadData = async () => {
    try {
      const [usersRes, formRes] = await Promise.all([
        api.get('/admin/users'),
        api.get('/admin/form-data')
      ]);
      setEmployees(usersRes.data);
      setFormData(formRes.data);
      setLoading(false);
    } catch (error) {
      console.error('Error cargando empleados:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenModal = (employee = null) => {
    setFormError('');
    if (employee) {
      setEditingEmployee(employee);
      setFormValues({
        documento: employee.documento,
        nombre: employee.nombre,
        apellido: employee.apellido,
        correo: employee.correo,
        contrasena: '', // No mostrar la contraseña actual
        rolId: employee.rolId,
        sedeId: employee.sedeId,
        horarioId: employee.horarioId,
        activo: employee.activo,
        rostroDescriptor: employee.rostroDescriptor || '',
        enVacaciones: employee.enVacaciones || false,
        vacacionesInicio: employee.vacacionesInicio ? employee.vacacionesInicio.split('T')[0] : '',
        vacacionesFin: employee.vacacionesFin ? employee.vacacionesFin.split('T')[0] : '',
        puedeAcumularExtras: employee.puedeAcumularExtras !== undefined ? employee.puedeAcumularExtras : true
      });
    } else {
      setEditingEmployee(null);
      setFormValues({
        documento: '',
        nombre: '',
        apellido: '',
        correo: '',
        contrasena: '',
        rolId: formData.roles[0]?.id || '',
        sedeId: formData.sedes[0]?.id || '',
        horarioId: formData.horarios[0]?.id || '',
        activo: true,
        rostroDescriptor: '',
        enVacaciones: false,
        vacacionesInicio: '',
        vacacionesFin: '',
        puedeAcumularExtras: true
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => setIsModalOpen(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    try {
      if (editingEmployee) {
        await api.put(`/admin/users/${editingEmployee.id}`, formValues);
      } else {
        await api.post('/admin/users', formValues);
      }
      await loadData();
      handleCloseModal();
    } catch (error) {
      setFormError(error.response?.data?.error || 'Ocurrió un error al guardar');
    }
  };

  const handleToggleStatus = async (id) => {
    if (window.confirm('¿Estás seguro de cambiar el estado de este empleado?')) {
      try {
        await api.patch(`/admin/users/${id}/status`);
        await loadData();
      } catch (error) {
        alert('Error al cambiar el estado');
      }
    }
  };

  const filteredEmployees = employees.filter(emp =>
    emp.nombre.toLowerCase().includes(search.toLowerCase()) ||
    emp.apellido.toLowerCase().includes(search.toLowerCase()) ||
    emp.documento.includes(search)
  );

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Gestión de Empleados</h2>
            <p className="text-slate-500">Administra el acceso y asignación de todos los trabajadores.</p>
          </div>
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center justify-center space-x-2 bg-slate-800 text-white px-5 py-2.5 rounded-xl hover:bg-slate-700 transition-colors shadow-sm font-medium"
          >
            <Plus className="w-5 h-5" />
            <span>Agregar Empleado</span>
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
            <div className="relative w-full max-w-md">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-slate-400" />
              </div>
              <input
                type="text"
                placeholder="Buscar por nombre o documento..."
                className="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg leading-5 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-500 sm:text-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <div className="flex justify-center p-10">
                <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white border-b border-slate-100 text-sm font-medium text-slate-500 uppercase tracking-wider">
                    <th className="px-6 py-4">Empleado</th>
                    <th className="px-6 py-4">Documento</th>
                    <th className="px-6 py-4">Sede / Horario</th>
                    <th className="px-6 py-4">Estado</th>
                    <th className="px-6 py-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredEmployees.map((emp) => (
                    <tr key={emp.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold uppercase mr-3">
                            {emp.nombre.charAt(0)}
                          </div>
                          <div>
                            <p className="font-medium text-slate-800">{emp.nombre} {emp.apellido}</p>
                            <p className="text-xs text-slate-500">{emp.correo}</p>
                            <p className="text-[10px] uppercase font-bold text-slate-400 mt-0.5">{emp.rol.nombre}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-600 font-mono text-sm">
                        {emp.documento}
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium text-slate-700">{emp.sede.nombre}</p>
                        <p className="text-xs text-slate-500">{emp.horario.nombre}</p>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleToggleStatus(emp.id)}
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${emp.activo
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                            }`}
                        >
                          {emp.activo ? 'Activo' : 'Inactivo'}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <button
                          onClick={() => handleOpenModal(emp)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleToggleStatus(emp.id)}
                          className={`p-2 rounded-lg transition-colors ${emp.activo ? 'text-red-600 hover:bg-red-50' : 'text-emerald-600 hover:bg-emerald-50'}`}
                          title={emp.activo ? "Desactivar" : "Activar"}
                        >
                          {emp.activo ? <Trash2 className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredEmployees.length === 0 && (
                    <tr>
                      <td colSpan="5" className="px-6 py-10 text-center text-slate-500">
                        No se encontraron empleados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Modal Form */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h3 className="text-lg font-bold text-slate-800">
                  {editingEmployee ? 'Editar Empleado' : 'Nuevo Empleado'}
                </h3>
                <button onClick={handleCloseModal} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-200 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto">
                {formError && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">
                    {formError}
                  </div>
                )}

                <form id="employeeForm" onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Documento (DNI/Cédula)</label>
                    <input
                      required type="text"
                      value={formValues.documento}
                      onChange={e => setFormValues({ ...formValues, documento: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Rol</label>
                    <select
                      required value={formValues.rolId}
                      onChange={e => setFormValues({ ...formValues, rolId: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none bg-white"
                    >
                      {formData.roles.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Nombres</label>
                    <input
                      required type="text"
                      value={formValues.nombre}
                      onChange={e => setFormValues({ ...formValues, nombre: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Apellidos</label>
                    <input
                      required type="text"
                      value={formValues.apellido}
                      onChange={e => setFormValues({ ...formValues, apellido: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Correo Electrónico</label>
                    <input
                      required type="email"
                      value={formValues.correo}
                      onChange={e => setFormValues({ ...formValues, correo: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Contraseña {editingEmployee && <span className="text-xs text-slate-400 font-normal">(Dejar en blanco para no cambiar)</span>}</label>
                    <input
                      required={!editingEmployee} type="password"
                      value={formValues.contrasena}
                      onChange={e => setFormValues({ ...formValues, contrasena: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Sede Asignada</label>
                    <select
                      required value={formValues.sedeId}
                      onChange={e => setFormValues({ ...formValues, sedeId: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none bg-white"
                    >
                      {formData.sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Horario Asignado</label>
                    <select
                      required value={formValues.horarioId}
                      onChange={e => setFormValues({ ...formValues, horarioId: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none bg-white"
                    >
                      {formData.horarios.map(h => <option key={h.id} value={h.id}>{h.nombre}</option>)}
                    </select>
                  </div>

                  <div className="col-span-1 md:col-span-2 flex flex-col mt-2 space-y-4">
                    <label className="relative inline-flex items-center cursor-pointer w-max">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={formValues.activo}
                        onChange={(e) => setFormValues({ ...formValues, activo: e.target.checked })}
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                      <span className="ml-3 text-sm font-medium text-slate-700">
                        {formValues.activo ? 'Usuario Activo en el Sistema' : 'Usuario Inactivo (Suspendido)'}
                      </span>
                    </label>

                    <label className="relative inline-flex items-center cursor-pointer w-max">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={formValues.puedeAcumularExtras}
                        onChange={(e) => setFormValues({ ...formValues, puedeAcumularExtras: e.target.checked })}
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500"></div>
                      <span className="ml-3 text-sm font-medium text-slate-700">
                        {formValues.puedeAcumularExtras ? 'Permitido acumular Horas Extras' : 'NO se le acumularán Horas Extras'}
                      </span>
                    </label>

                    <div className="p-4 bg-orange-50/50 border border-orange-100 rounded-xl space-y-3">
                      <label className="relative inline-flex items-center cursor-pointer w-max">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={formValues.enVacaciones}
                          onChange={(e) => setFormValues({ ...formValues, enVacaciones: e.target.checked })}
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                        <span className="ml-3 text-sm font-medium text-slate-800">
                          El empleado se encuentra en Vacaciones
                        </span>
                      </label>

                      {formValues.enVacaciones && (
                        <div className="grid grid-cols-2 gap-4 mt-2">
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Fecha Inicio</label>
                            <input
                              required={formValues.enVacaciones}
                              type="date"
                              value={formValues.vacacionesInicio}
                              onChange={e => setFormValues({ ...formValues, vacacionesInicio: e.target.value })}
                              className="w-full px-3 py-2 text-sm border border-orange-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none bg-white"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Fecha Fin</label>
                            <input
                              required={formValues.enVacaciones}
                              type="date"
                              value={formValues.vacacionesFin}
                              onChange={e => setFormValues({ ...formValues, vacacionesFin: e.target.value })}
                              className="w-full px-3 py-2 text-sm border border-orange-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none bg-white"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="col-span-1 md:col-span-2 mt-4 p-4 bg-slate-50 border border-slate-200 rounded-lg">
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="font-medium text-slate-800 flex items-center">
                        <Camera className="w-4 h-4 mr-2 text-purple-600" />
                        Reconocimiento Facial
                      </h4>
                      {formValues.rostroDescriptor ? (
                        <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full">Rostro Registrado</span>
                      ) : (
                        <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs font-bold rounded-full">Sin Rostro</span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsScanningFace(true)}
                      className="w-full py-2.5 mt-2 border-2 border-dashed border-purple-300 text-purple-700 rounded-lg hover:bg-purple-50 transition-colors text-sm font-medium"
                    >
                      {formValues.rostroDescriptor ? 'Actualizar Rostro' : 'Capturar Rostro para Login'}
                    </button>
                  </div>
                </form>
              </div>

              <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  form="employeeForm"
                  className="px-4 py-2 text-white bg-slate-800 rounded-lg hover:bg-slate-700 font-medium shadow-sm transition-colors"
                >
                  {editingEmployee ? 'Guardar Cambios' : 'Registrar Empleado'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal de Escáner Facial (sobrepuesto) */}
      <AnimatePresence>
        {isScanningFace && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full relative overflow-hidden ring-1 ring-white/10"
            >
              <FaceScanner
                onScanSuccess={(descriptor) => {
                  setFormValues({
                    ...formValues,
                    rostroDescriptor: descriptor
                  });
                  setIsScanningFace(false);
                }}
                onCancel={() => setIsScanningFace(false)}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
