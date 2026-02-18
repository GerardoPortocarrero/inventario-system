import type { FC } from 'react';
import { useState, useEffect, useMemo, Fragment } from 'react'; // Importar Fragment
import { Container, Row, Col, Card, Form, Button, Alert } from 'react-bootstrap';
import { db } from '../api/firebase';
import { collection, getDocs, setDoc, doc } from 'firebase/firestore';
import { FaPencilAlt, FaTrash } from 'react-icons/fa'; // Iconos para acciones
import useMediaQuery from '../hooks/useMediaQuery'; // Importar el hook useMediaQuery

import SearchInput from '../components/SearchInput';
import GenericTable, { type Column } from '../components/GenericTable';
import { UI_TEXTS, SPINNER_VARIANTS } from '../constants'; // Importar constantes y SPINNER_VARIANTS
import GlobalSpinner from '../components/GlobalSpinner'; // Importar GlobalSpinner
import FabButton from '../components/FabButton'; // Importar FabButton
import GenericCreationModal from '../components/GenericCreationModal'; // Importar GenericCreationModal

// Define la interfaz para un Rol (reutilizada de AdminUsersPage.tsx)
interface Role {
  id: string;
  nombre: string;
  // descripcion?: string; // REMOVED: No longer in documentation
}

const AdminRolesPage: FC = () => {
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const savedTheme = localStorage.getItem('theme');
    return savedTheme === 'dark' || savedTheme === null;
  });

  useEffect(() => {
    const handleStorageChange = () => {
      setIsDarkMode(localStorage.getItem('theme') === 'dark');
    };
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const isMobile = useMediaQuery('(max-width: 768px)'); // Hook para detectar vista móvil

  const [showModal, setShowModal] = useState(false); // Estado para controlar la visibilidad del modal
  const handleShow = () => setShowModal(true);
  const handleClose = () => setShowModal(false);

  const [nombreRol, setNombreRol] = useState(''); // Para el input del formulario
  const [idRol, setIdRol] = useState(''); // Nuevo estado para el ID del rol
  // const [descripcionRol, setDescripcionRol] = useState(''); // REMOVED: No longer in documentation
  const [roles, setRoles] = useState<Role[]>([]); // Lista de roles
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Componente funcional para el formulario de creación de roles
  const RoleCreationForm: React.FC<{
    onSubmit: (e: React.FormEvent) => Promise<void>;
    idRol: string;
    setIdRol: (id: string) => void;
    nombreRol: string;
    setNombreRol: (name: string) => void;
    error: string | null;
  }> = ({ onSubmit, idRol, setIdRol, nombreRol, setNombreRol, error }) => (
    <Form onSubmit={onSubmit}>
      <Form.Group className="mb-3" controlId="formRoleId">
        <Form.Label>ID de Rol</Form.Label>
        <Form.Control
          type="text"
          placeholder="Ej. admin, preventista"
          value={idRol}
          onChange={(e) => setIdRol(e.target.value)}
          required
        />
      </Form.Group>

      <Form.Group className="mb-3" controlId="formRoleName">
        <Form.Label>{UI_TEXTS.TABLE_HEADER_NAME}</Form.Label>
        <Form.Control
          type="text"
          placeholder={UI_TEXTS.PLACEHOLDER_SEDE_NAME.replace('Sede', 'Rol')} // Reutilizar placeholder
          value={nombreRol}
          onChange={(e) => setNombreRol(e.target.value)}
          required
        />
      </Form.Group>
      
      {error && <Alert variant="danger" className="mt-3">{error}</Alert>}

      <Button variant="primary" type="submit" className="w-100 mt-3">
        {UI_TEXTS.CREATE_SEDE.replace('Sede', 'Rol')}
      </Button>
    </Form>
  );

  // Función para cargar los roles
  const fetchRoles = async () => {
    setLoading(true);
    try {
      const rolesCollection = collection(db, 'roles');
      const rolesSnapshot = await getDocs(rolesCollection);
      const rolesList = rolesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Role));
      setRoles(rolesList);
    } catch (err) {
      setError(UI_TEXTS.ERROR_GENERIC_LOAD);
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRoles(); // Cargar roles al montar el componente
  }, []);

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!idRol.trim() || !nombreRol.trim()) {
      setError(UI_TEXTS.REQUIRED_FIELDS);
      return;
    }

    try {
      // const rolesCollection = collection(db, 'roles'); // REMOVED
      await setDoc(doc(db, 'roles', idRol), {
        nombre: nombreRol,
        // REMOVED: descripcion: descripcionRol,
      });
      setNombreRol(''); // Limpiar el formulario
      setIdRol(''); // Limpiar el ID del rol
      // setDescripcionRol(''); // REMOVED
      await fetchRoles(); // Recargar la lista de roles
    } catch (err) {
      setError(UI_TEXTS.ERROR_GENERIC_CREATE);
      console.error(err);
    }
  };

  const filteredRoles = useMemo(() => {
    return roles.filter(role =>
      role.nombre.toLowerCase().includes(searchTerm.toLowerCase())
      // REMOVED: || (role.descripcion && role.descripcion.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [roles, searchTerm]);

  // Definición de las columnas para GenericTable
  const rolesTableColumns: Column<Role>[] = useMemo(() => {
    return [
      { accessorKey: 'id', header: 'ID' }, // Nuevo: Mostrar el ID del rol
      { accessorKey: 'nombre', header: UI_TEXTS.TABLE_HEADER_NAME },
      // REMOVED: { accessorKey: 'descripcion', header: 'Descripción' },
      {
        header: UI_TEXTS.TABLE_HEADER_ACTIONS,
        render: (_role: Role) => (
          <>
            <Button variant="link" size="sm" className="me-2">
              <FaPencilAlt />
            </Button>
            <Button variant="link" size="sm">
              <FaTrash />
            </Button>
          </>
        ),
        colClassName: 'text-end' // Alinear acciones a la derecha
      },
    ];
  }, []);

  return (
    <Fragment>
      <Container fluid>
        <Row>
          {!isMobile && ( // Mostrar el formulario solo en vista de escritorio
            <Col md={4} className="mb-3">
              <Card>
                <Card.Body className="p-3">
                  <RoleCreationForm
                    onSubmit={handleCreateRole}
                    idRol={idRol}
                    setIdRol={setIdRol}
                    nombreRol={nombreRol}
                    setNombreRol={setNombreRol}
                    error={error}
                  />
                </Card.Body>
              </Card>
            </Col>
          )}

          <Col md={isMobile ? 12 : 8}> {/* La tabla ocupa 12 columnas en móvil, 8 en escritorio */}
            <Card>
              <Card.Body className="p-3">
                {/* REMOVED: h5 title */}
                <SearchInput
                  searchTerm={searchTerm}
                  onSearchChange={setSearchTerm}
                  placeholder={UI_TEXTS.PLACEHOLDER_SEDE_NAME.replace('sede', 'rol')} // Reutilizar placeholder de búsqueda
                  className="mb-3"
                />

                {loading ? (
                  <GlobalSpinner variant={SPINNER_VARIANTS.IN_PAGE} />
                ) : (
                  <GenericTable<Role>
                    data={filteredRoles}
                    columns={rolesTableColumns}
                    variant={isDarkMode ? 'dark' : ''}
                    noRecordsMessage={UI_TEXTS.NO_RECORDS_FOUND}
                  />
                )}
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>
      
      {isMobile && <FabButton onClick={handleShow} />} {/* FAB button for mobile */}

      {isMobile && ( // Modal para la vista móvil
        <GenericCreationModal
          show={showModal}
          onHide={handleClose}
          title={UI_TEXTS.CREATE_ROLE} // Usar una constante para "Crear Rol"
        >
          <RoleCreationForm
            onSubmit={handleCreateRole}
            idRol={idRol}
            setIdRol={setIdRol}
            nombreRol={nombreRol}
            setNombreRol={setNombreRol}
            error={error}
          />
        </GenericCreationModal>
      )}
    </Fragment>
  );
};

export default AdminRolesPage;