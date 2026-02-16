import { useState, useEffect } from 'react';
import type { FC } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Container } from 'react-bootstrap';
import Header from './components/layout/Header';
import Sidebar from './components/layout/Sidebar';
import ProtectedRoute from './components/ProtectedRoute'; // Importa el componente de ruta protegida
import { useAuth } from './context/AuthContext';

// Importa las páginas
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import UnauthorizedPage from './pages/UnauthorizedPage';
import PreventistaPage from './pages/PreventistaPage';
import AlmacenPage from './pages/AlmacenPage';
import SupervisorPage from './pages/SupervisorPage';
import AdminUsersPage from './pages/AdminUsersPage';
import AdminProductsPage from './pages/AdminProductsPage';

// Importa los archivos CSS
import './App.css';
import './components/layout/Sidebar.css';

const App: FC = () => {
  const { currentUser, loading } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const savedTheme = localStorage.getItem('theme');
    return savedTheme === 'dark' || savedTheme === null;
  });

  useEffect(() => {
    document.body.className = isDarkMode ? 'theme-dark' : 'theme-light';
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  const toggleSidebar = () => setIsSidebarOpen(prev => !prev);
  const toggleDarkMode = () => setIsDarkMode(prev => !prev);

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100">
        <h2>Cargando...</h2>
      </div>
    );
  }

  // Estructura de rutas separada para mayor claridad
  const AppRoutes: FC = () => {
    if (!currentUser) {
      return (
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={<Navigate to="/login" />} />
        </Routes>
      );
    }

    return (
      <div className="app-wrapper">
        <Sidebar isSidebarOpen={isSidebarOpen} toggleSidebar={toggleSidebar} />
        {isSidebarOpen && <div className="sidebar-overlay d-lg-none" onClick={toggleSidebar}></div>}
        <div className="main-content">
          <Header
            toggleSidebar={toggleSidebar}
            isDarkMode={isDarkMode}
            toggleDarkMode={toggleDarkMode}
          />
          <Container fluid className="py-3 flex-grow-1">
            <Routes>
              {/* Ruta pública para usuarios autenticados */}
              <Route path="/dashboard" element={<Dashboard />} />

              {/* Rutas Protegidas */}
              <Route path="/preventista" element={<ProtectedRoute allowedRoles={['preventista']}><PreventistaPage /></ProtectedRoute>} />
              <Route path="/almacen" element={<ProtectedRoute allowedRoles={['almacenero']}><AlmacenPage /></ProtectedRoute>} />
              <Route path="/supervisor" element={<ProtectedRoute allowedRoles={['supervisor']}><SupervisorPage /></ProtectedRoute>} />
              <Route path="/admin/users" element={<ProtectedRoute allowedRoles={['admin']}><AdminUsersPage /></ProtectedRoute>} />
              <Route path="/admin/products" element={<ProtectedRoute allowedRoles={['admin']}><AdminProductsPage /></ProtectedRoute>} />

              {/* Página de no autorizado y redirecciones */}
              <Route path="/unauthorized" element={<UnauthorizedPage />} />
              <Route path="*" element={<Navigate to="/dashboard" />} />
            </Routes>
          </Container>
        </div>
      </div>
    );
  };

  return (
    <Router>
      <AppRoutes />
    </Router>
  );
}

export default App;
