import type { FC } from 'react';
import { useState, useEffect, useMemo, Fragment } from 'react';
import { Container, Form, Button, Alert, Spinner } from 'react-bootstrap';
import { db } from '../api/firebase';
import { collection, addDoc, onSnapshot, updateDoc, doc, deleteDoc } from 'firebase/firestore';

import { FaPencilAlt, FaTrash } from 'react-icons/fa';
import useMediaQuery from '../hooks/useMediaQuery';

import SearchInput from '../components/SearchInput';
import GenericTable, { type Column } from '../components/GenericTable';
import { UI_TEXTS, SPINNER_VARIANTS } from '../constants';
import GlobalSpinner from '../components/GlobalSpinner';
import FabButton from '../components/FabButton';
import GenericCreationModal from '../components/GenericCreationModal';
import { useData } from '../context/DataContext';
import { matchSearchTerms } from '../utils/searchUtils';

interface Ruta {
  id: string;
  nombre: string;
}

const RutaForm: React.FC<{
  initialData: Ruta | null;
  onSubmit: (data: any, isEditing: boolean, resetForm: () => void) => Promise<void>;
  onCancel?: () => void;
  loading: boolean;
}> = ({ initialData, onSubmit, onCancel, loading }) => {
  const [nombreRuta, setNombreRuta] = useState(initialData?.nombre || '');
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setNombreRuta('');
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombreRuta.trim()) {
      setError(UI_TEXTS.RUTA_NAME_EMPTY);
      return;
    }
    try {
      await onSubmit({ nombre: nombreRuta }, !!initialData, resetForm);
    } catch (err: any) {
      setError(UI_TEXTS.ERROR_GENERIC_CREATE);
    }
  };

  return (
    <Form onSubmit={handleSubmit}>
      <Form.Group className="mb-3">
        <Form.Label>{UI_TEXTS.RUTA_NAME}</Form.Label>
        <Form.Control
          type="text"
          value={nombreRuta}
          onChange={(e) => setNombreRuta(e.target.value)}
          placeholder={UI_TEXTS.PLACEHOLDER_RUTA_NAME}
          required
          disabled={loading}
        />
      </Form.Group>
      {error && <Alert variant="danger">{error}</Alert>}
      <div className="d-flex gap-2 mt-3">
        {onCancel && <Button variant="secondary" onClick={onCancel} className="w-100" disabled={loading}>{UI_TEXTS.CLOSE}</Button>}
        <Button variant="primary" type="submit" className="w-100" disabled={loading}>
          {loading ? (
            <>
              <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" className="me-2" />
              {UI_TEXTS.LOADING}
            </>
          ) : (
            initialData ? UI_TEXTS.UPDATE_RUTA : UI_TEXTS.CREATE_RUTA
          )}
        </Button>
      </div>
    </Form>
  );
};

const AdminRutasPage: FC = () => {
  const [isDarkMode, setIsDarkMode] = useState(() => document.body.classList.contains('theme-dark'));
  const isMobile = useMediaQuery('(max-width: 768px)');

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDarkMode(document.body.classList.contains('theme-dark'));
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  
  const { loadingMasterData } = useData();
  const [rutas, setRutas] = useState<Ruta[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingRuta, setEditingRuta] = useState<Ruta | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [deletingRuta, setDeletingRuta] = useState<Ruta | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'rutas'), s => {
      setRutas(s.docs.map(d => ({ id: d.id, nombre: d.get('nombre') || '' } as Ruta)));
      setLoading(false);
    });
    return unsub;
  }, []);

  const handleSaveRuta = async (data: any, isEditing: boolean, resetForm: () => void) => {
    setIsSubmitting(true);
    try {
      if (isEditing && editingRuta) {
        await updateDoc(doc(db, 'rutas', editingRuta.id), data);
        setEditingRuta(null);
      } else {
        await addDoc(collection(db, 'rutas'), data);
        resetForm();
      }
      setShowModal(false);
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredRutas = useMemo(() => rutas.filter(r => matchSearchTerms(r, searchTerm, ['nombre'])), [rutas, searchTerm]);

  const columns: Column<Ruta>[] = [
    { accessorKey: 'nombre', header: UI_TEXTS.TABLE_HEADER_NAME },
    {
      header: UI_TEXTS.TABLE_HEADER_ACTIONS,
      render: (r) => (
        <div className="d-flex gap-2 action-buttons-container">
          <Button variant="link" size="sm" className="p-0 action-btn edit-btn" onClick={() => { setEditingRuta(r); setShowModal(true); }}>
            <FaPencilAlt className="icon-desktop" /> <span className="text-mobile">Editar</span>
          </Button>
          <Button variant="link" size="sm" className="p-0 text-danger action-btn delete-btn" onClick={() => setDeletingRuta(r)}>
            <FaTrash className="icon-desktop" /> <span className="text-mobile">Eliminar</span>
          </Button>
        </div>
      )
    }
  ];

  if (loading || loadingMasterData) return <GlobalSpinner variant={SPINNER_VARIANTS.IN_PAGE} />;

  return (
    <Fragment>
      <Container fluid className="p-0">
        <div className="admin-layout-container">
          {!isMobile && (
            <div className="admin-section-form">
              <RutaForm 
                key="new-ruta-form"
                onSubmit={handleSaveRuta} 
                loading={isSubmitting} 
                initialData={null} 
              />
            </div>
          )}
          <div className="admin-section-table">
            <div className="d-flex flex-column flex-md-row gap-3 mb-3">
              <SearchInput 
                searchTerm={searchTerm} 
                onSearchChange={setSearchTerm} 
                placeholder={UI_TEXTS.PLACEHOLDER_SEARCH_RUTAS} 
                className="flex-grow-1 mb-0" 
              />
            </div>
            <GenericTable 
              data={filteredRutas} 
              columns={columns} 
              variant={isDarkMode ? 'dark' : ''} 
              isLoading={loading}
            />
          </div>
        </div>
      </Container>
      {isMobile && <FabButton onClick={() => setShowModal(true)} />}
      <GenericCreationModal show={showModal} onHide={() => { setShowModal(false); setEditingRuta(null); }}>
        <RutaForm 
          key={editingRuta ? editingRuta.id : 'modal-new'}
          initialData={editingRuta} 
          onSubmit={handleSaveRuta} 
          onCancel={() => { setShowModal(false); setEditingRuta(null); }} 
          loading={isSubmitting} 
        />
      </GenericCreationModal>
      <GenericCreationModal show={!!deletingRuta} onHide={() => setDeletingRuta(null)}>
        <p>¿Eliminar ruta <strong>{deletingRuta?.nombre}</strong>?</p>
        <div className="d-flex justify-content-end gap-2">
          <Button variant="secondary" onClick={() => setDeletingRuta(null)}>{UI_TEXTS.CLOSE}</Button>
          <Button variant="danger" onClick={async () => {
            if (deletingRuta) {
              await deleteDoc(doc(db, 'rutas', deletingRuta.id));
              setDeletingRuta(null);
            }
          }}>{UI_TEXTS.DELETE}</Button>
        </div>
      </GenericCreationModal>
    </Fragment>
  );
};

export default AdminRutasPage;
