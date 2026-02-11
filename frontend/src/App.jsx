import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Container } from 'react-bootstrap';
import Header from './components/layout/Header';
import Sidebar from './components/layout/Sidebar';
import { useAuth } from './context/AuthContext';

import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';

function App() {
  const { currentUser, loading } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem('theme');
    return savedTheme === 'dark' || savedTheme === null;
  });

  useEffect(() => {
    document.body.className = isDarkMode ? 'theme-dark' : 'theme-light';
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
  const toggleDarkMode = () => setIsDarkMode(!isDarkMode);

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
        {!currentUser && (
          <Route path="/login" element={<LoginPage />} />
        )}

        {currentUser && (
          <Route path="/*" element={
            <div className={`app-wrapper ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
              <Sidebar isSidebarOpen={isSidebarOpen} />
              <div className={`main-content ${isSidebarOpen ? 'content-shifted' : ''}`}>
                <Header
                  toggleSidebar={toggleSidebar}
                  isDarkMode={isDarkMode}
                  toggleDarkMode={toggleDarkMode}
                />
                <Container fluid className="py-4 flex-grow-1">
                  <Routes>
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="*" element={<Navigate to="/dashboard" />} />
                  </Routes>
                </Container>
              </div>
            </div>
          } />
        )}

        <Route path="*" element={<Navigate to={currentUser ? "/dashboard" : "/login"} />} />
      </Routes>
    </Router>
  );
}

export default App;