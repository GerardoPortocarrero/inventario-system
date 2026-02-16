import type { FC } from 'react';
import { useState, useEffect, useMemo } from 'react'; // Importar useMemo
import { Container, Row, Col, Card, Form, Button, Table, Alert } from 'react-bootstrap';
import { db } from '../api/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { FaPencilAlt, FaTrash } from 'react-icons/fa'; // Importar los iconos

// Define la interfaz para los datos de un rol y un usuario
interface Role {
  id: string;
  nombre: string;
}

interface UserProfile {
  id: string;
  nombre: string;
  email: string;
  rolId: string;
}

const AdminUsersPage: FC = () => {
  // Estado para el modo oscuro, inicializado desde localStorage
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const savedTheme = localStorage.getItem('theme');
    return savedTheme === 'dark' || savedTheme === null;
  });

  // Escuchar cambios en localStorage para el tema (si el usuario lo cambia en otro lugar)
  useEffect(() => {
    const handleStorageChange = () => {
      setIsDarkMode(localStorage.getItem('theme') === 'dark');
    };
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // Estados para el formulario
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rolId, setRolId] = useState('');

  // Estados para la carga de datos y la UI
  const [roles, setRoles] = useState<Role[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>(''); // Estado para el término de búsqueda

  // Carga inicial de roles y usuarios
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
          setRolId(rolesList[0].id); // Selecciona el primer rol por defecto
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

    // TODO: Implementar la lógica de creación de usuario
    // 1. Usar una Cloud Function (preferido) o el SDK de Admin para crear el usuario en Firebase Auth.
    // 2. Si es exitoso, crear el documento del usuario en la colección 'usuarios' de Firestore.
    alert(`TODO: Crear usuario:\nNombre: ${nombre}\nEmail: ${email}\nRol: ${rolId}`);
  };

  // Filtrar usuarios basado en el término de búsqueda
  const filteredUsers = useMemo(() => {
    return users.filter(user =>
      user.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [users, searchTerm]);

  return (
    <Container fluid>
      <Row>
        {/* Columna del Formulario para Crear Usuario */}
        <Col md={4} className="mb-3"> {/* Añadir mb-3 para espaciado en móviles */}
          <Card> {/* Card ya es transparente y sin borde por App.css */}
            <Card.Body className="p-3"> {/* Añadir padding interno */}
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
                
                {error && <Alert variant="danger" className="mt-3">{error}</Alert>}

                <Button variant="primary" type="submit" className="w-100 mt-3">
                  Crear Usuario
                </Button>
              </Form>
            </Card.Body>
          </Card>
        </Col>

        {/* Columna de la Tabla de Usuarios */}
        <Col md={8}>
          <Card> {/* Card ya es transparente y sin borde por App.css */}
            <Card.Body className="p-3"> {/* Añadir padding interno */}
              <Form.Group className="mb-3" controlId="formSearchUser">
                <Form.Control
                  type="text"
                  placeholder="Buscar por nombre o email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </Form.Group>

              {loading ? (
                <p>Cargando usuarios...</p>
              ) : (
                <div style={{ maxHeight: '70vh', overflowY: 'auto' }}> {/* Contenedor scrollable */}
                  <Table responsive variant={isDarkMode ? 'dark' : ''}> {/* Eliminar 'striped', 'bordered', 'hover' */}
                    <thead>
                      <tr>
                        <th>Nombre</th>
                        <th>Email</th>
                        <th>Rol</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="text-center">No se encontraron usuarios.</td>
                        </tr>
                      ) : (
                        filteredUsers.map(user => (
                          <tr key={user.id}>
                            <td>{user.nombre}</td>
                            <td>{user.email}</td>
                            <td>{roles.find(r => r.id === user.rolId)?.nombre || user.rolId}</td>
                            <td>
                              <Button variant="outline-secondary" size="sm" className="me-2">
                                <FaPencilAlt />
                              </Button>
                              <Button variant="outline-danger" size="sm">
                                <FaTrash />
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </Table>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default AdminUsersPage;
