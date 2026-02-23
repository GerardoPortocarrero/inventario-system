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

interface BeverageType {
  id: string;
  nombre: string;
}

const BeverageTypeForm: React.FC<{
  initialData: BeverageType | null;
  onSubmit: (data: any, isEditing: boolean, resetForm: () => void) => Promise<void>;
  onCancel?: () => void;
  loading: boolean;
}> = ({ initialData, onSubmit, onCancel, loading }) => {
  const [nombre, setNombre] = useState(initialData?.nombre || '');
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setNombre('');
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) {
      setError(UI_TEXTS.BEVERAGE_TYPE_NAME_EMPTY);
      return;
    }
    try {
      await onSubmit({ nombre: nombre }, !!initialData, resetForm);
    } catch (err: any) {
      setError(UI_TEXTS.ERROR_GENERIC_CREATE);
    }
  };

  return (
    <Form onSubmit={handleSubmit}>
      <Form.Group className="mb-3">
        <Form.Label>{UI_TEXTS.BEVERAGE_TYPE_NAME}</Form.Label>
        <Form.Control
          type="text"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          required
          disabled={loading}
          placeholder={UI_TEXTS.PLACEHOLDER_BEVERAGE_TYPE_NAME}
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
            initialData ? UI_TEXTS.UPDATE_BEVERAGE_TYPE : UI_TEXTS.CREATE_BEVERAGE_TYPE
          )}
        </Button>
      </div>
    </Form>
  );
};

const AdminTipoBebidaPage: FC = () => {
  const isDarkMode = localStorage.getItem('theme') === 'dark' || localStorage.getItem('theme') === null;
  const isMobile = useMediaQuery('(max-width: 992px)');
  
  const [beverageTypes, setBeverageTypes] = useState<BeverageType[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingType, setEditingType] = useState<BeverageType | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [deletingType, setDeletingType] = useState<BeverageType | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'tiposBebida'), s => {
      setBeverageTypes(s.docs.map(d => ({ id: d.id, nombre: d.get('nombre') || '' } as BeverageType)));
      setLoading(false);
    });
    return unsub;
  }, []);

  const handleSaveType = async (data: any, isEditing: boolean, resetForm: () => void) => {
    setIsSubmitting(true);
    try {
      if (isEditing && editingType) {
        await updateDoc(doc(db, 'tiposBebida', editingType.id), data);
        setEditingType(null);
      } else {
        await addDoc(collection(db, 'tiposBebida'), data);
        resetForm();
      }
      setShowModal(false);
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredTypes = useMemo(() => beverageTypes.filter(s => s.nombre.toLowerCase().includes(searchTerm.toLowerCase())), [beverageTypes, searchTerm]);

  const columns: Column<BeverageType>[] = [
    { accessorKey: 'nombre', header: UI_TEXTS.TABLE_HEADER_NAME },
    {
      header: UI_TEXTS.TABLE_HEADER_ACTIONS,
      render: (s) => (
        <div className="d-flex gap-2">
          <Button variant="link" size="sm" className="p-0" onClick={() => { setEditingType(s); setShowModal(true); }}><FaPencilAlt /></Button>
          <Button variant="link" size="sm" className="p-0 text-danger" onClick={() => setDeletingType(s)}><FaTrash /></Button>
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
              <BeverageTypeForm 
                key="new-beverage-type-form"
                onSubmit={handleSaveType} 
                loading={isSubmitting} 
                initialData={null} 
              />
            </div>
          )}
          <div className="admin-section-table">
            <SearchInput searchTerm={searchTerm} onSearchChange={setSearchTerm} placeholder={UI_TEXTS.PLACEHOLDER_SEARCH_BEVERAGE_TYPES} className="mb-3" />
            {loading ? <GlobalSpinner variant={SPINNER_VARIANTS.IN_PAGE} /> : (
              <GenericTable data={filteredTypes} columns={columns} variant={isDarkMode ? 'dark' : ''} />
            )}
          </div>
        </div>
      </Container>
      {isMobile && <FabButton onClick={() => setShowModal(true)} />}
      <GenericCreationModal show={showModal} onHide={() => { setShowModal(false); setEditingType(null); }}>
        <BeverageTypeForm 
          key={editingType ? editingType.id : 'modal-new'}
          initialData={editingType} 
          onSubmit={handleSaveType} 
          onCancel={() => { setShowModal(false); setEditingType(null); }} 
          loading={isSubmitting} 
        />
      </GenericCreationModal>
      <GenericCreationModal show={!!deletingType} onHide={() => setDeletingType(null)}>
        <p>¿Eliminar tipo de bebida <strong>{deletingType?.nombre}</strong>?</p>
        <div className="d-flex justify-content-end gap-2">
          <Button variant="secondary" onClick={() => setDeletingType(null)}>{UI_TEXTS.CLOSE}</Button>
          <Button variant="danger" onClick={async () => {
            if (deletingType) {
              await deleteDoc(doc(db, 'tiposBebida', deletingType.id));
              setDeletingType(null);
            }
          }}>{UI_TEXTS.DELETE}</Button>
        </div>
      </GenericCreationModal>
    </Fragment>
  );
};

export default AdminTipoBebidaPage;
