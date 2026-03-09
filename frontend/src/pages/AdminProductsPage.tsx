import type { FC } from 'react';
import { useState, useEffect, useMemo, Fragment } from 'react';
import { Container, Form, Button, Alert, Spinner, Modal, Nav, Tab } from 'react-bootstrap';
import { db } from '../api/firebase';
import { collection, addDoc, onSnapshot, updateDoc, doc, deleteDoc, serverTimestamp } from 'firebase/firestore';

import { FaPencilAlt, FaTrash, FaQrcode, FaCopy } from 'react-icons/fa';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'react-hot-toast';
import useMediaQuery from '../hooks/useMediaQuery';

import SearchInput from '../components/SearchInput';
import GenericTable, { type Column } from '../components/GenericTable';
import { UI_TEXTS, SPINNER_VARIANTS } from '../constants';
import GlobalSpinner from '../components/GlobalSpinner';
import FabButton from '../components/FabButton';
import GenericCreationModal from '../components/GenericCreationModal';
import GenericFilter from '../components/GenericFilter';
import { useData } from '../context/DataContext';
import { matchSearchTerms } from '../utils/searchUtils';

interface Product {
  id: string;
  nombre: string;
  sap: string;
  tipoBebidaId: string;
  basis: string;
  comercial: string;
  contaaya: string;
  mililitros: number;
  unidades: number;
  precio: number;
  creadoEn?: any;
}

