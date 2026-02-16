import type { FC } from 'react';
import { useState, useEffect, useMemo } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert } from 'react-bootstrap';
import { db } from '../api/firebase';
import { collection, getDocs, addDoc } from 'firebase/firestore';
import { FaPencilAlt, FaTrash } from 'react-icons/fa'; // Iconos para acciones

import SearchInput from '../components/SearchInput';
import GenericTable, { type Column } from '../components/GenericTable';

// Define la interfaz para una Sede
interface Sede {
  id: string;
  nombre: string;
  // Puedes añadir más campos aquí según la documentación (ej. 'direccion')
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

  const [nombreSede, setNombreSede] = useState(''); // Para el input del formulario
  const [sedes, setSedes] = useState<Sede[]>([]); // Lista de sedes
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Función para cargar las sedes
  const fetchSedes = async () => {
    setLoading(true);
    try {
      const sedesCollection = collection(db, 'sedes');
      const sedesSnapshot = await getDocs(sedesCollection);
      const sedesList = sedesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sede));
      setSedes(sedesList);
    } catch (err) {
      setError('Error al cargar las sedes. Verifique los permisos de Firestore.');
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
      setError('El nombre de la sede no puede estar vacío.');
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
      setError('Error al crear la sede. Verifique los permisos de Firestore.');
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
      { accessorKey: 'nombre', header: 'Nombre' },
      {
        header: 'Acciones',
        render: (_sede: Sede) => (
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
  }, []);

  return (
    <Container fluid>
      <Row>
        <Col md={4} className="mb-3">
          <Card>
            <Card.Body className="p-3">
              <Form onSubmit={handleCreateSede}>
                <Form.Group className="mb-3" controlId="formSedeName">
                  <Form.Label>Nombre de la Sede</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="Ej. Sede Principal"
                    value={nombreSede}
                    onChange={(e) => setNombreSede(e.target.value)}
                    required
                  />
                </Form.Group>
                
                {error && <Alert variant="danger" className="mt-3">{error}</Alert>}

                <Button variant="primary" type="submit" className="w-100 mt-3">
                  Crear Sede
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
                placeholder="Buscar por nombre de sede..."
                className="mb-3"
              />

              {loading ? (
                <p>Cargando sedes...</p>
              ) : (
                <GenericTable<Sede>
                  data={filteredSedes}
                  columns={sedesTableColumns}
                  variant={isDarkMode ? 'dark' : ''}
                  maxHeight="70vh"
                  noRecordsMessage="No se encontraron sedes."
                />
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default AdminSedesPage;
