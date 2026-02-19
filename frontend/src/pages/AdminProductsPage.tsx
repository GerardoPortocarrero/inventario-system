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

interface Sede {
  id: string;
  nombre: string;
}

interface Product {
  id: string;
  nombre: string;
  sku: string;
  precio: number;
  descripcion: string;
  sedeId: string;
  creadoEn?: any;
}

const ProductForm: React.FC<{
  initialData: Product | null;
  sedes: Sede[];
  onSubmit: (data: any, isEditing: boolean, resetForm: () => void) => Promise<void>;
  onCancel?: () => void;
  loading: boolean;
}> = ({ initialData, sedes, onSubmit, onCancel, loading }) => {
  const [nombre, setNombre] = useState(initialData?.nombre || '');
  const [sku, setSku] = useState(initialData?.sku || '');
  const [precio, setPrecio] = useState(initialData?.precio?.toString() || '');
  const [descripcion, setDescripcion] = useState(initialData?.descripcion || '');
  const [sedeId, setSedeId] = useState(initialData?.sedeId || '');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) {
      setNombre(initialData.nombre);
      setSku(initialData.sku);
      setPrecio(initialData.precio.toString());
      setDescripcion(initialData.descripcion);
      setSedeId(initialData.sedeId);
    } else {
      if (!sedeId && sedes.length > 0) setSedeId(sedes[0].id);
    }
  }, [sedes, initialData]);

  const resetForm = () => {
    setNombre('');
    setSku('');
    setPrecio('');
    setDescripcion('');
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sedeId) {
      setError(UI_TEXTS.REQUIRED_FIELDS);
      return;
    }
    try {
      await onSubmit({ 
        nombre, 
        sku, 
        precio: parseFloat(precio), 
        descripcion, 
        sedeId 
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
          placeholder={UI_TEXTS.PLACEHOLDER_PRODUCT_NAME}
          required
          disabled={loading}
        />
      </Form.Group>
      <Form.Group className="mb-3">
        <Form.Label>{UI_TEXTS.SKU}</Form.Label>
        <Form.Control
          type="text"
          value={sku}
          onChange={(e) => setSku(e.target.value)}
          placeholder={UI_TEXTS.PLACEHOLDER_SKU}
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
        <Form.Label>{UI_TEXTS.SEDE}</Form.Label>
        <Form.Select value={sedeId} onChange={(e) => setSedeId(e.target.value)} required disabled={loading}>
          {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
        </Form.Select>
      </Form.Group>
      <Form.Group className="mb-3">
        <Form.Label>{UI_TEXTS.DESCRIPTION}</Form.Label>
        <Form.Control
          as="textarea"
          rows={3}
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
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
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);

  useEffect(() => {
    let sedesLoaded = false;
    let productsLoaded = false;

    const checkLoading = () => {
      if (sedesLoaded && productsLoaded) {
        setLoading(false);
      }
    };

    const unsubSedes = onSnapshot(collection(db, 'sedes'), s => {
      setSedes(s.docs.map(d => ({ id: d.id, nombre: d.get('nombre') || '' } as Sede)));
      sedesLoaded = true;
      checkLoading();
    });

    const unsubProducts = onSnapshot(collection(db, 'productos'), s => {
      setProducts(s.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
      productsLoaded = true;
      checkLoading();
    });

    return () => { unsubSedes(); unsubProducts(); };
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
      const sedeNombre = sedes.find(s => s.id === p.sedeId)?.nombre || '';
      return p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || 
             p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
             sedeNombre.toLowerCase().includes(searchTerm.toLowerCase());
    });
  }, [products, sedes, searchTerm]);

  const columns: Column<Product>[] = useMemo(() => [
    { accessorKey: 'sku', header: UI_TEXTS.SKU },
    { accessorKey: 'nombre', header: UI_TEXTS.TABLE_HEADER_NAME },
    { 
      header: UI_TEXTS.PRICE, 
      render: (p) => `$${p.precio.toFixed(2)}` 
    },
    { 
      header: UI_TEXTS.TABLE_HEADER_SEDE, 
      render: (p) => sedes.find(s => s.id === p.sedeId)?.nombre || p.sedeId 
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
  ], [sedes]);

  return (
    <Fragment>
      <Container fluid>
        <Row>
          {!isMobile && (
            <Col md={4} className="mb-3">
              <Card className="p-3">
                <ProductForm 
                  key={editingProduct ? editingProduct.id : 'new'}
                  sedes={sedes}
                  onSubmit={handleSaveProduct} 
                  loading={isSubmitting} 
                  initialData={editingProduct} 
                />
              </Card>
            </Col>
          )}
          <Col md={isMobile ? 12 : 8}>
            <Card className="p-3">
              <SearchInput searchTerm={searchTerm} onSearchChange={setSearchTerm} placeholder={UI_TEXTS.PLACEHOLDER_SEARCH_PRODUCTS} className="mb-3" />
              {loading ? <GlobalSpinner variant={SPINNER_VARIANTS.IN_PAGE} /> : (
                <GenericTable data={filteredProducts} columns={columns} variant={isDarkMode ? 'dark' : ''} />
              )}
            </Card>
          </Col>
        </Row>
      </Container>
      {isMobile && <FabButton onClick={() => setShowModal(true)} />}
      <GenericCreationModal show={showModal} onHide={() => { setShowModal(false); setEditingProduct(null); }}>
        <ProductForm 
          key={editingProduct ? editingProduct.id : 'modal-new'}
          initialData={editingProduct} 
          sedes={sedes}
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
