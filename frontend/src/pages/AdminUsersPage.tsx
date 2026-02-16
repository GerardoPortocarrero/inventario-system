import type { FC } from 'react';
import { useState, useEffect, useMemo } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert } from 'react-bootstrap';
import { db } from '../api/firebase';
import { collection, getDocs, setDoc, doc } from 'firebase/firestore'; // Añadir setDoc y doc
import { createUserWithEmailAndPassword } from 'firebase/auth'; // Importar para crear usuario
import { auth } from '../api/firebase'; // Asegurarse de que 'auth' esté importado

import { FaPencilAlt, FaTrash } from 'react-icons/fa';

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
  const [selectedSedeId, setSelectedSedeId] = useState<string>('');

  const [roles, setRoles] = useState<Role[]>([]);
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Función para cargar todos los datos necesarios (roles, sedes, usuarios)
  const fetchUsersAndSedesAndRoles = async () => {
    setLoading(true);
    try {
      // Cargar Roles
      const rolesCollection = collection(db, 'roles');
      const rolesSnapshot = await getDocs(rolesCollection);
      const rolesList = rolesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Role));
      setRoles(rolesList);
      if (rolesList.length > 0 && !rolId) {
        setRolId(rolesList[0].id);
      }

      // Cargar Sedes
      const sedesCollection = collection(db, 'sedes');
      const sedesSnapshot = await getDocs(sedesCollection);
      const sedesList = sedesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sede));
      setSedes(sedesList);
      if (sedesList.length > 0 && !selectedSedeId) {
        setSelectedSedeId(sedesList[0].id);
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

  useEffect(() => {
    fetchUsersAndSedesAndRoles();
  }, []); // Se ejecuta una vez al montar el componente

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true); // Indicar que se está creando el usuario

    if (!nombre.trim() || !email.trim() || !password.trim() || !rolId || !selectedSedeId) {
      setError('Todos los campos son obligatorios.');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      setLoading(false);
      return;
    }

    try {
      // 1. Crear usuario en Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const newUserUid = userCredential.user.uid;

      // NOTA: Esta creación del lado del cliente automáticamente inicia sesión al usuario recién creado.
      // Para un panel de administración, generalmente se prefiere una Cloud Function (Firebase Admin SDK)
      // para crear usuarios sin iniciar sesión y asignar claims personalizados (roles/sedeId).
      // Esta es una limitación conocida de la creación directa del lado del cliente para fines administrativos.
      // El administrador actualmente conectado será desconectado y el nuevo usuario iniciará sesión.
      // Una solución completa implicaría Firebase Admin SDK a través de Cloud Functions.

      // 2. Crear documento de usuario en Firestore
      await setDoc(doc(db, 'usuarios', newUserUid), {
        nombre: nombre,
        email: email,
        rolId: rolId,
        sedeId: selectedSedeId,
        activo: true, // Asumiendo que los nuevos usuarios están activos por defecto
      });

      // Resetear campos del formulario
      setNombre('');
      setEmail('');
      setPassword('');
      setRolId(roles[0]?.id || ''); // Resetear al primer rol o vacío
      setSelectedSedeId(sedes[0]?.id || ''); // Resetear a la primera sede o vacío

      setError(null);
      await fetchUsersAndSedesAndRoles(); // Recargar todos los datos, incluyendo los usuarios actualizados
      alert('Usuario creado exitosamente. Nota: El usuario recién creado ha iniciado sesión automáticamente.');

    } catch (err: any) {
      let errorMessage = 'Error al crear el usuario.';
      if (err.code === 'auth/email-already-in-use') {
        errorMessage = 'El correo electrónico ya está en uso.';
      } else if (err.message) {
        errorMessage = err.message;
      }
      setError(errorMessage);
      console.error("Error creating user:", err);
    }
    setLoading(false);
  };

  const filteredUsers = useMemo(() => {
    return users.filter(user =>
      user.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sedes.find(s => s.id === user.sedeId)?.nombre.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [users, searchTerm, sedes]);

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
        accessorKey: 'sedeId',
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
  }, [roles, sedes]);

  return (
    <Container fluid>
      <Row>
        <Col md={4} className="mb-3">
          <Card>
            <Card.Body className="p-3">
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