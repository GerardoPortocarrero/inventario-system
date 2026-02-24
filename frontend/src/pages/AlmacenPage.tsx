import type { FC } from 'react';
import { useState, useEffect, useMemo } from 'react';
import { Row, Col, Button, Form, Modal, InputGroup, Badge, Spinner } from 'react-bootstrap';
import { db } from '../api/firebase';
import { collection, onSnapshot, doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import GlobalSpinner from '../components/GlobalSpinner';
import { FaMapMarkerAlt, FaCalendarAlt, FaSync, FaCheck } from 'react-icons/fa';

interface Product {
  id: string;
  nombre: string;
  sap: string;
  unidades: number;
}

interface InventoryEntry {
  almacen: number;
  consignacion: number;
  rechazo: number;
}

const AlmacenPage: FC = () => {
  const { userSedeId, userName } = useAuth();
  const { sedes, loadingMasterData } = useData();
  
  const [products, setProducts] = useState<Product[]>([]);
  const [dailyInventory, setDailyInventory] = useState<Record<string, InventoryEntry>>({});
  const [draftInventory, setDraftInventory] = useState<Record<string, InventoryEntry>>({});
  
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [tempBoxes, setTempBoxes] = useState<Record<string, number>>({ almacen: 0, consignacion: 0, rechazo: 0 });
  const [tempUnits, setTempUnits] = useState<Record<string, number>>({ almacen: 0, consignacion: 0, rechazo: 0 });

  const currentSedeName = useMemo(() => sedes.find(s => s.id === userSedeId)?.nombre || 'Sede...', [sedes, userSedeId]);

  useEffect(() => {
    const unsubProducts = onSnapshot(collection(db, 'productos'), (s) => {
      setProducts(s.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
    });
    return () => unsubProducts();
  }, []);

  useEffect(() => {
    if (!userSedeId || !selectedDate) return;
    setLoading(true);
    const docId = `${userSedeId}_${selectedDate}`;
    const unsubDaily = onSnapshot(doc(db, 'inventario_diario', docId), (s) => {
      if (s.exists()) {
        setDailyInventory(s.data().productos || {});
      } else {
        setDailyInventory({});
      }
      setDraftInventory({});
      setLoading(false);
    });
    return () => unsubDaily();
  }, [userSedeId, selectedDate]);

  const sortedProducts = useMemo(() => {
    const list = products.filter(p => p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || p.sap.includes(searchTerm));
    return [...list].sort((a, b) => {
      const aDirty = draftInventory.hasOwnProperty(a.id);
      const bDirty = draftInventory.hasOwnProperty(b.id);
      if (aDirty && !bDirty) return -1;
      if (!aDirty && bDirty) return 1;
      return a.nombre.localeCompare(b.nombre);
    });
  }, [products, searchTerm, draftInventory]);

  const formatQty = (totalUnits: number, unitsPerBox: number) => {
    const boxes = Math.floor(totalUnits / unitsPerBox);
    const units = totalUnits % unitsPerBox;
    return `${boxes}-${units}`;
  };

  const handleOpenModal = (product: Product) => {
    const inv = draftInventory[product.id] || dailyInventory[product.id] || { almacen: 0, consignacion: 0, rechazo: 0 };
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
    if (!userSedeId || Object.keys(draftInventory).length === 0) return;
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      const docId = `${userSedeId}_${selectedDate}`;
      const finalData = { ...dailyInventory, ...draftInventory };
      await setDoc(doc(db, 'inventario_diario', docId), {
        sedeId: userSedeId, fecha: selectedDate, productos: finalData, actualizadoPor: userName, timestamp: serverTimestamp()
      }, { merge: true });

      const todayStr = new Date().toISOString().split('T')[0];
      if (selectedDate === todayStr) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        const yesterdayDoc = await getDoc(doc(db, 'inventario_diario', `${userSedeId}_${yesterdayStr}`));
        if (yesterdayDoc.exists()) {
          const ayerData = yesterdayDoc.data().productos || {};
          const transitoMap: Record<string, number> = {};
          let hasTransit = false;
          Object.keys(draftInventory).forEach(pid => {
            const totalAyer = (ayerData[pid]?.almacen || 0) + (ayerData[pid]?.consignacion || 0) + (ayerData[pid]?.rechazo || 0);
            const almacenHoy = draftInventory[pid].almacen;
            const diff = totalAyer - almacenHoy;
            if (diff > 0) { transitoMap[pid] = diff; hasTransit = true; }
          });
          if (hasTransit) {
            await setDoc(doc(db, 'transito', `${userSedeId}_${selectedDate}`), {
              sedeId: userSedeId, fecha: selectedDate, productos: transitoMap, timestamp: serverTimestamp()
            });
          }
        }
      }
      setDraftInventory({});
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 1500);
    } catch (e) { console.error(e); } finally { setIsSaving(false); }
  };

  const handleNumberInputChange = (field: string, subField: 'boxes' | 'units', value: string) => {
    if (!selectedProduct) return;
    const numericValue = value === '' ? 0 : parseInt(value, 10);
    const empaque = selectedProduct.unidades;
    if (subField === 'boxes') {
      setTempBoxes(prev => ({ ...prev, [field]: numericValue }));
    } else {
      if (numericValue >= empaque) {
        const extraBoxes = Math.floor(numericValue / empaque);
        const remainingUnits = numericValue % empaque;
        setTempBoxes(prev => ({ ...prev, [field]: (prev[field as keyof typeof tempBoxes] || 0) + extraBoxes }));
        setTempUnits(prev => ({ ...prev, [field]: remainingUnits }));
      } else {
        setTempUnits(prev => ({ ...prev, [field]: numericValue }));
      }
    }
  };

  if (loadingMasterData) return <GlobalSpinner variant="overlay" />;

  return (
    <div className="admin-layout-container overflow-hidden">
      <div className="admin-section-table d-flex flex-column h-100 overflow-hidden">
        
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
          <div className="d-flex flex-wrap gap-2">
            <div className="info-pill-new">
              <span className="pill-icon sede-icon"><FaMapMarkerAlt /></span>
              <div className="pill-content"><span className="pill-label">SEDE ACTUAL</span><span className="pill-value">{currentSedeName}</span></div>
            </div>
            <div className="info-pill-new">
              <span className="pill-icon date-icon"><FaCalendarAlt className="calendar-icon-highlight" /></span>
              <div className="pill-content">
                <span className="pill-label">FECHA DE INVENTARIO</span>
                <Form.Control type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="pill-date-input" />
              </div>
            </div>
          </div>
          <Button variant={saveSuccess ? "success" : "primary"} size="sm" className="px-3 d-flex align-items-center gap-2" onClick={handleSave} disabled={isSaving || (Object.keys(draftInventory).length === 0 && !saveSuccess)}>
            {isSaving ? <Spinner as="span" animation="border" size="sm" /> : saveSuccess ? <FaCheck /> : <FaSync />}
            {Object.keys(draftInventory).length > 0 && !saveSuccess && !isSaving && <span className="fw-bold">({Object.keys(draftInventory).length})</span>}
          </Button>
        </div>

        <div className="mb-3">
          <InputGroup size="sm" className="custom-search-group">
            <Form.Control placeholder="Escribe el nombre del producto o SAP..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="border-start" />
          </InputGroup>
        </div>

        <div className="flex-grow-1 overflow-auto pe-1 custom-scrollbar overflow-x-hidden">
          {loading ? <div className="text-center py-5 text-muted">Cargando hoja del día...</div> : (
            <Row className="g-2 m-0">
              {sortedProducts.map(product => {
                const inv = draftInventory[product.id] || dailyInventory[product.id] || { almacen: 0, consignacion: 0, rechazo: 0 };
                const isDirty = draftInventory.hasOwnProperty(product.id);
                return (
                  <Col key={product.id} xs={12} sm={6} lg={4} className="p-1">
                    <div className={`product-card ${isDirty ? 'dirty' : ''}`} onClick={() => handleOpenModal(product)}>
                      <div className="product-card-info">
                        <span className="product-sap">{product.sap}</span>
                        <div className="product-name">{product.nombre}</div>
                        {isDirty && <span className="pending-indicator">PENDIENTE</span>}
                      </div>
                      <div className="product-card-stats">
                        <div className={`stat-box ${inv.almacen > 0 ? 'has-data' : ''}`}>
                          <span className="stat-label">ALM</span>
                          <span className="stat-value">{formatQty(inv.almacen, product.unidades)}</span>
                        </div>
                        <div className={`stat-box ${inv.consignacion > 0 ? 'has-data' : ''}`}>
                          <span className="stat-label">CON</span>
                          <span className="stat-value">{formatQty(inv.consignacion, product.unidades)}</span>
                        </div>
                      </div>
                    </div>
                  </Col>
                );
              })}
            </Row>
          )}
        </div>
      </div>

      <Modal show={!!selectedProduct} onHide={() => setSelectedProduct(null)} centered className="inventory-modal-v3">
        {selectedProduct && (
          <Modal.Body className="p-0 overflow-hidden">
            <div className="modal-header-v3">
              <h5 className="mb-2 fw-bold text-uppercase">{selectedProduct.nombre}</h5>
              <div className="d-flex gap-4">
                <div className="d-flex flex-column"><span className="label-v3-header text-white-50 small fw-bold">CÓDIGO SAP</span><span className="value-v3-header text-white fw-bold">{selectedProduct.sap}</span></div>
                <div className="d-flex flex-column"><span className="label-v3-header text-white-50 small fw-bold">EMPAQUE</span><span className="value-v3-header text-white fw-bold">{selectedProduct.unidades}</span></div>
              </div>
            </div>
            <div className="p-3">
              {['almacen', 'consignacion', 'rechazo'].map((field) => (
                <div key={field} className="field-group-v3 mb-3">
                  <div className="group-title-v3 d-flex justify-content-between align-items-center">
                    <span className="text-uppercase small fw-bold">{field === 'almacen' ? 'Conteo Almacén' : field === 'consignacion' ? 'Consignación' : 'Rechazo'}</span>
                    <Badge bg="danger" className="border-radius-0 fs-6 px-3">{tempBoxes[field]} C / {tempUnits[field]} U</Badge>
                  </div>
                  <div className="p-0">
                    <Row className="g-2">
                      <Col xs={6}><Form.Label className="label-v3">CAJAS</Form.Label><Form.Control type="number" value={tempBoxes[field] === 0 ? '' : tempBoxes[field]} placeholder="0" onChange={(e) => handleNumberInputChange(field, 'boxes', e.target.value)} onFocus={(e) => e.target.select()} className="input-v3" /></Col>
                      <Col xs={6}><Form.Label className="label-v3">UNIDADES</Form.Label><Form.Control type="number" value={tempUnits[field] === 0 ? '' : tempUnits[field]} placeholder="0" onChange={(e) => handleNumberInputChange(field, 'units', e.target.value)} onFocus={(e) => e.target.select()} className="input-v3" /></Col>
                    </Row>
                  </div>
                </div>
              ))}
              <Button variant="primary" className="w-100 py-2 fw-bold text-uppercase" onClick={handleConfirmEntry}>Confirmar Cambios</Button>
            </div>
          </Modal.Body>
        )}
      </Modal>

      <style>{`
        .admin-layout-container, .admin-section-table { overflow-x: hidden !important; max-width: 100vw; }
        .info-pill-new { display: flex; align-items: center; background-color: var(--theme-background-secondary); border: 1px solid var(--theme-border-default); overflow: hidden; }
        .pill-icon { padding: 8px 10px; display: flex; align-items: center; justify-content: center; font-size: 1rem; }
        .sede-icon { background-color: #007bff; color: white; }
        .date-icon { background-color: var(--theme-background-secondary); border-right: 1px solid var(--theme-border-default); }
        .calendar-icon-highlight { font-size: 1.2rem; color: var(--color-red-primary); }
        .pill-content { padding: 2px 10px; display: flex; flex-direction: column; line-height: 1.1; }
        .pill-label { font-size: 0.55rem; font-weight: 800; opacity: 0.6; }
        .pill-value { font-size: 0.75rem; font-weight: 700; color: var(--theme-text-primary); }
        .pill-date-input { background: transparent !important; border: none !important; color: var(--theme-text-primary) !important; font-weight: 700 !important; font-size: 0.75rem !important; padding: 0 !important; height: auto !important; cursor: pointer; }
        .pill-date-input::-webkit-calendar-picker-indicator {
          filter: invert(1) brightness(100%);
          cursor: pointer;
          margin-left: 5px;
          transform: scale(1.2);
        }
        .custom-search-group .form-control { border-left: 1px solid var(--theme-border-default) !important; padding-left: 10px !important; }
        
        .product-card { border: 1px solid var(--theme-border-default) !important; background-color: var(--theme-background-primary); padding: 8px 12px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; height: 100%; transition: none !important; }
        .product-card:hover { border-color: var(--color-red-primary) !important; }
        .product-card.dirty { border-left: 3px solid #ffc107 !important; background: rgba(255, 193, 7, 0.05); }
        .product-card-info { flex: 1; min-width: 0; }
        .product-sap { font-size: 0.65rem; font-weight: bold; color: var(--color-red-primary); }
        .product-name { font-weight: bold; font-size: 0.85rem; color: var(--theme-text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .pending-indicator { font-size: 0.55rem; background: #ffc107; color: #000; padding: 0px 4px; font-weight: 900; }
        
        .product-card-stats { display: flex; gap: 4px; }
        .stat-box { background-color: var(--theme-background-secondary); padding: 2px 6px; text-align: center; min-width: 40px; border: 1px solid var(--theme-border-default); transition: all 0.2s ease; }
        .stat-box.has-data { background-color: rgba(0, 123, 255, 0.1); border-color: #007bff50; color: #007bff; }
        .stat-label { display: block; font-size: 0.55rem; font-weight: bold; opacity: 0.5; }
        .stat-value { font-weight: 800; font-size: 0.75rem; }

        .inventory-modal-v3 .modal-content { background-color: #1a1a1a !important; border: 1px solid #444 !important; color: white !important; }
        .modal-header-v3 { background-color: var(--color-red-primary); padding: 12px 20px; color: white; border-bottom: 2px solid rgba(0,0,0,0.1); }
        .label-v3 { font-size: 0.6rem; font-weight: 800; color: #777; margin-bottom: 2px; text-transform: uppercase; }
        .input-v3 { background: #111 !important; border: none !important; border-bottom: 2px solid #444 !important; color: white !important; font-weight: 900 !important; font-size: 1.1rem !important; text-align: center; }
        .input-v3:focus { border-color: var(--color-red-primary) !important; }
        .border-radius-0 { border-radius: 0 !important; }
      `}</style>
    </div>
  );
};

export default AlmacenPage;
