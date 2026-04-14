import type { FC } from 'react';
import { useState, useEffect, useMemo } from 'react';
import { Row, Col, Form, Badge, Accordion, ListGroup } from 'react-bootstrap';
import { db, rtdb } from '../api/firebase';
import { collection, onSnapshot, query, where, getDocs } from 'firebase/firestore';
import { ref, onValue } from 'firebase/database';
import { useData } from '../context/DataContext';
import { SPINNER_VARIANTS } from '../constants';
import { 
  FaShoppingCart, FaChartLine, FaWarehouse, FaBox, FaFilter, FaGlassMartiniAlt, FaChevronRight
} from 'react-icons/fa';
import GlobalSpinner from '../components/GlobalSpinner';

interface Product { id: string; nombre: string; sap: string; tipoBebidaId: string; precio: number; unidades: number; mililitros: number; }
interface Order { id: string; preventistaId: string; sedeId: string; fechaCreacion: string; detalles: { productoId: string; cantidad: number; }[]; }
interface User { id: string; nombre: string; rolId: string; sedeId: string; }
interface DailyInventory { id: string; productos: Record<string, { almacen: number; consignacion: number; rechazo: number; }>; }

type ReportType = 'VOLUMEN' | 'EFICIENCIA' | 'DIAGEO' | 'ACL';

