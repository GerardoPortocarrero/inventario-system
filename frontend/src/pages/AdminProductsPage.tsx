import type { FC } from 'react';
import { useState, useEffect, useMemo, Fragment } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert, Spinner } from 'react-bootstrap';
import { db } from '../api/firebase';
import { collection, addDoc, onSnapshot, updateDoc, doc, deleteDoc, serverTimestamp } from 'firebase/firestore';

import { FaPencilAlt, FaTrash } from 'react-icons/fa';
import useMediaQuery from '../hooks/useMediaQuery';

import SearchInput from '../components/SearchInput';
import GenericTable, { type Column } from '../components/GenericTable';
import { UI_TEXTS, SPINNER_VARIANTS } from '../constants';
import GlobalSpinner from '../components/GlobalSpinner';
import FabButton from '../components/FabButton';
import GenericCreationModal from '../components/GenericCreationModal';

interface Product {
  id: string;
  nombre: string;
  sap: string;
  basis: string;
  comercial: string;
  contaaya: string;
  mililitros: number;
  unidades: number;
  precio: number;
  creadoEn?: any;
}

const ProductForm: React.FC<{
  initialData: Product | null;
  onSubmit: (data: any, isEditing: boolean, resetForm: () => void) => Promise<void>;
  onCancel?: () => void;
  loading: boolean;
}> = ({ initialData, onSubmit, onCancel, loading }) => {
  const [nombre, setNombre] = useState(initialData?.nombre || '');
  const [sap, setSap] = useState(initialData?.sap || '');
  const [basis, setBasis] = useState(initialData?.basis || '');
  const [comercial, setComercial] = useState(initialData?.comercial || '');
  const [contaaya, setContaaya] = useState(initialData?.contaaya || '');
  const [mililitros, setMililitros] = useState(initialData?.mililitros?.toString() || '');
  const [unidades, setUnidades] = useState(initialData?.unidades?.toString() || '');
  const [precio, setPrecio] = useState(initialData?.precio?.toString() || '');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) {
      setNombre(initialData.nombre);
      setSap(initialData.sap);
      setBasis(initialData.basis);
      setComercial(initialData.comercial);
      setContaaya(initialData.contaaya);
      setMililitros(initialData.mililitros.toString());
      setUnidades(initialData.unidades.toString());
      setPrecio(initialData.precio.toString());
    }
  }, [initialData]);

  const resetForm = () => {
    setNombre('');
    setSap('');
    setBasis('');
    setComercial('');
    setContaaya('');
    setMililitros('');
    setUnidades('');
    setPrecio('');
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await onSubmit({ 
        nombre, 
        sap, 
        basis,
        comercial,
        contaaya,
        mililitros: parseFloat(mililitros),
        unidades: parseInt(unidades),
        precio: parseFloat(precio)
      }, !!initialData, resetForm);
    } catch (err: any) {
      setError(UI_TEXTS.ERROR_GENERIC_CREATE);
    }
  };

  return (
    <Form onSubmit={handleSubmit}>
      <Form.Group className="mb-3">
        <Form.Label>{UI_TEXTS.PRODUCT_NAME}</Form.Label>
        <Form.Control
          type="text"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          required
          disabled={loading}
        />
      </Form.Group>
      <Form.Group className="mb-3">
        <Form.Label>{UI_TEXTS.SAP}</Form.Label>
        <Form.Control
          type="text"
          value={sap}
          onChange={(e) => setSap(e.target.value)}
          required
          disabled={loading}
        />
      </Form.Group>
      <Form.Group className="mb-3">
        <Form.Label>{UI_TEXTS.PRICE}</Form.Label>
        <Form.Control
          type="number"
          step="0.01"
          value={precio}
          onChange={(e) => setPrecio(e.target.value)}
          required
          disabled={loading}
        />
      </Form.Group>
      <Form.Group className="mb-3">
        <Form.Label>{UI_TEXTS.MILILITROS}</Form.Label>
        <Form.Control
          type="number"
          value={mililitros}
          onChange={(e) => setMililitros(e.target.value)}
          required
          disabled={loading}
        />
      </Form.Group>
      <Form.Group className="mb-3">
        <Form.Label>{UI_TEXTS.UNIDADES}</Form.Label>
        <Form.Control
          type="number"
          value={unidades}
          onChange={(e) => setUnidades(e.target.value)}
          required
          disabled={loading}
        />
      </Form.Group>
      <Form.Group className="mb-3">
        <Form.Label>{UI_TEXTS.BASIS}</Form.Label>
        <Form.Control
          type="text"
          value={basis}
          onChange={(e) => setBasis(e.target.value)}
          disabled={loading}
        />
      </Form.Group>
      <Form.Group className="mb-3">
        <Form.Label>{UI_TEXTS.COMERCIAL}</Form.Label>
        <Form.Control
          type="text"
          value={comercial}
          onChange={(e) => setComercial(e.target.value)}
          disabled={loading}
        />
      </Form.Group>
      <Form.Group className="mb-3">
        <Form.Label>{UI_TEXTS.CONTAAYA}</Form.Label>
        <Form.Control
          type="text"
          value={contaaya}
          onChange={(e) => setContaaya(e.target.value)}
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
            initialData ? UI_TEXTS.UPDATE_PRODUCT : UI_TEXTS.CREATE_PRODUCT
          )}
        </Button>
      </div>
    </Form>
  );
};

