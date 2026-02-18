import type { FC } from 'react';
import { useState, useEffect, useMemo, Fragment } from 'react'; // Importar Fragment
import { Container, Row, Col, Card, Form, Button, Alert } from 'react-bootstrap';
import { db } from '../api/firebase';
import { collection, setDoc, doc, onSnapshot, updateDoc, deleteDoc } from 'firebase/firestore'; // Importar onSnapshot, updateDoc y deleteDoc
import { FaPencilAlt, FaTrash } from 'react-icons/fa'; // Iconos para acciones
import useMediaQuery from '../hooks/useMediaQuery'; // Importar el hook useMediaQuery

import SearchInput from '../components/SearchInput';
import GenericTable, { type Column } from '../components/GenericTable';
import { UI_TEXTS, SPINNER_VARIANTS } from '../constants'; // Importar constantes y SPINNER_VARIANTS
import GlobalSpinner from '../components/GlobalSpinner'; // Importar GlobalSpinner
import FabButton from '../components/FabButton'; // Importar FabButton
import GenericCreationModal from '../components/GenericCreationModal'; // Importar GenericCreationModal

// Define la interfaz para un Rol
interface Role {
  id: string;
  nombre: string;
  // descripcion?: string; // REMOVED: No longer in documentation
}

// Componente funcional para el formulario de creación/edición de roles
const RoleCreationForm: React.FC<{
  onSubmit: (e: React.FormEvent) => Promise<void>;
  idRol: string;
  setIdRol: (id: string) => void;
  nombreRol: string;
  setNombreRol: (name: string) => void;
  error: string | null;
  isEditing: boolean; // Nuevo prop para indicar si se está editando
}> = ({ onSubmit, idRol, setIdRol, nombreRol, setNombreRol, error, isEditing }) => (
  <Form onSubmit={onSubmit}>
    <Form.Group className="mb-3" controlId="formRoleId">
      <Form.Label>ID de Rol</Form.Label>
      <Form.Control
        type="text"
        placeholder="Ej. admin, preventista"
        value={idRol}
        onChange={(e) => setIdRol(e.target.value)}
        required
        disabled={isEditing} // Deshabilitar el ID si se está editando
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
      {isEditing ? UI_TEXTS.UPDATE_ROLE : UI_TEXTS.CREATE_ROLE} {/* Cambiar texto del botón */}
    </Button>
  </Form>
);

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

  const [showModal, setShowModal] = useState(false); // Estado para controlar la visibilidad del modal de creación/edición
  const handleShow = () => setShowModal(true);
  
  const handleClose = () => {
    setShowModal(false);
    setEditingRole(null); // Resetear el rol en edición al cerrar el modal
    setNombreRol(''); // Limpiar el formulario
    setIdRol(''); // Limpiar el ID del rol
    setError(null); // Limpiar errores
  };

  const [showDeleteModal, setShowDeleteModal] = useState(false); // Estado para controlar la visibilidad del modal de eliminación
  const handleCloseDeleteModal = () => {
    setShowDeleteModal(false);
    setDeletingRole(null); // Resetear el rol a eliminar al cerrar el modal
  };

  const [nombreRol, setNombreRol] = useState(''); // Para el input del formulario
  const [idRol, setIdRol] = useState(''); // Nuevo estado para el ID del rol
  const [editingRole, setEditingRole] = useState<Role | null>(null); // Estado para el rol en edición
  const [deletingRole, setDeletingRole] = useState<Role | null>(null); // Estado para el rol a eliminar
  const [roles, setRoles] = useState<Role[]>([]); // Lista de roles
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Usar useEffect para suscribirse a cambios en tiempo real con onSnapshot
  useEffect(() => {
    setLoading(true);
    setError(null);

    const rolesCollection = collection(db, 'roles');
    const unsubscribe = onSnapshot(rolesCollection, (snapshot) => {
      const rolesList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Role));
      setRoles(rolesList);
      setLoading(false);
    }, (err) => {
      setError(UI_TEXTS.ERROR_GENERIC_LOAD);
      console.error("Error fetching roles:", err);
      setLoading(false);
    });

    // La función de limpieza se ejecuta al desmontar el componente o si cambian las dependencias
    return () => unsubscribe();
  }, []); // El array de dependencias vacío asegura que se ejecute solo una vez al montar

  // Función para manejar tanto la creación como la edición
  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!idRol.trim() || !nombreRol.trim()) {
      setError(UI_TEXTS.REQUIRED_FIELDS);
      return;
    }

    try {
      if (editingRole) {
        // Modo edición: actualizar rol existente
        await updateDoc(doc(db, 'roles', editingRole.id), {
          nombre: nombreRol,
        });
        // alert(`Rol "${nombreRol}" actualizado exitosamente.`); // Eliminado alert
      } else {
        // Modo creación: crear nuevo rol
        await setDoc(doc(db, 'roles', idRol), {
          nombre: nombreRol,
        });
        // alert(`Rol "${nombreRol}" creado exitosamente.`); // Eliminado alert
      }
      handleClose(); // Cerrar modal y limpiar formulario
    } catch (err) {
      setError(UI_TEXTS.ERROR_GENERIC_CREATE);
      console.error("Error saving role:", err);
    }
  };

  // Función para iniciar la edición de un rol
  const handleEdit = (role: Role) => {
    setEditingRole(role);
    setIdRol(role.id);
    setNombreRol(role.nombre);
    handleShow(); // Abrir el modal
  };

  // Función para confirmar la eliminación de un rol
  const handleConfirmDelete = (role: Role) => {
    setDeletingRole(role);
    setShowDeleteModal(true);
  };

  // Función para eliminar un rol
  const handleDeleteRole = async () => {
    if (!deletingRole) return;
    try {
      await deleteDoc(doc(db, 'roles', deletingRole.id));
      // alert(`Rol "${deletingRole.nombre}" eliminado exitosamente.`); // Eliminado alert
      handleCloseDeleteModal(); // Cerrar modal de eliminación y limpiar
    } catch (err) {
      setError(UI_TEXTS.ERROR_GENERIC_CREATE); // Reutilizar para error de eliminación
      console.error("Error deleting role:", err);
    }
  };


  const filteredRoles = useMemo(() => {
    return roles.filter(role =>
      role.nombre.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [roles, searchTerm]);

  // Definición de las columnas para GenericTable
  const rolesTableColumns: Column<Role>[] = useMemo(() => {
    return [
      { accessorKey: 'id', header: 'ID' }, // Nuevo: Mostrar el ID del rol
      { accessorKey: 'nombre', header: UI_TEXTS.TABLE_HEADER_NAME },
      {
        header: UI_TEXTS.TABLE_HEADER_ACTIONS,
        render: (role: Role) => ( // Cambiar _role a role para acceder al objeto
          <>
            <Button variant="link" size="sm" className="me-2" onClick={() => handleEdit(role)}>
              <FaPencilAlt />
            </Button>
            <Button variant="link" size="sm" onClick={() => handleConfirmDelete(role)}>
              <FaTrash />
            </Button>
          </>
        ),
        colClassName: 'text-end' // Alinear acciones a la derecha
      },
    ];
  }, [handleEdit, handleConfirmDelete]); // Añadir handleEdit y handleConfirmDelete a las dependencias

  return (
    <Fragment>
      <Container fluid>
        <Row>
          {!isMobile && ( // Mostrar el formulario solo en vista de escritorio
            <Col md={4} className="mb-3">
              <Card>
                <Card.Body className="p-3">
                  <RoleCreationForm
                    onSubmit={handleSaveRole} // Usar handleSaveRole
                    idRol={idRol}
                    setIdRol={setIdRol}
                    nombreRol={nombreRol}
                    setNombreRol={setNombreRol}
                    error={error}
                    isEditing={!!editingRole} // Pasar isEditing al formulario
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

      {isMobile && ( // Modal para la vista móvil de creación/edición
        <GenericCreationModal
          show={showModal}
          onHide={handleClose}
          title={editingRole ? UI_TEXTS.EDIT_ROLE : UI_TEXTS.CREATE_ROLE} // Cambiar título del modal
        >
          <RoleCreationForm
            onSubmit={handleSaveRole} // Usar handleSaveRole
            idRol={idRol}
            setIdRol={setIdRol}
            nombreRol={nombreRol}
            setNombreRol={setNombreRol}
            error={error}
            isEditing={!!editingRole} // Pasar isEditing al formulario
          />
        </GenericCreationModal>
      )}

      {/* Modal de confirmación de eliminación */}
      <GenericCreationModal
        show={showDeleteModal}
        onHide={handleCloseDeleteModal}
        title={UI_TEXTS.CONFIRM_DELETE}
        dialogClassName="delete-modal-dialog" // Añadir la clase para el estilo
      >
        <p>
          ¿Está seguro que desea eliminar el rol "
          <strong>{deletingRole?.nombre ?? 'Desconocido'}</strong>"? Esta acción no se puede deshacer.
        </p>
        <div className="d-flex justify-content-end gap-2">
          <Button variant="secondary" onClick={handleCloseDeleteModal} className="rounded-0 shadow-none">
            {UI_TEXTS.CLOSE}
          </Button>
          <Button variant="danger" onClick={handleDeleteRole} className="rounded-0 shadow-none">
            {UI_TEXTS.DELETE}
          </Button>
        </div>
      </GenericCreationModal>
    </Fragment>
  );
};

export default AdminRolesPage;