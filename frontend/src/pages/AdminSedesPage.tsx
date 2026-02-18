import type { FC } from 'react';
import { useState, useEffect, useMemo, Fragment } from 'react'; // Importar Fragment
import { Container, Row, Col, Card, Form, Button, Alert } from 'react-bootstrap';
import { db } from '../api/firebase';
import { collection, addDoc, onSnapshot, updateDoc, doc, deleteDoc } from 'firebase/firestore'; // Importar onSnapshot, updateDoc y deleteDoc

import { FaPencilAlt, FaTrash } from 'react-icons/fa';
import useMediaQuery from '../hooks/useMediaQuery'; // Importar el hook useMediaQuery

import SearchInput from '../components/SearchInput';
import GenericTable, { type Column } from '../components/GenericTable';
import { UI_TEXTS, SPINNER_VARIANTS } from '../constants'; // Importar constantes y SPINNER_VARIANTS
import GlobalSpinner from '../components/GlobalSpinner'; // Importar GlobalSpinner
import FabButton from '../components/FabButton'; // Importar FabButton
import GenericCreationModal from '../components/GenericCreationModal'; // Importar GenericCreationModal

// Define la interfaz para una Sede
interface Sede {
  id: string;
  nombre: string;
  // Puedes añadir más campos aquí según la documentación (ej. direccion)
  // direccion?: string;
}

// Componente funcional para el formulario de creación/edición de sedes (MOVIDO FUERA DEL COMPONENTE PRINCIPAL)
const SedeCreationForm: React.FC<{
  onSubmit: (e: React.FormEvent) => Promise<void>;
  nombreSede: string;
  setNombreSede: (name: string) => void;
  error: string | null;
  isEditing: boolean; // Nuevo prop para indicar si se está editando
}> = ({ onSubmit, nombreSede, setNombreSede, error, isEditing }) => (
  <Form onSubmit={onSubmit}>
    <Form.Group className="mb-3" controlId="formSedeName">
      <Form.Label>{UI_TEXTS.SEDE_NAME}</Form.Label>
      <Form.Control
        type="text"
        placeholder={UI_TEXTS.PLACEHOLDER_SEDE_NAME}
        value={nombreSede}
        onChange={(e) => setNombreSede(e.target.value)}
        required
      />
    </Form.Group>
    
    {error && <Alert variant="danger" className="mt-3">{error}</Alert>}

    <Button variant="primary" type="submit" className="w-100 mt-3">
      {isEditing ? UI_TEXTS.UPDATE_SEDE : UI_TEXTS.CREATE_SEDE} {/* Cambiar texto del botón */}
    </Button>
  </Form>
);

