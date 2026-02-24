import type { FC } from 'react';
import { useState, useEffect, useMemo } from 'react';
import { Container, Row, Col, Button, Form, Modal, InputGroup } from 'react-bootstrap';
import { db } from '../api/firebase';
import { collection, onSnapshot, query, where, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { UI_TEXTS } from '../constants';
import GlobalSpinner from '../components/GlobalSpinner';
import { FaPlus, FaMinus, FaCalculator, FaSearch, FaBoxOpen, FaTruckLoading, FaUserCircle, FaMapMarkerAlt } from 'react-icons/fa';

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
    <div className="admin-layout-container">
      <div className="admin-section-table d-flex flex-column h-100">
        
        {/* HEADER DE DATOS (ELEGANTE Y SIMPLE) */}
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
          <div className="d-flex gap-2">
            <div className="info-pill sede-pill">
              <FaMapMarkerAlt className="icon" />
              <span className="label">SEDE</span>
              <span className="value">{currentSedeName}</span>
            </div>
            <div className="info-pill user-pill">
              <FaUserCircle className="icon" />
              <span className="label">CONTROLADOR</span>
              <span className="value">{userName}</span>
            </div>
          </div>
          <Button 
            variant="primary" 
            size="sm"
            className="px-4 fw-bold text-uppercase"
            onClick={handleSave}
            disabled={isSaving || Object.keys(draftInventory).length === 0}
          >
            {isSaving ? UI_TEXTS.LOADING : `SINCRONIZAR (${Object.keys(draftInventory).length})`}
          </Button>
        </div>

        {/* BUSCADOR FIJO */}
        <div className="mb-3">
          <InputGroup size="sm" className="custom-search-group">
            <InputGroup.Text><FaSearch /></InputGroup.Text>
            <Form.Control
              placeholder="Escribe el nombre del producto o SAP..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </InputGroup>
        </div>

        {/* AREA DE INVENTARIO CON SCROLL INTERNO */}
        <div className="flex-grow-1 overflow-auto pe-2 custom-scrollbar">
          <Row className="g-2 m-0">
            {filteredProducts.map(product => {
              const inv = draftInventory[product.id] || inventory[product.id] || { almacen: 0, consignacion: 0, rechazo: 0 };
              const isDirty = !!draftInventory[product.id];

              return (
                <Col key={product.id} xs={12} sm={6} lg={4} className="p-1">
                  <div 
                    className={`product-card ${isDirty ? 'dirty' : ''}`}
                    onClick={() => setSelectedProduct(product)}
                  >
                    <div className="product-card-info">
                      <span className="product-sap">{product.sap}</span>
                      <div className="product-name">{product.nombre}</div>
                      {isDirty && <span className="pending-indicator">PENDIENTE</span>}
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
                    </div>
                  </div>
                </Col>
              );
            })}
          </Row>
          {filteredProducts.length === 0 && (
            <div className="text-center py-5 opacity-50 italic">No se encontraron productos...</div>
          )}
        </div>
      </div>

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
              <h5 className="fw-bold mb-0 text-primary">{selectedProduct.nombre}</h5>
              <small className="text-muted">SAP: {selectedProduct.sap} | Empaque: {selectedProduct.unidades} uds</small>
            </div>

            <div className="d-flex flex-column gap-3">
              {['almacen', 'consignacion', 'rechazo'].map((field) => {
                const currentVal = (draftInventory[selectedProduct.id] || inventory[selectedProduct.id] || { almacen: 0, consignacion: 0, rechazo: 0 })[field as keyof InventoryEntry];
                
                return (
                  <div key={field} className="modal-field-group">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <span className="text-uppercase fw-bold small opacity-75">
                        {field === 'almacen' ? 'Conteo Almacén' : field === 'consignacion' ? 'Consignación' : 'Rechazo'}
                      </span>
                      <span className="h4 mb-0 fw-bold">{currentVal}</span>
                    </div>

                    <div className="modal-actions">
                      <Button 
                        variant="secondary" 
                        size="sm"
                        onClick={() => handleUpdateDraft(selectedProduct.id, field as keyof InventoryEntry, currentVal + selectedProduct.unidades)}
                      >
                        +{selectedProduct.unidades} (PAQ)
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
              CONFIRMAR CONTEO
            </Button>
          </Modal.Body>
        )}
      </Modal>

      <style>{`
        /* Pills de datos elegantes */
        .info-pill {
          display: flex;
          align-items: center;
          padding: 4px 12px;
          gap: 8px;
          border: 1px solid var(--theme-border-default);
          background-color: var(--theme-background-secondary);
        }
        .info-pill .icon {
          font-size: 0.9rem;
          color: var(--color-red-primary);
        }
        .info-pill .label {
          font-size: 0.65rem;
          font-weight: 800;
          opacity: 0.5;
        }
        .info-pill .value {
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--theme-text-primary);
        }
        .sede-pill {
          border-left: 3px solid var(--color-red-primary) !important;
        }

        /* Buscador */
        .custom-search-group .input-group-text {
          background-color: transparent !important;
          border-right: none !important;
          opacity: 0.5;
        }

        /* Scrollbar Personalizado */
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }

        /* Tarjetas de Producto */
        .product-card {
          border: 1px solid var(--theme-border-default) !important;
          background-color: var(--theme-background-primary);
          padding: 8px 12px;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          justify-content: space-between;
          align-items: center;
          height: 100%;
        }
        .product-card:hover {
          border-color: var(--color-red-primary) !important;
          background-color: var(--theme-background-secondary);
        }
        .product-card.dirty {
          border-left: 3px solid #ffc107 !important;
        }
        .product-card-info {
          flex: 1;
          min-width: 0;
        }
        .product-sap {
          font-size: 0.65rem;
          font-weight: bold;
          color: var(--color-red-primary);
        }
        .product-name {
          font-weight: bold;
          font-size: 0.85rem;
          color: var(--theme-text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .pending-indicator {
          font-size: 0.55rem;
          background: #ffc107;
          color: #000;
          padding: 0px 4px;
          font-weight: 900;
        }
        .product-card-stats {
          display: flex;
          gap: 4px;
        }
        .stat-box {
          background-color: var(--theme-background-secondary);
          padding: 2px 6px;
          text-align: center;
          min-width: 40px;
          border: 1px solid var(--theme-border-default);
        }
        .stat-label {
          display: block;
          font-size: 0.55rem;
          font-weight: bold;
          opacity: 0.5;
        }
        .stat-value {
          font-weight: 800;
          font-size: 0.75rem;
        }

        /* Modal */
        .inventory-modal .modal-content {
          background-color: var(--theme-background-primary) !important;
          border: 1px solid var(--theme-border-default) !important;
        }
        .modal-field-group {
          border-bottom: 1px solid var(--theme-border-default);
          padding-bottom: 12px;
        }
        .modal-actions {
          display: grid;
          grid-template-columns: 2fr 1fr 1fr 1fr;
          gap: 6px;
        }
      `}</style>
    </div>
  );
};

export default AlmacenPage;
