import type { FC } from 'react';
import { useState, useEffect, useMemo } from 'react';
import { Row, Col, Button, Form, Modal, Badge, Spinner, Alert } from 'react-bootstrap';
import { db } from '../api/firebase';
import { collection, onSnapshot, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import GlobalSpinner from '../components/GlobalSpinner';
import { FaCalendarAlt, FaSync, FaCheck, FaListAlt, FaEdit, FaExclamationTriangle, FaWarehouse, FaGlassMartiniAlt } from 'react-icons/fa';
import GenericTable, { type Column } from '../components/GenericTable';
import SearchInput from '../components/SearchInput';

interface Product {
  id: string;
  nombre: string;
  sap: string;
  basis: string;
  unidades: number;
}

interface InventoryEntry {
  almacen: number;
  consignacion: number;
  rechazo: number;
}

const AlmacenPage: FC = () => {
  const { userSedeId, userName } = useAuth();
  const { beverageTypes, loadingMasterData } = useData();
  
  const [products, setProducts] = useState<Product[]>([]);
  const [dailyInventory, setTodayInventory] = useState<Record<string, InventoryEntry>>({});
  const [yesterdayInventory, setYesterdayInventory] = useState<Record<string, InventoryEntry>>({});
  const [draftInventory, setDraftInventory] = useState<Record<string, InventoryEntry>>({});
  
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBeverageType, setSelectedBeverageType] = useState<string>('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [viewMode, setViewMode] = useState<'edit' | 'summary'>('edit');

  const [tempBoxes, setTempBoxes] = useState<Record<string, number>>({ almacen: 0, consignacion: 0, rechazo: 0 });
  const [tempUnits, setTempUnits] = useState<Record<string, number>>({ almacen: 0, consignacion: 0, rechazo: 0 });

  const yesterdayStr = useMemo(() => {
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  }, [selectedDate]);

  useEffect(() => {
    const unsubProducts = onSnapshot(collection(db, 'productos'), (s) => {
      setProducts(s.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
    });
    return () => unsubProducts();
  }, []);

  useEffect(() => {
    if (!userSedeId || !selectedDate) return;
    setLoading(true);
    
    const unsubToday = onSnapshot(doc(db, 'inventario_diario', `${userSedeId}_${selectedDate}`), (s) => {
      setTodayInventory(s.exists() ? s.data().productos || {} : {});
      setDraftInventory({});
      setLoading(false);
    });

    const unsubYesterday = onSnapshot(doc(db, 'inventario_diario', `${userSedeId}_${yesterdayStr}`), (s) => {
      setYesterdayInventory(s.exists() ? s.data().productos || {} : {});
    });

    return () => { unsubToday(); unsubYesterday(); };
  }, [userSedeId, selectedDate, yesterdayStr]);

  const processedData = useMemo(() => {
    return products.map(p => {
      const hoy = draftInventory[p.id] || dailyInventory[p.id] || { almacen: 0, consignacion: 0, rechazo: 0 };
      const ayer = yesterdayInventory[p.id] || { almacen: 0, consignacion: 0, rechazo: 0 };
      const totalAyer = ayer.almacen + ayer.consignacion + ayer.rechazo;
      const transito = Math.max(0, totalAyer - hoy.almacen);
      const inventarioTotal = hoy.almacen + hoy.consignacion + hoy.rechazo;

      return {
        ...p,
        ...hoy,
        transito,
        inventarioTotal,
        hasData: inventarioTotal > 0 || transito > 0 || dailyInventory.hasOwnProperty(p.id)
      };
    });
  }, [products, dailyInventory, draftInventory, yesterdayInventory]);

  const totals = useMemo(() => {
    return processedData.reduce((acc, curr) => ({
      transito: acc.transito + curr.transito,
      inventario: acc.inventario + curr.inventarioTotal
    }), { transito: 0, inventario: 0 });
  }, [processedData]);

  const sortedProducts = useMemo(() => {
    let list = processedData.filter(p => 
      (p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || p.sap.includes(searchTerm)) &&
      (selectedBeverageType === '' || (p as any).tipoBebidaId === selectedBeverageType)
    );
    return [...list].sort((a, b) => {
      const aDirty = draftInventory.hasOwnProperty(a.id);
      const bDirty = draftInventory.hasOwnProperty(b.id);
      if (aDirty && !bDirty) return -1;
      if (!aDirty && bDirty) return 1;
      return a.nombre.localeCompare(b.nombre);
    });
  }, [processedData, searchTerm, draftInventory, selectedBeverageType]);

  const summaryData = useMemo(() => {
    return processedData.filter(p => 
      p.hasData && 
      (selectedBeverageType === '' || (p as any).tipoBebidaId === selectedBeverageType)
    );
  }, [processedData, selectedBeverageType]);

  const formatQty = (totalUnits: number, unitsPerBox: number) => {
    const boxes = Math.floor(totalUnits / unitsPerBox);
    const units = totalUnits % unitsPerBox;
    return `${boxes}-${units}`;
  };

  const handleOpenModal = (product: any) => {
    setTempBoxes({
      almacen: Math.floor(product.almacen / product.unidades),
      consignacion: Math.floor(product.consignacion / product.unidades),
      rechazo: Math.floor(product.rechazo / product.unidades)
    });
    setTempUnits({
      almacen: product.almacen % product.unidades,
      consignacion: product.consignacion % product.unidades,
      rechazo: product.rechazo % product.unidades
    });
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
    try {
      const docId = `${userSedeId}_${selectedDate}`;
      const finalData = { ...dailyInventory, ...draftInventory };
      await setDoc(doc(db, 'inventario_diario', docId), {
        sedeId: userSedeId, fecha: selectedDate, productos: finalData, actualizadoPor: userName, timestamp: serverTimestamp()
      }, { merge: true });
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
        setTempBoxes(prev => ({ ...prev, [field]: (tempBoxes[field as keyof typeof tempBoxes] || 0) + extraBoxes }));
        setTempUnits(prev => ({ ...prev, [field]: remainingUnits }));
      } else {
        setTempUnits(prev => ({ ...prev, [field]: numericValue }));
      }
    }
  };

  const summaryColumns: Column<any>[] = [
    { header: 'PRODUCTO', render: (p) => (
      <div className="ps-2">
        <div className="fw-bold text-white small">{p.nombre}</div>
        <div className="text-secondary" style={{ fontSize: '0.65rem' }}>{p.sap} / {p.basis}</div>
      </div>
    )},
    { header: 'A / C / R', render: (p) => (
      <div className="text-light opacity-75 small">
        {formatQty(p.almacen, p.unidades)} / {formatQty(p.consignacion, p.unidades)} / {formatQty(p.rechazo, p.unidades)}
      </div>
    )},
    { header: 'TRÁNSITO', render: (p) => (
      <Badge bg={p.transito > 0 ? "warning" : "dark"} className={`border ${p.transito > 0 ? 'text-dark' : 'text-muted'}`}>
        {formatQty(p.transito, p.unidades)}
      </Badge>
    )},
    { header: 'INVENTARIO', render: (p) => (
      <Badge bg="dark" className="border text-white">
        {formatQty(p.inventarioTotal, p.unidades)}
      </Badge>
    )}
  ];

  if (loadingMasterData) return <GlobalSpinner variant="overlay" />;

  return (
    <div className="admin-layout-container overflow-hidden">
      <div className="admin-section-table d-flex flex-column h-100 overflow-hidden">
        
        {/* KPIs Operativos - Responsive Row */}
        <Row className="g-2 mb-3 px-1">
          <Col xs={6} md={3}>
            <div className="info-pill-new w-100">
              <span className="pill-icon pill-icon-sober highlight-system"><FaSync /></span>
              <div className="pill-content">
                <span className="pill-label">TRÁNSITO TOTAL</span>
                <span className="pill-value h6 mb-0">{loading ? '...' : totals.transito}</span>
              </div>
            </div>
          </Col>
          <Col xs={6} md={3}>
            <div className="info-pill-new w-100">
              <span className="pill-icon pill-icon-sober text-info"><FaWarehouse /></span>
              <div className="pill-content">
                <span className="pill-label">INVENTARIO TOTAL</span>
                <span className="pill-value h6 mb-0">{loading ? '...' : totals.inventario}</span>
              </div>
            </div>
          </Col>
          <Col xs={6} md={3}>
            <div className="info-pill-new w-100">
              <span className="pill-icon pill-icon-sober"><FaCalendarAlt /></span>
              <div className="pill-content">
                <span className="pill-label">FECHA INVENTARIO</span>
                <Form.Control type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="pill-date-input-v2" />
              </div>
            </div>
          </Col>
          <Col xs={6} md={3}>
            <div className="d-flex flex-column gap-1 h-100">
              <Button variant="outline-light" size="sm" className="w-100 h-50 d-flex align-items-center justify-content-center gap-2 py-1" onClick={() => setViewMode(viewMode === 'edit' ? 'summary' : 'edit')}>
                {viewMode === 'edit' ? <><FaListAlt /> RESUMEN</> : <><FaEdit /> EDICIÓN</>}
              </Button>
              <Button variant={saveSuccess ? "success" : "primary"} size="sm" className="w-100 h-50 d-flex align-items-center justify-content-center gap-2 py-1" onClick={handleSave} disabled={isSaving || (Object.keys(draftInventory).length === 0 && !saveSuccess)}>
                {isSaving ? <Spinner as="span" animation="border" size="sm" /> : saveSuccess ? <FaCheck /> : <FaSync />}
                {Object.keys(draftInventory).length > 0 && !saveSuccess && <span className="fw-bold">({Object.keys(draftInventory).length})</span>}
              </Button>
            </div>
          </Col>
        </Row>

        {!loading && Object.keys(dailyInventory).length === 0 && (
          <Alert variant="warning" className="py-2 px-3 border-0 shadow-sm mb-3 mx-1 d-flex align-items-center">
            <FaExclamationTriangle className="me-2" />
            <small className="fw-bold">Conteo de almacén pendiente para {selectedDate}.</small>
          </Alert>
        )}

        <Row className="mb-3 px-1 g-2">
          <Col xs={7} md={8}>
            <SearchInput 
              searchTerm={searchTerm} 
              onSearchChange={setSearchTerm} 
              placeholder="Buscar producto..." 
            />
          </Col>
          <Col xs={5} md={4}>
            <div className="info-pill-new w-100">
              <span className="pill-icon pill-icon-sober"><FaGlassMartiniAlt /></span>
              <div className="pill-content w-100">
                <span className="pill-label">TIPO BEBIDA</span>
                <Form.Select 
                  value={selectedBeverageType} 
                  onChange={(e) => setSelectedBeverageType(e.target.value)}
                  className="pill-select-v2"
                >
                  <option value="">TODOS</option>
                  {beverageTypes.map(type => (
                    <option key={type.id} value={type.id}>{type.nombre.toUpperCase()}</option>
                  ))}
                </Form.Select>
              </div>
            </div>
          </Col>
        </Row>

        <div className="flex-grow-1 overflow-auto pe-1 custom-scrollbar">
          {loading ? <div className="text-center py-5 text-muted">Sincronizando...</div> : (
            viewMode === 'edit' ? (
              <Row className="g-2 m-0">
                {sortedProducts.map(product => {
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
                          <div className={`stat-box ${product.almacen > 0 ? 'has-data' : ''}`}>
                            <span className="stat-label">ALM</span>
                            <span className="stat-value">{formatQty(product.almacen, product.unidades)}</span>
                          </div>
                          <div className={`stat-box ${product.consignacion > 0 ? 'has-data' : ''}`}>
                            <span className="stat-label">CON</span>
                            <span className="stat-value">{formatQty(product.consignacion, product.unidades)}</span>
                          </div>
                        </div>
                      </div>
                    </Col>
                  );
                })}
              </Row>
            ) : (
              <div className="sticky-table-container px-1">
                <GenericTable 
                  data={summaryData} 
                  columns={summaryColumns} 
                  variant={localStorage.getItem('theme') === 'dark' ? 'dark' : ''}
                  noRecordsMessage="No se encontraron registros con datos para esta fecha."
                />
              </div>
            )
          )}
        </div>
      </div>

      {/* Modal de Ingreso de Datos */}
      <Modal show={!!selectedProduct} onHide={() => setSelectedProduct(null)} centered className="inventory-modal-v3">
        {selectedProduct && (
          <Modal.Body className="p-0 overflow-hidden">
            <div className="modal-header-v3">
              <h5 className="mb-2 fw-bold text-uppercase">{selectedProduct.nombre}</h5>
              <div className="d-flex gap-4">
                <div className="d-flex flex-column">
                  <span className="label-v3-header text-white-50 small fw-bold">SAP</span>
                  <span className="value-v3-header text-white fw-bold">{selectedProduct.sap}</span>
                </div>
                <div className="d-flex flex-column">
                  <span className="label-v3-header text-white-50 small fw-bold">EMPAQUE</span>
                  <span className="value-v3-header text-white fw-bold">{selectedProduct.unidades} UNIDADES</span>
                </div>
              </div>
            </div>
            <div className="p-3">
              {['almacen', 'consignacion', 'rechazo'].map((field) => (
                <div key={field} className="field-group-v3 mb-3">
                  <div className="group-title-v3 d-flex justify-content-between align-items-center mb-1">
                    <span className="text-uppercase small fw-bold">{field === 'almacen' ? 'Conteo Almacén' : field === 'consignacion' ? 'Consignación' : 'Rechazo'}</span>
                    <Badge bg="danger" className="border-radius-0 fs-6 px-3">
                      {tempBoxes[field] || 0} C / {tempUnits[field] || 0} U
                    </Badge>
                  </div>
                  <Row className="g-2">
                    <Col xs={6}>
                      <Form.Label className="label-v3">CAJAS</Form.Label>
                      <Form.Control type="number" value={tempBoxes[field] || ''} placeholder="0" onChange={(e) => handleNumberInputChange(field, 'boxes', e.target.value)} onFocus={(e) => e.target.select()} className="input-v3" />
                    </Col>
                    <Col xs={6}>
                      <Form.Label className="label-v3">UNIDADES</Form.Label>
                      <Form.Control type="number" value={tempUnits[field] || ''} placeholder="0" onChange={(e) => handleNumberInputChange(field, 'units', e.target.value)} onFocus={(e) => e.target.select()} className="input-v3" />
                    </Col>
                  </Row>
                </div>
              ))}
              <Button variant="primary" className="w-100 py-2 fw-bold text-uppercase" onClick={handleConfirmEntry}>Confirmar Cambios</Button>
            </div>
          </Modal.Body>
        )}
      </Modal>

      <style>{`
        .admin-layout-container { max-height: calc(100vh - 70px); }
        .info-pill-new { display: flex; align-items: center; background-color: var(--theme-background-secondary); border: 1px solid var(--theme-border-default); overflow: hidden; border-radius: 4px; height: 100%; }
        .pill-icon { padding: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.1rem; }
        .pill-icon-sober { background-color: var(--theme-icon-bg); color: var(--theme-icon-color); border-right: 1px solid var(--theme-border-default); height: 100% !important; }
        .pill-icon-sober.highlight-system { color: var(--color-red-primary); }
        .pill-content { padding: 4px 12px; display: flex; flex-direction: column; justify-content: center; }
        .pill-label { font-size: 0.55rem; font-weight: 800; opacity: 0.6; text-uppercase: uppercase; color: var(--theme-text-primary); }
        .pill-value { color: var(--theme-text-primary); font-family: 'Inter', sans-serif; font-weight: bold; }
        
        .pill-date-input-v2 { 
          background: transparent !important; border: none !important; color: var(--theme-text-primary) !important; 
          font-weight: 700 !important; font-size: 0.85rem !important; padding: 0 !important; height: auto !important; cursor: pointer;
          width: 100% !important;
        }
        .pill-date-input-v2::-webkit-calendar-picker-indicator { 
          filter: invert(var(--theme-calendar-invert, 1)); 
          cursor: pointer;
          transform: scale(1.5);
          margin-left: 10px;
        }

        .pill-select-v2 {
          background: transparent !important;
          border: none !important;
          color: var(--theme-text-primary) !important;
          font-weight: 700 !important;
          font-size: 0.75rem !important;
          padding: 0 !important;
          height: auto !important;
          cursor: pointer;
          width: 100% !important;
          text-transform: uppercase;
        }
        .pill-select-v2 option {
          background-color: var(--theme-background-secondary) !important;
          color: var(--theme-text-primary) !important;
        }

        .product-card { border: 1px solid var(--theme-border-default); background: var(--theme-background-primary); padding: 8px 12px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; height: 100%; transition: all 0.2s ease; min-height: 80px; }
        .product-card:hover { border-color: var(--color-red-primary); }
        .product-card.dirty { border-left: 3px solid #ffc107; background: rgba(255, 193, 7, 0.05); }
        
        .product-card-info { flex: 1; min-width: 0; padding-right: 10px; }
        .product-name { 
          font-weight: bold; 
          font-size: 0.85rem; 
          color: var(--theme-text-primary); 
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          text-overflow: ellipsis;
          line-height: 1.2;
          margin-bottom: 2px;
        }
        .product-sap { font-size: 0.65rem; color: var(--color-red-primary); font-weight: bold; display: block; }
        .pending-indicator { font-size: 0.55rem; background: #ffc107; color: #000; padding: 0px 4px; font-weight: 900; }
        
        .product-card-stats { display: flex; gap: 4px; }
        .stat-box { background: var(--theme-background-secondary); padding: 2px 6px; text-align: center; min-width: 40px; border: 1px solid var(--theme-border-default); transition: all 0.2s ease; }
        .stat-box.has-data { background-color: rgba(0, 123, 255, 0.1); border-color: #007bff50; color: #007bff; }
        .stat-label { display: block; font-size: 0.55rem; font-weight: bold; opacity: 0.5; }
        .stat-value { font-weight: 800; font-size: 0.75rem; }

        /* CABECERA DE TABLA DE RESUMEN - IGUAL A CRUD */
        .sticky-table-container thead th { 
          background-color: transparent !important;
          color: var(--theme-text-secondary) !important; 
          border-bottom: 1px solid var(--theme-table-border-color) !important;
          font-size: 0.85rem;
          padding: 12px 15px;
          font-weight: 500;
          text-align: left;
        }

        .inventory-modal-v3 .modal-content { background: var(--theme-background-primary) !important; border: 1px solid var(--theme-border-default) !important; color: var(--theme-text-primary) !important; }
        .modal-header-v3 { background: var(--color-red-primary); padding: 15px; color: white; }
        .input-v3 { background: var(--theme-background-secondary) !important; border: none !important; border-bottom: 2px solid var(--theme-border-default) !important; color: var(--theme-text-primary) !important; font-weight: bold; text-align: center; font-size: 1.2rem; }
        .input-v3:focus { border-color: var(--color-red-primary) !important; }
        .label-v3 { font-size: 0.6rem; font-weight: 800; color: var(--theme-text-secondary); text-transform: uppercase; margin-bottom: 2px; }
        .border-radius-0 { border-radius: 0 !important; }

        @media (max-width: 768px) {
          .admin-section-table { padding: 0.5rem; }
          .info-pill-new { margin-bottom: 0.25rem; }
        }
      `}</style>
    </div>
  );
};

export default AlmacenPage;
