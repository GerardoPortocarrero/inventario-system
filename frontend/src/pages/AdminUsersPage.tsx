import type { FC } from 'react';
import { useState, useEffect, useMemo, Fragment } from 'react';
import { Container, Form, Button, Alert, Spinner } from 'react-bootstrap';
import { db, firebaseConfig } from '../api/firebase';
import { collection, setDoc, doc, onSnapshot, updateDoc, deleteDoc } from 'firebase/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut as signOutSecondary } from 'firebase/auth';

import { FaPencilAlt, FaTrash } from 'react-icons/fa';
import useMediaQuery from '../hooks/useMediaQuery';

import SearchInput from '../components/SearchInput';
import GenericTable, { type Column } from '../components/GenericTable';
import { UI_TEXTS, SPINNER_VARIANTS } from '../constants';
import GlobalSpinner from '../components/GlobalSpinner';
import FabButton from '../components/FabButton';
import GenericCreationModal from '../components/GenericCreationModal';
import GenericFilter from '../components/GenericFilter';
import { useData } from '../context/DataContext';

interface UserProfile {
  id: string;
  nombre: string;
  email: string;
  rolId: string;
  sedeId: string;
}

// Formulario con estado interno independiente
const UserForm: React.FC<{
  initialData: UserProfile | null;
  onSubmit: (data: any, isEditing: boolean, resetForm: () => void) => Promise<void>;
  onCancel?: () => void;
  loading: boolean;
}> = ({ initialData, onSubmit, onCancel, loading }) => {
  const { roles, sedes, loadingMasterData } = useData();
  const [nombre, setNombre] = useState(initialData?.nombre || '');
  const [email, setEmail] = useState(initialData?.email || '');
  const [password, setPassword] = useState('');
  const [rolId, setRolId] = useState(initialData?.rolId || '');
  const [sedeId, setSedeId] = useState(initialData?.sedeId || '');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) {
      setRolId(initialData.rolId);
      setSedeId(initialData.sedeId);
    } else {
      if (!rolId && roles.length > 0) setRolId(roles[0].id);
      if (!sedeId && sedes.length > 0) setSedeId(sedes[0].id);
    }
  }, [roles, sedes, initialData]);

  const resetForm = () => {
    setNombre('');
    setEmail('');
    setPassword('');
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const data = { nombre, email, password, rolId, sedeId };
    try {
      await onSubmit(data, !!initialData, resetForm);
    } catch (err: any) {
      setError(err.message || UI_TEXTS.ERROR_GENERIC_CREATE);
    }
  };

  if (loadingMasterData) return <GlobalSpinner variant={SPINNER_VARIANTS.IN_PAGE} />;

  return (
    <Form onSubmit={handleSubmit}>
      <Form.Group className="mb-3">
        <Form.Label>{UI_TEXTS.FULL_NAME}</Form.Label>
        <Form.Control
          type="text"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          required
          disabled={loading}
        />
      </Form.Group>
      <Form.Group className="mb-3">
        <Form.Label>{UI_TEXTS.EMAIL}</Form.Label>
        <Form.Control
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={!!initialData || loading}
        />
      </Form.Group>
      <Form.Group className="mb-3">
        <Form.Label>{UI_TEXTS.PASSWORD}</Form.Label>
        <Form.Control
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required={!initialData}
          minLength={6}
          placeholder={initialData ? 'Dejar en blanco para no cambiar' : UI_TEXTS.PLACEHOLDER_PASSWORD}
          disabled={!!initialData || loading}
        />
      </Form.Group>
      <Form.Group className="mb-3">
        <Form.Label>{UI_TEXTS.ROLE}</Form.Label>
        <Form.Select value={rolId} onChange={(e) => setRolId(e.target.value)} required disabled={loading}>
          {roles.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
        </Form.Select>
      </Form.Group>
      <Form.Group className="mb-3">
        <Form.Label>{UI_TEXTS.SEDE}</Form.Label>
        <Form.Select value={sedeId} onChange={(e) => setSedeId(e.target.value)} required disabled={loading}>
          {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
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
            initialData ? UI_TEXTS.UPDATE_USER : UI_TEXTS.CREATE_USER
          )}
        </Button>
      </div>
    </Form>
  );
};

