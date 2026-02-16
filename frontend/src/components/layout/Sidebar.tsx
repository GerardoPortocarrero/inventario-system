import type { FC } from 'react';
import { Nav } from 'react-bootstrap';
import { FaHome, FaUsers, FaBoxOpen, FaShoppingCart, FaClipboardList, FaSignOutAlt, FaBuilding, FaUserTag } from 'react-icons/fa'; // Importar FaUserTag
import './Sidebar.css';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

interface SidebarProps {
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
}

const Sidebar: FC<SidebarProps> = ({ isSidebarOpen, toggleSidebar }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { userRole, logout } = useAuth(); // Obtiene el rolId y la función de logout

  const handleLogout = async () => {
    if (isSidebarOpen) {
      toggleSidebar(); // Cierra el sidebar si está abierto en móvil
    }
    try {
      await logout();
      navigate('/login'); // Redirige al login después de cerrar sesión
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
    }
  };

  // El rol 'admin' puede ver todo
  const isAdmin = userRole === 'admin';

  return (
    <>
      <Nav className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-sticky">
          <Nav.Item className="sidebar-title-item">
            <h4 className="sidebar-title text-center" style={{ color: 'var(--theme-text-primary)' }}>
              Inventario A Y A
            </h4>
          </Nav.Item>

          {/* Enlaces comunes para todos los roles */}
          <Nav.Item>
            <Nav.Link href="/dashboard" className={location.pathname === '/dashboard' ? 'active' : ''} onClick={toggleSidebar}>
              <FaHome className="me-2" />
              Dashboard
            </Nav.Link>
          </Nav.Item>

          {/* Enlaces para Preventista */}
          {(userRole === 'preventista' || isAdmin) && (
            <Nav.Item>
              <Nav.Link href="/preventista" className={location.pathname === '/preventista' ? 'active' : ''} onClick={toggleSidebar}>
                <FaShoppingCart className="me-2" />
                Ventas
              </Nav.Link>
            </Nav.Item>
          )}

          {/* Enlaces para Almacenero */}
          {(userRole === 'almacenero' || isAdmin) && (
            <Nav.Item>
              <Nav.Link href="/almacen" className={location.pathname === '/almacen' ? 'active' : ''} onClick={toggleSidebar}>
                <FaBoxOpen className="me-2" />
                Controlador
              </Nav.Link>
            </Nav.Item>
          )}

          {/* Enlaces para Supervisor */}
          {(userRole === 'supervisor' || isAdmin) && (
            <Nav.Item>
              <Nav.Link href="/supervisor" className={location.pathname === '/supervisor' ? 'active' : ''} onClick={toggleSidebar}>
                <FaClipboardList className="me-2" />
                Supervisión
              </Nav.Link>
            </Nav.Item>
          )}

          {/* Enlaces para Administrador */}
          {isAdmin && (
            <>
              <hr/>
              <Nav.Item>
                <Nav.Link href="/admin/users" className={location.pathname === '/admin/users' ? 'active' : ''} onClick={toggleSidebar}>
                  <FaUsers className="me-2" />
                  Usuarios
                </Nav.Link>
              </Nav.Item>
              <Nav.Item> {/* Nuevo enlace para Roles */}
                <Nav.Link href="/admin/roles" className={location.pathname === '/admin/roles' ? 'active' : ''} onClick={toggleSidebar}>
                  <FaUserTag className="me-2" /> {/* Icono de roles */}
                  Roles
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link href="/admin/products" className={location.pathname === '/admin/products' ? 'active' : ''} onClick={toggleSidebar}>
                  <FaBoxOpen className="me-2" />
                  Productos
                </Nav.Link>
              </Nav.Item>
              <Nav.Item> {/* Nuevo enlace para Sedes */}
                <Nav.Link href="/admin/sedes" className={location.pathname === '/admin/sedes' ? 'active' : ''} onClick={toggleSidebar}>
                  <FaBuilding className="me-2" /> {/* Icono de edificio */}
                  Sedes
                </Nav.Link>
              </Nav.Item>
            </>
          )}

          {/* Sección de Logout */}
          <div className="sidebar-logout-section">
            <hr />
            <Nav.Item className="px-3">
              <Nav.Link onClick={handleLogout} className="w-100 text-start">
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