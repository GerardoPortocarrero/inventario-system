import type { FC } from 'react';
import { useState, useEffect, useMemo, Fragment, useRef } from 'react';
import { Container, Form, Button, Alert, Spinner, Modal, Nav, Tab } from 'react-bootstrap';
import { db } from '../api/firebase';
import { collection, addDoc, onSnapshot, updateDoc, doc, deleteDoc, serverTimestamp } from 'firebase/firestore';

import { FaPencilAlt, FaTrash, FaQrcode, FaCopy } from 'react-icons/fa';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'react-hot-toast';
import html2canvas from 'html2canvas';
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
  const qrRef = useRef<HTMLDivElement>(null);
  const [isCopying, setIsCopying] = useState(false);

  const handleCopy = async () => {
    if (!qrRef.current) return;
    setIsCopying(true);
    try {
      // Pequeña pausa para asegurar renderizado de imágenes
      await new Promise(r => setTimeout(r, 300));
      
      const canvas = await html2canvas(qrRef.current, {
        backgroundColor: '#ffffff',
        scale: 3,
        logging: false,
        useCORS: true,
        allowTaint: true
      });
      
      canvas.toBlob(async (blob) => {
        if (blob) {
          try {
            const data = [new ClipboardItem({ 'image/png': blob })];
            await navigator.clipboard.write(data);
            toast.success(`Ficha completa copiada al portapapeles`);
          } catch (err) {
            const dataUrl = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.href = dataUrl;
            link.download = `QR_${product?.nombre}.png`;
            link.click();
            toast.success("Imagen descargada");
          }
        }
        setIsCopying(false); // Desactivar spinner después de procesar el blob
      }, 'image/png', 1.0);
    } catch (error) {
      console.error(error);
      toast.error("Error al copiar");
      setIsCopying(false);
    }
  };

  if (!product) return null;

  const qrValue = activeTab === 'sap' ? product.sap : product.basis;

  return (
    <Modal show={show} onHide={onHide} centered className="qr-modal-v2">
      <Modal.Body className={isDarkMode ? 'bg-dark text-white pt-4' : 'pt-4'}>
        <div className="text-center">
          <Tab.Container activeKey={activeTab} onSelect={(k: any) => setActiveTab(k)}>
            <Nav variant="pills" className="justify-content-center mb-4 qr-tabs-pills">
              <Nav.Item>
                <Nav.Link eventKey="sap" className="px-5 py-2 fw-black">MODO SAP</Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link eventKey="basis" className="px-5 py-2 fw-black">MODO BASIS</Nav.Link>
              </Nav.Item>
            </Nav>
          </Tab.Container>

          <div className="qr-export-container-outer p-2 mb-3">
            <div ref={qrRef} className="qr-export-container p-4 bg-white rounded shadow-sm text-center border">
              <h5 className="fw-black text-dark text-uppercase mb-2" style={{ letterSpacing: '-0.5px' }}>{product.nombre}</h5>
              <div className="d-flex justify-content-center align-items-center mb-3">
                <div className="badge bg-danger px-3 py-2 fs-6">
                  {activeTab.toUpperCase()}: <span className="fw-black">{qrValue || 'N/A'}</span>
                </div>
              </div>
              <div className="d-inline-block p-1 border border-light position-relative">
                <QRCodeSVG 
                  value={qrValue || 'N/A'} 
                  size={280}
                  level="H"
                  includeMargin={false}
                />
                {/* Logo manual para asegurar captura por html2canvas */}
                <img 
                  src="/logo.png" 
                  alt="Logo"
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '55px',
                    height: '55px',
                    backgroundColor: 'white',
                    padding: '4px',
                    border: '1px solid #eee'
                  }}
                />
              </div>
              <div className="mt-3 pt-2 border-top text-muted small fw-bold text-uppercase" style={{ opacity: 0.5, fontSize: '0.6rem' }}>
                Sistema de Inventario • Propiedad de la Empresa
              </div>
            </div>
          </div>

          <div className="px-4 pb-3">
            <Button 
              variant="primary" 
              className="w-100 py-3 fw-black text-uppercase shadow-sm d-flex align-items-center justify-content-center gap-2 mb-2" 
              onClick={handleCopy}
              disabled={isCopying}
            >
              {isCopying ? (
                <>
                  <Spinner size="sm" animation="border" />
                  PROCESANDO...
                </>
              ) : (
                <>
                  <FaCopy />
                  Copiar Ficha Completa
                </>
              )}
            </Button>
            <Button variant="link" className="text-muted small fw-bold text-decoration-none" onClick={onHide}>
              CERRAR VENTANA
            </Button>
          </div>
        </div>
      </Modal.Body>
      <style>{`
        .fw-black { font-weight: 900 !important; }
        .qr-modal-v2 .modal-content { border-radius: 12px; overflow: hidden; border: none; }
        
        .qr-tabs-pills { background: rgba(0,0,0,0.05); padding: 5px; border-radius: 50px; display: inline-flex; margin: 0 auto; }
        .theme-dark .qr-tabs-pills { background: rgba(255,255,255,0.05); }
        
        .qr-tabs-pills .nav-link { 
          border-radius: 50px;
          color: var(--theme-text-secondary);
          font-size: 0.75rem;
          transition: all 0.2s ease;
          border: none;
        }
        
        .qr-tabs-pills .nav-link.active { 
          background: var(--color-red-primary) !important;
          color: white !important;
          box-shadow: 0 4px 10px rgba(244, 0, 9, 0.3);
        }

        .qr-export-container { width: 100%; max-width: 360px; margin: 0 auto; color: #000 !important; }
        .qr-export-container-outer { overflow: hidden; }
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
