import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { LogIn, Mail, Lock, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import { useNavigate } from 'react-router-dom';
import Globe from 'react-globe.gl';

export default function Login() {
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const globeEl = useRef();
  
  // Estado para la posición del satélite
  const [satellitePos, setSatellitePos] = useState({ lat: 15, lng: 0, alt: 0.4 });

  // Auto-rotar el globo terrestre y orbitar el satélite
  useEffect(() => {
    if (globeEl.current) {
      globeEl.current.controls().autoRotate = true;
      globeEl.current.controls().autoRotateSpeed = 1.0;
      globeEl.current.controls().enableZoom = false; // Evitar que el usuario haga zoom y lo rompa visualmente
    }

    let frameId;
    const animateSatellite = () => {
      setSatellitePos(prev => ({
        ...prev,
        lng: prev.lng >= 360 ? 0 : prev.lng + 0.8, // Velocidad de órbita
        lat: Math.sin(Date.now() / 1500) * 20 // Movimiento ondulado vertical
      }));
      frameId = requestAnimationFrame(animateSatellite);
    };
    
    frameId = requestAnimationFrame(animateSatellite);
    
    return () => cancelAnimationFrame(frameId);
  }, []);
  
  const setAuth = useAuthStore((state) => state.setAuth);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await api.post('/auth/login', { correo, contrasena });
      setAuth(response.data.usuario, response.data.token);
      
      setTimeout(() => {
        navigate(response.data.usuario.rol === 'ADMIN' ? '/admin' : '/dashboard');
      }, 500);
      
    } catch (err) {
      setError(err.response?.data?.error || 'Error al conectar con el servidor');
    } finally {
      setLoading(false);
    }
  };

  // Generar posiciones aleatorias para las estrellas solo una vez
  const [stars] = useState(() => 
    Array.from({ length: 150 }).map((_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      size: `${Math.random() * 2.5 + 0.5}px`,
      delay: `${Math.random() * 5}s`,
      duration: `${Math.random() * 3 + 2}s`
    }))
  );

  return (
    <div className="min-h-screen bg-slate-900 flex overflow-hidden relative">
      
      {/* Estilos CSS para el parpadeo de las estrellas */}
      <style>{`
        @keyframes twinkle {
          0%, 100% { opacity: 0.1; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.5); box-shadow: 0 0 10px 2px rgba(255,255,255,0.8); }
        }
        .star { animation: twinkle infinite ease-in-out; }
      `}</style>

      {/* 3D Globe Section (Left Side - Hidden on Mobile) */}
      <div className="hidden lg:flex lg:w-3/5 relative items-center justify-center bg-black overflow-hidden">
        
        {/* Fondo de Estrellas */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          {stars.map(star => (
            <div
              key={star.id}
              className="absolute rounded-full bg-white star"
              style={{
                left: star.left,
                top: star.top,
                width: star.size,
                height: star.size,
                animationDelay: star.delay,
                animationDuration: star.duration,
              }}
            />
          ))}
        </div>

        {/* Glow effect detrás del mundo */}
        <div className="absolute w-[600px] h-[600px] bg-blue-600/20 rounded-full blur-[120px] pointer-events-none z-0"></div>
        
        {/* React Globe 3D */}
        <div className="absolute inset-0 z-10 flex items-center justify-center cursor-move">
          <Globe
            ref={globeEl}
            globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
            bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
            backgroundColor="rgba(0,0,0,0)"
            width={800}
            height={800}
            htmlElementsData={[satellitePos]}
            htmlAltitude="alt"
            htmlElement={d => {
              const el = document.createElement('div');
              el.innerHTML = `
                <div style="display:flex; flex-direction:column; items-center; justify-content:center; position:relative; pointer-events:none;">
                  <div style="background-color:rgba(147, 51, 234, 0.9); padding:4px; border-radius:50%; box-shadow: 0 0 15px 5px rgba(147, 51, 234, 0.6); animation: pulse 2s infinite;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 7 9 3 5 7l4 4"/><path d="m17 11 4 4-4 4-4-4"/><path d="m8 12 8 8"/><path d="m16 8-8-8"/><path d="M16.7 12.7 18 14"/><path d="M12.7 16.7 14 18"/><path d="M7 17l-4 4"/></svg>
                  </div>
                  <div style="position:absolute; top:24px; left:50%; transform:translateX(-50%); font-size:10px; color:white; font-weight:bold; text-shadow:0 0 5px black; white-space:nowrap;">PUNTUALITO GPS</div>
                </div>
              `;
              return el;
            }}
            // Dibujar una línea (láser) desde el satélite hacia la superficie
            arcsData={[{
              startLat: satellitePos.lat,
              startLng: satellitePos.lng,
              endLat: satellitePos.lat,
              endLng: satellitePos.lng,
              color: ['rgba(147, 51, 234, 0.8)', 'rgba(255, 255, 255, 0.2)']
            }]}
            arcAltitude={0.4}
            arcStroke={1.5}
            arcDashLength={0.5}
            arcDashGap={0.2}
            arcDashAnimateTime={1000}
            arcsTransitionDuration={0}
          />
        </div>
        
        {/* Overlay text */}
        <div className="absolute bottom-12 left-12 z-20 pointer-events-none">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.8 }}
          >
            <h2 className="text-4xl font-bold text-white mb-2">El futuro de tu empresa.</h2>
            <p className="text-slate-400 text-lg max-w-md">
              Gestiona tiempos, ubicaciones y productividad con precisión milimétrica y tecnología de vanguardia.
            </p>
          </motion.div>
        </div>
      </div>

      {/* Login Form Section (Right Side) */}
      <div className="w-full lg:w-2/5 flex items-center justify-center relative bg-slate-900 lg:bg-slate-900/40">
        {/* Animated background glows for Mobile or fallback */}
        <div className="absolute inset-0 z-0 overflow-hidden lg:hidden">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-purple-600 rounded-full mix-blend-screen filter blur-[100px] opacity-40 animate-pulse"></div>
          <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-blue-600 rounded-full mix-blend-screen filter blur-[100px] opacity-40 animate-pulse" style={{ animationDelay: '2s' }}></div>
        </div>

        {/* Glassmorphism Card */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="w-full max-w-md p-8 sm:p-12 z-10"
        >
          <div className="mb-10">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-tr from-purple-600 to-blue-500 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/30">
                <LogIn className="text-white w-6 h-6" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white tracking-tight">Puntualito</h1>
                <p className="text-sm font-medium text-purple-400 tracking-wide uppercase mt-1">Portal de Acceso</p>
              </div>
            </div>
            <h2 className="text-2xl font-semibold text-slate-100">Bienvenido de nuevo</h2>
            <p className="text-slate-400 mt-2 text-sm">Ingresa tus credenciales corporativas para continuar.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Correo Corporativo</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-slate-500 group-focus-within:text-purple-400 transition-colors" />
                </div>
                <input
                  type="email"
                  required
                  className="block w-full pl-11 pr-4 py-3.5 border border-slate-700/50 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-slate-800/50 text-white placeholder-slate-500 transition-all outline-none backdrop-blur-sm"
                  placeholder="tu@empresa.com"
                  value={correo}
                  onChange={(e) => setCorreo(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Contraseña</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-500 group-focus-within:text-purple-400 transition-colors" />
                </div>
                <input
                  type="password"
                  required
                  className="block w-full pl-11 pr-4 py-3.5 border border-slate-700/50 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-slate-800/50 text-white placeholder-slate-500 transition-all outline-none backdrop-blur-sm"
                  placeholder="••••••••"
                  value={contrasena}
                  onChange={(e) => setContrasena(e.target.value)}
                />
              </div>
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="flex items-center space-x-2 text-red-400 bg-red-900/30 border border-red-900/50 p-3.5 rounded-xl text-sm"
              >
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-4 px-4 border border-transparent rounded-xl shadow-lg shadow-purple-900/20 text-sm font-bold text-white bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-purple-500 transition-all disabled:opacity-70 disabled:cursor-not-allowed group relative overflow-hidden"
            >
              <span className="relative flex items-center space-x-2">
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>
                    <span>Iniciar Sesión Segura</span>
                    <CheckCircle className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-all -ml-6 group-hover:ml-0 translate-x-2 group-hover:translate-x-0" />
                  </>
                )}
              </span>
            </button>
          </form>
          
          <div className="mt-8 text-center">
            <p className="text-xs text-slate-500">
              © {new Date().getFullYear()} Puntualito. Todos los derechos reservados.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