const ProductQRModal: FC<{
  show: boolean;
  onHide: () => void;
  product: Product | null;
  isDarkMode: boolean;
}> = ({ show, onHide, product, isDarkMode }) => {
  const [activeTab, setActiveTab] = useState<'sap' | 'basis'>('sap');

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${activeTab.toUpperCase()} copiado al portapapeles`);
  };

  if (!product) return null;

  const qrValue = activeTab === 'sap' ? product.sap : product.basis;

  return (
    <Modal show={show} onHide={onHide} centered className="qr-modal">
      <Modal.Header closeButton className={isDarkMode ? 'bg-dark text-white border-secondary' : ''}>
        <Modal.Title className="fs-6 fw-bold">QR DE PRODUCTO</Modal.Title>
      </Modal.Header>
      <Modal.Body className={isDarkMode ? 'bg-dark text-white' : ''}>
        <div className="text-center mb-4">
          <h6 className="fw-bold text-uppercase mb-1">{product.nombre}</h6>
          <p className="text-muted small mb-3">{product.sap} / {product.basis}</p>
          
          <Tab.Container activeKey={activeTab} onSelect={(k: any) => setActiveTab(k)}>
            <Nav variant="pills" className="justify-content-center mb-4 gap-2">
              <Nav.Item>
                <Nav.Link eventKey="sap" className="px-4 py-1 small fw-bold">SAP</Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link eventKey="basis" className="px-4 py-1 small fw-bold">BASIS</Nav.Link>
              </Nav.Item>
            </Nav>
          </Tab.Container>

          <div className="p-3 bg-white d-inline-block rounded shadow-sm mb-4">
            <QRCodeSVG 
              value={qrValue || 'N/A'} 
              size={200}
              level="H"
              includeMargin={true}
            />
          </div>

          <div className="d-flex flex-column align-items-center gap-2">
            <div className="d-flex align-items-center gap-2 p-2 px-3 rounded w-100 justify-content-center" style={{ background: isDarkMode ? '#2b2b2b' : '#f8f9fa', border: '1px solid ' + (isDarkMode ? '#333' : '#eee') }}>
              <span className="fw-bold text-danger fs-5">{qrValue || 'N/A'}</span>
              <Button variant="link" className="p-0 text-secondary" onClick={() => handleCopy(qrValue || '')}>
                <FaCopy />
              </Button>
            </div>
            <p className="small text-muted mb-0">Escanea este código para identificar el producto.</p>
          </div>
        </div>
      </Modal.Body>
      <style>{`
        .qr-modal .nav-pills .nav-link { 
          background: transparent; 
          color: var(--theme-text-secondary);
          border: 1px solid var(--theme-border-default);
          border-radius: 4px;
        }
        .qr-modal .nav-pills .nav-link.active { 
          background: var(--color-red-primary); 
          color: white;
          border-color: var(--color-red-primary);
        }
      `}</style>
    </Modal>
  );
};

const ProductForm: React.FC<{
  initialData: Product | null;
  onSubmit: (data: any, isEditing: boolean, resetForm: () => void) => Promise<void>;
  onCancel?: () => void;
  loading: boolean;
}> = ({ initialData, onSubmit, onCancel, loading }) => {
  const { beverageTypes } = useData();
  const [nombre, setNombre] = useState(initialData?.nombre || '');
  const [sap, setSap] = useState(initialData?.sap || '');
  const [tipoBebidaId, setTipoBebidaId] = useState(initialData?.tipoBebidaId || '');
  const [basis, setBasis] = useState(initialData?.basis || '');
  const [comercial, setComercial] = useState(initialData?.comercial || '');
  const [contaaya, setContaaya] = useState(initialData?.contaaya || '');
  const [mililitros, setMililitros] = useState(initialData?.mililitros?.toString() || '');
  const [unidades, setUnidades] = useState(initialData?.unidades?.toString() || '');
  const [precio, setPrecio] = useState(initialData?.precio?.toString() || '');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) {
      setNombre(initialData.nombre || '');
      setSap(initialData.sap || '');
      // Fallback to first beverage type if the product document lacks it
      setTipoBebidaId(initialData.tipoBebidaId || (beverageTypes.length > 0 ? beverageTypes[0].id : ''));
      setBasis(initialData.basis || '');
      setComercial(initialData.comercial || '');
      setContaaya(initialData.contaaya || '');
      setMililitros(initialData.mililitros?.toString() || '');
      setUnidades(initialData.unidades?.toString() || '');
      setPrecio(initialData.precio?.toString() || '');
    } else {
      if (!tipoBebidaId && beverageTypes.length > 0) {
        setTipoBebidaId(beverageTypes[0].id);
      }
    }
  }, [initialData, beverageTypes]);

  const resetForm = () => {
    setNombre('');
    setSap('');
    setTipoBebidaId(beverageTypes.length > 0 ? beverageTypes[0].id : '');
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
        tipoBebidaId,
        basis,
        comercial,
        contaaya,
        mililitros: mililitros ? parseFloat(mililitros) : 0,
        unidades: unidades ? parseInt(unidades) : 0,
        precio: precio ? parseFloat(precio) : 0
      }, !!initialData, resetForm);
    } catch (err: any) {
      setError(UI_TEXTS.ERROR_GENERIC_CREATE);
    }
  };

  const selectedTypeName = beverageTypes.find(t => t.id === tipoBebidaId)?.nombre?.toLowerCase() || '';
  const isEnvase = selectedTypeName === 'envase';

  return (
    <Form onSubmit={handleSubmit}>
      <Form.Group className="mb-3">
        <Form.Label>{UI_TEXTS.BEVERAGE_TYPE_NAME}</Form.Label>
        <Form.Select 
          value={tipoBebidaId} 
          onChange={(e) => setTipoBebidaId(e.target.value)} 
          required 
          disabled={loading}
        >
          {beverageTypes.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
        </Form.Select>
      </Form.Group>
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
      {!isEnvase && (
        <>
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
        </>
      )}
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
  const [isDarkMode, setIsDarkMode] = useState(() => document.body.classList.contains('theme-dark'));
  const isMobile = useMediaQuery('(max-width: 768px)');

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDarkMode(document.body.classList.contains('theme-dark'));
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  const { beverageTypes, loadingMasterData } = useData();
  
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [qrProduct, setQrProduct] = useState<Product | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);

  useEffect(() => {
    const unsubProducts = onSnapshot(collection(db, 'productos'), s => {
      setProducts(s.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
      setLoading(false);
    });

    return () => unsubProducts();
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
      const matchesSearch = matchSearchTerms(p, searchTerm, ['nombre', 'sap', 'basis', 'comercial', 'contaaya']);
      const matchesType = !selectedType || p.tipoBebidaId === selectedType;
      return matchesSearch && matchesType;
    });
  }, [products, searchTerm, selectedType]);

  const columns: Column<Product>[] = [
    { 
      header: 'Tipo', 
      render: (p) => beverageTypes.find(t => t.id === p.tipoBebidaId)?.nombre || p.tipoBebidaId 
    },
    { accessorKey: 'nombre', header: UI_TEXTS.TABLE_HEADER_NAME },
    { accessorKey: 'sap', header: UI_TEXTS.SAP },
    { accessorKey: 'basis', header: UI_TEXTS.BASIS },
    { accessorKey: 'comercial', header: UI_TEXTS.COMERCIAL },
    { accessorKey: 'contaaya', header: UI_TEXTS.CONTAAYA },
    {
      header: UI_TEXTS.TABLE_HEADER_ACTIONS,
      render: (p) => (
        <div className="d-flex gap-2 action-buttons-container">
          <Button variant="link" size="sm" className="p-0 action-btn qr-btn text-info" onClick={() => setQrProduct(p)}>
            <FaQrcode className="icon-desktop" /> <span className="text-mobile">QR</span>
          </Button>
          <Button variant="link" size="sm" className="p-0 action-btn edit-btn" onClick={() => { setEditingProduct(p); setShowModal(true); }}>
            <FaPencilAlt className="icon-desktop" /> <span className="text-mobile">Editar</span>
          </Button>
          <Button variant="link" size="sm" className="p-0 text-danger action-btn delete-btn" onClick={() => setDeletingProduct(p)}>
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
              <ProductForm 
                key="new-product-form"
                onSubmit={handleSaveProduct} 
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
                placeholder={UI_TEXTS.PLACEHOLDER_SEARCH_PRODUCTS} 
                className="flex-grow-1 mb-0" 
              />
              <GenericFilter
                prefix="Tipo"
                value={selectedType}
                onChange={setSelectedType}
                options={beverageTypes.map(t => ({ value: t.id, label: t.nombre }))}
                className="flex-shrink-0"
              />
            </div>
            <GenericTable 
              data={filteredProducts} 
              columns={columns} 
              variant={isDarkMode ? 'dark' : ''} 
              isLoading={loading}
            />
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
      <ProductQRModal 
        show={!!qrProduct} 
        onHide={() => setQrProduct(null)} 
        product={qrProduct}
        isDarkMode={isDarkMode}
      />
    </Fragment>
  );
};

export default AdminProductsPage;
