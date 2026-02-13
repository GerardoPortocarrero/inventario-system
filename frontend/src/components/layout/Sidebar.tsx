import React, { FC } from 'react';
import { Nav } from 'react-bootstrap';
import { FaHome, FaUsers, FaBoxOpen, FaShoppingCart, FaClipboardList, FaSignOutAlt } from 'react-icons/fa';
import './Sidebar.css';
import { useLocation } from 'react-router-dom';

interface SidebarProps {
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
}

const Sidebar: FC<SidebarProps> = ({ isSidebarOpen, toggleSidebar }) => {
  const location = useLocation();

  // TODO: Añadir lógica para mostrar/ocultar enlaces según el rol del usuario (useAuth)

  return (
    <>
      <Nav className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-sticky">
          <Nav.Item className="sidebar-title-item">
            <h4 className="sidebar-title text-center" style={{ color: 'var(--theme-text-primary)' }}>
              Inventario A Y A
            </h4>
          </Nav.Item>

          {/* Enlaces comunes/principales */}
          <Nav.Item>
            <Nav.Link href="/dashboard" className={location.pathname === '/dashboard' ? 'active' : ''} onClick={toggleSidebar}>
              <FaHome className="me-2" />
              Dashboard
            </Nav.Link>
          </Nav.Item>

          {/* Enlaces para Preventista */}
          <Nav.Item>
            <Nav.Link href="/preventista" className={location.pathname === '/preventista' ? 'active' : ''} onClick={toggleSidebar}>
              <FaShoppingCart className="me-2" />
                          Ventas
                        </Nav.Link>          </Nav.Item>

          {/* Enlaces para Almacenero */}
          <Nav.Item>
            <Nav.Link href="/almacen" className={location.pathname === '/almacen' ? 'active' : ''} onClick={toggleSidebar}>
              <FaBoxOpen className="me-2" />
              Controlador
            </Nav.Link>
          </Nav.Item>

          {/* Enlaces para Supervisor */}
          <Nav.Item>
            <Nav.Link href="/supervisor" className={location.pathname === '/supervisor' ? 'active' : ''} onClick={toggleSidebar}>
              <FaClipboardList className="me-2" />
              Supervisión
            </Nav.Link>
          </Nav.Item>

          {/* Enlaces para Administrador */}
          <Nav.Item>
            <Nav.Link href="/admin/users" className={location.pathname === '/admin/users' ? 'active' : ''} onClick={toggleSidebar}>
              <FaUsers className="me-2" />
              Usuarios
            </Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link href="/admin/products" className={location.pathname === '/admin/products' ? 'active' : ''} onClick={toggleSidebar}>
              <FaBoxOpen className="me-2" />
              Productos
            </Nav.Link>
          </Nav.Item>

          {/* Sección de Logout */}
          <div className="sidebar-logout-section">
            <hr />
            <Nav.Item>
              <Nav.Link href="/logout" className={location.pathname === '/logout' ? 'active' : ''} onClick={toggleSidebar}>
                <FaSignOutAlt className="me-2" />
                Cerrar Sesión
              </Nav.Link>
            </Nav.Item>
          </div>
        </div>
      </Nav>
    </>
  );
};

export default Sidebar;