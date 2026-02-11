import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Container } from 'react-bootstrap';
import Header from './components/layout/Header';
import Sidebar from './components/layout/Sidebar';
import { useAuth } from './context/AuthContext'; // Para acceder al usuario autenticado

// Importar las páginas (aún no creadas, solo esqueletos)
import LoginPage from './pages/LoginPage'; // Esta la crearemos en el siguiente paso
import Dashboard from './pages/Dashboard';
// TODO: Importar otras páginas según los roles: PreventistaDashboard, AlmaceneroDashboard, SupervisorDashboard, AdminUsers, AdminProducts

import './App.css'; // Estilos generales de la aplicación
import './components/layout/Sidebar.css'; // Importa los estilos del Sidebar

function App() {
  const { currentUser } = useAuth(); // Accede al usuario actual del contexto de autenticación
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    // Lee el tema del localStorage o usa dark por defecto
    const savedTheme = localStorage.getItem('theme');
    return savedTheme === 'dark' || savedTheme === null;
  });

  // Efecto para aplicar el tema al body y guardar en localStorage
  useEffect(() => {
    document.body.className = isDarkMode ? 'bg-dark text-white' : 'bg-light text-dark';
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };

  return (
    <Router>
      <div className={`app-wrapper d-flex ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
        {currentUser && <Sidebar isSidebarOpen={isSidebarOpen} />} {/* Mostrar Sidebar solo si está autenticado */}
        
        <div className={`main-content flex-grow-1 ${isSidebarOpen && currentUser ? 'content-shifted' : ''}`}>
          {currentUser && (
            <Header
              toggleSidebar={toggleSidebar}
              isDarkMode={isDarkMode}
              toggleDarkMode={toggleDarkMode}
            />
          )}

          <Container fluid className="py-4">
            <Routes>
              {/* Rutas públicas o accesibles sin autenticación */}
              <Route path="/login" element={<LoginPage />} />

              {/* Rutas protegidas - Requieren autenticación */}
              {currentUser ? (
                <>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  {/* TODO: Añadir rutas protegidas para los diferentes roles */}
                  {/* <Route path="/preventista" element={<PreventistaDashboard />} /> */}
                  {/* <Route path="/almacen" element={<AlmaceneroDashboard />} /> */}
                  {/* <Route path="/supervisor" element={<SupervisorDashboard />} /> */}
                  {/* <Route path="/admin/users" element={<AdminUsers />} /> */}
                  {/* <Route path="/admin/products" element={<AdminProducts />} /> */}
                </>
              ) : (
                // Redirigir a login si no está autenticado y la ruta no es /login
                <Route path="*" element={<LoginPage />} />
              )}
            </Routes>
          </Container>
        </div>
      </div>
    </Router>
  );
}

export default App;