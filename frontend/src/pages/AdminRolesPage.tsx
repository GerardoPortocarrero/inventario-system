import type { FC } from 'react';
import { useState, useEffect, useMemo, Fragment } from 'react';
import { Container, Form, Button, Alert, Spinner } from 'react-bootstrap';
import { db } from '../api/firebase';
import { collection, setDoc, doc, onSnapshot, updateDoc, deleteDoc } from 'firebase/firestore';

import { FaPencilAlt, FaTrash } from 'react-icons/fa';
import useMediaQuery from '../hooks/useMediaQuery';

import SearchInput from '../components/SearchInput';
import GenericTable, { type Column } from '../components/GenericTable';
import { UI_TEXTS, SPINNER_VARIANTS } from '../constants';
import GlobalSpinner from '../components/GlobalSpinner';
import FabButton from '../components/FabButton';
import GenericCreationModal from '../components/GenericCreationModal';

interface Role {
  id: string;
  nombre: string;
}

const RoleForm: React.FC<{
  initialData: Role | null;
  onSubmit: (data: any, isEditing: boolean, resetForm: () => void) => Promise<void>;
  onCancel?: () => void;
  loading: boolean;
}> = ({ initialData, onSubmit, onCancel, loading }) => {
  const [idRol, setIdRol] = useState(initialData?.id || '');
  const [nombreRol, setNombreRol] = useState(initialData?.nombre || '');
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setIdRol('');
    setNombreRol('');
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!idRol.trim() || !nombreRol.trim()) {
      setError(UI_TEXTS.REQUIRED_FIELDS);
      return;
    }
    try {
      await onSubmit({ id: idRol, nombre: nombreRol }, !!initialData, resetForm);
    } catch (err: any) {
      setError(UI_TEXTS.ERROR_GENERIC_CREATE);
    }
  };

  return (
    <Form onSubmit={handleSubmit}>
      <Form.Group className="mb-3">
        <Form.Label>ID de Rol</Form.Label>
        <Form.Control
          type="text"
          value={idRol}
          onChange={(e) => setIdRol(e.target.value)}
          required
          disabled={!!initialData || loading}
        />
      </Form.Group>
      <Form.Group className="mb-3">
        <Form.Label>{UI_TEXTS.TABLE_HEADER_NAME}</Form.Label>
        <Form.Control
          type="text"
          value={nombreRol}
          onChange={(e) => setNombreRol(e.target.value)}
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
            initialData ? UI_TEXTS.UPDATE_ROLE : UI_TEXTS.CREATE_ROLE
          )}
        </Button>
      </div>
    </Form>
  );
};

const AdminRolesPage: FC = () => {
  const [isDarkMode, setIsDarkMode] = useState(() => document.body.classList.contains('theme-dark'));
  const isMobile = useMediaQuery('(max-width: 768px)');

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDarkMode(document.body.classList.contains('theme-dark'));
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [deletingRole, setDeletingRole] = useState<Role | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'roles'), s => {
      setRoles(s.docs.map(d => ({ id: d.id, nombre: d.get('nombre') || '' } as Role)));
      setLoading(false);
    });
    return unsub;
  }, []);

  const handleSaveRole = async (data: any, isEditing: boolean, resetForm: () => void) => {
    setIsSubmitting(true);
    try {
      if (isEditing && editingRole) {
        await updateDoc(doc(db, 'roles', editingRole.id), { nombre: data.nombre });
        setEditingRole(null);
      } else {
        await setDoc(doc(db, 'roles', data.id), { nombre: data.nombre });
        resetForm();
      }
      setShowModal(false);
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredRoles = useMemo(() => roles.filter(r => r.nombre.toLowerCase().includes(searchTerm.toLowerCase())), [roles, searchTerm]);

  const columns: Column<Role>[] = [
    { accessorKey: 'id', header: 'ID' },
    { accessorKey: 'nombre', header: UI_TEXTS.TABLE_HEADER_NAME },
    {
      header: UI_TEXTS.TABLE_HEADER_ACTIONS,
      render: (r) => (
        <div className="d-flex gap-2 action-buttons-container">
          <Button variant="link" size="sm" className="p-0 action-btn edit-btn" onClick={() => { setEditingRole(r); setShowModal(true); }}>
            <FaPencilAlt className="icon-desktop" /> <span className="text-mobile">Editar</span>
          </Button>
          <Button variant="link" size="sm" className="p-0 text-danger action-btn delete-btn" onClick={() => setDeletingRole(r)}>
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
              <RoleForm 
                key="new-role-form"
                onSubmit={handleSaveRole} 
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
                placeholder="Buscar rol..." 
                className="flex-grow-1 mb-0" 
              />
            </div>
            <GenericTable 
              data={filteredRoles} 
              columns={columns} 
              variant={isDarkMode ? 'dark' : ''} 
              isLoading={loading}
            />
          </div>
        </div>
      </Container>
      {isMobile && <FabButton onClick={() => setShowModal(true)} />}
      <GenericCreationModal show={showModal} onHide={() => { setShowModal(false); setEditingRole(null); }}>
        <RoleForm 
          key={editingRole ? editingRole.id : 'modal-new'}
          initialData={editingRole} 
          onSubmit={handleSaveRole} 
          onCancel={() => { setShowModal(false); setEditingRole(null); }} 
          loading={isSubmitting} 
        />
      </GenericCreationModal>
      <GenericCreationModal show={!!deletingRole} onHide={() => setDeletingRole(null)}>
        <p>¿Eliminar rol <strong>{deletingRole?.nombre}</strong>?</p>
        <div className="d-flex justify-content-end gap-2">
          <Button variant="secondary" onClick={() => setDeletingRole(null)}>{UI_TEXTS.CLOSE}</Button>
          <Button variant="danger" onClick={async () => {
            if (deletingRole) {
              await deleteDoc(doc(db, 'roles', deletingRole.id));
              setDeletingRole(null);
            }
          }}>{UI_TEXTS.DELETE}</Button>
        </div>
      </GenericCreationModal>
    </Fragment>
  );
};

export default AdminRolesPage;