const SupervisorPage: FC = () => {
  const [isDarkMode, setIsDarkMode] = useState(() => document.body.classList.contains('theme-dark'));
  const { sedes, beverageTypes, loadingMasterData } = useData();

  const [products, setProducts] = useState<Product[]>([]);
  const [ordersToday, setOrdersToday] = useState<Order[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [allInventory, setAllInventory] = useState<Record<string, DailyInventory>>({});
  const [yesterdayInventory, setYesterdayInventory] = useState<Record<string, DailyInventory>>({});
  
  const [maestroData, setMaestroData] = useState<any[]>([]);
  const [demandaData, setDemandaData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedSedeId, setSelectedSedeId] = useState<string>('GLOBAL');
  const [selectedReportType, setSelectedReportType] = useState<ReportType>('VOLUMEN');
  
  const [expandedRutas, setExpandedRutas] = useState<Record<string, boolean>>({});

  const yesterdayStr = useMemo(() => {
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  }, [selectedDate]);

  useEffect(() => {
    const observer = new MutationObserver(() => setIsDarkMode(document.body.classList.contains('theme-dark')));
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setLoading(true);
    const unsubProducts = onSnapshot(collection(db, 'productos'), s => setProducts(s.docs.map(d => ({ id: d.id, ...d.data() } as Product))));
    const unsubUsers = onSnapshot(collection(db, 'usuarios'), s => setUsers(s.docs.map(d => ({ id: d.id, ...d.data() } as User))));
    
    const unsubOrdersToday = onSnapshot(query(collection(db, 'ordenes'), where('fechaCreacion', '==', selectedDate)), s => setOrdersToday(s.docs.map(d => ({ id: d.id, ...d.data() } as Order))));

    const fetchInventories = async () => {
      const qToday = query(collection(db, 'inventario_diario'), where('fecha', '==', selectedDate));
      const qYesterday = query(collection(db, 'inventario_diario'), where('fecha', '==', yesterdayStr));
      const [snapToday, snapYesterday] = await Promise.all([getDocs(qToday), getDocs(qYesterday)]);
      
      const invToday: Record<string, DailyInventory> = {};
      snapToday.docs.forEach(d => { invToday[d.data().sedeId] = { id: d.id, productos: d.data().productos || {} }; });
      const invYesterday: Record<string, DailyInventory> = {};
      snapYesterday.docs.forEach(d => { invYesterday[d.data().sedeId] = { id: d.id, productos: d.data().productos || {} }; });

      setAllInventory(invToday);
      setYesterdayInventory(invYesterday);
      setLoading(false);
    };

    fetchInventories();

    const maestroRef = ref(rtdb, 'maestro/data');
    const demandaRef = ref(rtdb, 'demanda/data');

    const unsubMaestro = onValue(maestroRef, (snapshot) => {
      setMaestroData(snapshot.exists() ? snapshot.val() : []);
    });

    const unsubDemanda = onValue(demandaRef, (snapshot) => {
      setDemandaData(snapshot.exists() ? snapshot.val() : []);
    });

    return () => { 
      unsubProducts(); 
      unsubUsers(); 
      unsubOrdersToday(); 
      unsubMaestro();
      unsubDemanda();
    };
  }, [selectedDate, yesterdayStr]);

  const volumenHierarchicalData = useMemo(() => {
    if (!maestroData.length || !demandaData.length || !products.length) return [];

    const productMap = products.reduce((acc, p) => ({ ...acc, [p.sap]: p }), {} as Record<string, Product>);
    const maestroMap = maestroData.reduce((acc, m) => ({ ...acc, [String(m.Codigo)]: m }), {} as Record<string, any>);

    const UNIT_CASE_ML = 5677.92;

    const hier: Record<string, any> = {};

    demandaData.forEach(d => {
      const prod = productMap[String(d.Material)];
      const client = maestroMap[String(d.Solicitante)];
      
      if (!prod || !client) return;

      const loc = client.Loc || 'OTRO';
      const mesa = client['Mesa Com'] || client['MESA COM'] || 'SIN MESA';
      const ruta = client['Ruta com'] || client['RUTA COM'] || 'SIN RUTA';

      if (selectedSedeId !== 'GLOBAL') {
        const sede = sedes.find(s => s.id === selectedSedeId);
        if (sede && loc !== sede.codigo) return;
      }

      let totalUnits = 0;
      const cant = Number(d.Cantidad) || 0;
      if (d.Medida === 'CAJ') totalUnits = cant * (prod.unidades || 1);
      else totalUnits = cant;

      const physicalBoxes = totalUnits / (prod.unidades || 1);
      const unitCases = (totalUnits * (prod.mililitros || 0)) / UNIT_CASE_ML;

      if (!hier[loc]) {
        hier[loc] = { nombre: sedes.find(s => s.codigo === loc)?.nombre || loc, totalCF: 0, totalUC: 0, mesas: {} };
      }
      
      if (!hier[loc].mesas[mesa]) {
        hier[loc].mesas[mesa] = { totalCF: 0, totalUC: 0, rutas: {} };
      }

      if (!hier[loc].mesas[mesa].rutas[ruta]) {
        hier[loc].mesas[mesa].rutas[ruta] = { totalCF: 0, totalUC: 0, productos: {} };
      }

      const rutaObj = hier[loc].mesas[mesa].rutas[ruta];
      rutaObj.totalCF += physicalBoxes;
      rutaObj.totalUC += unitCases;
      
      if (!rutaObj.productos[prod.sap]) {
        rutaObj.productos[prod.sap] = { nombre: prod.nombre, cantU: 0, cantC: 0 };
      }
      rutaObj.productos[prod.sap].cantU += totalUnits;
      rutaObj.productos[prod.sap].cantC += physicalBoxes;

      hier[loc].totalCF += physicalBoxes;
      hier[loc].totalUC += unitCases;
      hier[loc].mesas[mesa].totalCF += physicalBoxes;
      hier[loc].mesas[mesa].totalUC += unitCases;
    });

    return Object.entries(hier).map(([id, data]) => ({ id, ...data }));
  }, [maestroData, demandaData, products, selectedSedeId, sedes]);

  const toggleRuta = (rutaKey: string) => {
    setExpandedRutas(prev => ({ ...prev, [rutaKey]: !prev[rutaKey] }));
  };

  const renderVolumenReport = () => (
    <div className="volumen-compact-view">
      {volumenHierarchicalData.length === 0 ? (
        <div className="text-center p-5 text-muted small fw-bold">NO HAY DATOS DE VOLUMEN PARA ESTA FECHA O SEDE.</div>
      ) : (
        <Accordion defaultActiveKey={volumenHierarchicalData[0]?.id}>
          {volumenHierarchicalData.map(loc => (
            <Accordion.Item eventKey={loc.id} key={loc.id} className="loc-accordion-item border-0 mb-2">
              <Accordion.Header className="loc-header-compact">
                <div className="d-flex justify-content-between align-items-center w-100 pe-3">
                  <div className="d-flex align-items-center gap-3">
                    <div className="loc-avatar">{loc.id}</div>
                    <div>
                      <div className="fw-black text-uppercase" style={{ letterSpacing: '0.5px', fontSize: '0.85rem', color: 'var(--theme-text-primary)' }}>{loc.nombre}</div>
                      <div className="fw-bold" style={{ fontSize: '0.6rem', color: 'var(--theme-text-secondary)', opacity: 0.7 }}>RESUMEN DE LOCALIDAD</div>
                    </div>
                  </div>
                  <div className="d-flex gap-2">
                    <Badge bg="primary" className="p-2 px-3 d-flex flex-column align-items-center justify-content-center" style={{ borderRadius: 0 }}>
                      <span style={{ fontSize: '0.55rem', fontWeight: 800 }}>CF</span>
                      <span className="fw-black fs-6">{loc.totalCF.toFixed(1)}</span>
                    </Badge>
                    <Badge bg="success" className="p-2 px-3 d-flex flex-column align-items-center justify-content-center" style={{ borderRadius: 0 }}>
                      <span style={{ fontSize: '0.55rem', fontWeight: 800 }}>CU</span>
                      <span className="fw-black fs-6">{loc.totalUC.toFixed(2)}</span>
                    </Badge>
                  </div>
                </div>
              </Accordion.Header>
              <Accordion.Body className="bg-transparent p-0 pt-1">
                {Object.entries(loc.mesas).map(([mesaName, mesa]: [string, any]) => (
                  <div key={mesaName} className="mesa-section mb-3">
                    <div className="mesa-title-bar d-flex justify-content-between align-items-center px-3 py-2 mb-2">
                      <span className="fw-black" style={{ fontSize: '0.75rem', color: 'var(--theme-text-primary)' }}>MESA: {mesaName.toUpperCase()}</span>
                      <div className="fw-black text-uppercase" style={{ fontSize: '0.65rem', color: 'var(--theme-text-secondary)' }}>
                        {mesa.totalCF.toFixed(1)} CF / {mesa.totalUC.toFixed(2)} CU
                      </div>
                    </div>
                    
                    <div className="px-3">
                      <Row className="g-2">
                        {Object.entries(mesa.rutas).map(([rutaName, ruta]: [string, any]) => {
                          const rutaKey = `${loc.id}-${mesaName}-${rutaName}`;
                          const isExpanded = expandedRutas[rutaKey];
                          return (
                            <Col xs={12} key={rutaName}>
                              <div className={`ruta-card-compact ${isExpanded ? 'expanded' : ''}`}>
                                <div className="ruta-main-row d-flex justify-content-between align-items-center p-2" onClick={() => toggleRuta(rutaKey)} style={{ cursor: 'pointer' }}>
                                  <div className="d-flex align-items-center gap-2">
                                    <div className={`chevron-icon ${isExpanded ? 'active' : ''}`}><FaChevronRight /></div>
                                    <span className="fw-black" style={{ fontSize: '0.75rem', color: 'var(--theme-text-primary)' }}>RUTA {rutaName}</span>
                                  </div>
                                  <div className="d-flex gap-3 align-items-center">
                                    <div className="d-flex flex-column align-items-end">
                                      <span className="fw-black text-primary" style={{ fontSize: '0.8rem' }}>{ruta.totalCF.toFixed(2)} <span style={{ fontSize: '0.6rem', opacity: 0.7 }}>CF</span></span>
                                    </div>
                                    <div className="d-flex flex-column align-items-end" style={{ minWidth: '60px' }}>
                                      <span className="fw-black text-success" style={{ fontSize: '0.8rem' }}>{ruta.totalUC.toFixed(2)} <span style={{ fontSize: '0.6rem', opacity: 0.7 }}>CU</span></span>
                                    </div>
                                  </div>
                                </div>
                                
                                {isExpanded && (
                                  <div className="ruta-details-list p-2 pt-0 border-top border-secondary border-opacity-10">
                                    <ListGroup variant="flush">
                                      {Object.entries(ruta.productos).map(([sap, p]: [string, any]) => (
                                        <ListGroup.Item key={sap} className="bg-transparent border-0 px-1 py-1 d-flex justify-content-between align-items-center">
                                          <div className="d-flex flex-column">
                                            <span className="fw-bold" style={{ fontSize: '0.7rem', color: 'var(--theme-text-primary)' }}>{p.nombre}</span>
                                            <span className="text-muted fw-bold" style={{ fontSize: '0.6rem' }}>SAP: {sap}</span>
                                          </div>
                                          <div className="d-flex gap-2 align-items-center">
                                            <Badge bg="dark" className="text-light fw-black" style={{ fontSize: '0.65rem', borderRadius: 0 }}>
                                              {p.cantU} UND
                                            </Badge>
                                            <Badge bg="light" className="text-dark border fw-black" style={{ fontSize: '0.65rem', borderRadius: 0 }}>
                                              {p.cantC.toFixed(1)} CJ
                                            </Badge>
                                          </div>
                                        </ListGroup.Item>
                                      ))}
                                    </ListGroup>
                                  </div>
                                )}
                              </div>
                            </Col>
                          );
                        })}
                      </Row>
                    </div>
                  </div>
                ))}
              </Accordion.Body>
            </Accordion.Item>
          ))}
        </Accordion>
      )}
      
      <style>{`
        .fw-black { font-weight: 900 !important; }
        .loc-accordion-item { background: var(--theme-background-secondary) !important; border: 1px solid var(--theme-border-default) !important; border-radius: 0 !important; overflow: hidden; }
        .loc-header-compact .accordion-button { background: transparent !important; box-shadow: none !important; padding: 12px !important; border-radius: 0 !important; }
        .loc-header-compact .accordion-button:after { display: none; }
        .loc-avatar { width: 42px; height: 42px; background: var(--color-red-primary); color: white; display: flex; align-items: center; justify-content: center; border-radius: 0; font-weight: 900; font-size: 1rem; }
        
        .mesa-title-bar { background: var(--theme-icon-bg); border-left: 4px solid var(--color-red-primary); }
        
        .ruta-card-compact { background: var(--theme-background-primary); border: 1px solid var(--theme-border-default); border-radius: 0; transition: all 0.2s ease; }
        .ruta-card-compact:hover { border-color: var(--color-red-primary); }
        .ruta-card-compact.expanded { border-color: var(--color-red-primary); box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        
        .chevron-icon { font-size: 0.65rem; transition: transform 0.2s ease; color: var(--theme-text-secondary); }
        .chevron-icon.active { transform: rotate(90deg); color: var(--color-red-primary); }
        
        .ruta-details-list { max-height: 300px; overflow-y: auto; scrollbar-width: thin; }
        
        .volumen-compact-view .accordion-button:not(.collapsed) { color: inherit; }
        .info-pill-new { border-radius: 0 !important; }
      `}</style>
    </div>
  );

  const renderEficienciaReport = () => (
    <div className="dash-chart-box">
      <div className="dash-chart-header text-uppercase">
        <FaChartLine className="me-2 text-danger" /> Reporte de Eficiencia
      </div>
      <div className="p-3 text-center text-muted small">
        Análisis de efectividad logística y rechazos...
      </div>
    </div>
  );

  const renderDiageoReport = () => (
    <div className="dash-chart-box">
      <div className="dash-chart-header text-uppercase">
        <FaGlassMartiniAlt className="me-2 text-danger" /> Reporte Diageo
      </div>
      <div className="p-3 text-center text-muted small">
        Seguimiento de cuotas y productos especializados...
      </div>
    </div>
  );

  const renderACLReport = () => (
    <div className="dash-chart-box">
      <div className="dash-chart-header text-uppercase">
        <FaBox className="me-2 text-danger" /> Reporte ACL
      </div>
      <div className="p-3 text-center text-muted small">
        Auditoría y Control Logístico...
      </div>
    </div>
  );

  return (
    <div className="admin-layout-container flex-column overflow-hidden gap-3">
      <div className="admin-section-table flex-shrink-0" style={{ flex: 'none', height: 'auto' }}>
        <Row className="g-2 align-items-center">
          <Col xs={12} md={6}>
            <div className="info-pill-new w-100">
              <span className="pill-icon-sober text-danger"><FaWarehouse /></span>
              <div className="pill-content flex-grow-1">
                <span className="pill-label">SEDE AUDITADA</span>
                <Form.Select value={selectedSedeId} onChange={(e) => setSelectedSedeId(e.target.value)} className="pill-select-v2 w-100">
                  <option value="GLOBAL">TODAS LAS SEDES (GLOBAL)</option>
                  {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre.toUpperCase()}</option>)}
                </Form.Select>
              </div>
            </div>
          </Col>
          <Col xs={12} md={6}>
            <div className="info-pill-new w-100">
              <span className="pill-icon-sober text-primary"><FaFilter /></span>
              <div className="pill-content flex-grow-1">
                <span className="pill-label">TIPO DE REPORTE</span>
                <Form.Select value={selectedReportType} onChange={(e) => setSelectedReportType(e.target.value as ReportType)} className="pill-select-v2 w-100">
                  <option value="VOLUMEN">VOLUMEN</option>
                  <option value="EFICIENCIA">EFICIENCIA</option>
                  <option value="DIAGEO">DIAGEO</option>
                  <option value="ACL">ACL</option>
                </Form.Select>
              </div>
            </div>
          </Col>
        </Row>
      </div>

      <div className="admin-section-table flex-grow-1 overflow-hidden p-0">
        <div className="h-100 overflow-auto custom-scrollbar p-3">
          {loading ? (
            <GlobalSpinner variant={SPINNER_VARIANTS.IN_PAGE} />
          ) : (
            <div className="d-flex flex-column gap-3">
              {selectedReportType === 'VOLUMEN' && renderVolumenReport()}
              {selectedReportType === 'EFICIENCIA' && renderEficienciaReport()}
              {selectedReportType === 'DIAGEO' && renderDiageoReport()}
              {selectedReportType === 'ACL' && renderACLReport()}
            </div>
          )}
        </div>
      </div>

      <style>{`
        .info-pill-new { display: flex; align-items: center; background-color: var(--theme-background-secondary); border: 1px solid var(--theme-border-default); border-radius: 4px; height: 40px; overflow: hidden; }
        .pill-icon-sober { background-color: var(--theme-icon-bg); color: var(--theme-icon-color); padding: 0 10px; height: 100%; display: flex; align-items: center; border-right: 1px solid var(--theme-border-default); }
        .pill-content { padding: 0 10px; display: flex; flex-direction: column; justify-content: center; }
        .pill-label { font-size: 0.45rem; font-weight: 800; opacity: 0.5; text-transform: uppercase; color: var(--theme-text-primary); }
        .pill-date-input-v2, .pill-select-v2 { background: transparent !important; border: none !important; color: var(--theme-text-primary) !important; font-weight: 700; font-size: 0.85rem; cursor: pointer; padding: 2px 0 !important; margin-top: -2px; width: 100% !important; }
        
        .dash-chart-box { background: var(--theme-background-secondary); border: 1px solid var(--theme-border-default); padding: 15px; }
        .dash-chart-header { font-size: 0.6rem; font-weight: 900; color: var(--theme-text-secondary); margin-bottom: 10px; text-transform: uppercase; border-left: 3px solid var(--color-red-primary); padding-left: 8px; }
      `}</style>
    </div>
  );
};

export default SupervisorPage;
