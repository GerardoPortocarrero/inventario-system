import type { FC } from 'react';
import { useState, useEffect, useMemo } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert } from 'react-bootstrap';
import { db } from '../api/firebase';
import { collection, getDocs, setDoc, doc } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../api/firebase';

import { FaPencilAlt, FaTrash } from 'react-icons/fa';

import SearchInput from '../components/SearchInput';
import GenericTable, { type Column } from '../components/GenericTable';
import { UI_TEXTS, SPINNER_VARIANTS } from '../constants'; // Importar constantes y SPINNER_VARIANTS
import GlobalSpinner from '../components/GlobalSpinner'; // Importar GlobalSpinner

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
      setError(UI_TEXTS.ERROR_GENERIC_LOAD);
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
      setError(UI_TEXTS.REQUIRED_FIELDS);
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError(UI_TEXTS.PASSWORD_MIN_LENGTH);
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
      alert(`${UI_TEXTS.USER_CREATED_SUCCESS} ${UI_TEXTS.TODO_USER_CREATION_NOTE}`);

    } catch (err: any) {
      let errorMessage = UI_TEXTS.ERROR_GENERIC_CREATE;
      if (err.code === 'auth/email-already-in-use') {
        errorMessage = UI_TEXTS.EMAIL_ALREADY_IN_USE;
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
      { accessorKey: 'nombre', header: UI_TEXTS.TABLE_HEADER_NAME },
      { accessorKey: 'email', header: UI_TEXTS.TABLE_HEADER_EMAIL },
      {
        accessorKey: 'rolId',
        header: UI_TEXTS.TABLE_HEADER_ROLE,
        render: (user: UserProfile) => roles.find(r => r.id === user.rolId)?.nombre || user.rolId
      },
      {
        accessorKey: 'sedeId',
        header: UI_TEXTS.TABLE_HEADER_SEDE,
        render: (user: UserProfile) => sedes.find(s => s.id === user.sedeId)?.nombre || user.sedeId
      },
      {
        header: UI_TEXTS.TABLE_HEADER_ACTIONS,
        render: (_user: UserProfile) => (
          <>
            <Button variant="link" size="sm" className="me-2">
              <FaPencilAlt />
            </Button>
            <Button variant="link" size="sm">
              <FaTrash />
            </Button>
          </>
        ),
        colClassName: 'text-end'
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
                  <Form.Label>{UI_TEXTS.FULL_NAME}</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder={UI_TEXTS.PLACEHOLDER_FULL_NAME}
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    required
                  />
                </Form.Group>

                <Form.Group className="mb-3" controlId="formUserEmail">
                  <Form.Label>{UI_TEXTS.EMAIL}</Form.Label>
                  <Form.Control
                    type="email"
                    placeholder={UI_TEXTS.PLACEHOLDER_EMAIL}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </Form.Group>

                <Form.Group className="mb-3" controlId="formUserPassword">
                  <Form.Label>{UI_TEXTS.PASSWORD}</Form.Label>
                  <Form.Control
                    type="password"
                    placeholder={UI_TEXTS.PLACEHOLDER_PASSWORD}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </Form.Group>

                <Form.Group className="mb-3" controlId="formUserRole">
                  <Form.Label>{UI_TEXTS.ROLE}</Form.Label>
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
                  <Form.Label>{UI_TEXTS.SEDE}</Form.Label>
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
                  {UI_TEXTS.CREATE_USER}
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
                placeholder={UI_TEXTS.PLACEHOLDER_SEARCH_USERS}
                className="mb-3"
              />

              {loading ? (
                <GlobalSpinner variant={SPINNER_VARIANTS.IN_PAGE} />
              ) : (
                <GenericTable<UserProfile>
                  data={filteredUsers}
                  columns={userTableColumns}
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

export default AdminUsersPage;