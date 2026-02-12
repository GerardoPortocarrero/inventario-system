import React, { useState, useEffect, FC } from 'react'; // Importa FC
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Container } from 'react-bootstrap';
import Header from './components/layout/Header';
import Sidebar from './components/layout/Sidebar';
import { useAuth } from './context/AuthContext';

import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';

// Importa los archivos CSS (las extensiones no cambian)
import './App.css';
import './components/layout/Sidebar.css';

const App: FC = () => { // Define el tipo de componente funcional
  const { currentUser, loading } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false); // Reintroduce isSidebarOpen, oculto por defecto en móviles
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => { // Tipado
    const savedTheme = localStorage.getItem('theme');
    return savedTheme === 'dark' || savedTheme === null;
  });

  useEffect(() => {
    document.body.className = isDarkMode ? 'theme-dark' : 'theme-light';
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  const toggleSidebar = () => setIsSidebarOpen(prev => !prev); // Reintroduce toggleSidebar
  const toggleDarkMode = () => setIsDarkMode(prev => !prev); // Uso de prev para actualizar estado

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100">
        <h2>Cargando...</h2>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        {/* Si no hay usuario, solo renderiza la ruta de login */}
        {!currentUser && (
          <Route path="/login" element={
            // El div no necesita la clase 'login-page-wrapper' si el CSS global ya lo centra
            <LoginPage />
          } />
        )}

        {/* Si hay usuario, renderiza el layout principal */}
        {currentUser && (
          <Route path="/*" element={
            <div className={`app-wrapper ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
              <Sidebar isSidebarOpen={isSidebarOpen} toggleSidebar={toggleSidebar} /> {/* Pasa toggleSidebar a Sidebar */}
              {/* Overlay para cerrar el sidebar en responsive */}
              {isSidebarOpen && <div className="sidebar-overlay d-lg-none" onClick={toggleSidebar}></div>}
              <div className={`main-content ${isSidebarOpen ? 'content-shifted' : ''}`}>
                <Header
                  toggleSidebar={toggleSidebar}
                  isDarkMode={isDarkMode}
                  toggleDarkMode={toggleDarkMode}
                  isSidebarOpen={isSidebarOpen}
                />
                <Container fluid className="py-4 flex-grow-1">
                  <Routes>
                    <Route path="/dashboard" element={<Dashboard />} />
                    {/* Otras rutas protegidas aquí */}
                    <Route path="*" element={<Navigate to="/dashboard" />} />
                  </Routes>
                </Container>
              </div>
            </div>
          } />
        )}

        {/* Redirecciones generales */}
        <Route path="*" element={<Navigate to={currentUser ? "/dashboard" : "/login"} />} />
      </Routes>
    </Router>
  );
}

export default App;
