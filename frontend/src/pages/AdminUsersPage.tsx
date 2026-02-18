import type { FC } from 'react';
import { useState, useEffect, useMemo, Fragment } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert } from 'react-bootstrap';
import { db } from '../api/firebase';
import { collection, setDoc, doc, onSnapshot, updateDoc, deleteDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../api/firebase';

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

interface Sede {
  id: string;
  nombre: string;
}

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
  roles: Role[];
  sedes: Sede[];
  onSubmit: (data: any, isEditing: boolean, resetForm: () => void) => Promise<void>;
  onCancel?: () => void;
  loading: boolean;
}> = ({ initialData, roles, sedes, onSubmit, onCancel, loading }) => {
  const [nombre, setNombre] = useState(initialData?.nombre || '');
  const [email, setEmail] = useState(initialData?.email || '');
  const [password, setPassword] = useState('');
  const [rolId, setRolId] = useState(initialData?.rolId || (roles[0]?.id || ''));
  const [sedeId, setSedeId] = useState(initialData?.sedeId || (sedes[0]?.id || ''));
  const [error, setError] = useState<string | null>(null);

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

  return (
    <Form onSubmit={handleSubmit}>
      <Form.Group className="mb-3">
        <Form.Label>{UI_TEXTS.FULL_NAME}</Form.Label>
        <Form.Control
          type="text"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          required
        />
      </Form.Group>
      <Form.Group className="mb-3">
        <Form.Label>{UI_TEXTS.EMAIL}</Form.Label>
        <Form.Control
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={!!initialData}
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
          disabled={!!initialData} // En este sistema el admin no cambia pass desde aquí por ahora
        />
      </Form.Group>
      <Form.Group className="mb-3">
        <Form.Label>{UI_TEXTS.ROLE}</Form.Label>
        <Form.Select value={rolId} onChange={(e) => setRolId(e.target.value)} required>
          {roles.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
        </Form.Select>
      </Form.Group>
      <Form.Group className="mb-3">
        <Form.Label>{UI_TEXTS.SEDE}</Form.Label>
        <Form.Select value={sedeId} onChange={(e) => setSedeId(e.target.value)} required>
          {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
        </Form.Select>
      </Form.Group>
      {error && <Alert variant="danger">{error}</Alert>}
      <div className="d-flex gap-2 mt-3">
        {onCancel && <Button variant="secondary" onClick={onCancel} className="w-100">{UI_TEXTS.CLOSE}</Button>}
        <Button variant="primary" type="submit" className="w-100" disabled={loading}>
          {initialData ? UI_TEXTS.UPDATE_USER : UI_TEXTS.CREATE_USER}
        </Button>
      </div>
    </Form>
  );
};

const AdminUsersPage: FC = () => {
  const isDarkMode = localStorage.getItem('theme') === 'dark' || localStorage.getItem('theme') === null;
  const isMobile = useMediaQuery('(max-width: 768px)');
  
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [deletingUser, setDeletingUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    const unsubRoles = onSnapshot(collection(db, 'roles'), s => setRoles(s.docs.map(d => ({ id: d.id, ...d.data() } as Role))));
    const unsubSedes = onSnapshot(collection(db, 'sedes'), s => setSedes(s.docs.map(d => ({ id: d.id, ...d.data() } as Sede))));
    const unsubUsers = onSnapshot(collection(db, 'usuarios'), s => {
      setUsers(s.docs.map(d => ({ id: d.id, ...d.data() } as UserProfile)));
      setLoading(false);
    });
    return () => { unsubRoles(); unsubSedes(); unsubUsers(); };
  }, []);

  const handleSaveUser = async (data: any, isEditing: boolean, resetForm: () => void) => {
    if (isEditing && editingUser) {
      await updateDoc(doc(db, 'usuarios', editingUser.id), {
        nombre: data.nombre,
        rolId: data.rolId,
        sedeId: data.sedeId
      });
      setShowModal(false);
      setEditingUser(null);
    } else {
      const userCred = await createUserWithEmailAndPassword(auth, data.email, data.password);
      await setDoc(doc(db, 'usuarios', userCred.user.uid), {
        nombre: data.nombre,
        email: data.email,
        rolId: data.rolId,
        sedeId: data.sedeId,
        activo: true
      });
      resetForm();
    }
  };

  const filteredUsers = useMemo(() => {
    return users.filter(u => 
      u.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || 
      u.email.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [users, searchTerm]);

  const columns: Column<UserProfile>[] = useMemo(() => [
    { accessorKey: 'nombre', header: UI_TEXTS.TABLE_HEADER_NAME },
    { accessorKey: 'email', header: UI_TEXTS.TABLE_HEADER_EMAIL },
    { 
      header: UI_TEXTS.TABLE_HEADER_ROLE, 
      render: (u) => roles.find(r => r.id === u.rolId)?.nombre || u.rolId 
    },
    { 
      header: UI_TEXTS.TABLE_HEADER_SEDE, 
      render: (u) => sedes.find(s => s.id === u.sedeId)?.nombre || u.sedeId 
    },
    {
      header: UI_TEXTS.TABLE_HEADER_ACTIONS,
      render: (u) => (
        <>
          <Button variant="link" size="sm" onClick={() => { setEditingUser(u); setShowModal(true); }}><FaPencilAlt /></Button>
          <Button variant="link" size="sm" onClick={() => setDeletingUser(u)}><FaTrash /></Button>
        </>
      )
    }
  ], [roles, sedes]);

  return (
    <Fragment>
      <Container fluid>
        <Row>
          {!isMobile && (
            <Col md={4} className="mb-3">
              <Card className="p-3">
                <UserForm roles={roles} sedes={sedes} onSubmit={handleSaveUser} loading={false} initialData={null} />
              </Card>
            </Col>
          )}
          <Col md={isMobile ? 12 : 8}>
            <Card className="p-3">
              <SearchInput searchTerm={searchTerm} onSearchChange={setSearchTerm} placeholder={UI_TEXTS.PLACEHOLDER_SEARCH_USERS} className="mb-3" />
              {loading ? <GlobalSpinner variant={SPINNER_VARIANTS.IN_PAGE} /> : (
                <GenericTable data={filteredUsers} columns={columns} variant={isDarkMode ? 'dark' : ''} />
              )}
            </Card>
          </Col>
        </Row>
      </Container>
      {isMobile && <FabButton onClick={() => setShowModal(true)} />}
      <GenericCreationModal show={showModal} onHide={() => { setShowModal(false); setEditingUser(null); }}>
        <UserForm 
          initialData={editingUser} 
          roles={roles} 
          sedes={sedes} 
          onSubmit={handleSaveUser} 
          onCancel={() => { setShowModal(false); setEditingUser(null); }} 
          loading={false} 
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
