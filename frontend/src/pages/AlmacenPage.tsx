import type { FC } from 'react';
import { useState, useEffect, useMemo } from 'react';
import { Container, Row, Col, Button, Form, Modal, InputGroup, Badge } from 'react-bootstrap';
import { db } from '../api/firebase';
import { collection, onSnapshot, query, where, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { UI_TEXTS } from '../constants';
import GlobalSpinner from '../components/GlobalSpinner';
import { FaUserCircle, FaMapMarkerAlt, FaCalculator } from 'react-icons/fa';

interface Product {
  id: string;
  nombre: string;
  sap: string;
  tipoBebidaId: string;
  unidades: number;
}

interface InventoryEntry {
  almacen: number;
  consignacion: number;
  rechazo: number;
}

const AlmacenPage: FC = () => {
  const { userSedeId, userName } = useAuth();
  const { beverageTypes, sedes, loadingMasterData } = useData();
  const [products, setProducts] = useState<Product[]>([]);
  const [inventory, setInventory] = useState<Record<string, InventoryEntry>>({});
  const [draftInventory, setDraftInventory] = useState<Record<string, InventoryEntry>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [tempBoxes, setTempBoxes] = useState<Record<string, number>>({ almacen: 0, consignacion: 0, rechazo: 0 });
  const [tempUnits, setTempUnits] = useState<Record<string, number>>({ almacen: 0, consignacion: 0, rechazo: 0 });

  const currentSedeName = useMemo(() => sedes.find(s => s.id === userSedeId)?.nombre || 'Sede...', [sedes, userSedeId]);

  useEffect(() => {
    if (!userSedeId) return;
    const unsubProducts = onSnapshot(collection(db, 'productos'), (s) => {
      setProducts(s.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
    });
    const qInventory = query(collection(db, 'inventario'), where('sedeId', '==', userSedeId));
    const unsubInventory = onSnapshot(qInventory, (s) => {
      const invMap: Record<string, InventoryEntry> = {};
      s.docs.forEach(d => {
        const data = d.data();
        invMap[data.productoId] = {
          almacen: data.almacen || 0,
          consignacion: data.consignacion || 0,
          rechazo: data.rechazo || 0
        };
      });
      setInventory(invMap);
      setLoading(false);
    });
    return () => { unsubProducts(); unsubInventory(); };
  }, [userSedeId]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || p.sap.includes(searchTerm));
  }, [products, searchTerm]);

  const handleOpenModal = (product: Product) => {
    const inv = draftInventory[product.id] || inventory[product.id] || { almacen: 0, consignacion: 0, rechazo: 0 };
    const newTempBoxes: any = {};
    const newTempUnits: any = {};
    ['almacen', 'consignacion', 'rechazo'].forEach(field => {
      const total = inv[field as keyof InventoryEntry];
      newTempBoxes[field] = Math.floor(total / product.unidades);
      newTempUnits[field] = total % product.unidades;
    });
    setTempBoxes(newTempBoxes);
    setTempUnits(newTempUnits);
    setSelectedProduct(product);
  };

  const handleConfirmEntry = () => {
    if (!selectedProduct) return;
    setDraftInventory(prev => ({
      ...prev,
      [selectedProduct.id]: {
        almacen: (tempBoxes.almacen * selectedProduct.unidades) + tempUnits.almacen,
        consignacion: (tempBoxes.consignacion * selectedProduct.unidades) + tempUnits.consignacion,
        rechazo: (tempBoxes.rechazo * selectedProduct.unidades) + tempUnits.rechazo
      }
    }));
    setSelectedProduct(null);
  };

  const handleSave = async () => {
    if (Object.keys(draftInventory).length === 0) return;
    setIsSaving(true);
    try {
      const promises = Object.entries(draftInventory).map(([prodId, data]) => {
        return setDoc(doc(db, 'inventario', `${userSedeId}_${prodId}`), {
          ...data, productoId: prodId, sedeId: userSedeId, ultimaActualizacion: serverTimestamp(), actualizadoPor: userName
        }, { merge: true });
      });
      await Promise.all(promises);
      setDraftInventory({});
      alert(UI_TEXTS.INVENTORY_UPDATED_SUCCESS);
    } catch (e) { console.error(e); } finally { setIsSaving(false); }
  };

  if (loading || loadingMasterData) return <GlobalSpinner variant="overlay" />;

  return (
    <div className="admin-layout-container">
      <div className="admin-section-table d-flex flex-column h-100">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
          <div className="d-flex gap-2">
            <div className="info-pill-new">
              <FaMapMarkerAlt className="mx-2 text-primary" />
              <div className="pill-content">
                <span className="pill-label">SEDE</span>
                <span className="pill-value">{currentSedeName}</span>
              </div>
            </div>
            <div className="info-pill-new">
              <FaUserCircle className="mx-2 text-muted" />
              <div className="pill-content">
                <span className="pill-label">CONTROLADOR</span>
                <span className="pill-value">{userName}</span>
              </div>
            </div>
          </div>
          <Button variant="primary" size="sm" className="px-4 fw-bold" onClick={handleSave} disabled={isSaving || Object.keys(draftInventory).length === 0}>
            {isSaving ? UI_TEXTS.LOADING : `SINCRONIZAR (${Object.keys(draftInventory).length})`}
          </Button>
        </div>

        <div className="mb-3">
          <Form.Control placeholder="Buscar producto por nombre o SAP..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="search-input-clean" />
        </div>

        <div className="flex-grow-1 overflow-auto pe-2 custom-scrollbar">
          <Row className="g-2 m-0">
            {filteredProducts.map(product => {
              const inv = draftInventory[product.id] || inventory[product.id] || { almacen: 0, consignacion: 0, rechazo: 0 };
              const isDirty = !!draftInventory[product.id];
              return (
                <Col key={product.id} xs={12} sm={6} lg={4} className="p-1">
                  <div className={`product-card-simple ${isDirty ? 'is-dirty' : ''}`} onClick={() => handleOpenModal(product)}>
                    <div className="product-info">
                      <span className="sap-code">{product.sap}</span>
                      <div className="name">{product.nombre}</div>
                    </div>
                    <div className="stats-row">
                      <div className="stat-item"><span>ALM</span><strong>{inv.almacen}</strong></div>
                      <div className="stat-item"><span>CON</span><strong>{inv.consignacion}</strong></div>
                    </div>
                  </div>
                </Col>
              );
            })}
          </Row>
        </div>
      </div>

      <Modal show={!!selectedProduct} onHide={() => setSelectedProduct(null)} centered className="inventory-modal-v2">
        {selectedProduct && (
          <Modal.Body className="p-0">
            <div className="modal-header-v2">
              <h5 className="mb-1 fw-bold">{selectedProduct.nombre}</h5>
              <div className="d-flex gap-3 opacity-75 small fw-bold">
                <span>SAP: {selectedProduct.sap}</span>
                <span>EMPAQUE: {selectedProduct.unidades} UDS</span>
              </div>
            </div>

            <div className="p-3">
              {['almacen', 'consignacion', 'rechazo'].map((field) => (
                <div key={field} className="field-group-v2 mb-3">
                  <div className="group-title d-flex justify-content-between align-items-center">
                    <span className="text-uppercase">{field === 'almacen' ? 'Conteo Almacén' : field === 'consignacion' ? 'Consignación' : 'Rechazo'}</span>
                    <Badge bg="danger" className="uds-badge">
                      {(tempBoxes[field] * selectedProduct.unidades) + tempUnits[field]} UDS TOTALES
                    </Badge>
                  </div>
                  <div className="group-content p-3">
                    <Row className="g-3">
                      <Col xs={6}>
                        <Form.Label className="label-v2">CANTIDAD CAJAS</Form.Label>
                        <Form.Control 
                          type="number" 
                          value={tempBoxes[field]} 
                          onChange={(e) => setTempBoxes({...tempBoxes, [field]: Math.max(0, parseInt(e.target.value) || 0)})}
                          className="input-v2"
                        />
                      </Col>
                      <Col xs={6}>
                        <Form.Label className="label-v2">UNIDADES SUELTAS</Form.Label>
                        <Form.Control 
                          type="number" 
                          value={tempUnits[field]} 
                          onChange={(e) => setTempUnits({...tempUnits, [field]: Math.max(0, parseInt(e.target.value) || 0)})}
                          className="input-v2"
                        />
                      </Col>
                    </Row>
                  </div>
                </div>
              ))}
              <Button variant="primary" className="w-100 py-2 fw-bold mt-2" onClick={handleConfirmEntry}>CONFIRMAR CONTEO</Button>
            </div>
          </Modal.Body>
        )}
      </Modal>

      <style>{`
        .info-pill-new { display: flex; align-items: center; border: 1px solid var(--theme-border-default); background: var(--theme-background-secondary); padding: 2px 8px; }
        .pill-content { display: flex; flex-direction: column; line-height: 1.1; }
        .pill-label { font-size: 0.6rem; font-weight: 800; opacity: 0.5; }
        .pill-value { font-size: 0.8rem; font-weight: 700; }
        
        .search-input-clean { border-radius: 0 !important; border: none !important; border-bottom: 1px solid var(--theme-border-default) !important; background: transparent !important; padding-left: 0 !important; font-weight: 500; }
        .search-input-clean:focus { border-color: var(--color-red-primary) !important; }

        .product-card-simple { border: 1px solid var(--theme-border-default); background: var(--theme-background-primary); padding: 8px 12px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; }
        .product-card-simple:hover { border-color: var(--color-red-primary); background: var(--theme-background-secondary); }
        .product-card-simple.is-dirty { border-left: 3px solid #ffc107; }
        .sap-code { font-size: 0.65rem; font-weight: bold; color: var(--color-red-primary); display: block; }
        .name { font-weight: bold; font-size: 0.85rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .stats-row { display: flex; gap: 4px; }
        .stat-item { background: var(--theme-background-secondary); border: 1px solid var(--theme-border-default); padding: 2px 6px; text-align: center; min-width: 45px; }
        .stat-item span { display: block; font-size: 0.55rem; opacity: 0.5; font-weight: bold; }
        .stat-item strong { font-size: 0.8rem; font-weight: 900; }

        /* MODAL V2 - ALTA VISIBILIDAD */
        .inventory-modal-v2 .modal-content { 
          background-color: #1a1a1a !important; 
          border: 1px solid #444 !important;
          color: white !important;
        }
        .modal-header-v2 { 
          background-color: var(--color-red-primary); 
          padding: 15px 20px; 
          color: white; 
        }
        .field-group-v2 { border: 1px solid #333; background: #222; }
        .group-title { background: #333; padding: 4px 12px; font-size: 0.75rem; font-weight: 800; color: #aaa; }
        .uds-badge { font-size: 0.7rem; letter-spacing: 0.5px; }
        .label-v2 { font-size: 0.65rem; font-weight: 800; color: #888; margin-bottom: 4px; display: block; }
        .input-v2 { 
          background: #111 !important; 
          border: none !important; 
          border-bottom: 2px solid #444 !important; 
          color: white !important; 
          font-weight: 900 !important; 
          font-size: 1.2rem !important;
          text-align: center;
        }
        .input-v2:focus { border-color: var(--color-red-primary) !important; background: #000 !important; }
      `}</style>
    </div>
  );
};

export default AlmacenPage;
