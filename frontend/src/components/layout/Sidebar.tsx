import type { FC } from 'react';
import { Nav } from 'react-bootstrap';
import { FaHome, FaUsers, FaBoxOpen, FaShoppingCart, FaClipboardList, FaSignOutAlt, FaBuilding, FaUserTag, FaGlassMartiniAlt, FaUserCircle } from 'react-icons/fa'; // Importar FaUserCircle
import './Sidebar.css';
import { useLocation, useNavigate, Link } from 'react-router-dom';
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

  const handleLinkClick = () => {
    if (window.innerWidth < 992) {
      toggleSidebar();
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

          <Nav.Item>
            <Nav.Link as={Link} to="/profile" className={location.pathname === '/profile' ? 'active' : ''} onClick={handleLinkClick}>
              <FaUserCircle className="me-2" />
              Mi Perfil
            </Nav.Link>
          </Nav.Item>

          <hr />

          {/* Enlaces comunes para todos los roles */}
          <Nav.Item>
            <Nav.Link as={Link} to="/dashboard" className={location.pathname === '/dashboard' ? 'active' : ''} onClick={handleLinkClick}>
              <FaHome className="me-2" />
              Dashboard
            </Nav.Link>
          </Nav.Item>

          {/* Enlaces para Preventista */}
          {(userRole === 'preventista' || isAdmin) && (
            <Nav.Item>
              <Nav.Link as={Link} to="/preventista" className={location.pathname === '/preventista' ? 'active' : ''} onClick={handleLinkClick}>
                <FaShoppingCart className="me-2" />
                Ventas
              </Nav.Link>
            </Nav.Item>
          )}

          {/* Enlaces para Almacenero */}
          {(userRole === 'almacenero' || isAdmin) && (
            <Nav.Item>
              <Nav.Link as={Link} to="/almacen" className={location.pathname === '/almacen' ? 'active' : ''} onClick={handleLinkClick}>
                <FaBoxOpen className="me-2" />
                Controlador
              </Nav.Link>
            </Nav.Item>
          )}

          {/* Enlaces para Supervisor */}
          {(userRole === 'supervisor' || isAdmin) && (
            <Nav.Item>
              <Nav.Link as={Link} to="/supervisor" className={location.pathname === '/supervisor' ? 'active' : ''} onClick={handleLinkClick}>
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
                <Nav.Link as={Link} to="/admin/users" className={location.pathname === '/admin/users' ? 'active' : ''} onClick={handleLinkClick}>
                  <FaUsers className="me-2" />
                  Usuarios
                </Nav.Link>
              </Nav.Item>
              <Nav.Item> {/* Nuevo enlace para Roles */}
                <Nav.Link as={Link} to="/admin/roles" className={location.pathname === '/admin/roles' ? 'active' : ''} onClick={handleLinkClick}>
                  <FaUserTag className="me-2" /> {/* Icono de roles */}
                  Roles
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link as={Link} to="/admin/products" className={location.pathname === '/admin/products' ? 'active' : ''} onClick={handleLinkClick}>
                  <FaBoxOpen className="me-2" />
                  Productos
                </Nav.Link>
              </Nav.Item>
              <Nav.Item> {/* Nuevo enlace para Sedes */}
                <Nav.Link as={Link} to="/admin/sedes" className={location.pathname === '/admin/sedes' ? 'active' : ''} onClick={handleLinkClick}>
                  <FaBuilding className="me-2" /> {/* Icono de edificio */}
                  Sedes
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link as={Link} to="/admin/beverage-types" className={location.pathname === '/admin/beverage-types' ? 'active' : ''} onClick={handleLinkClick}>
                  <FaGlassMartiniAlt className="me-2" />
                  Tipo Bebida
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