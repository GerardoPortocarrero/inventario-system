import type { FC } from 'react';
import { useState, useEffect, useMemo } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert } from 'react-bootstrap';
import { db } from '../api/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { FaPencilAlt, FaTrash } from 'react-icons/fa';

// Importar los nuevos componentes y la interfaz Column
import SearchInput from '../components/SearchInput';
import GenericTable, { type Column } from '../components/GenericTable';

// Define la interfaz para los datos de un rol
interface Role {
  id: string;
  nombre: string;
}

// Define la interfaz para los datos de una sede
interface Sede {
  id: string;
  nombre: string;
  // Añadir otras propiedades de sede si se definen (ej. direccion)
}

// Define la interfaz para los datos de un usuario
interface UserProfile {
  id: string;
  nombre: string;
  email: string;
  rolId: string;
  sedeId: string; // Nuevo campo
}

const AdminUsersPage: FC = () => {
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

  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rolId, setRolId] = useState('');
  const [selectedSedeId, setSelectedSedeId] = useState<string>(''); // Para el input del formulario

  const [roles, setRoles] = useState<Role[]>([]);
  const [sedes, setSedes] = useState<Sede[]>([]); // Nuevo estado para las sedes
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Cargar Roles
        const rolesCollection = collection(db, 'roles');
        const rolesSnapshot = await getDocs(rolesCollection);
        const rolesList = rolesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Role));
        setRoles(rolesList);
        if (rolesList.length > 0) {
          setRolId(rolesList[0].id);
        }

        // Cargar Sedes
        const sedesCollection = collection(db, 'sedes');
        const sedesSnapshot = await getDocs(sedesCollection);
        const sedesList = sedesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sede));
        setSedes(sedesList);
        if (sedesList.length > 0) {
          setSelectedSedeId(sedesList[0].id); // Seleccionar la primera sede por defecto
        }

        // Cargar Usuarios
        const usersCollection = collection(db, 'usuarios');
        const usersSnapshot = await getDocs(usersCollection);
        const usersList = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserProfile));
        setUsers(usersList);

      } catch (err) {
        setError('Error al cargar los datos. Verifique los permisos de Firestore.');
        console.error(err);
      }
      setLoading(false);
    };

    fetchData();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    alert(`TODO: Crear usuario:\nNombre: ${nombre}\nEmail: ${email}\nRol: ${rolId}\nSede: ${selectedSedeId}`);
  };

  const filteredUsers = useMemo(() => {
    return users.filter(user =>
      user.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sedes.find(s => s.id === user.sedeId)?.nombre.toLowerCase().includes(searchTerm.toLowerCase()) // Buscar por nombre de sede
    );
  }, [users, searchTerm, sedes]); // Añadir 'sedes' como dependencia para el filtrado

  // Definición de las columnas para GenericTable
  const userTableColumns: Column<UserProfile>[] = useMemo(() => {
    return [
      { accessorKey: 'nombre', header: 'Nombre' },
      { accessorKey: 'email', header: 'Email' },
      {
        accessorKey: 'rolId',
        header: 'Rol',
        render: (user: UserProfile) => roles.find(r => r.id === user.rolId)?.nombre || user.rolId
      },
      {
        accessorKey: 'sedeId', // Mostrar el ID de la sede
        header: 'Sede',
        render: (user: UserProfile) => sedes.find(s => s.id === user.sedeId)?.nombre || user.sedeId
      },
      {
        header: 'Acciones',
        render: (_user: UserProfile) => (
          <>
            <Button variant="outline-secondary" size="sm" className="me-2">
              <FaPencilAlt />
            </Button>
            <Button variant="outline-danger" size="sm">
              <FaTrash />
            </Button>
          </>
        ),
      },
    ];
  }, [roles, sedes]); // Añadir 'sedes' como dependencia

  return (
    <Container fluid>
      <Row>
        <Col md={4} className="mb-3">
          <Card>
            <Card.Body className="p-3">
              <h5 className="mb-3">Crear Nuevo Usuario</h5>
              <Form onSubmit={handleCreateUser}>
                <Form.Group className="mb-3" controlId="formUserName">
                  <Form.Label>Nombre Completo</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="Ej. Juan Pérez"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    required
                  />
                </Form.Group>

                <Form.Group className="mb-3" controlId="formUserEmail">
                  <Form.Label>Correo Electrónico</Form.Label>
                  <Form.Control
                    type="email"
                    placeholder="Ej. juan.perez@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </Form.Group>

                <Form.Group className="mb-3" controlId="formUserPassword">
                  <Form.Label>Contraseña</Form.Label>
                  <Form.Control
                    type="password"
                    placeholder="Mínimo 6 caracteres"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </Form.Group>

                <Form.Group className="mb-3" controlId="formUserRole">
                  <Form.Label>Rol</Form.Label>
                  <Form.Select
                    value={rolId}
                    onChange={(e) => setRolId(e.target.value)}
                    required
                    disabled={loading}
                  >
                    {roles.map(role => (
                      <option key={role.id} value={role.id}>{role.nombre}</option>
                    ))}
                  </Form.Select>
                </Form.Group>
                
                {/* Nuevo campo de selección de Sede */}
                <Form.Group className="mb-3" controlId="formUserSede">
                  <Form.Label>Sede</Form.Label>
                  <Form.Select
                    value={selectedSedeId}
                    onChange={(e) => setSelectedSedeId(e.target.value)}
                    required
                    disabled={loading}
                  >
                    {sedes.map(sede => (
                      <option key={sede.id} value={sede.id}>{sede.nombre}</option>
                    ))}
                  </Form.Select>
                </Form.Group>

                {error && <Alert variant="danger" className="mt-3">{error}</Alert>}

                <Button variant="primary" type="submit" className="w-100 mt-3">
                  Crear Usuario
                </Button>
              </Form>
            </Card.Body>
          </Card>
        </Col>

        <Col md={8}>
          <Card>
            <Card.Body className="p-3">
              <h5 className="mb-3">Lista de Usuarios</h5>
              <SearchInput
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                placeholder="Buscar por nombre o email o sede..."
                className="mb-3"
              />

              {loading ? (
                <p>Cargando usuarios...</p>
              ) : (
                <GenericTable<UserProfile>
                  data={filteredUsers}
                  columns={userTableColumns}
                  variant={isDarkMode ? 'dark' : ''}
                  maxHeight="70vh"
                  noRecordsMessage="No se encontraron usuarios."
                />
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default AdminUsersPage;