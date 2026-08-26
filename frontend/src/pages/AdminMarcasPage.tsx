import type { FC } from 'react';
import { useState, useEffect, useMemo, Fragment } from 'react';
import { Container, Form, Button, Alert, Spinner } from 'react-bootstrap';
import { db } from '../api/firebase';
import { collection, addDoc, onSnapshot, updateDoc, doc, deleteDoc } from 'firebase/firestore';

import { FaPencilAlt, FaTrash } from 'react-icons/fa';
import toast from 'react-hot-toast';
import useMediaQuery from '../hooks/useMediaQuery';

import SearchInput from '../components/SearchInput';
import GenericTable, { type Column } from '../components/GenericTable';
import { UI_TEXTS, SPINNER_VARIANTS } from '../constants';
import GlobalSpinner from '../components/GlobalSpinner';
import FabButton from '../components/FabButton';
import GenericCreationModal from '../components/GenericCreationModal';
import { useData } from '../context/DataContext';
import { matchSearchTerms } from '../utils/searchUtils';

interface Marca {
  id: string;
  nombre: string;
  tipoBebidaId: string;
}

const BrandForm: React.FC<{
  initialData: Marca | null;
  onSubmit: (data: any, isEditing: boolean, resetForm: () => void) => Promise<void>;
  onCancel?: () => void;
  loading: boolean;
}> = ({ initialData, onSubmit, onCancel, loading }) => {
  const { beverageTypes } = useData();
  const [nombre, setNombre] = useState(initialData?.nombre || '');
  const [tipoBebidaId, setTipoBebidaId] = useState(initialData?.tipoBebidaId || '');
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setNombre('');
    setTipoBebidaId('');
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) {
      setError(UI_TEXTS.BRAND_NAME_EMPTY);
      return;
    }
    if (!tipoBebidaId) {
      setError(UI_TEXTS.REQUIRED_FIELDS);
      return;
    }
    try {
      await onSubmit({ nombre: nombre, tipoBebidaId: tipoBebidaId }, !!initialData, resetForm);
    } catch (err: any) {
      setError(UI_TEXTS.ERROR_GENERIC_CREATE);
    }
  };

  return (
    <Form onSubmit={handleSubmit}>
      <Form.Group className="mb-3">
        <Form.Label>{UI_TEXTS.BRAND_NAME}</Form.Label>
        <Form.Control
          type="text"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          required
          disabled={loading}
          placeholder={UI_TEXTS.PLACEHOLDER_BRAND_NAME}
        />
      </Form.Group>
      <Form.Group className="mb-3">
        <Form.Label>{UI_TEXTS.BEVERAGE_TYPE_NAME}</Form.Label>
        <Form.Select
          value={tipoBebidaId}
          onChange={(e) => setTipoBebidaId(e.target.value)}
          required
          disabled={loading}
        >
          <option value="">Seleccionar tipo...</option>
          {beverageTypes.map(t => (
            <option key={t.id} value={t.id}>{t.nombre}</option>
          ))}
        </Form.Select>
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
            initialData ? UI_TEXTS.UPDATE_BRAND : UI_TEXTS.CREATE_BRAND
          )}
        </Button>
      </div>
    </Form>
  );
};

const AdminMarcasPage: FC = () => {
  const isMobile = useMediaQuery('(max-width: 992px)');
  
  const { loadingMasterData, beverageTypes } = useData();
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingBrand, setEditingBrand] = useState<Marca | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [deletingBrand, setDeletingBrand] = useState<Marca | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'marcas'), s => {
      setMarcas(s.docs.map(d => ({ 
        id: d.id, 
        nombre: d.get('nombre') || '',
        tipoBebidaId: d.get('tipoBebidaId') || ''
      } as Marca)));
      setLoading(false);
    });
    return unsub;
  }, []);

  const handleSaveBrand = async (data: any, isEditing: boolean, resetForm: () => void) => {
    setIsSubmitting(true);
    try {
      if (isEditing && editingBrand) {
        await updateDoc(doc(db, 'marcas', editingBrand.id), data);
        setEditingBrand(null);
      } else {
        await addDoc(collection(db, 'marcas'), data);
        resetForm();
      }
      setShowModal(false);
      toast.success(isEditing ? 'Marca actualizada' : 'Marca creada');
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredMarcas = useMemo(() => {
    return marcas.filter(m => {
      const typeName = beverageTypes.find(t => t.id === m.tipoBebidaId)?.nombre || '';
      return matchSearchTerms({ ...m, tipoNombre: typeName }, searchTerm, ['nombre', 'tipoNombre']);
    });
  }, [marcas, searchTerm, beverageTypes]);

  const columns: Column<Marca>[] = [
    { accessorKey: 'nombre', header: UI_TEXTS.BRAND_NAME },
    { 
      accessorKey: 'tipoBebidaId', 
      header: UI_TEXTS.BEVERAGE_TYPE_NAME,
      render: (m) => beverageTypes.find(t => t.id === m.tipoBebidaId)?.nombre || 'Desconocido'
    },
    {
      header: UI_TEXTS.TABLE_HEADER_ACTIONS,
      render: (m) => (
        <div className="d-flex gap-2 action-buttons-container">
          <Button variant="link" size="sm" className="p-0 action-btn edit-btn" onClick={() => { setEditingBrand(m); setShowModal(true); }}>
            <FaPencilAlt className="icon-desktop" /> <span className="text-mobile">Editar</span>
          </Button>
          <Button variant="link" size="sm" className="p-0 text-danger action-btn delete-btn" onClick={() => setDeletingBrand(m)}>
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
              <BrandForm 
                key="new-brand-form"
                onSubmit={handleSaveBrand} 
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
                placeholder={UI_TEXTS.PLACEHOLDER_SEARCH_BRANDS} 
                className="flex-grow-1 mb-0" 
              />
            </div>
            <GenericTable 
              data={filteredMarcas} 
              columns={columns} 
              isLoading={loading}
            />
          </div>
        </div>
      </Container>
      {isMobile && <FabButton onClick={() => setShowModal(true)} />}
      <GenericCreationModal show={showModal} onHide={() => { setShowModal(false); setEditingBrand(null); }}>
        <BrandForm 
          key={editingBrand ? editingBrand.id : 'modal-new'}
          initialData={editingBrand} 
          onSubmit={handleSaveBrand} 
          onCancel={() => { setShowModal(false); setEditingBrand(null); }} 
          loading={isSubmitting} 
        />
      </GenericCreationModal>
      <GenericCreationModal show={!!deletingBrand} onHide={() => setDeletingBrand(null)}>
        <p>¿Eliminar marca <strong>{deletingBrand?.nombre}</strong>?</p>
        <div className="d-flex justify-content-end gap-2">
          <Button variant="secondary" onClick={() => setDeletingBrand(null)}>{UI_TEXTS.CLOSE}</Button>
          <Button variant="danger" disabled={isSubmitting} onClick={async () => {
            if (deletingBrand) {
              try {
                setIsSubmitting(true);
                await deleteDoc(doc(db, 'marcas', deletingBrand.id));
                setDeletingBrand(null);
                toast.success('Marca eliminada');
              } catch (error) {
                toast.error('Error al eliminar marca');
              } finally {
                setIsSubmitting(false);
              }
            }
          }}>{isSubmitting ? <Spinner size="sm" animation="border" /> : UI_TEXTS.DELETE}</Button>
        </div>
      </GenericCreationModal>
    </Fragment>
  );
};

export default AdminMarcasPage;
