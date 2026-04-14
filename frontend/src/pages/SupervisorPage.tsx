import type { FC } from 'react';
import { useState, useEffect, useMemo } from 'react';
import { Row, Col, Form, Badge, Accordion, ListGroup } from 'react-bootstrap';
import { rtdb } from '../api/firebase';
import { ref, onValue } from 'firebase/database';
import { useData } from '../context/DataContext';
import { SPINNER_VARIANTS } from '../constants';
import { 
  FaShoppingCart, FaChartLine, FaWarehouse, FaBox, FaFilter, FaGlassMartiniAlt, FaChevronRight, FaSyncAlt
} from 'react-icons/fa';
import GlobalSpinner from '../components/GlobalSpinner';

type ReportType = 'VOLUMEN' | 'EFICIENCIA' | 'DIAGEO' | 'ACL';

const SupervisorPage: FC = () => {
  const [isDarkMode, setIsDarkMode] = useState(() => document.body.classList.contains('theme-dark'));
  const { sedes, loadingMasterData } = useData();

  // Estados para datos pre-calculados
  const [volumenReport, setVolumenReport] = useState<any[]>([]);
  const [volumenMetadata, setVolumenMetadata] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const [selectedSedeId, setSelectedSedeId] = useState<string>('GLOBAL');
  const [selectedReportType, setSelectedReportType] = useState<ReportType>('VOLUMEN');
  
  const [expandedRutas, setExpandedRutas] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const observer = new MutationObserver(() => setIsDarkMode(document.body.classList.contains('theme-dark')));
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setLoading(true);
    
    // Suscripción al reporte de volumen pre-calculado
    const volumenRef = ref(rtdb, 'reportes/volumen');
    const unsubVolumen = onValue(volumenRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        setVolumenReport(data.data || []);
        setVolumenMetadata(data.metadata || null);
      } else {
        setVolumenReport([]);
        setVolumenMetadata(null);
      }
      setLoading(false);
    }, (error) => {
      console.error("Error cargando reporte de volumen:", error);
      setLoading(false);
    });

    return () => { 
      unsubVolumen();
    };
  }, []);

  const filteredVolumenData = useMemo(() => {
    if (selectedSedeId === 'GLOBAL') return volumenReport;
    const sede = sedes.find(s => s.id === selectedSedeId);
    if (!sede) return volumenReport;
    return volumenReport.filter(loc => loc.id === sede.codigo);
  }, [volumenReport, selectedSedeId, sedes]);

  const toggleRuta = (rutaKey: string) => {
    setExpandedRutas(prev => ({ ...prev, [rutaKey]: !prev[rutaKey] }));
  };

  const renderVolumenReport = () => (
    <div className="volumen-compact-view">
      {filteredVolumenData.length === 0 ? (
        <div className="text-center p-5 text-muted small fw-black">NO HAY DATOS DE VOLUMEN PRE-CALCULADOS.</div>
      ) : (
        <Accordion defaultActiveKey={filteredVolumenData[0]?.id}>
          {filteredVolumenData.map(loc => (
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
      `}</style>
    </div>
  );

  const renderEficienciaReport = () => (
    <div className="dash-chart-box" style={{ borderRadius: 0 }}>
      <div className="dash-chart-header text-uppercase">
        <FaChartLine className="me-2 text-danger" /> Reporte de Eficiencia
      </div>
      <div className="p-3 text-center text-muted small">
        Análisis de efectividad logística y rechazos...
      </div>
    </div>
  );

  const renderDiageoReport = () => (
    <div className="dash-chart-box" style={{ borderRadius: 0 }}>
      <div className="dash-chart-header text-uppercase">
        <FaGlassMartiniAlt className="me-2 text-danger" /> Reporte Diageo
      </div>
      <div className="p-3 text-center text-muted small">
        Seguimiento de cuotas y productos especializados...
      </div>
    </div>
  );

  const renderACLReport = () => (
    <div className="dash-chart-box" style={{ borderRadius: 0 }}>
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
          <Col xs={12} md={4}>
            <div className="info-pill-new w-100" style={{ borderRadius: 0 }}>
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
          <Col xs={12} md={4}>
            <div className="info-pill-new w-100" style={{ borderRadius: 0 }}>
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
          <Col xs={12} md={4}>
            <div className="info-pill-new w-100" style={{ borderRadius: 0 }}>
              <span className="pill-icon-sober text-success"><FaSyncAlt /></span>
              <div className="pill-content flex-grow-1">
                <span className="pill-label">SINCRO DEMANDA</span>
                <div className="fw-black" style={{ fontSize: '0.75rem', color: 'var(--theme-text-primary)', marginTop: '-2px' }}>
                  {volumenMetadata ? volumenMetadata.lastUpdated : 'SIN DATOS'}
                </div>
              </div>
            </div>
          </Col>
        </Row>
      </div>

      <div className="admin-section-table flex-grow-1 overflow-hidden p-0">
        <div className="h-100 overflow-auto custom-scrollbar p-3">
          {loadingMasterData || loading ? (
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
