import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import AdminDashboard from './pages/AdminDashboard';
import AdminEmployees from './pages/AdminEmployees';
import AdminConfig from './pages/AdminConfig';
import AdminHistory from './pages/AdminHistory';
import AdminLayout from './layouts/AdminLayout';

// Componente para proteger las rutas de Empleados
const EmployeeRoute = ({ children }) => {
  const { isAuthenticated, user } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  // Si es ADMIN, lo mandamos a su panel
  if (user?.rol === 'ADMIN') return <Navigate to="/admin" replace />;
  return children;
};

// Componente para proteger las rutas de Administradores
const AdminRoute = ({ children }) => {
  const { isAuthenticated, user } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  // Si no es ADMIN, lo mandamos al dashboard de empleado
  if (user?.rol !== 'ADMIN') return <Navigate to="/dashboard" replace />;
  return children;
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        {/* Ruta para Empleados */}
        <Route 
          path="/dashboard" 
          element={
            <EmployeeRoute>
              <Dashboard />
            </EmployeeRoute>
          } 
        />

        {/* Ruta para Administradores */}
        <Route 
          path="/admin" 
          element={
            <AdminRoute>
              <AdminLayout>
                <AdminDashboard />
              </AdminLayout>
            </AdminRoute>
          } 
        />
        <Route 
          path="/admin/empleados" 
          element={
            <AdminRoute>
              <AdminLayout>
                <AdminEmployees />
              </AdminLayout>
            </AdminRoute>
          } 
        />
        <Route 
          path="/admin/configuracion" 
          element={
            <AdminRoute>
              <AdminLayout>
                <AdminConfig />
              </AdminLayout>
            </AdminRoute>
          } 
        />
        <Route 
          path="/admin/historial" 
          element={
            <AdminRoute>
              <AdminLayout>
                <AdminHistory />
              </AdminLayout>
            </AdminRoute>
          } 
        />
        
        {/* Ruta por defecto redirecciona según estado y rol */}
        <Route path="*" element={
          <DefaultRedirect />
        } />
      </Routes>
    </Router>
  );
}

function DefaultRedirect() {
  const { isAuthenticated, user } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return user?.rol === 'ADMIN' ? <Navigate to="/admin" replace /> : <Navigate to="/dashboard" replace />;
}

export default App;
