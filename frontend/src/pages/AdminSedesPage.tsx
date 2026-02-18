import type { FC } from 'react';
import { useState, useEffect, useMemo, Fragment } from 'react'; // Importar Fragment
import { Container, Row, Col, Card, Form, Button, Alert } from 'react-bootstrap';
import { db } from '../api/firebase';
import { collection, getDocs, addDoc } from 'firebase/firestore';

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
  const handleClose = () => setShowModal(false);

  const [nombreSede, setNombreSede] = useState(''); // Para el input del formulario
  const [sedes, setSedes] = useState<Sede[]>([]); // Lista de sedes
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Componente funcional para el formulario de creación de sedes
  const SedeCreationForm: React.FC<{
    onSubmit: (e: React.FormEvent) => Promise<void>;
    nombreSede: string;
    setNombreSede: (name: string) => void;
    error: string | null;
  }> = ({ onSubmit, nombreSede, setNombreSede, error }) => (
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
        {UI_TEXTS.CREATE_SEDE}
      </Button>
    </Form>
  );

  // Función para cargar las sedes
  const fetchSedes = async () => {
    setLoading(true);
    try {
      const sedesCollection = collection(db, 'sedes');
      const sedesSnapshot = await getDocs(sedesCollection);
      const sedesList = sedesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sede));
      setSedes(sedesList);
    } catch (err) {
      setError(UI_TEXTS.ERROR_GENERIC_LOAD);
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSedes(); // Cargar sedes al montar el componente
  }, []);

  const handleCreateSede = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!nombreSede.trim()) {
      setError(UI_TEXTS.SEDE_NAME_EMPTY);
      return;
    }

    try {
      const sedesCollection = collection(db, 'sedes');
      await addDoc(sedesCollection, {
        nombre: nombreSede,
      });
      setNombreSede(''); // Limpiar el formulario
      await fetchSedes(); // Recargar la lista de sedes
    } catch (err) {
      setError(UI_TEXTS.ERROR_GENERIC_CREATE);
      console.error(err);
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
        render: (_sede: Sede) => (
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
  }, []);

  return (
    <Fragment>
      <Container fluid>
        <Row>
          {!isMobile && ( // Mostrar el formulario solo en vista de escritorio
            <Col md={4} className="mb-3">
              <Card>
                <Card.Body className="p-3">
                  <SedeCreationForm
                    onSubmit={handleCreateSede}
                    nombreSede={nombreSede}
                    setNombreSede={setNombreSede}
                    error={error}
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

      {isMobile && ( // Modal para la vista móvil
        <GenericCreationModal
          show={showModal}
          onHide={handleClose}
          title={UI_TEXTS.CREATE_SEDE} // Usar una constante para "Crear Sede"
        >
          <SedeCreationForm
            onSubmit={handleCreateSede}
            nombreSede={nombreSede}
            setNombreSede={setNombreSede}
            error={error}
          />
        </GenericCreationModal>
      )}
    </Fragment>
  );
};

export default AdminSedesPage;