const AdminUsersPage: FC = () => {
  const [isDarkMode, setIsDarkMode] = useState(() => document.body.classList.contains('theme-dark'));
  const isMobile = useMediaQuery('(max-width: 768px)');

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDarkMode(document.body.classList.contains('theme-dark'));
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  const { roles, sedes } = useData();
  
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [selectedSede, setSelectedSede] = useState('');
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [deletingUser, setDeletingUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, 'usuarios'), s => {
      setUsers(s.docs.map(d => ({ id: d.id, ...d.data() } as UserProfile)));
      setLoading(false);
    });

    return () => unsubUsers();
  }, []);

  const handleSaveUser = async (data: any, isEditing: boolean, resetForm: () => void) => {
    setIsSubmitting(true);
    try {
      if (isEditing && editingUser) {
        await updateDoc(doc(db, 'usuarios', editingUser.id), {
          nombre: data.nombre,
          rolId: data.rolId,
          sedeId: data.sedeId
        });
        setShowModal(false);
        setEditingUser(null);
      } else {
        const secondaryAppName = `SecondaryApp_${Date.now()}`;
        const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
        const secondaryAuth = getAuth(secondaryApp);
        
        try {
          const userCred = await createUserWithEmailAndPassword(secondaryAuth, data.email, data.password);
          await setDoc(doc(db, 'usuarios', userCred.user.uid), {
            nombre: data.nombre,
            email: data.email,
            rolId: data.rolId,
            sedeId: data.sedeId,
            activo: true
          });
          await signOutSecondary(secondaryAuth);
          await deleteApp(secondaryApp);
          
          // Cerrar modal tras creación exitosa
          setShowModal(false);
          resetForm();
        } catch (error) {
          await deleteApp(secondaryApp);
          throw error;
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchesSearch = u.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           u.email.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesRole = !selectedRole || u.rolId === selectedRole;
      const matchesSede = !selectedSede || u.sedeId === selectedSede;
      return matchesSearch && matchesRole && matchesSede;
    });
  }, [users, searchTerm, selectedRole, selectedSede]);

  const columns: Column<UserProfile>[] = useMemo(() => [
    { accessorKey: 'nombre', header: UI_TEXTS.TABLE_HEADER_NAME },
    { accessorKey: 'email', header: UI_TEXTS.TABLE_HEADER_EMAIL },
    { 
      header: UI_TEXTS.TABLE_HEADER_ROLE, 
      render: (u) => roles.find(r => r.id === u.rolId)?.nombre || u.rolId 
    },
    { 
      header: UI_TEXTS.TABLE_HEADER_SEDE, 
      render: (u) => {
        const sede = sedes.find(s => s.id === u.sedeId);
        return sede ? sede.nombre : u.sedeId;
      }
    },
    {
      header: UI_TEXTS.TABLE_HEADER_ACTIONS,
      render: (u) => (
        <div className="d-flex gap-2 action-buttons-container">
          <Button variant="link" size="sm" className="p-0 action-btn edit-btn" onClick={() => { setEditingUser(u); setShowModal(true); }}>
            <FaPencilAlt className="icon-desktop" /> <span className="text-mobile">Editar</span>
          </Button>
          <Button variant="link" size="sm" className="p-0 text-danger action-btn delete-btn" onClick={() => setDeletingUser(u)}>
            <FaTrash className="icon-desktop" /> <span className="text-mobile">Eliminar</span>
          </Button>
        </div>
      )
    }
  ], [roles, sedes]);

  return (
    <Fragment>
      <Container fluid className="p-0">
        <div className="admin-layout-container">
          {!isMobile && (
            <div className="admin-section-form">
              <UserForm 
                key="new-user-form"
                onSubmit={handleSaveUser} 
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
                placeholder={UI_TEXTS.PLACEHOLDER_SEARCH_USERS} 
                className="flex-grow-1 mb-0" 
              />
              <GenericFilter
                prefix="Rol"
                value={selectedRole}
                onChange={setSelectedRole}
                options={roles.map(r => ({ value: r.id, label: r.nombre }))}
                className="flex-shrink-0"
              />
              <GenericFilter
                prefix="Sede"
                value={selectedSede}
                onChange={setSelectedSede}
                options={sedes.map(s => ({ value: s.id, label: s.nombre }))}
                className="flex-shrink-0"
              />
            </div>
            {loading ? <GlobalSpinner variant={SPINNER_VARIANTS.IN_PAGE} /> : (
              <GenericTable data={filteredUsers} columns={columns} variant={isDarkMode ? 'dark' : ''} />
            )}
          </div>
        </div>
      </Container>
      {isMobile && <FabButton onClick={() => setShowModal(true)} />}
      <GenericCreationModal show={showModal} onHide={() => { setShowModal(false); setEditingUser(null); }}>
        <UserForm 
          key={editingUser ? editingUser.id : 'modal-new'}
          initialData={editingUser} 
          onSubmit={handleSaveUser} 
          onCancel={() => { setShowModal(false); setEditingUser(null); }} 
          loading={isSubmitting} 
        />
      </GenericCreationModal>
      <GenericCreationModal show={!!deletingUser} onHide={() => setDeletingUser(null)}>
        <p>¿Eliminar a <strong>{deletingUser?.nombre}</strong>?</p>
        <div className="d-flex justify-content-end gap-2">
          <Button variant="secondary" onClick={() => setDeletingUser(null)}>{UI_TEXTS.CLOSE}</Button>
          <Button variant="danger" onClick={async () => {
            if (deletingUser) {
              await deleteDoc(doc(db, 'usuarios', deletingUser.id));
              setDeletingUser(null);
            }
          }}>{UI_TEXTS.DELETE}</Button>
        </div>
      </GenericCreationModal>
    </Fragment>
  );
};

export default AdminUsersPage;
