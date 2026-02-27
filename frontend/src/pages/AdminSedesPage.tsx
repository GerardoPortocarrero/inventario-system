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

interface Sede {
  id: string;
  nombre: string;
}

const SedeForm: React.FC<{
  initialData: Sede | null;
  onSubmit: (data: any, isEditing: boolean, resetForm: () => void) => Promise<void>;
  onCancel?: () => void;
  loading: boolean;
}> = ({ initialData, onSubmit, onCancel, loading }) => {
  const [nombreSede, setNombreSede] = useState(initialData?.nombre || '');
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setNombreSede('');
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombreSede.trim()) {
      setError(UI_TEXTS.SEDE_NAME_EMPTY);
      return;
    }
    try {
      await onSubmit({ nombre: nombreSede }, !!initialData, resetForm);
    } catch (err: any) {
      setError(UI_TEXTS.ERROR_GENERIC_CREATE);
    }
  };

  return (
    <Form onSubmit={handleSubmit}>
      <Form.Group className="mb-3">
        <Form.Label>{UI_TEXTS.SEDE_NAME}</Form.Label>
        <Form.Control
          type="text"
          value={nombreSede}
          onChange={(e) => setNombreSede(e.target.value)}
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
            initialData ? UI_TEXTS.UPDATE_SEDE : UI_TEXTS.CREATE_SEDE
          )}
        </Button>
      </div>
    </Form>
  );
};

const AdminSedesPage: FC = () => {
  const [isDarkMode, setIsDarkMode] = useState(() => document.body.classList.contains('theme-dark'));
  const isMobile = useMediaQuery('(max-width: 768px)');

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDarkMode(document.body.classList.contains('theme-dark'));
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingSede, setEditingSede] = useState<Sede | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [deletingSede, setDeletingSede] = useState<Sede | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'sedes'), s => {
      setSedes(s.docs.map(d => ({ id: d.id, nombre: d.get('nombre') || '' } as Sede)));
      setLoading(false);
    });
    return unsub;
  }, []);

  const handleSaveSede = async (data: any, isEditing: boolean, resetForm: () => void) => {
    setIsSubmitting(true);
    try {
      if (isEditing && editingSede) {
        await updateDoc(doc(db, 'sedes', editingSede.id), data);
        setEditingSede(null);
      } else {
        await addDoc(collection(db, 'sedes'), data);
        resetForm();
      }
      setShowModal(false);
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredSedes = useMemo(() => sedes.filter(s => s.nombre.toLowerCase().includes(searchTerm.toLowerCase())), [sedes, searchTerm]);

  const columns: Column<Sede>[] = [
    { accessorKey: 'nombre', header: UI_TEXTS.TABLE_HEADER_NAME },
    {
      header: UI_TEXTS.TABLE_HEADER_ACTIONS,
      render: (s) => (
        <div className="d-flex gap-2 action-buttons-container">
          <Button variant="link" size="sm" className="p-0 action-btn edit-btn" onClick={() => { setEditingSede(s); setShowModal(true); }}>
            <FaPencilAlt className="icon-desktop" /> <span className="text-mobile">Editar</span>
          </Button>
          <Button variant="link" size="sm" className="p-0 text-danger action-btn delete-btn" onClick={() => setDeletingSede(s)}>
            <FaTrash className="icon-desktop" /> <span className="text-mobile">Eliminar</span>
          </Button>
        </div>
      )
    }
  ];

  return (
    <Fragment>
      <Container fluid className="p-0">
        <div className="admin-layout-container">
          {!isMobile && (
            <div className="admin-section-form">
              <SedeForm 
                key="new-sede-form"
                onSubmit={handleSaveSede} 
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
                placeholder={UI_TEXTS.PLACEHOLDER_SEARCH_SEDES} 
                className="flex-grow-1 mb-0" 
              />
            </div>
            {loading ? <GlobalSpinner variant={SPINNER_VARIANTS.IN_PAGE} /> : (
              <GenericTable data={filteredSedes} columns={columns} variant={isDarkMode ? 'dark' : ''} />
            )}
          </div>
        </div>
      </Container>
      {isMobile && <FabButton onClick={() => setShowModal(true)} />}
      <GenericCreationModal show={showModal} onHide={() => { setShowModal(false); setEditingSede(null); }}>
        <SedeForm 
          key={editingSede ? editingSede.id : 'modal-new'}
          initialData={editingSede} 
          onSubmit={handleSaveSede} 
          onCancel={() => { setShowModal(false); setEditingSede(null); }} 
          loading={isSubmitting} 
        />
      </GenericCreationModal>
      <GenericCreationModal show={!!deletingSede} onHide={() => setDeletingSede(null)}>
        <p>¿Eliminar sede <strong>{deletingSede?.nombre}</strong>?</p>
        <div className="d-flex justify-content-end gap-2">
          <Button variant="secondary" onClick={() => setDeletingSede(null)}>{UI_TEXTS.CLOSE}</Button>
          <Button variant="danger" onClick={async () => {
            if (deletingSede) {
              await deleteDoc(doc(db, 'sedes', deletingSede.id));
              setDeletingSede(null);
            }
          }}>{UI_TEXTS.DELETE}</Button>
        </div>
      </GenericCreationModal>
    </Fragment>
  );
};

export default AdminSedesPage;
