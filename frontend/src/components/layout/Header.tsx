import React, { FC } from 'react';
import { Navbar, Container, Button } from 'react-bootstrap';
import { FaBars, FaSun, FaMoon } from 'react-icons/fa'; // Elimina FaTimes
import './Header.css';

// Importa el logo (asumiendo que estará en assets)
import logo from '../../assets/logo.png'; // Placeholder, reemplazar con el logo real

interface HeaderProps {
  toggleSidebar: () => void;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
}

const Header: FC<HeaderProps> = ({ toggleSidebar, isDarkMode, toggleDarkMode }) => { // Elimina isSidebarOpen de la desestructuración
  return (
    <Navbar className="app-header" variant="dark">
      <Container fluid className="d-flex justify-content-between align-items-center">
        {/* Botón para Sidebar en móvil */}
        <Button variant="link" className="d-lg-none" onClick={toggleSidebar}>
          <FaBars size={24} /> {/* Solo renderiza FaBars */}
        </Button>

        {/* Logo centrado */}
        <Navbar.Brand href="#home" className="mx-auto">
          <img
            src={logo}
            width="45"
            height="45"
            className="d-inline-block align-top"
            alt="Logo"
          />{' '}
          {/* Aquí puedes mantener el logo si lo deseas, o quitarlo también */}
        </Navbar.Brand>

        {/* Botón de cambio de tema */}
        <Button variant="link" onClick={toggleDarkMode}>
          {isDarkMode ? <FaSun size={24} /> : <FaMoon size={24} />}
        </Button>
      </Container>
    </Navbar>
  );
};

export default Header;