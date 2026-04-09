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

interface Mesa {
  id: string;
  nombre: string;
  sedeId?: string;
}

const MesaForm: React.FC<{
  initialData: Mesa | null;
  onSubmit: (data: any, isEditing: boolean, resetForm: () => void) => Promise<void>;
  onCancel?: () => void;
  loading: boolean;
}> = ({ initialData, onSubmit, onCancel, loading }) => {
  const { sedes } = useData();
  const [nombreMesa, setNombreMesa] = useState(initialData?.nombre || '');
  const [sedeId, setSedeId] = useState(initialData?.sedeId || '');
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setNombreMesa('');
    setSedeId('');
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); // Reset error
    
    if (!nombreMesa.trim()) {
      setError(UI_TEXTS.MESA_NAME_EMPTY);
      return;
    }
    if (!sedeId) {
      setError("Debe seleccionar una sede.");
      return;
    }
    try {
      await onSubmit({ nombre: nombreMesa, sedeId }, !!initialData, resetForm);
    } catch (err: any) {
      // Si la función onSubmit lanzó un error con mensaje, lo mostramos
      setError(err.message || UI_TEXTS.ERROR_GENERIC_CREATE);
    }
  };

  return (
    <Form onSubmit={handleSubmit}>
      <Form.Group className="mb-3">
        <Form.Label>{UI_TEXTS.MESA_NAME}</Form.Label>
        <Form.Control
          type="text"
          value={nombreMesa}
          onChange={(e) => setNombreMesa(e.target.value)}
          required
          disabled={loading}
          placeholder={UI_TEXTS.PLACEHOLDER_MESA_NAME}
        />
      </Form.Group>

      <Form.Group className="mb-3">
        <Form.Label>Sede</Form.Label>
        <Form.Select
          value={sedeId}
          onChange={(e) => setSedeId(e.target.value)}
          disabled={loading}
          required
        >
          <option value="">-- Seleccionar Sede --</option>
          {sedes.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nombre}
            </option>
          ))}
        </Form.Select>
      </Form.Group>

      {error && <Alert variant="danger" className="py-2">{error}</Alert>}
      
      <div className="d-flex gap-2 mt-3">
        {onCancel && <Button variant="secondary" onClick={onCancel} className="w-100" disabled={loading}>{UI_TEXTS.CLOSE}</Button>}
        <Button variant="primary" type="submit" className="w-100" disabled={loading}>
          {loading ? (
            <>
              <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" className="me-2" />
              {UI_TEXTS.LOADING}
            </>
          ) : (
            initialData ? UI_TEXTS.UPDATE_MESA : UI_TEXTS.CREATE_MESA
          )}
        </Button>
      </div>
    </Form>
  );
};

const AdminMesasPage: FC = () => {
  const [isDarkMode, setIsDarkMode] = useState(() => document.body.classList.contains('theme-dark'));
  const isMobile = useMediaQuery('(max-width: 768px)');

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDarkMode(document.body.classList.contains('theme-dark'));
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  
  const { loadingMasterData, sedes } = useData();
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingMesa, setEditingMesa] = useState<Mesa | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [deletingMesa, setDeletingMesa] = useState<Mesa | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'mesas'), s => {
      setMesas(s.docs.map(d => ({ 
        id: d.id, 
        nombre: d.get('nombre') || '',
        sedeId: d.get('sedeId') || ''
      } as Mesa)));
      setLoading(false);
    });
    return unsub;
  }, []);

  const handleSaveMesa = async (data: any, isEditing: boolean, resetForm: () => void) => {
    // VALIDACIÓN DE DUPLICADO (Nombre + Sede)
    const isDuplicate = mesas.some(m => 
      m.nombre.trim().toLowerCase() === data.nombre.trim().toLowerCase() && 
      m.sedeId === data.sedeId &&
      (!isEditing || m.id !== editingMesa?.id)
    );

    if (isDuplicate) {
      throw new Error(UI_TEXTS.MESA_DUPLICATE_ERROR);
    }

    setIsSubmitting(true);
    try {
      if (isEditing && editingMesa) {
        await updateDoc(doc(db, 'mesas', editingMesa.id), data);
        setEditingMesa(null);
      } else {
        await addDoc(collection(db, 'mesas'), data);
        resetForm();
      }
      setShowModal(false);
    } catch (error) {
      console.error(error);
      throw error; // Rethrow to be caught by MesaForm
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredMesas = useMemo(() => mesas.filter(m => matchSearchTerms(m, searchTerm, ['nombre'])), [mesas, searchTerm]);

  const columns: Column<Mesa>[] = [
    { accessorKey: 'nombre', header: UI_TEXTS.TABLE_HEADER_NAME },
    { 
      header: 'Sede', 
      render: (m) => {
        const sede = sedes.find(s => s.id === m.sedeId);
        return sede ? sede.nombre : <span className="text-muted">Sin sede</span>;
      }
    },
    {
      header: UI_TEXTS.TABLE_HEADER_ACTIONS,
      render: (m) => (
        <div className="d-flex gap-2 action-buttons-container">
          <Button variant="link" size="sm" className="p-0 action-btn edit-btn" onClick={() => { setEditingMesa(m); setShowModal(true); }}>
            <FaPencilAlt className="icon-desktop" /> <span className="text-mobile">Editar</span>
          </Button>
          <Button variant="link" size="sm" className="p-0 text-danger action-btn delete-btn" onClick={() => setDeletingMesa(m)}>
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
              <MesaForm 
                key="new-mesa-form"
                onSubmit={handleSaveMesa} 
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
                placeholder={UI_TEXTS.PLACEHOLDER_SEARCH_MESAS} 
                className="flex-grow-1 mb-0" 
              />
            </div>
            <GenericTable 
              data={filteredMesas} 
              columns={columns} 
              variant={isDarkMode ? 'dark' : ''} 
              isLoading={loading}
            />
          </div>
        </div>
      </Container>
      {isMobile && <FabButton onClick={() => setShowModal(true)} />}
      <GenericCreationModal show={showModal} onHide={() => { setShowModal(false); setEditingMesa(null); }}>
        <MesaForm 
          key={editingMesa ? editingMesa.id : 'modal-new'}
          initialData={editingMesa} 
          onSubmit={handleSaveMesa} 
          onCancel={() => { setShowModal(false); setEditingMesa(null); }} 
          loading={isSubmitting} 
        />
      </GenericCreationModal>
      <GenericCreationModal show={!!deletingMesa} onHide={() => setDeletingMesa(null)}>
        <p>¿Eliminar mesa <strong>{deletingMesa?.nombre}</strong>?</p>
        <div className="d-flex justify-content-end gap-2">
          <Button variant="secondary" onClick={() => setDeletingMesa(null)}>{UI_TEXTS.CLOSE}</Button>
          <Button variant="danger" onClick={async () => {
            if (deletingMesa) {
              await deleteDoc(doc(db, 'mesas', deletingMesa.id));
              setDeletingMesa(null);
            }
          }}>{UI_TEXTS.DELETE}</Button>
        </div>
      </GenericCreationModal>
    </Fragment>
  );
};

export default AdminMesasPage;