const AdminSedesPage: FC = () => {
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
  
  const handleClose = () => {
    setShowModal(false);
    setEditingSede(null); // Resetear la sede en edición al cerrar el modal
    setNombreSede(''); // Limpiar el formulario
    setError(null); // Limpiar errores
  };

  const [showDeleteModal, setShowDeleteModal] = useState(false); // Estado para controlar la visibilidad del modal de eliminación
  const handleCloseDeleteModal = () => {
    setShowDeleteModal(false);
    setDeletingSede(null); // Resetear la sede a eliminar al cerrar el modal
  };

  const [nombreSede, setNombreSede] = useState(''); // Para el input del formulario
  const [editingSede, setEditingSede] = useState<Sede | null>(null); // Estado para la sede en edición
  const [deletingSede, setDeletingSede] = useState<Sede | null>(null); // Estado para la sede a eliminar
  const [sedes, setSedes] = useState<Sede[]>([]); // Lista de sedes
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Usar useEffect para suscribirse a cambios en tiempo real con onSnapshot
  useEffect(() => {
    setLoading(true);
    setError(null);

    const sedesCollection = collection(db, 'sedes');
    const unsubscribe = onSnapshot(sedesCollection, (snapshot) => {
      const sedesList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sede));
      setSedes(sedesList);
      setLoading(false);
    }, (err) => {
      setError(UI_TEXTS.ERROR_GENERIC_LOAD);
      console.error("Error fetching sedes:", err);
      setLoading(false);
    });

    // La función de limpieza se ejecuta al desmontar el componente o si cambian las dependencias
    return () => unsubscribe();
  }, []); // El array de dependencias vacío asegura que se ejecute solo una vez al montar

  // Función para manejar tanto la creación como la edición
  const handleSaveSede = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!nombreSede.trim()) {
      setError(UI_TEXTS.SEDE_NAME_EMPTY);
      return;
    }

    try {
      if (editingSede) {
        // Modo edición: actualizar sede existente
        await updateDoc(doc(db, 'sedes', editingSede.id), {
          nombre: nombreSede,
        });
        // alert(`Sede "${nombreSede}" actualizada exitosamente.`); // Eliminado alert
      } else {
        // Modo creación: crear nueva sede
        const sedesCollection = collection(db, 'sedes');
        await addDoc(sedesCollection, {
          nombre: nombreSede,
        });
        // alert(`Sede "${nombreSede}" creada exitosamente.`); // Eliminado alert
      }
      handleClose(); // Cerrar modal y limpiar formulario
    } catch (err) {
      setError(UI_TEXTS.ERROR_GENERIC_CREATE);
      console.error("Error saving sede:", err);
    }
  };

  // Función para iniciar la edición de una sede
  const handleEdit = (sede: Sede) => {
    setEditingSede(sede);
    setNombreSede(sede.nombre);
    handleShow(); // Abrir el modal
  };

  // Función para confirmar la eliminación de una sede
  const handleConfirmDelete = (sede: Sede) => {
    setDeletingSede(sede);
    setShowDeleteModal(true);
  };

  // Función para eliminar una sede
  const handleDeleteSede = async () => {
    if (!deletingSede) return;
    try {
      await deleteDoc(doc(db, 'sedes', deletingSede.id));
      // alert(`Sede "${deletingSede.nombre ?? 'Desconocido'}" eliminada exitosamente.`); // Eliminado alert
      handleCloseDeleteModal(); // Cerrar modal de eliminación y limpiar
    } catch (err) {
      setError(UI_TEXTS.ERROR_GENERIC_CREATE); // Reutilizar para error de eliminación
      console.error("Error deleting sede:", err);
    }
  };

  const filteredSedes = useMemo(() => {
    return sedes.filter(sede =>
      sede.nombre.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [sedes, searchTerm]);

  // Definición de las columnas para GenericTable
  const sedesTableColumns: Column<Sede>[] = useMemo(() => {
    return [
      { accessorKey: 'nombre', header: UI_TEXTS.TABLE_HEADER_NAME },
      {
        header: UI_TEXTS.TABLE_HEADER_ACTIONS,
        render: (sede: Sede) => ( // Cambiar _sede a sede para acceder al objeto
          <>
            <Button variant="link" size="sm" className="me-2" onClick={() => handleEdit(sede)}>
              <FaPencilAlt />
            </Button>
            <Button variant="link" size="sm" onClick={() => handleConfirmDelete(sede)}>
              <FaTrash />
            </Button>
          </>
        ),
        colClassName: 'text-end'
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
                  <SedeCreationForm
                    onSubmit={handleSaveSede} // Usar handleSaveSede
                    nombreSede={nombreSede}
                    setNombreSede={setNombreSede}
                    error={error}
                    isEditing={!!editingSede} // Pasar isEditing al formulario
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
                  placeholder={UI_TEXTS.PLACEHOLDER_SEARCH_SEDES}
                  className="mb-3"
                />

                {loading ? (
                  <GlobalSpinner variant={SPINNER_VARIANTS.IN_PAGE} />
                ) : (
                  <GenericTable<Sede>
                    data={filteredSedes}
                    columns={sedesTableColumns}
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
        >
          <SedeCreationForm
            onSubmit={handleSaveSede} // Usar handleSaveSede
            nombreSede={nombreSede}
            setNombreSede={setNombreSede}
            error={error}
            isEditing={!!editingSede} // Pasar isEditing al formulario
          />
        </GenericCreationModal>
      )}

      {/* Modal de confirmación de eliminación */}
      <GenericCreationModal
        show={showDeleteModal}
        onHide={handleCloseDeleteModal}
        dialogClassName="delete-modal-dialog" // Añadir la clase para el estilo
      >
        <p>
          ¿Está seguro que desea eliminar la sede "
          <strong>{deletingSede?.nombre ?? 'Desconocido'}</strong>"? Esta acción no se puede deshacer.
        </p>
        <div className="d-flex justify-content-end gap-2">
          <Button variant="secondary" onClick={handleCloseDeleteModal} className="rounded-0 shadow-none">
            {UI_TEXTS.CLOSE}
          </Button>
          <Button variant="danger" onClick={handleDeleteSede} className="rounded-0 shadow-none">
            {UI_TEXTS.DELETE}
          </Button>
        </div>
      </GenericCreationModal>
    </Fragment>
  );
};

export default AdminSedesPage;