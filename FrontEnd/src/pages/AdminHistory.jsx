import { useEffect, useState } from 'react';
import api from '../services/api';
import { Download, Search, Filter, Calendar, ClipboardList, Clock, Users, Eye, X, Trash2, Image as ImageIcon } from 'lucide-react';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, Legend } from 'recharts';

export default function AdminHistory() {
  const [attendances, setAttendances] = useState([]);
  const [users, setUsers] = useState([]);
  const [sedes, setSedes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters state
  const [filters, setFilters] = useState({
    fechaInicio: dayjs().startOf('month').format('YYYY-MM-DD'),
    fechaFin: dayjs().endOf('month').format('YYYY-MM-DD'),
    usuarioId: '',
    sedeId: ''
  });

  const [activeTab, setActiveTab] = useState('general');
  const [selectedEmployeeDetails, setSelectedEmployeeDetails] = useState(null);
  
  // Extra hours approval state
  const [approvingExtra, setApprovingExtra] = useState(null);
  const [extraMinutesToApprove, setExtraMinutesToApprove] = useState('');

  // Report State
  const [reportData, setReportData] = useState([]);
  const [loadingReport, setLoadingReport] = useState(true);

  const loadFiltersData = async () => {
    try {
      const [usersRes, formRes] = await Promise.all([
        api.get('/admin/users'),
        api.get('/admin/form-data')
      ]);
      setUsers(usersRes.data);
      setSedes(formRes.data.sedes);
    } catch (error) {
      console.error('Error cargando datos de filtros:', error);
    }
  };

  const loadAttendances = async () => {
    setLoading(true);
    try {
      // Clean empty filters
      const params = new URLSearchParams();
      if (filters.fechaInicio) params.append('fechaInicio', filters.fechaInicio);
      if (filters.fechaFin) params.append('fechaFin', filters.fechaFin);
      if (filters.usuarioId) params.append('usuarioId', filters.usuarioId);
      if (filters.sedeId) params.append('sedeId', filters.sedeId);

      const res = await api.get(`/admin/attendances?${params.toString()}`);
      setAttendances(res.data);
    } catch (error) {
      console.error('Error cargando asistencias:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadReportData = async () => {
    try {
      const res = await api.get('/admin/reports/tardanzas');
      // Sort by count descending
      const sorted = res.data.sort((a, b) => b.count - a.count);
      setReportData(sorted);
    } catch (error) {
      console.error('Error cargando reporte de tardanzas:', error);
    } finally {
      setLoadingReport(false);
    }
  };

  useEffect(() => {
    loadFiltersData();
    loadAttendances();
    loadReportData();

    // Polling cada 10 segundos
    const interval = setInterval(() => {
      loadReportData();
    }, 10000);
    
    return () => clearInterval(interval);
  }, []);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const isLateLunch = (a) => {
    if (!a.horaEntradaAlmuerzo || !a.usuario.horaFinAlmuerzo) return false;
    const returnTimeStr = dayjs(a.horaEntradaAlmuerzo).format('HH:mm:ss');
    const limitTimeStr = a.usuario.horaFinAlmuerzo.length === 5 ? `${a.usuario.horaFinAlmuerzo}:00` : a.usuario.horaFinAlmuerzo;
    return returnTimeStr > limitTimeStr;
  };

  const processedAttendances = attendances.map(a => ({
    ...a,
    tardeAlmuerzo: isLateLunch(a)
  }));

  const filteredAttendances = processedAttendances.filter(a => activeTab === 'tarde_almuerzo' ? a.tardeAlmuerzo : true);

  const formatMinutes = (mins) => {
    if (!mins) return '0m';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const getConsolidatedData = () => {
    const grouped = {};
    processedAttendances.forEach(a => {
      if (!grouped[a.usuarioId]) {
        grouped[a.usuarioId] = {
          usuarioId: a.usuarioId,
          usuario: a.usuario,
          sede: a.sede,
          diasAsistidos: 0,
          llegadasTarde: 0,
          tardesAlmuerzo: 0,
          faltas: 0,
          totalMinutosExtra: 0,
          totalMinutosTarde: 0
        };
      }
      grouped[a.usuarioId].diasAsistidos++;
      if (a.estado.nombre === 'TARDE') grouped[a.usuarioId].llegadasTarde++;
      if (a.estado.nombre === 'AUSENTE') grouped[a.usuarioId].faltas++;
      if (a.tardeAlmuerzo) grouped[a.usuarioId].tardesAlmuerzo++;
      if (a.minutosExtraAprobados) grouped[a.usuarioId].totalMinutosExtra += a.minutosExtraAprobados;
      if (a.minutosTarde) grouped[a.usuarioId].totalMinutosTarde += a.minutosTarde;
    });
    return Object.values(grouped).sort((a, b) => b.diasAsistidos - a.diasAsistidos);
  };

  const consolidatedData = getConsolidatedData();

  const handleViewDetails = (usuarioId) => {
    setSelectedEmployeeDetails(usuarioId);
  };

  const handleApplyFilters = (e) => {
    e.preventDefault();
    loadAttendances();
  };

  const handleDeleteAttendance = async (id) => {
    if (window.confirm('¿Estás seguro de eliminar este registro de asistencia? Esta acción no se puede deshacer.')) {
      try {
        await api.delete(`/admin/attendances/${id}`);
        loadAttendances();
      } catch (error) {
        alert('Error al eliminar el registro de asistencia');
      }
    }
  };

  const handleApproveExtrasSubmit = async (e) => {
    e.preventDefault();
    if (!approvingExtra) return;
    try {
      await api.put(`/admin/attendances/${approvingExtra.id}/approve-extras`, {
        minutosAprobados: Number(extraMinutesToApprove)
      });
      setApprovingExtra(null);
      loadAttendances();
    } catch (error) {
      alert('Error al aprobar las horas extras');
    }
  };

  const handleExportExcel = () => {
    if (attendances.length === 0) {
      alert('No hay datos para exportar en este rango.');
      return;
    }

    // Preparar datos para Excel
    const excelData = processedAttendances.map(a => ({
      'Fecha': dayjs(a.fecha).add(5, 'hour').format('DD/MM/YYYY'), // Ajuste simple si fecha guarda midnight UTC
      'Entrada': a.horaEntrada ? dayjs(a.horaEntrada).format('hh:mm A') : 'N/A',
      'Salida Almuerzo': a.horaSalidaAlmuerzo ? dayjs(a.horaSalidaAlmuerzo).format('hh:mm A') : 'N/A',
      'Regreso Almuerzo': a.horaEntradaAlmuerzo ? dayjs(a.horaEntradaAlmuerzo).format('hh:mm A') : 'N/A',
      'Salida Jornada': a.horaSalida ? dayjs(a.horaSalida).format('hh:mm A') : 'N/A',
      'Extras (Sistema)': formatMinutes(a.minutosExtra),
      'Extras (Aprobadas)': a.minutosExtraAprobados !== null ? formatMinutes(a.minutosExtraAprobados) : 'Pendiente',
      'Tardanzas': formatMinutes(a.minutosTarde),
      'Documento': a.usuario.documento,
      'Empleado': `${a.usuario.nombre} ${a.usuario.apellido}`,
      'Sede': a.sede.nombre,
      'Estado (Día)': a.estado.nombre,
      'Tarde de Almuerzo': a.tardeAlmuerzo ? 'SÍ' : 'NO',
      'Observaciones (Mañana)': a.observaciones || 'N/A',
      'Observaciones (Almuerzo)': a.observacionesAlmuerzo || 'N/A'
    }));

    // Preparar datos para Excel Consolidado
    const excelConsolidatedData = consolidatedData.map(c => {
      const balance = c.totalMinutosExtra - c.totalMinutosTarde;
      return {
        'Empleado': `${c.usuario.nombre} ${c.usuario.apellido}`,
        'Documento': c.usuario.documento,
        'Sede': c.sede.nombre,
        'Días Asistidos': c.diasAsistidos,
        'Llegadas Tarde': c.llegadasTarde,
        'Faltas': c.faltas,
        'Tardes de Almuerzo': c.tardesAlmuerzo,
        'Hrs Extras': formatMinutes(c.totalMinutosExtra),
        'Hrs Tardanzas': formatMinutes(c.totalMinutosTarde),
        'Balance': balance === 0 ? '0m' : balance > 0 ? `+ ${formatMinutes(balance)}` : `- ${formatMinutes(Math.abs(balance))}`
      };
    });

    // Crear libro de trabajo
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const worksheetConsolidado = XLSX.utils.json_to_sheet(excelConsolidatedData);
    
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Detalle Asistencias");
    XLSX.utils.book_append_sheet(workbook, worksheetConsolidado, "Consolidado");

    // Descargar
    const fileName = `Reporte_Asistencia_${dayjs().format('YYYYMMDD_HHmm')}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Historial y Reportes</h2>
            <p className="text-slate-500">Filtra y exporta las asistencias de los empleados.</p>
          </div>
          <button 
            onClick={handleExportExcel}
            className="flex items-center justify-center space-x-2 bg-emerald-600 text-white px-5 py-2.5 rounded-xl hover:bg-emerald-700 transition-colors shadow-sm font-medium"
          >
            <Download className="w-5 h-5" />
            <span>Exportar a Excel</span>
          </button>
        </div>

        {/* Gráfico Animado en Tiempo Real (Reporte) */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-slate-800">Causas de Llegadas Tarde</h3>
              <p className="text-sm text-slate-500">Actualización en tiempo real (Polling cada 10s)</p>
            </div>
            <div className="flex items-center space-x-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
              <span className="text-xs font-medium text-emerald-600">En Vivo</span>
            </div>
          </div>
          
          <div className="h-64 w-full">
            {loadingReport ? (
              <div className="w-full h-full flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-slate-200 border-t-purple-600 rounded-full animate-spin"></div>
              </div>
            ) : reportData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={reportData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} allowDecimals={false} />
                  <Tooltip 
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar 
                    dataKey="count" 
                    name="Nº de Casos"
                    radius={[6, 6, 0, 0]}
                    animationDuration={1500}
                  >
                    {reportData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#8b5cf6' : '#3b82f6'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm italic">
                No hay registros de llegadas tarde con causa registrada.
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex space-x-1 bg-slate-200/50 p-1 rounded-xl w-full max-w-2xl mb-6">
          <button
            onClick={() => setActiveTab('general')}
            className={`flex-1 flex items-center justify-center space-x-2 py-2.5 text-sm font-medium rounded-lg transition-all ${
              activeTab === 'general' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            <span>General</span>
          </button>
          <button
            onClick={() => setActiveTab('tarde_almuerzo')}
            className={`flex-1 flex items-center justify-center space-x-2 py-2.5 text-sm font-medium rounded-lg transition-all ${
              activeTab === 'tarde_almuerzo' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Tarde de Almuerzo</span>
          </button>
          <button
            onClick={() => setActiveTab('consolidado')}
            className={`flex-1 flex items-center justify-center space-x-2 py-2.5 text-sm font-medium rounded-lg transition-all ${
              activeTab === 'consolidado' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Consolidado por Empleado</span>
          </button>
        </div>

        {/* Filters Panel */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 mb-6">
          <form onSubmit={handleApplyFilters} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Fecha Inicio</label>
              <div className="relative">
                <Calendar className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input 
                  type="date" 
                  name="fechaInicio"
                  value={filters.fechaInicio}
                  onChange={handleFilterChange}
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none text-sm text-slate-600"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Fecha Fin</label>
              <div className="relative">
                <Calendar className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input 
                  type="date" 
                  name="fechaFin"
                  value={filters.fechaFin}
                  onChange={handleFilterChange}
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none text-sm text-slate-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Empleado</label>
              <select 
                name="usuarioId"
                value={filters.usuarioId}
                onChange={handleFilterChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none bg-white text-sm text-slate-600"
              >
                <option value="">Todos los empleados</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.nombre} {u.apellido}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Sede</label>
              <select 
                name="sedeId"
                value={filters.sedeId}
                onChange={handleFilterChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none bg-white text-sm text-slate-600"
              >
                <option value="">Todas las sedes</option>
                {sedes.map(s => (
                  <option key={s.id} value={s.id}>{s.nombre}</option>
                ))}
              </select>
            </div>

            <button 
              type="submit"
              className="w-full flex items-center justify-center space-x-2 bg-slate-800 text-white px-4 py-2 rounded-lg hover:bg-slate-700 transition-colors shadow-sm font-medium text-sm h-[38px]"
            >
              <Filter className="w-4 h-4" />
              <span>Filtrar</span>
            </button>
          </form>
        </div>

        {/* Data Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            {loading ? (
              <div className="flex justify-center p-10">
                <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
              </div>
            ) : activeTab === 'consolidado' ? (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    <th className="px-6 py-4">Empleado</th>
                    <th className="px-6 py-4 text-center">Días Asistidos</th>
                    <th className="px-6 py-4 text-center">Tardanzas</th>
                    <th className="px-6 py-4 text-center">Extras</th>
                    <th className="px-6 py-4 text-center">Balance Neto</th>
                    <th className="px-6 py-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {consolidatedData.map((c) => (
                    <tr key={c.usuarioId} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-medium text-slate-800">{c.usuario.nombre} {c.usuario.apellido}</p>
                        <p className="text-xs text-slate-500 font-mono">{c.usuario.documento} • {c.sede.nombre}</p>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="font-bold text-slate-700">{c.diasAsistidos}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex flex-col items-center">
                          <p className={`font-bold ${c.llegadasTarde > 0 || c.tardesAlmuerzo > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                            {c.llegadasTarde + c.tardesAlmuerzo} Veces
                          </p>
                          <p className="text-xs text-amber-700">
                            {formatMinutes(c.totalMinutosTarde)}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <p className={`font-medium ${c.totalMinutosExtra > 0 ? 'text-indigo-600' : 'text-slate-600'}`}>
                          {formatMinutes(c.totalMinutosExtra)}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {(() => {
                          const balance = c.totalMinutosExtra - c.totalMinutosTarde;
                          if (balance === 0) return <span className="text-slate-500 font-medium">0m</span>;
                          if (balance > 0) return <span className="text-emerald-600 font-bold bg-emerald-50 px-2 py-1 rounded">+ {formatMinutes(balance)}</span>;
                          return <span className="text-red-600 font-bold bg-red-50 px-2 py-1 rounded">- {formatMinutes(Math.abs(balance))}</span>;
                        })()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleViewDetails(c.usuarioId)}
                          className="inline-flex items-center space-x-1 text-sm font-medium text-purple-600 hover:text-purple-700 transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                          <span>Ver Detalles</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                  {consolidatedData.length === 0 && (
                    <tr>
                      <td colSpan="6" className="px-6 py-10 text-center text-slate-500">
                        No se encontraron registros para los filtros seleccionados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    <th className="px-6 py-4">Fecha</th>
                    <th className="px-6 py-4">Empleado</th>
                    <th className="px-6 py-4">Sede</th>
                    <th className="px-6 py-4">Horarios Registrados</th>
                    <th className="px-6 py-4">{activeTab === 'tarde_almuerzo' ? 'Minutos de Tardanza' : 'Horas Extras'}</th>
                    <th className="px-6 py-4">Estado</th>
                    <th className="px-6 py-4">Observaciones</th>
                    <th className="px-6 py-4">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAttendances.map((a) => {
                    const isTarde = a.estado.nombre === 'TARDE';
                    const isFalta = a.estado.nombre === 'AUSENTE';
                    return (
                      <tr key={a.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          {/* El campo fecha en la BD guarda UTC midnight, para mostrarlo sin offset, le sumamos las 5 horas o usamos add() para evitar bugs de zona local */}
                          <p className="font-medium text-slate-800">{dayjs(a.fecha).add(5, 'hour').format('DD MMM, YYYY')}</p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-medium text-slate-800">{a.usuario.nombre} {a.usuario.apellido}</p>
                          <p className="text-xs text-slate-500 font-mono">{a.usuario.documento}</p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm text-slate-600">{a.sede.nombre}</p>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-xs space-y-1">
                          {activeTab !== 'tarde_almuerzo' && a.horaEntrada && <p><span className="text-slate-400">Entrada:</span> <span className="font-medium text-slate-700">{dayjs(a.horaEntrada).format('hh:mm A')}</span></p>}
                          {a.horaSalidaAlmuerzo && <p><span className="text-slate-400">Sale Almz:</span> <span className="font-medium text-slate-700">{dayjs(a.horaSalidaAlmuerzo).format('hh:mm A')}</span></p>}
                          {a.horaEntradaAlmuerzo && <p><span className="text-slate-400">Vuelve Almz:</span> <span className="font-medium text-slate-700">{dayjs(a.horaEntradaAlmuerzo).format('hh:mm A')}</span></p>}
                          {activeTab !== 'tarde_almuerzo' && a.horaSalida && <p><span className="text-slate-400">Salida:</span> <span className="font-medium text-slate-700">{dayjs(a.horaSalida).format('hh:mm A')}</span></p>}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {activeTab === 'tarde_almuerzo' ? (
                            a.horaSalidaAlmuerzo && a.horaEntradaAlmuerzo && a.usuario.horaFinAlmuerzo ? (() => {
                              const limitTimeStr = a.usuario.horaFinAlmuerzo.length === 5 ? `${a.usuario.horaFinAlmuerzo}:00` : a.usuario.horaFinAlmuerzo;
                              const returnObj = dayjs(a.horaEntradaAlmuerzo);
                              const limitObj = dayjs(`${returnObj.format('YYYY-MM-DD')}T${limitTimeStr}`);
                              const diff = returnObj.diff(limitObj, 'minute');
                              return diff > 0 ? (
                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border bg-red-50 text-red-700 border-red-200">
                                  + {formatMinutes(diff)} tarde
                                </span>
                              ) : (
                                <span className="text-xs text-slate-400 font-medium">0m tarde</span>
                              );
                            })() : (
                              <span className="text-xs text-slate-400 italic">En almuerzo...</span>
                            )
                          ) : (
                            a.minutosExtra > 0 ? (
                              <div className="flex flex-col space-y-2">
                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border bg-indigo-50 text-indigo-700 border-indigo-200 w-fit">
                                  Sistema: + {formatMinutes(a.minutosExtra)}
                                </span>
                                {a.minutosExtraAprobados !== null ? (
                                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border bg-emerald-50 text-emerald-700 border-emerald-200 w-fit">
                                    Aprobado: {formatMinutes(a.minutosExtraAprobados)}
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => {
                                      setApprovingExtra(a);
                                      setExtraMinutesToApprove(a.minutosExtra);
                                    }}
                                    className="text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-2 py-1 rounded shadow-sm w-fit transition-colors"
                                  >
                                    Validar Extras
                                  </button>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400 font-medium border border-transparent px-2.5 py-1">
                                0m
                              </span>
                            )
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col space-y-2">
                            {activeTab !== 'tarde_almuerzo' && (
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border w-fit ${
                                isTarde ? 'bg-amber-50 text-amber-700 border-amber-200' : 
                                isFalta ? 'bg-red-50 text-red-700 border-red-200' : 
                                'bg-emerald-50 text-emerald-700 border-emerald-200'
                              }`}>
                                Mañana: {a.estado.nombre}
                              </span>
                            )}
                            {a.tardeAlmuerzo && (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border w-fit bg-red-50 text-red-700 border-red-200">
                                Tarde de Almuerzo
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-500 max-w-xs" title={a.observaciones || a.observacionesAlmuerzo}>
                          <div className="space-y-1">
                            {a.observaciones && <p><span className="font-semibold text-slate-700">Mañana:</span> <span className="truncate block">{a.observaciones}</span></p>}
                            {a.observacionesAlmuerzo && <p><span className="font-semibold text-slate-700">Almuerzo:</span> <span className="truncate block">{a.observacionesAlmuerzo}</span></p>}
                            {!a.observaciones && !a.observacionesAlmuerzo && <span className="italic text-slate-400">Sin observaciones</span>}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center space-x-2">
                            {a.evidenciaUrl && (
                              <a
                                href={`${(import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace('/api', '')}${a.evidenciaUrl}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200 flex items-center justify-center"
                                title="Ver evidencia de la mañana"
                              >
                                <ImageIcon className="w-4 h-4" />
                              </a>
                            )}
                            {a.evidenciaAlmuerzoUrl && (
                              <a
                                href={`${(import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace('/api', '')}${a.evidenciaAlmuerzoUrl}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 bg-amber-50 text-amber-600 hover:bg-amber-100 rounded-lg transition-colors border border-amber-200 flex items-center justify-center"
                                title="Ver evidencia del almuerzo"
                              >
                                <ImageIcon className="w-4 h-4" />
                              </a>
                            )}
                            <button
                              onClick={() => handleDeleteAttendance(a.id)}
                              className="p-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-colors border border-red-200 flex items-center justify-center"
                              title="Eliminar registro"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredAttendances.length === 0 && (
                    <tr>
                      <td colSpan="8" className="px-6 py-10 text-center text-slate-500">
                        No se encontraron registros para los filtros seleccionados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>

      </div>

      {/* Modal de Detalles */}
      {selectedEmployeeDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm transition-opacity">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-lg font-bold text-slate-800">
                  Detalle de Asistencia
                </h3>
                <p className="text-sm text-slate-500">Filtrado para el periodo seleccionado</p>
              </div>
              <button
                onClick={() => setSelectedEmployeeDetails(null)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto overflow-x-auto p-6 bg-white">
              <div className="min-w-full inline-block align-middle">
                <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    <th className="px-4 py-3">Fecha</th>
                    <th className="px-4 py-3">Horarios Registrados</th>
                    <th className="px-4 py-3">Hrs Extras</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3">Observaciones</th>
                    <th className="px-4 py-3 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {processedAttendances.filter(a => a.usuarioId === selectedEmployeeDetails).map((a) => {
                    const isTarde = a.estado.nombre === 'TARDE';
                    const isFalta = a.estado.nombre === 'AUSENTE';
                    return (
                      <tr key={a.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <p className="font-medium text-slate-800">{dayjs(a.fecha).add(5, 'hour').format('DD MMM, YYYY')}</p>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs space-y-1">
                          {a.horaEntrada && <p><span className="text-slate-400">Entrada:</span> <span className="font-medium text-slate-700">{dayjs(a.horaEntrada).format('hh:mm A')}</span></p>}
                          {a.horaSalidaAlmuerzo && <p><span className="text-slate-400">Sale Almz:</span> <span className="font-medium text-slate-700">{dayjs(a.horaSalidaAlmuerzo).format('hh:mm A')}</span></p>}
                          {a.horaEntradaAlmuerzo && <p><span className="text-slate-400">Vuelve Almz:</span> <span className="font-medium text-slate-700">{dayjs(a.horaEntradaAlmuerzo).format('hh:mm A')}</span></p>}
                          {a.horaSalida && <p><span className="text-slate-400">Salida:</span> <span className="font-medium text-slate-700">{dayjs(a.horaSalida).format('hh:mm A')}</span></p>}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {a.minutosExtra > 0 ? (
                            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-indigo-50 text-indigo-700">
                              + {formatMinutes(a.minutosExtra)}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400 font-medium px-2 py-1">
                              0m
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col space-y-2">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border w-fit ${
                              isTarde ? 'bg-amber-50 text-amber-700 border-amber-200' : 
                              isFalta ? 'bg-red-50 text-red-700 border-red-200' : 
                              'bg-emerald-50 text-emerald-700 border-emerald-200'
                            }`}>
                              Mañana: {a.estado.nombre}
                            </span>
                            {a.tardeAlmuerzo && (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border w-fit bg-red-50 text-red-700 border-red-200">
                                Tarde de Almuerzo
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500 max-w-[300px]">
                          {a.observaciones || <span className="italic text-slate-400">Sin observaciones</span>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center space-x-2">
                            {a.evidenciaUrl && (
                              <a
                                href={`${(import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace('/api', '')}${a.evidenciaUrl}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200 flex items-center justify-center"
                                title="Ver evidencia adjunta"
                              >
                                <ImageIcon className="w-4 h-4" />
                              </a>
                            )}
                            <button
                              onClick={() => handleDeleteAttendance(a.id)}
                              className="p-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-colors border border-red-200 flex items-center justify-center"
                              title="Eliminar registro"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Aprobación de Extras */}
      {approvingExtra && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm transition-opacity">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-bold text-slate-800">
                Aprobar Horas Extras
              </h3>
              <button
                onClick={() => setApprovingExtra(null)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleApproveExtrasSubmit} className="p-6 bg-white space-y-4">
              <div>
                <p className="text-sm font-medium text-slate-700 mb-1">Empleado</p>
                <p className="text-sm text-slate-600 bg-slate-50 p-2 rounded border border-slate-100">
                  {approvingExtra.usuario.nombre} {approvingExtra.usuario.apellido}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-slate-700 mb-1">Sugerido (Sistema)</p>
                  <p className="text-sm text-indigo-600 font-bold bg-indigo-50 p-2 rounded border border-indigo-100">
                    {formatMinutes(approvingExtra.minutosExtra)}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Aprobar (Minutos)</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={extraMinutesToApprove}
                    onChange={(e) => setExtraMinutesToApprove(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  />
                </div>
              </div>
              <p className="text-xs text-slate-500 italic mt-2">
                Equivale a: {formatMinutes(Number(extraMinutesToApprove) || 0)}
              </p>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setApprovingExtra(null)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-colors shadow-sm"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
