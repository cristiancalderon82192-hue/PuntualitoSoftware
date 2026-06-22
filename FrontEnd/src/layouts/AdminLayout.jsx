import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { LayoutDashboard, LogOut, Users, Settings, Activity, ClipboardList } from 'lucide-react';

export default function AdminLayout({ children }) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { name: 'Dashboard', path: '/admin', icon: LayoutDashboard },
    { name: 'Empleados', path: '/admin/empleados', icon: Users },
    { name: 'Historial y Reportes', shortName: 'Reportes', path: '/admin/historial', icon: ClipboardList },
    { name: 'Configuración', path: '/admin/configuracion', icon: Settings },
  ];

  return (
    <div className="h-screen overflow-hidden bg-slate-50 flex flex-col md:flex-row">
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-64 bg-[#0b1021] flex-shrink-0 flex flex-col hidden md:flex">
        {/* Sidebar Header */}
        <div className="h-16 flex items-center px-6 border-b border-white/10">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-tr from-purple-600 to-blue-500 rounded-lg flex items-center justify-center shadow-md">
              <Activity className="text-white w-4 h-4" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white leading-tight">Admin</h1>
              <p className="text-[10px] text-slate-400 font-medium tracking-wide">PUNTUALITO</p>
            </div>
          </div>
        </div>

        {/* Sidebar Links */}
        <div className="flex-1 py-6 px-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.name}
                to={item.path}
                className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-white/10 text-white font-medium'
                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                <span className="text-sm">{item.name}</span>
              </Link>
            );
          })}
        </div>

        {/* Sidebar Footer (User info & Logout) */}
        <div className="p-4 border-t border-white/10">
          <div className="flex items-center mb-4 px-3">
            <div className="w-8 h-8 bg-slate-800 rounded-full flex items-center justify-center text-white font-bold text-xs uppercase">
              {user?.nombre?.charAt(0)}
            </div>
            <div className="ml-3 overflow-hidden">
              <p className="text-sm font-medium text-white truncate">{user?.nombre} {user?.apellido}</p>
              <p className="text-xs text-slate-400 truncate">{user?.correo}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-red-400 font-medium rounded-lg hover:bg-red-500/10 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="md:hidden bg-[#0b1021] h-16 px-4 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-gradient-to-tr from-purple-600 to-blue-500 rounded-lg flex items-center justify-center">
            <Activity className="text-white w-4 h-4" />
          </div>
          <span className="font-bold text-white text-lg">Admin</span>
        </div>
        <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-white rounded-lg">
          <LogOut className="w-5 h-5" />
        </button>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto pb-20 md:pb-0 relative min-w-0 w-full">
        {children}
      </main>

      {/* Mobile Navigation Bar */}
      <nav className="md:hidden bg-[#0b1021] fixed bottom-0 w-full z-20 pb-safe shadow-[0_-5px_15px_rgba(0,0,0,0.1)]">
        <div className="flex justify-around items-center h-16 px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.name}
                to={item.path}
                className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${
                  isActive ? 'text-white' : 'text-slate-400 hover:text-slate-300'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-purple-400' : ''}`} />
                <span className="text-[10px] font-medium text-center leading-tight">{item.shortName || item.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
