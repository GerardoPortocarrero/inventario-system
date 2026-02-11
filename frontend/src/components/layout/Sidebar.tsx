import React, { FC } from 'react';
import { Nav } from 'react-bootstrap';
import { FaHome, FaUsers, FaBoxOpen, FaShoppingCart, FaClipboardList, FaSignOutAlt } from 'react-icons/fa';
import './Sidebar.css';

interface SidebarProps {
  isSidebarOpen: boolean;
}

const Sidebar: FC<SidebarProps> = ({ isSidebarOpen }) => {
  // TODO: Añadir lógica para mostrar/ocultar enlaces según el rol del usuario (useAuth)

  return (
    <Nav className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
      <div className="sidebar-sticky">
        {/* Enlaces comunes/principales */}
        <Nav.Item>
          <Nav.Link href="/dashboard">
            <FaHome className="me-2" />
            Dashboard
          </Nav.Link>
        </Nav.Item>

        {/* Enlaces para Preventista */}
        <Nav.Item>
          <Nav.Link href="/preventista">
            <FaShoppingCart className="me-2" />
            Ventas
          </Nav.Link>
        </Nav.Item>

        {/* Enlaces para Almacenero */}
        <Nav.Item>
          <Nav.Link href="/almacen">
            <FaBoxOpen className="me-2" />
            Gestión de Almacén
          </Nav.Link>
        </Nav.Item>

        {/* Enlaces para Supervisor */}
        <Nav.Item>
          <Nav.Link href="/supervisor">
            <FaClipboardList className="me-2" />
            Supervisión
          </Nav.Link>
        </Nav.Item>

        {/* Enlaces para Administrador */}
        <Nav.Item>
          <Nav.Link href="/admin/users">
            <FaUsers className="me-2" />
            Gestión de Usuarios
          </Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link href="/admin/products">
            <FaBoxOpen className="me-2" />
            Gestión de Productos
          </Nav.Link>
        </Nav.Item>

        {/* Separador y enlace de Logout */}
        <hr className="text-white-50" />
        <Nav.Item>
          <Nav.Link href="/logout">
            <FaSignOutAlt className="me-2" />
            Cerrar Sesión
          </Nav.Link>
        </Nav.Item>
      </div>
    </Nav>
  );
};

export default Sidebar;