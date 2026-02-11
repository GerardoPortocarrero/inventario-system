import React, { FC } from 'react';
import { Navbar, Container, Button } from 'react-bootstrap';
import { FaBars, FaSun, FaMoon } from 'react-icons/fa';

// Importa el logo (asumiendo que estará en assets)
import logo from '../../assets/logo.png'; // Placeholder, reemplazar con el logo real

interface HeaderProps {
  toggleSidebar: () => void;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
}

const Header: FC<HeaderProps> = ({ toggleSidebar, isDarkMode, toggleDarkMode }) => {
  return (
    <Navbar bg={isDarkMode ? 'dark' : 'light'} variant={isDarkMode ? 'dark' : 'light'} className="p-0">
      <Container fluid className="d-flex justify-content-between align-items-center">
        {/* Botón para Sidebar en móvil */}
        <Button variant="link" className="d-lg-none text-white-50" onClick={toggleSidebar}>
          <FaBars size={24} />
        </Button>

        {/* Logo centrado */}
        <Navbar.Brand href="#home" className="mx-auto">
          <img
            src={logo}
            width="30"
            height="30"
            className="d-inline-block align-top"
            alt="Logo"
          />{' '}
          Sistema de Inventario
        </Navbar.Brand>

        {/* Botón de cambio de tema */}
        <Button variant="link" className="text-white-50" onClick={toggleDarkMode}>
          {isDarkMode ? <FaSun size={24} /> : <FaMoon size={24} />}
        </Button>
      </Container>
    </Navbar>
  );
};

export default Header;