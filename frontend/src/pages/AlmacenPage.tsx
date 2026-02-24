import type { FC } from 'react';
import { useState, useEffect, useMemo } from 'react';
import { Container, Row, Col, Card, Button, Badge, Form, Modal, InputGroup } from 'react-bootstrap';
import { db } from '../api/firebase';
import { collection, onSnapshot, query, where, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { UI_TEXTS } from '../constants';
import GlobalSpinner from '../components/GlobalSpinner';
import { FaPlus, FaMinus, FaCalculator, FaSave, FaHistory, FaSearch, FaBoxOpen, FaTruckLoading } from 'react-icons/fa';

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

  const handleUpdateDraft = (prodId: string, field: keyof InventoryEntry, value: number) => {
    setDraftInventory(prev => ({
      ...prev,
      [prodId]: { ...(prev[prodId] || inventory[prodId] || { almacen: 0, consignacion: 0, rechazo: 0 }), [field]: Math.max(0, value) }
    }));
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
    <Container fluid className="px-3 py-2">
      {/* HEADER COMPACTO */}
      <div className="controlador-header d-flex justify-content-between align-items-center mb-3">
        <div>
          <h5 className="fw-bold mb-0 text-uppercase">{UI_TEXTS.INVENTORY_CONTROL}</h5>
          <small className="text-muted">{currentSedeName} | {userName}</small>
        </div>
        <Button 
          variant="primary" 
          size="sm"
          className="px-3 fw-bold"
          onClick={handleSave}
          disabled={isSaving || Object.keys(draftInventory).length === 0}
        >
          {isSaving ? UI_TEXTS.LOADING : `SINCRONIZAR (${Object.keys(draftInventory).length})`}
        </Button>
      </div>

      {/* BUSCADOR COMPACTO */}
      <div className="mb-3">
        <InputGroup size="sm">
          <InputGroup.Text><FaSearch /></InputGroup.Text>
          <Form.Control
            placeholder="Buscar producto..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </InputGroup>
      </div>

      {/* REJILLA DE PRODUCTOS */}
      <Row className="g-2">
        {filteredProducts.map(product => {
          const inv = draftInventory[product.id] || inventory[product.id] || { almacen: 0, consignacion: 0, rechazo: 0 };
          const isDirty = !!draftInventory[product.id];

          return (
            <Col key={product.id} xs={12} sm={6} lg={4}>
              <div 
                className={`product-card ${isDirty ? 'dirty' : ''}`}
                onClick={() => setSelectedProduct(product)}
              >
                <div className="product-card-info">
                  <div className="d-flex justify-content-between">
                    <span className="product-sap">{product.sap}</span>
                    {isDirty && <span className="pending-badge">Pendiente</span>}
                  </div>
                  <div className="product-name">{product.nombre}</div>
                </div>
                <div className="product-card-stats">
                  <div className="stat-box">
                    <span className="stat-label">ALM</span>
                    <span className="stat-value">{inv.almacen}</span>
                  </div>
                  <div className="stat-box">
                    <span className="stat-label">CON</span>
                    <span className="stat-value">{inv.consignacion}</span>
                  </div>
                  <div className="stat-box">
                    <span className="stat-label">REC</span>
                    <span className="stat-value">{inv.rechazo}</span>
                  </div>
                </div>
              </div>
            </Col>
          );
        })}
      </Row>

      {/* MODAL DE ASISTENTE */}
      <Modal 
        show={!!selectedProduct} 
        onHide={() => setSelectedProduct(null)} 
        centered
        className="inventory-modal"
      >
        {selectedProduct && (
          <Modal.Body className="p-3">
            <div className="modal-header-custom mb-3">
              <h5 className="fw-bold mb-0">{selectedProduct.nombre}</h5>
              <small className="text-muted">SAP: {selectedProduct.sap} | Empaque: {selectedProduct.unidades}</small>
            </div>

            <div className="d-flex flex-column gap-3">
              {['almacen', 'consignacion', 'rechazo'].map((field) => {
                const currentVal = (draftInventory[selectedProduct.id] || inventory[selectedProduct.id] || { almacen: 0, consignacion: 0, rechazo: 0 })[field as keyof InventoryEntry];
                
                return (
                  <div key={field} className="modal-field-group">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <span className="text-uppercase fw-bold small">
                        {field === 'almacen' ? 'Almacén' : field === 'consignacion' ? 'Consignación' : 'Rechazo'}
                      </span>
                      <span className="h4 mb-0 fw-bold">{currentVal}</span>
                    </div>

                    <div className="modal-actions">
                      <Button 
                        variant="secondary" 
                        size="sm"
                        onClick={() => handleUpdateDraft(selectedProduct.id, field as keyof InventoryEntry, currentVal + selectedProduct.unidades)}
                      >
                        +{selectedProduct.unidades} (Paq)
                      </Button>
                      <Button 
                        variant="secondary" 
                        size="sm"
                        onClick={() => handleUpdateDraft(selectedProduct.id, field as keyof InventoryEntry, currentVal + 1)}
                      >
                        +1
                      </Button>
                      <Button 
                        variant="secondary" 
                        size="sm"
                        onClick={() => handleUpdateDraft(selectedProduct.id, field as keyof InventoryEntry, currentVal - 1)}
                      >
                        -1
                      </Button>
                      <Button 
                        variant="outline-primary" 
                        size="sm"
                        onClick={() => {
                          const nuevo = prompt(`Valor para ${field}:`, currentVal.toString());
                          if (nuevo !== null) handleUpdateDraft(selectedProduct.id, field as keyof InventoryEntry, parseInt(nuevo) || 0);
                        }}
                      >
                        <FaCalculator />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            <Button variant="primary" className="w-100 mt-4 py-2 fw-bold" onClick={() => setSelectedProduct(null)}>
              LISTO
            </Button>
          </Modal.Body>
        )}
      </Modal>

      <style>{`
        /* Estilos alineados al sistema */
        .product-card {
          border: 1px solid var(--theme-border-default) !important;
          background-color: var(--theme-background-primary);
          padding: 10px;
          cursor: pointer;
          transition: border-color 0.2s;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .product-card:hover {
          border-color: var(--color-red-primary) !important;
        }
        .product-card.dirty {
          border-left: 3px solid #ffc107 !important;
        }
        .product-card-info {
          flex: 1;
          min-width: 0;
        }
        .product-sap {
          font-size: 0.7rem;
          color: var(--theme-text-secondary);
          display: block;
        }
        .product-name {
          font-weight: bold;
          font-size: 0.9rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          color: var(--theme-text-primary);
        }
        .pending-badge {
          background-color: #ffc107;
          color: #000;
          font-size: 0.6rem;
          padding: 1px 4px;
          text-transform: uppercase;
          font-weight: bold;
        }
        .product-card-stats {
          display: flex;
          gap: 5px;
          margin-left: 10px;
        }
        .stat-box {
          background-color: var(--theme-background-secondary);
          padding: 4px 8px;
          text-align: center;
          min-width: 45px;
        }
        .stat-label {
          display: block;
          font-size: 0.6rem;
          color: var(--theme-text-secondary);
        }
        .stat-value {
          font-weight: bold;
          font-size: 0.8rem;
          color: var(--theme-text-primary);
        }

        /* Modal custom para visibilidad total */
        .inventory-modal .modal-content {
          background-color: var(--theme-background-primary) !important;
          border: 1px solid var(--theme-border-default) !important;
        }
        .modal-field-group {
          border-bottom: 1px solid var(--theme-border-default);
          padding-bottom: 10px;
        }
        .modal-field-group:last-child {
          border-bottom: none;
        }
        .modal-actions {
          display: grid;
          grid-template-columns: 2fr 1fr 1fr 1fr;
          gap: 5px;
        }
        .modal-actions .btn {
          border-radius: 0 !important;
        }
      `}</style>
    </Container>
  );
};

export default AlmacenPage;
