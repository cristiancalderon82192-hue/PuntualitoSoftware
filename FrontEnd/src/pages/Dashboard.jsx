import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { useGeolocation } from '../hooks/useGeolocation';
import api from '../services/api';
import { LogOut, MapPin, Navigation, CheckCircle, AlertCircle, Clock, Camera, UploadCloud, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import AttendanceMap from '../components/AttendanceMap';
import dayjs from 'dayjs';

export default function Dashboard() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const { location, error: geoError, loading: geoLoading, getLocation, setLocation, setError: setGeoError } = useGeolocation();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);
  const [apiError, setApiError] = useState(null);

  const [attendanceStatus, setAttendanceStatus] = useState(null);
  const [tieneAlmuerzo, setTieneAlmuerzo] = useState(false);
  const [yaAlmorzo, setYaAlmorzo] = useState(false);
  const [sedeInfo, setSedeInfo] = useState(null);
  const [timeLimits, setTimeLimits] = useState(null);
  const [currentAction, setCurrentAction] = useState(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(dayjs());
  const [causasTardanza, setCausasTardanza] = useState([]);

  const loadStatus = async () => {
    try {
      const res = await api.get('/attendance/status');
      setAttendanceStatus(res.data.status);
      setTieneAlmuerzo(res.data.tieneAlmuerzo);
      setYaAlmorzo(res.data.yaAlmorzo);
      setSedeInfo(res.data.sede);
      setTimeLimits(res.data.timeLimits);
      if (res.data.causasTardanza) setCausasTardanza(res.data.causasTardanza);
      
      if (res.data.requireJustification && res.data.asistencia) {
        setAsistenciaId(res.data.asistencia.id);
        setJustifyType('ENTRADA');
        setShowJustifyModal(true);
      } else if (res.data.requireLunchJustification && res.data.asistencia) {
        setAsistenciaId(res.data.asistencia.id);
        setJustifyType('ALMUERZO');
        setShowJustifyModal(true);
      }
    } catch (err) {
      console.error(err);
      setApiError(err.response?.data?.details || err.response?.data?.error || 'Error al cargar tu estado de asistencia. Recarga la página.');
    } finally {
      setStatusLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
    getLocation(); // Solicitar GPS automáticamente al abrir
    
    // Actualizar la hora local cada segundo para habilitar botones en tiempo real exacto
    const timer = setInterval(() => setCurrentTime(dayjs()), 1000);
    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Efecto para registrar automáticamente la llegada (auto check-in)
  useEffect(() => {
    if (attendanceStatus === 'PENDIENTE_ENTRADA' && !isSubmitting && !currentAction) {
      handleCheckIn('ENTRADA');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attendanceStatus]);

  // Estados para justificación
  const [showJustifyModal, setShowJustifyModal] = useState(false);
  const [justifyType, setJustifyType] = useState('ENTRADA');
  const [asistenciaId, setAsistenciaId] = useState(null);
  const [causaSeleccionada, setCausaSeleccionada] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [evidencia, setEvidencia] = useState(null);
  const [isSubmittingJustification, setIsSubmittingJustification] = useState(false);

  const format12h = (timeStr) => {
    if (!timeStr) return '';
    return dayjs(`2000-01-01T${timeStr}`).format('hh:mm A');
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleCheckIn = async (action) => {
    setCurrentAction(action);
    setApiError(null);
    setSuccessMsg(null);
    
    if (location) {
      registrarAsistencia(location, action);
    } else {
      getLocation();
    }
  };

  useEffect(() => {
    if (location && !isSubmitting && !successMsg && currentAction) {
      registrarAsistencia(location, currentAction);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  const registrarAsistencia = async (coords, action) => {
    setIsSubmitting(true);
    setApiError(null);
    try {
      const response = await api.post('/attendance/check-in', {
        latitud: coords.latitud,
        longitud: coords.longitud,
        action
      });
      
      if (response.data.isTarde && action === 'ENTRADA') {
        setAsistenciaId(response.data.asistencia.id);
        setJustifyType('ENTRADA');
        setShowJustifyModal(true);
        loadStatus();
      } else if (response.data.isTardeAlmuerzo && action === 'ENTRADA_ALMUERZO') {
        setAsistenciaId(response.data.asistencia.id);
        setJustifyType('ALMUERZO');
        setShowJustifyModal(true);
        loadStatus();
      } else {
        setSuccessMsg(response.data.mensaje);
        loadStatus();
        setTimeout(() => setSuccessMsg(null), 3000);
      }
    } catch (err) {
      setApiError(err.response?.data?.error || 'Error al conectar con el servidor');
      // setLocation(null); // No limpiar la ubicación para que el mapa siga visible
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitJustification = async (e) => {
    e.preventDefault();
    if (!causaSeleccionada) {
      alert('Debes seleccionar una causa de tardanza');
      return;
    }
    if (causaSeleccionada === 'OTRO' && !observaciones.trim()) {
      alert('Por favor especifica el motivo en las observaciones');
      return;
    }

    const textoFinal = causaSeleccionada === 'OTRO' ? observaciones : (observaciones ? `${causaSeleccionada}: ${observaciones}` : causaSeleccionada);

    setIsSubmittingJustification(true);
    try {
      const formData = new FormData();
      formData.append('observaciones', textoFinal);
      if (evidencia && justifyType !== 'ALMUERZO') formData.append('evidencia', evidencia);
      formData.append('tipo', justifyType);

      await api.patch(`/attendance/${asistenciaId}/justify`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      setShowJustifyModal(false);
      setSuccessMsg('Asistencia y justificación guardadas correctamente');
      loadStatus();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      alert(err.response?.data?.error || 'Error al enviar justificación');
    } finally {
      setIsSubmittingJustification(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-tr from-purple-600 to-blue-500 rounded-xl flex items-center justify-center shadow-md">
              <Clock className="text-white w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800 leading-tight">Puntualito</h1>
              <p className="text-xs text-slate-500 font-medium tracking-wide">{user?.rol}</p>
            </div>
          </div>
          
          <button 
            onClick={handleLogout}
            className="flex items-center space-x-2 px-3 py-2 sm:px-4 sm:py-2 text-sm bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors font-medium"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Cerrar Sesión</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-8 flex flex-col items-center justify-center relative">
        
        {/* Saludo */}
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold text-slate-800 mb-2">¡Hola, {user?.nombre}!</h2>
          <p className="text-slate-500 flex items-center justify-center space-x-2">
            <MapPin className="w-4 h-4" />
            <span>Sede asignada: <strong>{user?.sede}</strong></span>
          </p>
        </div>

        {/* Live GPS Map Loader */}
        {geoLoading && !location && (
          <div className="w-full max-w-md h-[250px] bg-slate-100 animate-pulse rounded-2xl border border-slate-200 mb-6 flex flex-col items-center justify-center text-slate-500">
            <Navigation className="w-8 h-8 mb-2 animate-bounce" />
            <p className="text-sm font-medium">Buscando señal GPS...</p>
          </div>
        )}

        {/* Live GPS Map */}
        {location && sedeInfo && (
          <div className="w-full max-w-md">
            <AttendanceMap 
              userLat={location.latitud} 
              userLng={location.longitud} 
              sedeLat={sedeInfo.latitud} 
              sedeLng={sedeInfo.longitud} 
              sedeRadius={sedeInfo.radioPermitido}
            />
          </div>
        )}

        {/* Acciones de Asistencia */}
        <div className="relative mb-8 w-full max-w-md">
          {statusLoading ? (
            <div className="flex justify-center py-10">
              <div className="w-12 h-12 border-4 border-slate-200 border-t-purple-600 rounded-full animate-spin"></div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              
              {/* Mostrar errores del GPS si ocurren */}
              {geoError && (
                <div className="w-full bg-red-50 text-red-700 p-4 rounded-2xl flex flex-col items-center justify-center text-center border border-red-100 shadow-sm">
                  <AlertCircle className="w-8 h-8 mb-2 text-red-500" />
                  <p className="text-sm font-bold">{geoError}</p>
                  <p className="text-xs mt-1 opacity-80">Por favor, revisa los permisos de ubicación o asegúrate de tener el GPS encendido.</p>
                </div>
              )}

              {attendanceStatus === 'PENDIENTE_ENTRADA' && (
                (apiError || geoError) ? (
                  <button 
                    onClick={() => handleCheckIn('ENTRADA')}
                    disabled={isSubmitting || geoLoading}
                    className="w-full bg-slate-800 hover:bg-slate-900 text-white py-4 rounded-2xl shadow-lg flex items-center justify-center space-x-3 font-bold text-lg transition-all"
                  >
                    <span>Reintentar Registro de Llegada</span>
                  </button>
                ) : (
                  <div className="w-full bg-slate-100 text-slate-500 py-4 rounded-2xl flex items-center justify-center space-x-3 font-bold text-lg border border-slate-200">
                    <div className="w-5 h-5 border-2 border-slate-400 border-t-purple-600 rounded-full animate-spin"></div>
                    <span>Registrando tu llegada automáticamente...</span>
                  </div>
                )
              )}

              {attendanceStatus === 'TRABAJANDO' && (
                <>
                  {tieneAlmuerzo && !yaAlmorzo && (
                    <button
                      onClick={() => handleCheckIn('SALIDA_ALMUERZO')}
                      disabled={geoLoading || isSubmitting || successMsg || (timeLimits?.horaInicioAlmuerzo && currentTime.format('HH:mm') < timeLimits.horaInicioAlmuerzo.substring(0, 5))}
                      className="w-full bg-amber-500 hover:bg-amber-600 text-white py-4 rounded-2xl shadow-lg flex items-center justify-center space-x-3 font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      title={timeLimits?.horaInicioAlmuerzo && currentTime.format('HH:mm') < timeLimits.horaInicioAlmuerzo.substring(0, 5) ? `Disponible desde las ${format12h(timeLimits.horaInicioAlmuerzo)}` : ''}
                    >
                      <Clock className="w-6 h-6" />
                      <span>{timeLimits?.horaInicioAlmuerzo && currentTime.format('HH:mm') < timeLimits.horaInicioAlmuerzo.substring(0, 5) ? `Almuerzo a las ${format12h(timeLimits.horaInicioAlmuerzo)}` : 'Salida a Almorzar'}</span>
                    </button>
                  )}

                  <button
                    onClick={() => handleCheckIn('SALIDA')}
                    disabled={geoLoading || isSubmitting || successMsg || (timeLimits?.horaFinJornada && currentTime.format('HH:mm') < timeLimits.horaFinJornada.substring(0, 5))}
                    className="w-full bg-slate-800 hover:bg-slate-900 text-white py-4 rounded-2xl shadow-lg flex items-center justify-center space-x-3 font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    title={timeLimits?.horaFinJornada && currentTime.format('HH:mm') < timeLimits.horaFinJornada.substring(0, 5) ? `Disponible desde las ${format12h(timeLimits.horaFinJornada)}` : ''}
                  >
                    <LogOut className="w-6 h-6" />
                    <span>{timeLimits?.horaFinJornada && currentTime.format('HH:mm') < timeLimits.horaFinJornada.substring(0, 5) ? `Salida a las ${format12h(timeLimits.horaFinJornada)}` : 'Finalizar Jornada'}</span>
                  </button>
                </>
              )}

              {attendanceStatus === 'EN_ALMUERZO' && (() => {
                let lunchLateMinutes = 0;
                if (timeLimits?.horaFinAlmuerzo) {
                  const limitTimeStr = timeLimits.horaFinAlmuerzo.length === 5 ? `${timeLimits.horaFinAlmuerzo}:00` : timeLimits.horaFinAlmuerzo;
                  const today = currentTime.format('YYYY-MM-DD');
                  const limitObj = dayjs(`${today}T${limitTimeStr}`);
                  const diff = currentTime.diff(limitObj, 'minute');
                  if (diff > 0) {
                    lunchLateMinutes = diff;
                  }
                }
                const isLate = lunchLateMinutes > 0;

                return (
                  <button
                    onClick={() => handleCheckIn('ENTRADA_ALMUERZO')}
                    disabled={geoLoading || isSubmitting || successMsg}
                    className={`w-full text-white py-4 rounded-2xl shadow-lg flex items-center justify-center space-x-3 font-bold text-lg disabled:opacity-70 transition-all ${
                      isLate ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-500 hover:bg-emerald-600'
                    }`}
                  >
                    <CheckCircle className="w-6 h-6" />
                    <span>
                      {isLate 
                        ? `Regreso de Almuerzo (${lunchLateMinutes}m tarde)` 
                        : 'Regreso de Almuerzo'
                      }
                    </span>
                  </button>
                );
              })()}

              {attendanceStatus === 'JORNADA_FINALIZADA' && (
                <div className="w-full bg-slate-100 text-slate-500 py-4 rounded-2xl flex items-center justify-center space-x-3 font-bold text-lg border border-slate-200">
                  <CheckCircle className="w-6 h-6" />
                  <span>Jornada Finalizada por Hoy</span>
                </div>
              )}

              {attendanceStatus === 'AUSENTE' && (
                <div className="w-full bg-rose-50 text-rose-600 py-4 rounded-2xl flex items-center justify-center space-x-3 font-bold text-lg border border-rose-200">
                  <AlertCircle className="w-6 h-6" />
                  <span>Has sido marcado como ausente hoy</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Mensajes de Error o Éxito */}
        <AnimatePresence mode="wait">
          {(geoError || apiError) && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-md bg-red-50 border border-red-200 text-red-700 p-4 rounded-2xl flex items-start space-x-3 shadow-sm"
            >
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-sm">No pudimos registrar tu llegada</h3>
                <p className="text-sm mt-1 opacity-90">{geoError || apiError}</p>
                {apiError?.includes('metros') && (
                  <button 
                    onClick={() => { setApiError(null); setGeoError(null); getLocation(); }}
                    className="mt-3 text-sm font-medium text-red-700 bg-red-100 hover:bg-red-200 px-4 py-2 rounded-lg transition-colors"
                  >
                    Intentar de nuevo
                  </button>
                )}
              </div>
            </motion.div>
          )}

          {successMsg && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full max-w-md bg-emerald-50 border border-emerald-200 text-emerald-700 p-4 rounded-2xl flex items-center justify-center space-x-2 shadow-sm text-center"
            >
              <span className="font-semibold">{successMsg}</span>
            </motion.div>
          )}
        </AnimatePresence>

      </main>

      {/* Modal de Justificación de Tardanza */}
      <AnimatePresence>
        {showJustifyModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="bg-amber-50 px-6 py-4 border-b border-amber-100 flex items-center space-x-3">
                <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-amber-800">
                    {justifyType === 'ALMUERZO' ? 'Regresaste Tarde de Almorzar' : 'Llegaste Tarde'}
                  </h3>
                  <p className="text-xs text-amber-600/80">Por favor, adjunta una justificación</p>
                </div>
              </div>
              
              <div className="p-6 overflow-y-auto">
                <form id="justify-form" onSubmit={handleSubmitJustification} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Causa de Tardanza</label>
                    <select 
                      value={causaSeleccionada}
                      onChange={e => setCausaSeleccionada(e.target.value)}
                      className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-amber-500 outline-none text-sm bg-white"
                    >
                      <option value="">Selecciona una causa...</option>
                      {causasTardanza.map(c => (
                        <option key={c.id} value={c.nombre}>{c.nombre}</option>
                      ))}
                      <option value="OTRO">Otra (Especifique)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Observaciones Adicionales {causaSeleccionada === 'OTRO' && <span className="text-red-500">*</span>}</label>
                    <textarea 
                      value={observaciones}
                      onChange={e => setObservaciones(e.target.value)}
                      className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-amber-500 outline-none resize-none h-20 text-sm"
                      placeholder="Detalles opcionales..."
                    ></textarea>
                  </div>
                  
                  {justifyType !== 'ALMUERZO' && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Evidencia Fotográfica</label>
                      <div className="relative border-2 border-dashed border-slate-300 rounded-xl p-4 flex flex-col items-center justify-center hover:bg-slate-50 transition-colors">
                        <input 
                          type="file" 
                          accept="image/*"
                          capture="environment"
                          onChange={e => setEvidencia(e.target.files[0])}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        {evidencia ? (
                          <div className="text-center">
                            <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                            <p className="text-sm font-medium text-slate-700 truncate max-w-[200px]">{evidencia.name}</p>
                            <p className="text-xs text-emerald-600 mt-1">¡Foto cargada!</p>
                          </div>
                        ) : (
                          <div className="text-center text-slate-500">
                            <Camera className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm font-medium">Toca para tomar una foto</p>
                            <p className="text-xs mt-1">o sube desde la galería</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </form>
              </div>

              <div className="p-6 border-t border-slate-100 bg-slate-50 flex gap-3">
                <button 
                  type="submit"
                  form="justify-form"
                  disabled={isSubmittingJustification || !causaSeleccionada || (causaSeleccionada === 'OTRO' && !observaciones.trim())}
                  className="flex-1 bg-amber-500 text-white font-medium py-2.5 rounded-xl hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                >
                  {isSubmittingJustification ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <UploadCloud className="w-5 h-5" />
                      <span>Enviar Justificación</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
