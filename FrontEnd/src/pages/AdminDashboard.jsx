import { useEffect, useState } from 'react';
import api from '../services/api';
import { Users, CheckCircle, Clock, XCircle, Coffee, MapPin } from 'lucide-react';
import { motion } from 'framer-motion';
import dayjs from 'dayjs';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix para los íconos de Leaflet en React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const StatCard = ({ title, value, icon: Icon, colorClass, delay }) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay }}
    className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex items-center space-x-4"
  >
    <div className={`p-4 rounded-xl ${colorClass}`}>
      <Icon className="w-6 h-6 text-white" />
    </div>
    <div>
      <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
      <h3 className="text-3xl font-bold text-slate-800">{value}</h3>
    </div>
  </motion.div>
);

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const fetchStats = async () => {
      try {
        const response = await api.get('/admin/stats');
        if (isMounted) setStats(response.data);
      } catch (err) {
        if (isMounted) setError('Error al cargar las estadísticas');
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchStats();
    
    // Poll every 5 seconds for real-time updates
    const interval = setInterval(fetchStats, 5000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-slate-800">Vista General de Hoy</h2>
          <p className="text-slate-500">Métricas en tiempo real de la asistencia corporativa.</p>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="w-12 h-12 border-4 border-slate-200 border-t-purple-600 rounded-full animate-spin"></div>
          </div>
        ) : error ? (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100">{error}</div>
        ) : (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 mb-10">
              <StatCard 
                title="Total Empleados" 
                value={stats.estadisticas.totalEmpleados} 
                icon={Users} 
                colorClass="bg-blue-500"
                delay={0.1}
              />
              <StatCard 
                title="Llegaron Puntual" 
                value={stats.estadisticas.puntuales} 
                icon={CheckCircle} 
                colorClass="bg-emerald-500"
                delay={0.2}
              />
              <StatCard 
                title="Llegaron Tarde" 
                value={stats.estadisticas.tardes} 
                icon={Clock} 
                colorClass="bg-amber-500"
                delay={0.3}
              />
              <StatCard 
                title="En Almuerzo" 
                value={stats.estadisticas.enAlmuerzo} 
                icon={Coffee} 
                colorClass="bg-purple-500"
                delay={0.4}
              />
              <StatCard 
                title="Ausentes (Aún no llegan)" 
                value={stats.estadisticas.ausentes} 
                icon={XCircle} 
                colorClass="bg-rose-500"
                delay={0.5}
              />
            </div>

            {/* Sedes Map Section */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.5 }}
              className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mb-10"
            >
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800">Mapa de Sedes</h3>
                </div>
              </div>
              
              <div className="h-96 w-full relative z-0">
                {stats.sedes && stats.sedes.length > 0 ? (
                  <MapContainer 
                    center={[Number(stats.sedes[0].latitud), Number(stats.sedes[0].longitud)]} 
                    zoom={12} 
                    style={{ height: '100%', width: '100%', zIndex: 0 }}
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    {stats.sedes.map((sede) => (
                      <div key={sede.id}>
                        <Marker 
                          position={[Number(sede.latitud), Number(sede.longitud)]}
                        >
                          <Popup>
                            <div className="text-center">
                              <h4 className="font-bold text-slate-800">{sede.nombre}</h4>
                              {sede.direccion && <p className="text-xs text-slate-500 mt-1">{sede.direccion}</p>}
                              <p className="text-xs font-medium text-emerald-600 mt-1">Radio: {sede.radioPermitido}m</p>
                            </div>
                          </Popup>
                        </Marker>
                        <Circle 
                          center={[Number(sede.latitud), Number(sede.longitud)]} 
                          radius={sede.radioPermitido} 
                          pathOptions={{ fillColor: '#10b981', color: '#059669', weight: 2 }} 
                        />
                      </div>
                    ))}
                  </MapContainer>
                ) : (
                  <div className="flex justify-center items-center h-full text-slate-500">
                    No hay sedes registradas para mostrar en el mapa.
                  </div>
                )}
              </div>
            </motion.div>

            {/* Recent Attendances Table */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.6 }}
              className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden"
            >
              <div className="px-6 py-5 border-b border-slate-100">
                <h3 className="text-lg font-bold text-slate-800">Registros Recientes</h3>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-sm font-medium text-slate-500 uppercase tracking-wider">
                      <th className="px-6 py-4">Empleado</th>
                      <th className="px-6 py-4">Sede</th>
                      <th className="px-6 py-4">Hora de Entrada</th>
                      <th className="px-6 py-4">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {stats.registrosRecientes.length === 0 ? (
                      <tr>
                        <td colSpan="4" className="px-6 py-8 text-center text-slate-500">
                          Nadie ha marcado asistencia el día de hoy.
                        </td>
                      </tr>
                    ) : (
                      stats.registrosRecientes.map((registro, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4 font-medium text-slate-800">
                            {registro.usuario.nombre} {registro.usuario.apellido}
                          </td>
                          <td className="px-6 py-4 text-slate-600">
                            {registro.sede.nombre}
                          </td>
                          <td className="px-6 py-4 text-slate-600 font-mono text-sm">
                            {registro.horaEntrada ? dayjs(registro.horaEntrada).format('hh:mm:ss A') : '--:--'}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-wrap gap-2 items-center">
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border
                                ${registro.estado.nombre === 'PUNTUAL' 
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                  : 'bg-amber-50 text-amber-700 border-amber-200'
                                }`}
                              >
                                {registro.estado.nombre}
                              </span>
                              {registro.horaSalidaAlmuerzo && !registro.horaEntradaAlmuerzo && !registro.horaSalida && (
                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border bg-purple-50 text-purple-700 border-purple-200">
                                  En Almuerzo
                                </span>
                              )}
                              {registro.horaSalida && (
                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border bg-slate-100 text-slate-600 border-slate-200">
                                  Jornada Finalizada
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>

            {/* Absent Employees Table */}
            {stats.empleadosAusentes && stats.empleadosAusentes.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.7 }}
                className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mt-6"
              >
                <div className="px-6 py-5 border-b border-slate-100">
                  <h3 className="text-lg font-bold text-slate-800">Empleados Ausentes (Aún no llegan)</h3>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-sm font-medium text-slate-500 uppercase tracking-wider">
                        <th className="px-6 py-4">Empleado</th>
                        <th className="px-6 py-4">Sede</th>
                        <th className="px-6 py-4">Hora de Entrada</th>
                        <th className="px-6 py-4">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {stats.empleadosAusentes.map((registro, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4 font-medium text-slate-800">
                            {registro.usuario.nombre} {registro.usuario.apellido}
                          </td>
                          <td className="px-6 py-4 text-slate-600">
                            {registro.sede.nombre}
                          </td>
                          <td className="px-6 py-4 text-slate-600 font-mono text-sm">
                            -
                          </td>
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border bg-rose-50 text-rose-700 border-rose-200">
                              AUSENTE
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}

          </>
        )}
      </div>
    </div>
  );
}