const AdminProductsPage: FC = () => {
  const isDarkMode = localStorage.getItem('theme') === 'dark' || localStorage.getItem('theme') === null;
  const isMobile = useMediaQuery('(max-width: 768px)');
  
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);

  useEffect(() => {
    const unsubProducts = onSnapshot(collection(db, 'productos'), s => {
      setProducts(s.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
      setLoading(false);
    });

    return () => { unsubProducts(); };
  }, []);

  const handleSaveProduct = async (data: any, isEditing: boolean, resetForm: () => void) => {
    setIsSubmitting(true);
    try {
      if (isEditing && editingProduct) {
        await updateDoc(doc(db, 'productos', editingProduct.id), data);
        setEditingProduct(null);
      } else {
        await addDoc(collection(db, 'productos'), {
          ...data,
          creadoEn: serverTimestamp()
        });
        resetForm();
      }
      setShowModal(false);
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      return p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || 
             (p.sap && p.sap.toLowerCase().includes(searchTerm.toLowerCase()));
    });
  }, [products, searchTerm]);

  const columns: Column<Product>[] = [
    { accessorKey: 'sap', header: UI_TEXTS.SAP },
    { accessorKey: 'nombre', header: UI_TEXTS.TABLE_HEADER_NAME },
    { 
      header: UI_TEXTS.PRICE, 
      render: (p) => `$${p.precio.toFixed(2)}` 
    },
    {
      header: UI_TEXTS.TABLE_HEADER_ACTIONS,
      render: (p) => (
        <div className="d-flex gap-2">
          <Button variant="link" size="sm" className="p-0" onClick={() => { setEditingProduct(p); setShowModal(true); }}><FaPencilAlt /></Button>
          <Button variant="link" size="sm" className="p-0 text-danger" onClick={() => setDeletingProduct(p)}><FaTrash /></Button>
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
              <ProductForm 
                key={editingProduct ? editingProduct.id : 'new'}
                onSubmit={handleSaveProduct} 
                loading={isSubmitting} 
                initialData={editingProduct} 
              />
            </div>
          )}
          <div className="admin-section-table">
            <SearchInput searchTerm={searchTerm} onSearchChange={setSearchTerm} placeholder={UI_TEXTS.PLACEHOLDER_SEARCH_PRODUCTS} className="mb-3" />
            {loading ? <GlobalSpinner variant={SPINNER_VARIANTS.IN_PAGE} /> : (
              <GenericTable data={filteredProducts} columns={columns} variant={isDarkMode ? 'dark' : ''} />
            )}
          </div>
        </div>
      </Container>
      {isMobile && <FabButton onClick={() => setShowModal(true)} />}
      <GenericCreationModal show={showModal} onHide={() => { setShowModal(false); setEditingProduct(null); }}>
        <ProductForm 
          key={editingProduct ? editingProduct.id : 'modal-new'}
          initialData={editingProduct} 
          onSubmit={handleSaveProduct} 
          onCancel={() => { setShowModal(false); setEditingProduct(null); }} 
          loading={isSubmitting} 
        />
      </GenericCreationModal>
      <GenericCreationModal show={!!deletingProduct} onHide={() => setDeletingProduct(null)}>
        <p>¿Eliminar producto <strong>{deletingProduct?.nombre}</strong>?</p>
        <div className="d-flex justify-content-end gap-2">
          <Button variant="secondary" onClick={() => setDeletingProduct(null)}>{UI_TEXTS.CLOSE}</Button>
          <Button variant="danger" onClick={async () => {
            if (deletingProduct) {
              await deleteDoc(doc(db, 'productos', deletingProduct.id));
              setDeletingProduct(null);
            }
          }}>{UI_TEXTS.DELETE}</Button>
        </div>
      </GenericCreationModal>
    </Fragment>
  );
};

export default AdminProductsPage;
