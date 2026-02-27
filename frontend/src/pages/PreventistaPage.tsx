import type { FC } from 'react';
import { useState, useEffect, useMemo } from 'react';
import { Row, Col, Button, Form, Modal, Badge, Spinner, Alert } from 'react-bootstrap';
import { db } from '../api/firebase';
import { collection, onSnapshot, doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import GlobalSpinner from '../components/GlobalSpinner';
import { FaShoppingCart, FaClipboardList, FaGlassMartiniAlt, FaCashRegister, FaCheck, FaExclamationTriangle } from 'react-icons/fa';
import SearchInput from '../components/SearchInput';

interface Product {
  id: string;
  nombre: string;
  sap: string;
  unidades: number;
  tipoBebidaId: string;
  precio: number;
}

interface InventoryEntry {
  almacen: number;
  consignacion: number;
  rechazo: number;
  preventa: number;
}

const PreventistaPage: FC = () => {
  const { userSedeId, userName, userId } = useAuth();
  const { beverageTypes, loadingMasterData } = useData();
  const [isDarkMode, setIsDarkMode] = useState(() => document.body.classList.contains('theme-dark'));

  useEffect(() => {
    const observer = new MutationObserver(() => setIsDarkMode(document.body.classList.contains('theme-dark')));
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const [products, setProducts] = useState<Product[]>([]);
  const [dailyInventory, setDailyInventory] = useState<Record<string, InventoryEntry>>({});
  const [cart, setCart] = useState<Record<string, number>>({}); 
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBeverageType, setSelectedBeverageType] = useState<string>('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [viewMode, setViewMode] = useState<'sell' | 'stock'>('sell');

  const [tempBoxes, setTempBoxes] = useState(0);
  const [tempUnits, setTempUnits] = useState(0);

  const todayStr = new Date().toISOString().split('T')[0];

  useEffect(() => {
    const unsubProducts = onSnapshot(collection(db, 'productos'), (s) => {
      setProducts(s.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
    });
    return () => unsubProducts();
  }, []);

  useEffect(() => {
    if (!userSedeId) return;
    setLoading(true);
    const unsubInventory = onSnapshot(doc(db, 'inventario_diario', `${userSedeId}_${todayStr}`), (s) => {
      setDailyInventory(s.exists() ? s.data().productos || {} : {});
      setLoading(false);
    }, () => setLoading(false));
    return () => unsubInventory();
  }, [userSedeId, todayStr]);

  const processedData = useMemo(() => {
    return products.map(p => {
      const inv = dailyInventory[p.id] || { almacen: 0, consignacion: 0, rechazo: 0, preventa: 0 };
      const físicoTotal = inv.almacen + inv.consignacion + inv.rechazo;
      const stockDisponible = físicoTotal - (inv.preventa || 0);
      return { ...p, stockDisponible, inCart: cart[p.id] || 0 };
    });
  }, [products, dailyInventory, cart]);

  const totals = useMemo(() => {
    let totalItems = 0;
    let totalValue = 0;
    Object.entries(cart).forEach(([pid, qty]) => {
      const p = products.find(prod => prod.id === pid);
      if (p) {
        totalItems += qty;
        totalValue += qty * (p.precio || 0);
      }
    });
    return { items: totalItems, value: totalValue };
  }, [cart, products]);

  const filteredProducts = useMemo(() => {
    return processedData.filter(p => 
      (p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || p.sap.includes(searchTerm)) &&
      (selectedBeverageType === '' || p.tipoBebidaId === selectedBeverageType)
    );
  }, [processedData, searchTerm, selectedBeverageType]);

  const formatQty = (totalUnits: number, unitsPerBox: number) => {
    const boxes = Math.floor(totalUnits / unitsPerBox);
    const units = totalUnits % unitsPerBox;
    return `${boxes}-${units}`;
  };

  const handleOpenModal = (product: any) => {
    const currentQty = cart[product.id] || 0;
    setTempBoxes(Math.floor(currentQty / product.unidades));
    setTempUnits(currentQty % product.unidades);
    setSelectedProduct(product);
  };

  const handleConfirmAddToCart = () => {
    if (!selectedProduct) return;
    const totalUnitsRequested = (tempBoxes * selectedProduct.unidades) + tempUnits;
    if (totalUnitsRequested > selectedProduct.stockDisponible) {
      alert(`Stock insuficiente.`);
      return;
    }
    setCart(prev => {
      const newCart = { ...prev };
      if (totalUnitsRequested > 0) newCart[selectedProduct.id] = totalUnitsRequested;
      else delete newCart[selectedProduct.id];
      return newCart;
    });
    setSelectedProduct(null);
  };

  const handleSaveOrder = async () => {
    if (!userSedeId || Object.keys(cart).length === 0) return;
    setIsSaving(true);
    try {
      await runTransaction(db, async (transaction) => {
        const invDocRef = doc(db, 'inventario_diario', `${userSedeId}_${todayStr}`);
        const invSnap = await transaction.get(invDocRef);
        if (!invSnap.exists()) throw new Error("No hay inventario hoy.");
        const currentInvData = invSnap.data().productos || {};
        const orderDetails: any[] = [];
        const updatedInvProducts = { ...currentInvData };
        for (const [pid, qty] of Object.entries(cart)) {
          const p = products.find(prod => prod.id === pid);
          if (!p) continue;
          const inv = currentInvData[pid] || { almacen: 0, consignacion: 0, rechazo: 0, preventa: 0 };
          if (qty > (inv.almacen + inv.consignacion + inv.rechazo - (inv.preventa || 0))) throw new Error(`Stock insuficiente para ${p.nombre}`);
          orderDetails.push({ productoId: pid, nombreProducto: p.nombre, cantidad: qty, precioUnitario: p.precio || 0, subtotal: qty * (p.precio || 0) });
          updatedInvProducts[pid] = { ...inv, preventa: (inv.preventa || 0) + qty };
        }
        const orderRef = doc(collection(db, 'ordenes'));
        transaction.set(orderRef, { sedeId: userSedeId, preventistaId: userId, nombrePreventista: userName, fechaCreacion: todayStr, estadoOrden: 'PENDIENTE', total: totals.value, detalles: orderDetails, timestamp: serverTimestamp() });
        transaction.update(invDocRef, { productos: updatedInvProducts });
      });
      setSaveSuccess(true);
      setCart({});
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (e: any) { alert(e.message); } finally { setIsSaving(false); }
  };

  if (loadingMasterData) return <GlobalSpinner variant="overlay" />;

  return (
    <div className="admin-layout-container flex-column overflow-hidden">
      <div className="admin-section-table d-flex flex-column h-100 overflow-hidden">
        
        {/* 1. SECCIÓN DE CABECERA (IGUAL A CONTROLADOR) */}
        <Row className="g-2 mb-3 px-1">
          <Col xs={6} md={3}>
            <div className="info-pill-new w-100">
              <span className="pill-icon pill-icon-sober highlight-system"><FaShoppingCart /></span>
              <div className="pill-content">
                <span className="pill-label">ÍTEMS PEDIDO</span>
                <span className="pill-value h6 mb-0">{Object.keys(cart).length}</span>
              </div>
            </div>
          </Col>
          <Col xs={6} md={3}>
            <div className="info-pill-new w-100">
              <span className="pill-icon pill-icon-sober text-success"><FaCashRegister /></span>
              <div className="pill-content">
                <span className="pill-label">TOTAL ESTIMADO</span>
                <span className="pill-value h6 mb-0">S/ {totals.value.toFixed(2)}</span>
              </div>
            </div>
          </Col>
          <Col xs={6} md={3}>
            <div className="info-pill-new w-100">
              <span className="pill-icon pill-icon-sober"><FaGlassMartiniAlt /></span>
              <div className="pill-content w-100">
                <span className="pill-label">TIPO BEBIDA</span>
                <Form.Select value={selectedBeverageType} onChange={(e) => setSelectedBeverageType(e.target.value)} className="pill-select-v2">
                  <option value="">TODOS</option>
                  {beverageTypes.map(t => <option key={t.id} value={t.id}>{t.nombre.toUpperCase()}</option>)}
                </Form.Select>
              </div>
            </div>
          </Col>
          <Col xs={6} md={3}>
            <div className="d-flex flex-column gap-1 h-100">
              <Button variant={isDarkMode ? "outline-light" : "outline-dark"} size="sm" className="w-100 h-50 d-flex align-items-center justify-content-center gap-2 py-1" onClick={() => setViewMode(viewMode === 'sell' ? 'stock' : 'sell')}>
                {viewMode === 'sell' ? <><FaClipboardList /> STOCK</> : <><FaShoppingCart /> VENTA</>}
              </Button>
              <Button variant={saveSuccess ? "success" : "primary"} size="sm" className="w-100 h-50 d-flex align-items-center justify-content-center gap-2 py-1" onClick={handleSaveOrder} disabled={isSaving || (Object.keys(cart).length === 0 && !saveSuccess)}>
                {isSaving ? <Spinner as="span" animation="border" size="sm" /> : saveSuccess ? <FaCheck /> : <FaCheck />} {saveSuccess ? "GUARDADO" : "CONFIRMAR"}
              </Button>
            </div>
          </Col>
        </Row>

        {/* 2. CONTENIDO (Scrollable - IGUAL A CONTROLADOR) */}
        <div className="flex-grow-1 overflow-auto pe-1 custom-scrollbar">
          
          {loading ? (
            <div className="d-flex justify-content-center align-items-center h-100 py-5">
              <div className="spinner-border text-danger" role="status"></div>
            </div>
          ) : viewMode === 'sell' ? (
            <>
              <div className="mb-3 px-1">
                <SearchInput searchTerm={searchTerm} onSearchChange={setSearchTerm} placeholder="Buscar producto..." />
              </div>
              
              {!loading && Object.keys(dailyInventory).length === 0 && (
                <Alert variant="danger" className="py-2 px-3 border-0 shadow-sm mb-3 mx-1 d-flex align-items-center">
                  <FaExclamationTriangle className="me-2" />
                  <small className="fw-bold">VENTA BLOQUEADA: CONTEO INICIAL PENDIENTE.</small>
                </Alert>
              )}

              <Row className="g-2 m-0">
                {filteredProducts.map(product => {
                  const hasStock = product.stockDisponible > 0;
                  return (
                    <Col key={product.id} xs={12} sm={6} lg={4} className="p-1">
                      <div className={`product-card ${product.inCart > 0 ? 'in-cart' : ''} ${!hasStock ? 'opacity-75' : ''}`} onClick={() => handleOpenModal(product)}>
                        <div className="product-card-info">
                          <span className="product-sap">{product.sap}</span>
                          <div className="product-name">{product.nombre}</div>
                          {product.inCart > 0 && <span className="cart-indicator">PEDIDO: {formatQty(product.inCart, product.unidades)}</span>}
                        </div>
                        <div className="product-card-stats">
                          <div className={`stat-box ${hasStock ? 'stock-ok' : 'stock-none'}`}>
                            <span className="stat-label">DISP</span>
                            <span className="stat-value">{formatQty(product.stockDisponible, product.unidades)}</span>
                          </div>
                        </div>
                      </div>
                    </Col>
                  );
                })}
              </Row>
            </>
          ) : (
            /* VISTA DE STOCK (ESTILO DASHBOARD) */
            <Row className="g-3 m-0">
              {beverageTypes.map(type => {
                const typeProducts = processedData.filter(p => p.tipoBebidaId === type.id && p.stockDisponible > 0);
                if (typeProducts.length === 0) return null;
                return (
                  <Col key={type.id} xs={12} md={6} lg={4} className="p-1">
                    <div className="dash-top-card">
                      <div className="dash-top-header text-uppercase">
                        <FaGlassMartiniAlt className="me-2" /> {type.nombre}
                      </div>
                      {typeProducts.map((p, idx) => (
                        <div key={p.id} className="dash-top-item">
                          <span className="dash-top-idx">{idx + 1}</span>
                          <div className="dash-top-info">
                            <div className="dash-top-name">{p.nombre}</div>
                            <div className="dash-top-sap">{p.sap}</div>
                          </div>
                          <div className={`dash-top-val ${p.stockDisponible < 10 ? 'text-danger' : 'text-success'}`}>
                            {formatQty(p.stockDisponible, p.unidades)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </Col>
                );
              })}
            </Row>
          )}
        </div>
      </div>

      {/* Modal de Cantidad */}
      <Modal show={!!selectedProduct} onHide={() => setSelectedProduct(null)} centered className="inventory-modal-v3">
        {selectedProduct && (
          <Modal.Body className="p-0 overflow-hidden">
            <div className="modal-header-v3">
              <h5 className="mb-2 fw-bold text-uppercase">{selectedProduct.nombre}</h5>
              <div className="d-flex justify-content-between">
                <div>
                  <span className="label-v3-header text-white-50 small fw-bold d-block text-uppercase">Stock Disponible</span>
                  <span className="value-v3-header text-white h5 fw-bold">{formatQty(selectedProduct.stockDisponible, selectedProduct.unidades)}</span>
                </div>
                <div className="text-end">
                  <span className="label-v3-header text-white-50 small fw-bold d-block text-uppercase">Precio Unit.</span>
                  <span className="value-v3-header text-white h5 fw-bold">S/ {selectedProduct.precio?.toFixed(2)}</span>
                </div>
              </div>
            </div>
            <div className="p-4">
              <div className="field-group-v3 mb-4">
                <div className="group-title-v3 d-flex justify-content-between align-items-center mb-2">
                  <span className="text-uppercase small fw-bold">Cantidad a Vender</span>
                  <Badge bg="primary" className="fs-6 px-3 border-radius-0">
                    {tempBoxes} C / {tempUnits} U
                  </Badge>
                </div>
                <Row className="g-3">
                  <Col xs={6}>
                    <Form.Label className="label-v3">CAJAS</Form.Label>
                    <Form.Control type="number" value={tempBoxes || ''} onChange={(e) => setTempBoxes(parseInt(e.target.value || '0'))} onFocus={(e) => e.target.select()} className="input-v3" />
                  </Col>
                  <Col xs={6}>
                    <Form.Label className="label-v3">UNIDADES</Form.Label>
                    <Form.Control type="number" value={tempUnits || ''} onChange={(e) => setTempUnits(parseInt(e.target.value || '0'))} onFocus={(e) => e.target.select()} className="input-v3" />
                  </Col>
                </Row>
              </div>
              
              <div className="mb-4 text-center">
                <div className="text-muted small text-uppercase fw-bold mb-1">Subtotal</div>
                <div className="h3 fw-bold" style={{ color: 'var(--theme-text-primary)' }}>
                  S/ {((tempBoxes * selectedProduct.unidades + tempUnits) * (selectedProduct.precio || 0)).toFixed(2)}
                </div>
              </div>

              <Button variant="primary" className="w-100 py-3 fw-bold text-uppercase" onClick={handleConfirmAddToCart}>Actualizar Pedido</Button>
            </div>
          </Modal.Body>
        )}
      </Modal>

      <style>{`
        .info-pill-new { display: flex; align-items: center; background-color: var(--theme-background-secondary); border: 1px solid var(--theme-border-default); overflow: hidden; border-radius: 4px; height: 100%; }
        .pill-icon-sober { background-color: var(--theme-icon-bg); color: var(--theme-icon-color); padding: 12px; border-right: 1px solid var(--theme-border-default); height: 100%; display: flex; align-items: center; }
        .pill-icon-sober.highlight-system { color: var(--color-red-primary); }
        .pill-content { padding: 4px 12px; display: flex; flex-direction: column; justify-content: center; }
        .pill-label { font-size: 0.55rem; font-weight: 800; opacity: 0.6; text-uppercase: uppercase; color: var(--theme-text-primary); }
        .pill-value { color: var(--theme-text-primary); font-family: 'Inter', sans-serif; font-weight: bold; }
        .pill-select-v2 { background: transparent !important; border: none !important; color: var(--theme-text-primary) !important; font-weight: 700; font-size: 0.75rem !important; cursor: pointer; text-transform: uppercase; padding: 0 !important; width: 100% !important; }
        
        .product-card { border: 1px solid var(--theme-border-default); background: var(--theme-background-primary); padding: 10px 15px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; height: 100%; transition: all 0.2s ease; min-height: 90px; }
        .product-card:hover { border-color: var(--color-red-primary); }
        .product-card.in-cart { border-left: 4px solid var(--color-red-primary); background: rgba(244, 0, 9, 0.05); }
        
        .product-card-info { flex: 1; min-width: 0; padding-right: 10px; }
        .product-name { font-weight: bold; font-size: 0.85rem; color: var(--theme-text-primary); line-height: 1.2; margin-bottom: 4px; }
        .product-sap { font-size: 0.65rem; color: var(--color-red-primary); font-weight: 800; display: block; }
        .cart-indicator { font-size: 0.55rem; background: var(--color-red-primary); color: white; padding: 1px 6px; font-weight: 900; display: inline-block; }
        
        .stat-box { background: var(--theme-background-secondary); padding: 4px 10px; text-align: center; border: 1px solid var(--theme-border-default); min-width: 60px; }
        .stat-box.stock-ok { color: #198754; border-color: #19875450; background: rgba(25, 135, 84, 0.05); }
        .stat-box.stock-none { color: #dc3545; border-color: #dc354550; background: rgba(220, 53, 69, 0.05); }
        .stat-label { display: block; font-size: 0.55rem; font-weight: bold; opacity: 0.6; }
        .stat-value { font-weight: 900; font-size: 0.85rem; }

        .dash-top-card { background: var(--theme-background-secondary); border: 1px solid var(--theme-border-default); height: 100%; }
        .dash-top-header { padding: 12px; background: var(--theme-icon-bg); font-size: 0.7rem; font-weight: 900; border-bottom: 1px solid var(--theme-border-default); color: var(--theme-text-secondary); display: flex; align-items: center; }
        .dash-top-item { display: flex; align-items: center; padding: 10px 15px; border-bottom: 1px solid var(--theme-table-border-color); }
        .dash-top-idx { width: 25px; font-weight: 900; color: var(--color-red-primary); font-size: 0.75rem; }
        .dash-top-info { flex: 1; min-width: 0; }
        .dash-top-name { font-size: 0.75rem; font-weight: bold; color: var(--theme-text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .dash-top-sap { font-size: 0.6rem; color: var(--theme-text-secondary); }
        .dash-top-val { font-weight: 900; font-size: 0.85rem; }

        .inventory-modal-v3 .modal-content { background: var(--theme-background-primary) !important; border: 1px solid var(--theme-border-default) !important; color: var(--theme-text-primary) !important; }
        .modal-header-v3 { background: var(--color-red-primary); padding: 20px; color: white; }
        .input-v3 { background: var(--theme-background-secondary) !important; border: none !important; border-bottom: 2px solid var(--theme-border-default) !important; color: var(--theme-text-primary) !important; font-weight: bold; text-align: center; font-size: 1.5rem; height: 60px !important; }
        .input-v3:focus { border-color: var(--color-red-primary) !important; box-shadow: none !important; }
        .label-v3 { font-size: 0.65rem; font-weight: 800; color: var(--theme-text-secondary); text-transform: uppercase; margin-bottom: 4px; }
        .border-radius-0 { border-radius: 0 !important; }

        @media (max-width: 768px) {
          .admin-section-table { padding: 0.5rem; }
          .info-pill-new { margin-bottom: 0.25rem; }
        }
      `}</style>
    </div>
  );
};

export default PreventistaPage;
