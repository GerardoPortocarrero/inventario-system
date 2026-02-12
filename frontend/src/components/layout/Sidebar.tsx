import React, { FC } from 'react';
import { Nav } from 'react-bootstrap';
import { FaHome, FaUsers, FaBoxOpen, FaShoppingCart, FaClipboardList, FaSignOutAlt } from 'react-icons/fa';
import './Sidebar.css';
import { useLocation } from 'react-router-dom'; // Importa useLocation

interface SidebarProps {
  // isSidebarOpen: boolean; // Ya no es necesario
}

const Sidebar: FC<SidebarProps> = () => { // Elimina isSidebarOpen de los props
  const location = useLocation(); // Hook para obtener la ubicación actual

  // TODO: Añadir lógica para mostrar/ocultar enlaces según el rol del usuario (useAuth)

  return (
    <Nav className="sidebar"> {/* Elimina la clase condicional 'open' */}
      <div className="sidebar-sticky">
        {/* Enlaces comunes/principales */}
        <Nav.Item>
          <Nav.Link href="/dashboard" className={location.pathname === '/dashboard' ? 'active' : ''}>
            <FaHome className="me-2" />
            Dashboard
          </Nav.Link>
        </Nav.Item>

        {/* Enlaces para Preventista */}
        <Nav.Item>
          <Nav.Link href="/preventista" className={location.pathname === '/preventista' ? 'active' : ''}>
            <FaShoppingCart className="me-2" />
            Ventas
          </Nav.Link>
        </Nav.Item>

        {/* Enlaces para Almacenero */}
        <Nav.Item>
          <Nav.Link href="/almacen" className={location.pathname === '/almacen' ? 'active' : ''}>
            <FaBoxOpen className="me-2" />
            Gestión de Almacén
          </Nav.Link>
        </Nav.Item>

        {/* Enlaces para Supervisor */}
        <Nav.Item>
          <Nav.Link href="/supervisor" className={location.pathname === '/supervisor' ? 'active' : ''}>
            <FaClipboardList className="me-2" />
            Supervisión
          </Nav.Link>
        </Nav.Item>

        {/* Enlaces para Administrador */}
        <Nav.Item>
          <Nav.Link href="/admin/users" className={location.pathname === '/admin/users' ? 'active' : ''}>
            <FaUsers className="me-2" />
            Gestión de Usuarios
          </Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link href="/admin/products" className={location.pathname === '/admin/products' ? 'active' : ''}>
            <FaBoxOpen className="me-2" />
            Gestión de Productos
          </Nav.Link>
        </Nav.Item>

        {/* Separador y enlace de Logout */}
        <hr className="text-white-50" />
        <Nav.Item>
          <Nav.Link href="/logout" className={location.pathname === '/logout' ? 'active' : ''}>
            <FaSignOutAlt className="me-2" />
            Cerrar Sesión
          </Nav.Link>
        </Nav.Item>
      </div>
    </Nav>
  );
};

export default Sidebar;