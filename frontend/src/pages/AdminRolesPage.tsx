import type { FC } from 'react';
import { useState, useEffect, useMemo } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert } from 'react-bootstrap';
import { db } from '../api/firebase';
import { collection, getDocs, addDoc } from 'firebase/firestore';
import { FaPencilAlt, FaTrash } from 'react-icons/fa'; // Iconos para acciones

import SearchInput from '../components/SearchInput';
import GenericTable, { type Column } from '../components/GenericTable';
import { UI_TEXTS, SPINNER_VARIANTS } from '../constants'; // Importar constantes y SPINNER_VARIANTS
import GlobalSpinner from '../components/GlobalSpinner'; // Importar GlobalSpinner

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

  const [nombreRol, setNombreRol] = useState(''); // Para el input del formulario
  // const [descripcionRol, setDescripcionRol] = useState(''); // REMOVED: No longer in documentation
  const [roles, setRoles] = useState<Role[]>([]); // Lista de roles
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');

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

    if (!nombreRol.trim()) {
      setError(UI_TEXTS.REQUIRED_FIELDS); // Use a more general required field message
      return;
    }

    try {
      const rolesCollection = collection(db, 'roles');
      await addDoc(rolesCollection, {
        nombre: nombreRol,
        // REMOVED: descripcion: descripcionRol,
      });
      setNombreRol(''); // Limpiar el formulario
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
    <Container fluid>
      <Row>
        <Col md={4} className="mb-3">
          <Card>
            <Card.Body className="p-3">
              {/* REMOVED: h5 title */}
              <Form onSubmit={handleCreateRole}>
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

                {/* REMOVED: Form.Group for descripcionRol */}
                
                {error && <Alert variant="danger" className="mt-3">{error}</Alert>}

                <Button variant="primary" type="submit" className="w-100 mt-3">
                  {UI_TEXTS.CREATE_SEDE.replace('Sede', 'Rol')}
                </Button>
              </Form>
            </Card.Body>
          </Card>
        </Col>

        <Col md={8}>
          <Card>
            <Card.Body className="p-3">
              {/* REMOVED: h5 title */}
              <SearchInput
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                placeholder={UI_TEXTS.PLACEHOLDER_SEARCH_SEDES.replace('sede', 'rol')} // Reutilizar placeholder de búsqueda
                className="mb-3"
              />

              {loading ? (
                <GlobalSpinner variant={SPINNER_VARIANTS.IN_PAGE} />
              ) : (
                <GenericTable<Role>
                  data={filteredRoles}
                  columns={rolesTableColumns}
                  variant={isDarkMode ? 'dark' : ''}
                  maxHeight="70vh"
                  noRecordsMessage={UI_TEXTS.NO_RECORDS_FOUND}
                />
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default AdminRolesPage;
