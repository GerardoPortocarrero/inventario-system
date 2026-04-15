import type { FC } from 'react';
import { useState, useEffect, useMemo } from 'react';
import { Row, Col, Form, Badge, Accordion, ListGroup } from 'react-bootstrap';
import { rtdb } from '../api/firebase';
import { ref, onValue } from 'firebase/database';
import { useData } from '../context/DataContext';
import { SPINNER_VARIANTS } from '../constants';
import { 
  FaChartLine, FaWarehouse, FaBox, FaFilter, FaGlassMartiniAlt, FaChevronRight, FaSyncAlt
} from 'react-icons/fa';
import GlobalSpinner from '../components/GlobalSpinner';

type ReportType = 'VOLUMEN' | 'EFICIENCIA' | 'DIAGEO' | 'ACL';

const SupervisorPage: FC = () => {
  const { sedes, loadingMasterData } = useData();

  // Estados para datos
  const [volumenReport, setVolumenReport] = useState<any[]>([]);
  const [volumenMetadata, setVolumenMetadata] = useState<any>(null);
  const [eficienciaReport, setEficienciaReport] = useState<any[]>([]);
  const [eficienciaMetadata, setEficienciaMetadata] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const [selectedSedeId, setSelectedSedeId] = useState<string>('GLOBAL');
  const [selectedReportType, setSelectedReportType] = useState<ReportType>('VOLUMEN');
  
  // Filtros para Eficiencia
  const [selectedDia, setSelectedDia] = useState<string>(['LU', 'MA', 'MI', 'JU', 'VI', 'SA', 'DO'][new Date().getDay() === 0 ? 6 : new Date().getDay() - 1]);
  const [selectedSemana, setSelectedSemana] = useState<string>('');
  const [expandedRutas, setExpandedRutas] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setLoading(true);
    
    const volumenRef = ref(rtdb, 'reportes/volumen');
    const unsubVolumen = onValue(volumenRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        setVolumenReport(data.data || []);
        setVolumenMetadata(data.metadata || null);
      }
      if (selectedReportType === 'VOLUMEN') setLoading(false);
    });

    const eficienciaRef = ref(rtdb, 'reportes/eficiencia');
    const unsubEficiencia = onValue(eficienciaRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        setEficienciaReport(data.data || []);
        setEficienciaMetadata(data.metadata || null);
      }
      if (selectedReportType === 'EFICIENCIA') setLoading(false);
    });

    return () => { unsubVolumen(); unsubEficiencia(); };
  }, [selectedReportType]);

  const availableSemanas = useMemo(() => {
    const semanas = new Set<string>();
    eficienciaReport.forEach(loc => {
      Object.values(loc.mesas || {}).forEach((mesa: any) => {
        Object.values(mesa.rutas || {}).forEach((ruta: any) => {
          Object.keys(ruta.schedules || {}).forEach(key => {
            const sem = key.split('_')[1];
            if (sem) semanas.add(sem);
          });
        });
      });
    });
    const sorted = Array.from(semanas).sort();
    if (selectedSemana === '' && sorted.length > 0) setSelectedSemana(sorted[0]);
    return sorted;
  }, [eficienciaReport]);

  const filteredVolumenData = useMemo(() => {
    if (selectedSedeId === 'GLOBAL') return volumenReport;
    return volumenReport.filter(loc => loc.id === sedes.find(s => s.id === selectedSedeId)?.codigo);
  }, [volumenReport, selectedSedeId, sedes]);

  const filteredEficienciaData = useMemo(() => {
    let data = selectedSedeId === 'GLOBAL' ? eficienciaReport : eficienciaReport.filter(loc => loc.id === sedes.find(s => s.id === selectedSedeId)?.codigo);
    const schedKey = `${selectedDia}_${selectedSemana}`;
    
    return data.map(loc => {
      const newMesas: Record<string, any> = {};
      Object.entries(loc.mesas || {}).forEach(([mesaName, mesa]: [string, any]) => {
        const newRutas: Record<string, any> = {};
        Object.entries(mesa.rutas || {}).forEach(([rutaName, ruta]: [string, any]) => {
          const stats = ruta.schedules[schedKey];
          if (stats && stats.prog > 0) newRutas[rutaName] = { ...ruta, stats };
        });
        if (Object.keys(newRutas).length > 0) {
          const totalProg = Object.values(newRutas).reduce((acc, r) => acc + r.stats.prog, 0);
          const totalEfec = Object.values(newRutas).reduce((acc, r) => acc + r.stats.efec, 0);
          newMesas[mesaName] = { rutas: newRutas, totalProg, totalEfec };
        }
      });
      if (Object.keys(newMesas).length > 0) {
        const totalProg = Object.values(newMesas).reduce((acc, m) => acc + m.totalProg, 0);
        const totalEfec = Object.values(newMesas).reduce((acc, m) => acc + m.totalEfec, 0);
        return { ...loc, mesas: newMesas, totalProg, totalEfec };
      }
      return null;
    }).filter(Boolean);
  }, [eficienciaReport, selectedSedeId, sedes, selectedDia, selectedSemana]);

  const toggleRuta = (rutaKey: string) => setExpandedRutas(prev => ({ ...prev, [rutaKey]: !prev[rutaKey] }));

  const renderVolumenReport = () => (
    <div className="volumen-compact-view">
      {filteredVolumenData.length === 0 ? (
        <div className="text-center p-5 text-muted small fw-black">NO HAY DATOS DE VOLUMEN.</div>
      ) : (
        <Accordion defaultActiveKey={filteredVolumenData[0]?.id}>
          {filteredVolumenData.map(loc => (
            <Accordion.Item eventKey={loc.id} key={loc.id} className="loc-accordion-item border-0 mb-2">
              <Accordion.Header className="loc-header-compact">
                <div className="d-flex justify-content-between align-items-center w-100 pe-3">
                  <div className="d-flex align-items-center gap-3">
                    <div className="loc-avatar">{loc.id}</div>
                    <div>
                      <div className="fw-black text-uppercase l-height-1">{loc.nombre}</div>
                      <div className="fw-bold sub-label">RESUMEN DE LOCALIDAD</div>
                    </div>
                  </div>
                  <div className="d-flex gap-2">
                    <Badge bg="primary" className="badge-industrial">
                      <span className="b-label">CF</span><span className="fw-black fs-6">{loc.totalCF.toFixed(1)}</span>
                    </Badge>
                    <Badge bg="success" className="badge-industrial">
                      <span className="b-label">CU</span><span className="fw-black fs-6">{loc.totalUC.toFixed(2)}</span>
                    </Badge>
                  </div>
                </div>
              </Accordion.Header>
              <Accordion.Body className="bg-transparent p-0 pt-1">
                {Object.entries(loc.mesas).map(([mesaName, mesa]: [string, any]) => (
                  <div key={mesaName} className="mesa-section mb-3">
                    <div className="mesa-title-bar d-flex justify-content-between align-items-center px-3 py-2 mb-2">
                      <span className="fw-black m-label">MESA: {mesaName.toUpperCase()}</span>
                      <div className="fw-black m-stats">{mesa.totalCF.toFixed(1)} CF / {mesa.totalUC.toFixed(2)} CU</div>
                    </div>
                    <div className="px-3">
                      <Row className="g-2">
                        {Object.entries(mesa.rutas).map(([rutaName, ruta]: [string, any]) => {
                          const rutaKey = `${loc.id}-${mesaName}-${rutaName}`;
                          const isExpanded = expandedRutas[rutaKey];
                          return (
                            <Col xs={12} key={rutaName}>
                              <div className={`ruta-card-compact ${isExpanded ? 'expanded' : ''}`}>
                                <div className="ruta-main-row d-flex justify-content-between align-items-center p-2" onClick={() => toggleRuta(rutaKey)}>
                                  <div className="d-flex align-items-center gap-2">
                                    <div className={`chevron-icon ${isExpanded ? 'active' : ''}`}><FaChevronRight /></div>
                                    <span className="fw-black r-label">RUTA {rutaName}</span>
                                  </div>
                                  <div className="d-flex gap-3 align-items-center">
                                    <div className="d-flex flex-column align-items-end"><span className="fw-black text-primary r-val">{ruta.totalCF.toFixed(2)} <span className="r-unit">CF</span></span></div>
                                    <div className="d-flex flex-column align-items-end" style={{ minWidth: '60px' }}><span className="fw-black text-success r-val">{ruta.totalUC.toFixed(2)} <span className="r-unit">CU</span></span></div>
                                  </div>
                                </div>
                                {isExpanded && (
                                  <div className="ruta-details-list p-2 pt-0 border-top border-secondary border-opacity-10">
                                    <ListGroup variant="flush">
                                      {Object.entries(ruta.productos).map(([sap, p]: [string, any]) => (
                                        <ListGroup.Item key={sap} className="bg-transparent border-0 px-1 py-1 d-flex justify-content-between align-items-center">
                                          <div className="d-flex flex-column"><span className="fw-bold p-name">{p.nombre}</span><span className="text-muted fw-bold p-sap">SAP: {sap}</span></div>
                                          <div className="d-flex gap-2 align-items-center">
                                            <Badge bg="dark" className="p-badge">{p.cantU} UND</Badge>
                                            <Badge bg="light" className="p-badge text-dark border">{p.cantC.toFixed(1)} CJ</Badge>
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
    </div>
  );

  const renderEficienciaReport = () => (
    <div className="volumen-compact-view">
      {filteredEficienciaData.length === 0 ? (
        <div className="text-center p-5 text-muted small fw-black">NO HAY DATOS DE EFICIENCIA.</div>
      ) : (
        <Accordion defaultActiveKey={filteredEficienciaData[0]?.id}>
          {filteredEficienciaData.map((loc: any) => (
            <Accordion.Item eventKey={loc.id} key={loc.id} className="loc-accordion-item border-0 mb-2">
              <Accordion.Header className="loc-header-compact">
                <div className="d-flex justify-content-between align-items-center w-100 pe-3">
                  <div className="d-flex align-items-center gap-3">
                    <div className="loc-avatar">{loc.id}</div>
                    <div>
                      <div className="fw-black text-uppercase l-height-1">{loc.nombre}</div>
                      <div className="fw-bold sub-label">EFECTIVIDAD DE COMPRA</div>
                    </div>
                  </div>
                  <div className="d-flex gap-2">
                    <Badge bg="primary" className="badge-industrial">
                      <span className="b-label">PROG</span><span className="fw-black fs-6">{loc.totalProg}</span>
                    </Badge>
                    <Badge bg="success" className="badge-industrial">
                      <span className="b-label">EFEC</span><span className="fw-black fs-6">{loc.totalEfec}</span>
                    </Badge>
                  </div>
                </div>
              </Accordion.Header>
              <Accordion.Body className="bg-transparent p-0 pt-1">
                {Object.entries(loc.mesas).map(([mesaName, mesa]: [string, any]) => (
                  <div key={mesaName} className="mesa-section mb-3">
                    <div className="mesa-title-bar d-flex justify-content-between align-items-center px-3 py-2 mb-2">
                      <span className="fw-black m-label">MESA: {mesaName.toUpperCase()}</span>
                      <div className="fw-black m-stats">{mesa.totalProg} P / {mesa.totalEfec} E / {((mesa.totalEfec / mesa.totalProg) * 100).toFixed(1)}% EF</div>
                    </div>
                    <div className="px-3">
                      <Row className="g-2">
                        {Object.entries(mesa.rutas).map(([rutaName, ruta]: [string, any]) => {
                          const sinVis = ruta.stats.prog - ruta.stats.efec;
                          const efPorc = (ruta.stats.efec / ruta.stats.prog) * 100;
                          return (
                            <Col xs={12} key={rutaName}>
                              <div className="ruta-card-compact border-0 shadow-none">
                                <div className="ruta-main-row d-flex justify-content-between align-items-center p-2">
                                  <div className="d-flex align-items-center gap-2">
                                    <div style={{ width: '12px' }}></div>
                                    <span className="fw-black r-label">RUTA {rutaName}</span>
                                  </div>
                                  <div className="d-flex gap-3 align-items-center">
                                    <div className="d-flex flex-column align-items-end" style={{ minWidth: '45px' }}><span className="fw-black text-primary r-val">{ruta.stats.prog} <span className="r-unit">P</span></span></div>
                                    <div className="d-flex flex-column align-items-end" style={{ minWidth: '45px' }}><span className="fw-black text-success r-val">{ruta.stats.efec} <span className="r-unit">E</span></span></div>
                                    <div className="d-flex flex-column align-items-end" style={{ minWidth: '45px' }}><span className="fw-black text-danger r-val">{sinVis} <span className="r-unit">SV</span></span></div>
                                    <div className="d-flex flex-column align-items-end" style={{ minWidth: '55px' }}><span className="fw-black text-dark r-val">{efPorc.toFixed(0)} <span className="r-unit">%</span></span></div>
                                  </div>
                                </div>
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
    </div>
  );

  return (
    <div className="admin-layout-container flex-column overflow-hidden gap-3">
      <div className="admin-section-table flex-shrink-0" style={{ flex: 'none', height: 'auto' }}>
        <Row className="g-2 align-items-center">
          <Col xs={12} md={selectedReportType === 'EFICIENCIA' ? 3 : 4}>
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
          <Col xs={12} md={selectedReportType === 'EFICIENCIA' ? 3 : 4}>
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
          {selectedReportType === 'EFICIENCIA' ? (
            <>
              <Col xs={6} md={1.5}>
                <div className="info-pill-new w-100"><div className="pill-content flex-grow-1"><span className="pill-label">DÍA</span><Form.Select value={selectedDia} onChange={(e) => setSelectedDia(e.target.value)} className="pill-select-v2 w-100">{['LU', 'MA', 'MI', 'JU', 'VI', 'SA', 'DO'].map(d => <option key={d} value={d}>{d}</option>)}</Form.Select></div></div>
              </Col>
              <Col xs={6} md={1.5}>
                <div className="info-pill-new w-100"><div className="pill-content flex-grow-1"><span className="pill-label">SEMANA</span><Form.Select value={selectedSemana} onChange={(e) => setSelectedSemana(e.target.value)} className="pill-select-v2 w-100">{availableSemanas.length > 0 ? availableSemanas.map(s => <option key={s} value={s}>{s}</option>) : <option value="">...</option>}</Form.Select></div></div>
              </Col>
            </>
          ) : null}
          <Col xs={12} md={selectedReportType === 'EFICIENCIA' ? 3 : 4}>
            <div className="info-pill-new w-100">
              <span className="pill-icon-sober text-success"><FaSyncAlt /></span>
              <div className="pill-content flex-grow-1">
                <span className="pill-label">SINCRO DEMANDA</span>
                <div className="fw-black sincro-val">
                  {selectedReportType === 'EFICIENCIA' ? (eficienciaMetadata?.lastUpdated || 'SIN DATOS') : (volumenMetadata?.lastUpdated || 'SIN DATOS')}
                </div>
              </div>
            </div>
          </Col>
        </Row>
      </div>

      <div className="admin-section-table flex-grow-1 overflow-hidden p-0">
        <div className="h-100 overflow-auto custom-scrollbar p-3">
          {loadingMasterData || loading ? <GlobalSpinner variant={SPINNER_VARIANTS.IN_PAGE} /> : (
            <div className="d-flex flex-column gap-3">
              {selectedReportType === 'VOLUMEN' && renderVolumenReport()}
              {selectedReportType === 'EFICIENCIA' && renderEficienciaReport()}
              {selectedReportType === 'DIAGEO' && <div className="dash-chart-box"><div className="dash-chart-header"><FaGlassMartiniAlt className="me-2" /> Reporte Diageo</div><div className="p-3 text-center text-muted small">Próximamente...</div></div>}
              {selectedReportType === 'ACL' && <div className="dash-chart-box"><div className="dash-chart-header"><FaBox className="me-2" /> Reporte ACL</div><div className="p-3 text-center text-muted small">Próximamente...</div></div>}
            </div>
          )}
        </div>
      </div>

      <style>{`
        .admin-layout-container { background: var(--theme-background-primary); min-height: 100%; }
        .fw-black { font-weight: 900 !important; }
        .l-height-1 { letter-spacing: 0.5px; font-size: 0.85rem; color: var(--theme-text-primary); }
        .sub-label { font-size: 0.6rem; color: var(--theme-text-secondary); opacity: 0.7; }
        
        .info-pill-new { display: flex; align-items: center; background-color: var(--theme-background-secondary); border: 1px solid var(--theme-border-default); border-radius: 0; height: 40px; overflow: hidden; }
        .pill-icon-sober { background-color: var(--theme-icon-bg); color: var(--theme-icon-color); padding: 0 10px; height: 100%; display: flex; align-items: center; border-right: 1px solid var(--theme-border-default); }
        .pill-content { padding: 0 10px; display: flex; flex-direction: column; justify-content: center; }
        .pill-label { font-size: 0.45rem; font-weight: 800; opacity: 0.5; text-transform: uppercase; color: var(--theme-text-primary); }
        .pill-select-v2 { background: transparent !important; border: none !important; color: var(--theme-text-primary) !important; font-weight: 700; font-size: 0.85rem; padding: 0 !important; margin-top: -2px; }
        .sincro-val { font-size: 0.75rem; color: var(--theme-text-primary); margin-top: -2px; }

        .loc-accordion-item { background: var(--theme-background-secondary) !important; border: 1px solid var(--theme-border-default) !important; border-radius: 0 !important; overflow: hidden; }
        .loc-header-compact .accordion-button { background: transparent !important; box-shadow: none !important; padding: 12px !important; border-radius: 0 !important; }
        .loc-header-compact .accordion-button:not(.collapsed) { background: transparent !important; color: inherit !important; box-shadow: none !important; }
        .loc-header-compact .accordion-button:after { display: none; }
        .loc-avatar { width: 42px; height: 42px; background: var(--color-red-primary); color: white; display: flex; align-items: center; justify-content: center; font-weight: 900; }
        .badge-industrial { padding: 8px 12px; display: flex; flex-direction: column; align-items: center; border-radius: 0; min-width: 60px; }
        .b-label { font-size: 0.55rem; font-weight: 800; }

        .mesa-title-bar { background: var(--theme-icon-bg); border-left: 4px solid var(--color-red-primary); }
        .m-label { font-size: 0.75rem; color: var(--theme-text-primary); }
        .m-stats { font-size: 0.65rem; color: var(--theme-text-secondary); text-transform: uppercase; }

        .ruta-card-compact { background: var(--theme-background-primary); border: 1px solid var(--theme-border-default); border-radius: 0; }
        .r-label { font-size: 0.75rem; color: var(--theme-text-primary); }
        .r-val { font-size: 0.8rem; }
        .r-unit { font-size: 0.6rem; opacity: 0.7; }
        .chevron-icon { font-size: 0.65rem; transition: transform 0.2s ease; color: var(--theme-text-secondary); }
        .chevron-icon.active { transform: rotate(90deg); color: var(--color-red-primary); }

        .p-name { font-size: 0.7rem; color: var(--theme-text-primary); }
        .p-sap { font-size: 0.6rem; }
        .p-badge { font-size: 0.65rem; border-radius: 0; font-weight: 900; }

        .dash-chart-box { background: var(--theme-background-secondary); border: 1px solid var(--theme-border-default); padding: 15px; }
        .dash-chart-header { font-size: 0.6rem; font-weight: 900; color: var(--theme-text-secondary); text-transform: uppercase; border-left: 3px solid var(--color-red-primary); padding-left: 8px; margin-bottom: 10px; }
      `}</style>
    </div>
  );
};

export default SupervisorPage;
