import { useState, type FC } from 'react';
import { Nav } from 'react-bootstrap';
import { FaUsers, FaBoxOpen, FaClipboardList, FaSignOutAlt, FaBuilding, FaUserTag, FaGlassMartiniAlt, FaUserCircle, FaDatabase, FaChartLine, FaTag } from 'react-icons/fa'; // Importar FaUserCircle, FaDatabase y FaChartLine
import './Sidebar.css';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import useMediaQuery from '../../hooks/useMediaQuery';

interface SidebarProps {
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
}

const Sidebar: FC<SidebarProps> = ({ isSidebarOpen, toggleSidebar }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { userRole, logout } = useAuth(); // Obtiene el rolId y la función de logout
  const isDesktop = useMediaQuery('(min-width: 992px)');
  const [desktopHovered, setDesktopHovered] = useState(false);

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

  // En desktop el sidebar se colapsa a solo iconos y se expande al hacer hover (sin empujar contenido)
  const collapsed = isDesktop && !desktopHovered;

  return (
    <>
      <Nav
        className={`sidebar ${isSidebarOpen ? 'open' : ''} ${isDesktop && desktopHovered ? 'hovered' : ''}`}
        onMouseEnter={() => isDesktop && setDesktopHovered(true)}
        onMouseLeave={() => isDesktop && setDesktopHovered(false)}
      >
        <div className="sidebar-brand">
          <h4 className={`sidebar-title text-center ${collapsed ? 'is-collapsed' : ''}`} style={{ color: 'var(--theme-text-primary)' }}>
            Ventas A Y A
          </h4>
        </div>

        <div className="sidebar-sticky">
          <Nav.Item>
            <Nav.Link as={Link} to="/profile" title="Mi Perfil" className={location.pathname === '/profile' ? 'active' : ''} onClick={handleLinkClick}>
              <FaUserCircle className="sidebar-link-icon" />
              <span className="sidebar-link-text">Mi Perfil</span>
            </Nav.Link>
          </Nav.Item>

          <hr />

          {/* Enlaces para Supervisor / Admin */}
          {(userRole === 'supervisor' || isAdmin) && (
            <>
              <Nav.Item>
                <Nav.Link as={Link} to="/supervisor" title="Supervisión" className={location.pathname === '/supervisor' ? 'active' : ''} onClick={handleLinkClick}>
                  <FaClipboardList className="sidebar-link-icon" />
                  <span className="sidebar-link-text">Supervisión</span>
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link as={Link} to="/analytics-pro" title="Analítica Pro" className={location.pathname === '/analytics-pro' ? 'active' : ''} onClick={handleLinkClick}>
                  <FaChartLine className="sidebar-link-icon" />
                  <span className="sidebar-link-text">Analítica Pro</span>
                </Nav.Link>
              </Nav.Item>
            </>
          )}

          {/* Enlaces para Administrador */}
          {isAdmin && (
            <>
              <Nav.Item>
                <Nav.Link as={Link} to="/admin/upload" title="Datos" className={location.pathname === '/admin/upload' ? 'active' : ''} onClick={handleLinkClick}>
                  <FaDatabase className="sidebar-link-icon" />
                  <span className="sidebar-link-text">Datos</span>
                </Nav.Link>
              </Nav.Item>
              <hr/>
              <Nav.Item>
                <Nav.Link as={Link} to="/admin/users" title="Usuarios" className={location.pathname === '/admin/users' ? 'active' : ''} onClick={handleLinkClick}>
                  <FaUsers className="sidebar-link-icon" />
                  <span className="sidebar-link-text">Usuarios</span>
                </Nav.Link>
              </Nav.Item>
              <Nav.Item> {/* Nuevo enlace para Roles */}
                <Nav.Link as={Link} to="/admin/roles" title="Roles" className={location.pathname === '/admin/roles' ? 'active' : ''} onClick={handleLinkClick}>
                  <FaUserTag className="sidebar-link-icon" /> {/* Icono de roles */}
                  <span className="sidebar-link-text">Roles</span>
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link as={Link} to="/admin/products" title="Productos" className={location.pathname === '/admin/products' ? 'active' : ''} onClick={handleLinkClick}>
                  <FaBoxOpen className="sidebar-link-icon" />
                  <span className="sidebar-link-text">Productos</span>
                </Nav.Link>
              </Nav.Item>
              <Nav.Item> {/* Nuevo enlace para Sedes */}
                <Nav.Link as={Link} to="/admin/sedes" title="Sedes" className={location.pathname === '/admin/sedes' ? 'active' : ''} onClick={handleLinkClick}>
                  <FaBuilding className="sidebar-link-icon" /> {/* Icono de edificio */}
                  <span className="sidebar-link-text">Sedes</span>
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link as={Link} to="/admin/beverage-types" title="Tipo Bebida" className={location.pathname === '/admin/beverage-types' ? 'active' : ''} onClick={handleLinkClick}>
                  <FaGlassMartiniAlt className="sidebar-link-icon" />
                  <span className="sidebar-link-text">Tipo Bebida</span>
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link as={Link} to="/admin/marcas" title="Marcas" className={location.pathname === '/admin/marcas' ? 'active' : ''} onClick={handleLinkClick}>
                  <FaTag className="sidebar-link-icon" />
                  <span className="sidebar-link-text">Marcas</span>
                </Nav.Link>
              </Nav.Item>
            </>
          )}
        </div>

        {/* Sección de Logout (fuera del sticky para evitar recálculos de margin-top:auto) */}
        <div className="sidebar-logout-section">
          <hr />
          <Nav.Item>
            <Nav.Link onClick={handleLogout} title="Cerrar Sesión" className="w-100 text-start">
              <FaSignOutAlt className="sidebar-link-icon" />
              <span className="sidebar-link-text">Cerrar Sesión</span>
            </Nav.Link>
          </Nav.Item>
        </div>
      </Nav>
    </>
  );
};

export default Sidebar;