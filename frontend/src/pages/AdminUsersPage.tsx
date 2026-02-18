import type { FC } from 'react';
import { useState, useEffect, useMemo, Fragment } from 'react'; // Importar Fragment
import { Container, Row, Col, Card, Form, Button, Alert } from 'react-bootstrap';
import { db } from '../api/firebase';
import { collection, setDoc, doc, onSnapshot, updateDoc, deleteDoc } from 'firebase/firestore'; // Importar onSnapshot, updateDoc y deleteDoc
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../api/firebase';

import { FaPencilAlt, FaTrash } from 'react-icons/fa';
import useMediaQuery from '../hooks/useMediaQuery'; // Importar el hook useMediaQuery

import SearchInput from '../components/SearchInput';
import GenericTable, { type Column } from '../components/GenericTable';
import { UI_TEXTS, SPINNER_VARIANTS } from '../constants'; // Importar constantes y SPINNER_VARIANTS
import GlobalSpinner from '../components/GlobalSpinner'; // Importar GlobalSpinner
import FabButton from '../components/FabButton'; // Importar FabButton
import GenericCreationModal from '../components/GenericCreationModal'; // Importar GenericCreationModal


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

// Componente funcional para el formulario de creación/edición de usuarios (MOVIDO FUERA DEL COMPONENTE PRINCIPAL)
const UserCreationForm: React.FC<{
  onSubmit: (e: React.FormEvent, isEditing: boolean) => Promise<void>; // Actualizar signature
  nombre: string;
  setNombre: (name: string) => void;
  email: string;
  setEmail: (email: string) => void;
  password: string;
  setPassword: (password: string) => void;
  rolId: string;
  setRolId: (rolId: string) => void;
  selectedSedeId: string;
  setSelectedSedeId: (sedeId: string) => void;
  roles: Role[];
  sedes: Sede[];
  loading: boolean;
  error: string | null;
  isEditing: boolean; // Nuevo prop para indicar si se está editando
  onCancel?: () => void; // Nuevo prop para cancelar
}> = ({ onSubmit, nombre, setNombre, email, setEmail, password, setPassword, rolId, setRolId, selectedSedeId, setSelectedSedeId, roles, sedes, loading, error, isEditing, onCancel }) => (
  <Form onSubmit={(e) => onSubmit(e, isEditing)}> {/* Pasar isEditing al onSubmit */}
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
        disabled={isEditing} // Email no editable en modo edición
      />
    </Form.Group>

    <Form.Group className="mb-3" controlId="formUserPassword">
      <Form.Label>{UI_TEXTS.PASSWORD}</Form.Label>
      <Form.Control
        type="password"
        placeholder={UI_TEXTS.PLACEHOLDER_PASSWORD}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required={!isEditing} // Password es requerido solo en creación
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

    <div className="d-flex gap-2 mt-3">
      {onCancel && (
        <Button variant="secondary" onClick={onCancel} className="w-100">
          {UI_TEXTS.CLOSE}
        </Button>
      )}
      <Button variant="primary" type="submit" className="w-100">
        {isEditing ? UI_TEXTS.UPDATE_USER : UI_TEXTS.CREATE_USER}
      </Button>
    </div>
  </Form>
);


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

  const isMobile = useMediaQuery('(max-width: 768px)'); // Hook para detectar vista móvil

  const [showModal, setShowModal] = useState(false); // Estado para controlar la visibilidad del modal de creación/edición
  const handleShow = () => setShowModal(true);
  
  const handleClose = () => {
    setShowModal(false);
    setEditingUser(null); // Resetear el usuario en edición al cerrar el modal
    setNombre('');
    setEmail('');
    setPassword('');
    setRolId('');
    setSelectedSedeId('');
    setError(null); // Limpiar errores
  };

  const [showDeleteModal, setShowDeleteModal] = useState(false); // Estado para controlar la visibilidad del modal de eliminación
  const handleCloseDeleteModal = () => {
    setShowDeleteModal(false);
    setDeletingUser(null); // Resetear el usuario a eliminar al cerrar el modal
  };

  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rolId, setRolId] = useState('');
  const [selectedSedeId, setSelectedSedeId] = useState<string>('');
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null); // Estado para el usuario en edición
  const [deletingUser, setDeletingUser] = useState<UserProfile | null>(null); // Estado para el usuario a eliminar

  const [roles, setRoles] = useState<Role[]>([]);
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Usar useEffect para suscribirse a cambios en tiempo real con onSnapshot para roles, sedes y usuarios
  useEffect(() => {
    setLoading(true);
    setError(null);

    const rolesCollection = collection(db, 'roles');
    const unsubscribeRoles = onSnapshot(rolesCollection, (snapshot) => {
      const rolesList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Role));
      setRoles(rolesList);
      // No set loading false here, wait for all
    }, (err) => {
      setError(UI_TEXTS.ERROR_GENERIC_LOAD);
      console.error("Error fetching roles:", err);
      setLoading(false);
    });

    const sedesCollection = collection(db, 'sedes');
    const unsubscribeSedes = onSnapshot(sedesCollection, (snapshot) => {
      const sedesList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sede));
      setSedes(sedesList);
      if (sedesList.length > 0 && !selectedSedeId) {
        setSelectedSedeId(sedesList[0].id);
      }
      // No set loading false here, wait for all
    }, (err) => {
      setError(UI_TEXTS.ERROR_GENERIC_LOAD);
      console.error("Error fetching sedes:", err);
      setLoading(false);
    });

    const usersCollection = collection(db, 'usuarios');
    const unsubscribeUsers = onSnapshot(usersCollection, (snapshot) => {
      const usersList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserProfile));
      setUsers(usersList);
      setLoading(false); // Set loading false after users (the last one) are loaded
    }, (err) => {
      setError(UI_TEXTS.ERROR_GENERIC_LOAD);
      console.error("Error fetching users:", err);
      setLoading(false);
    });

    // La función de limpieza se ejecuta al desmontar el componente
    return () => {
      unsubscribeRoles();
      unsubscribeSedes();
      unsubscribeUsers();
    };
  }, []); // El array de dependencias vacío asegura que se ejecute solo una vez al montar

  // Función para manejar tanto la creación como la edición
  const handleSaveUser = async (e: React.FormEvent, isCurrentlyEditing: boolean) => { // Actualizar signature
    e.preventDefault();
    setError(null);

    // Validación de campos obligatorios
    if (!nombre.trim() || !email.trim() || !rolId || !selectedSedeId) {
      setError(UI_TEXTS.REQUIRED_FIELDS);
      setLoading(false);
      return;
    }

    if (!isCurrentlyEditing) { // Usar isCurrentlyEditing
      if (!password.trim()) {
        setError(UI_TEXTS.REQUIRED_FIELDS); // Contraseña requerida para creación
        setLoading(false);
        return;
      }
      if (password.length < 6) {
        setError(UI_TEXTS.PASSWORD_MIN_LENGTH);
        setLoading(false);
        return;
      }
    }

    try {
      if (editingUser) {
        // Modo edición: actualizar usuario existente
        // Solo actualizamos los campos modificables desde Firestore
        await updateDoc(doc(db, 'usuarios', editingUser.id), {
          nombre: nombre,
          rolId: rolId,
          sedeId: selectedSedeId,
        });
        // alert(`Usuario "${nombre}" actualizado exitosamente.`); // Eliminado alert
      } else {
        // Modo creación: crear nuevo usuario
        // 1. Crear usuario en Firebase Authentication
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const newUserUid = userCredential.user.uid;

        // 2. Crear documento de usuario en Firestore
        await setDoc(doc(db, 'usuarios', newUserUid), {
          nombre: nombre,
          email: email,
          rolId: rolId,
          sedeId: selectedSedeId,
          activo: true, // Asumiendo que los nuevos usuarios están activos por defecto
        });
        // alert(`${UI_TEXTS.USER_CREATED_SUCCESS} ${UI_TEXTS.TODO_USER_CREATION_NOTE}`); // Eliminado alert
      }
      handleClose(); // Cerrar modal y limpiar formulario
    } catch (err: any) {
      let errorMessage = UI_TEXTS.ERROR_GENERIC_CREATE;
      if (err.code === 'auth/email-already-in-use') {
        errorMessage = UI_TEXTS.EMAIL_ALREADY_IN_USE;
      } else if (err.message) {
        errorMessage = err.message;
      }
      setError(errorMessage);
      console.error("Error saving user:", err);
    }
  };

  // Función para iniciar la edición de un usuario
  const handleEdit = (user: UserProfile) => {
    setEditingUser(user);
    setNombre(user.nombre);
    setEmail(user.email);
    setRolId(user.rolId);
    setSelectedSedeId(user.sedeId);
    // No pre-llenar la contraseña por seguridad
    setPassword(''); 
    handleShow(); // Abrir el modal
  };

  // Función para confirmar la eliminación de un usuario
  const handleConfirmDelete = (user: UserProfile) => {
    setDeletingUser(user);
    setShowDeleteModal(true);
  };

  // Función para eliminar un usuario
  const handleDeleteUser = async () => {
    if (!deletingUser) return;
    try {
      await deleteDoc(doc(db, 'usuarios', deletingUser.id));
      // alert(`Usuario "${deletingUser.nombre ?? 'Desconocido'}" eliminado exitosamente.`); // Eliminado alert
      handleCloseDeleteModal(); // Cerrar modal de eliminación y limpiar
    } catch (err: any) { // Catch all errors, including auth errors if any.
      let errorMessage = UI_TEXTS.ERROR_GENERIC_CREATE;
      if (err.message) {
        errorMessage = err.message;
      }
      setError(errorMessage);
      console.error("Error deleting user:", err);
    }
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
        render: (user: UserProfile) => ( // Cambiar _user a user para acceder al objeto
          <>
            <Button variant="link" size="sm" className="me-2" onClick={() => handleEdit(user)}>
              <FaPencilAlt />
            </Button>
            <Button variant="link" size="sm" onClick={() => handleConfirmDelete(user)}>
              <FaTrash />
            </Button>
          </>
        ),
        colClassName: 'text-end'
      },
    ];
  }, [roles, sedes, handleEdit, handleConfirmDelete]); // Añadir handleEdit y handleConfirmDelete a las dependencias

  return (
    <Fragment>
      <Container fluid>
        <Row>
          {!isMobile && ( // Mostrar el formulario solo en vista de escritorio para CREACIÓN
            <Col md={4} className="mb-3">
              <Card>
                <Card.Body className="p-3">
                  <UserCreationForm
                    onSubmit={(e) => handleSaveUser(e, false)} // Siempre false para creación lateral
                    nombre={nombre}
                    setNombre={setNombre}
                    email={email}
                    setEmail={setEmail}
                    password={password}
                    setPassword={setPassword}
                    rolId={rolId}
                    setRolId={setRolId}
                    selectedSedeId={selectedSedeId}
                    setSelectedSedeId={setSelectedSedeId}
                    roles={roles}
                    sedes={sedes}
                    loading={loading}
                    error={error}
                    isEditing={false} // Siempre false en el panel lateral
                  />
                </Card.Body>
              </Card>
            </Col>
          )}

          <Col md={isMobile ? 12 : 8}> {/* La tabla ocupa 12 columnas en móvil, 8 en escritorio */}
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
                    noRecordsMessage={UI_TEXTS.NO_RECORDS_FOUND}
                  />
                )}
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>
      
      {isMobile && <FabButton onClick={handleShow} />} {/* FAB button for mobile */}

      {/* Modal para CREACIÓN (en móvil) o EDICIÓN (en todos los dispositivos) */}
      <GenericCreationModal
        show={showModal}
        onHide={handleClose}
      >
        <UserCreationForm
          onSubmit={(e) => handleSaveUser(e, !!editingUser)} // Detecta si es edición por el estado
          nombre={nombre}
          setNombre={setNombre}
          email={email}
          setEmail={setEmail}
          password={password}
          setPassword={setPassword}
          rolId={rolId}
          setRolId={setRolId}
          selectedSedeId={selectedSedeId}
          setSelectedSedeId={setSelectedSedeId}
          roles={roles}
          sedes={sedes}
          loading={loading}
          error={error}
          isEditing={!!editingUser}
          onCancel={handleClose}
        />
      </GenericCreationModal>

      {/* Modal de confirmación de eliminación */}
      <GenericCreationModal
        show={showDeleteModal}
        onHide={handleCloseDeleteModal}
        dialogClassName="delete-modal-dialog" // Añadir la clase para el estilo
      >
        <p>
          ¿Está seguro que desea eliminar el usuario "
          <strong>{deletingUser?.nombre ?? 'Desconocido'}</strong>" con email "
          <strong>{deletingUser?.email ?? 'Desconocido'}</strong>"? Esta acción eliminará el
          documento del usuario de Firestore, pero **NO** eliminará la cuenta
          de autenticación de Firebase. Para una eliminación completa,
          se requiere una función de Cloud Functions.
        </p>
        <div className="d-flex justify-content-end gap-2">
          <Button variant="secondary" onClick={handleCloseDeleteModal} className="rounded-0 shadow-none">
            {UI_TEXTS.CLOSE}
          </Button>
          <Button variant="danger" onClick={handleDeleteUser} className="rounded-0 shadow-none">
            {UI_TEXTS.DELETE}
          </Button>
        </div>
      </GenericCreationModal>
    </Fragment>
  );
};

export default AdminUsersPage;