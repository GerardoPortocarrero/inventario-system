import type { FC } from 'react';
import { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { Row, Col, Form, Badge, Accordion, ListGroup, Dropdown } from 'react-bootstrap';
import { rtdb } from '../api/firebase';
import { ref, onValue } from 'firebase/database';
import { useData } from '../context/DataContext';
import { SPINNER_VARIANTS } from '../constants';
import { FaWarehouse, FaFilter, FaGlassMartiniAlt, FaChevronRight, FaSyncAlt, FaCalendarAlt, FaExclamationTriangle } from 'react-icons/fa';
import GlobalSpinner from '../components/GlobalSpinner';

type ReportType = 'VOLUMEN' | 'EFICIENCIA' | 'BEBIDAS' | 'DUPLICADOS';

// --- COMPONENTES MEMOIZADOS PARA MANTENER EL DISEÑO Y GANAR FLUIDEZ ---

const RutaVolumenBebidaItem = memo(({ 
  rutaName, ruta, isExpanded, onToggle, rutaKey 
}: { 
  rutaName: string, ruta: any, isExpanded: boolean, onToggle: (key: string) => void, rutaKey: string 
}) => {
  return (
    <Col xs={12}>
      <div className={`ruta-card-compact ${isExpanded ? 'expanded' : ''}`}>
        <div className="ruta-main-row d-flex justify-content-between align-items-center p-2" onClick={() => onToggle(rutaKey)}>
          <div className="d-flex align-items-center gap-2 flex-grow-1 overflow-hidden">
            <div className={`chevron-icon ${isExpanded ? 'active' : ''}`}><FaChevronRight /></div>
            <span className="fw-black r-label text-nowrap">RUTA {rutaName}</span>
            <div className="r-dot-leader d-none d-md-block"></div>
          </div>
          <div className="d-flex gap-3 align-items-center ps-2">
            <div className="d-flex flex-column align-items-end"><span className="fw-black text-primary r-val">{ruta.totalCF.toFixed(2)} <span className="r-unit">CF</span></span></div>
            <div className="d-flex flex-column align-items-end" style={{ minWidth: '60px' }}><span className="fw-black text-success r-val">{ruta.totalUC.toFixed(2)} <span className="r-unit">CU</span></span></div>
          </div>
        </div>
        {isExpanded && (
          <div className="ruta-details-list p-2 pt-0 border-top border-secondary border-opacity-10">
            <ListGroup variant="flush">
              {Object.entries(ruta.productos).map(([sap, p]: [string, any]) => (
                <ListGroup.Item key={sap} className="bg-transparent border-0 px-1 py-1 d-flex justify-content-between align-items-center">
                  <div className="d-flex flex-column flex-grow-1 overflow-hidden">
                    <div className="d-flex align-items-center gap-2">
                      <span className="fw-bold p-name text-nowrap">{p.nombre}</span>
                      <div className="p-dot-leader d-none d-md-block"></div>
                    </div>
                    <span className="fw-bold p-sap">SAP: {sap}</span>
                  </div>
                  <div className="d-flex gap-2 align-items-center ps-2">
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
});

const EficienciaRutaItem = memo(({ 
  rutaName, ruta, sinVis, efPorc, porcColor 
}: { 
  rutaName: string, ruta: any, sinVis: number, efPorc: number, porcColor: string 
}) => {
  return (
    <Col xs={12}>
      <div className="ruta-card-compact border-0 shadow-none">
        <div className="ruta-main-row d-flex justify-content-between align-items-center p-2">
          <div className="d-flex align-items-center gap-2 flex-grow-1 overflow-hidden">
            <div style={{ width: '12px' }}></div>
            <span className="fw-black r-label text-nowrap">RUTA {rutaName}</span>
            <div className="r-dot-leader d-none d-md-block"></div>
          </div>
          <div className="d-flex gap-3 align-items-center ps-2">
            <div className="d-flex flex-column align-items-end" style={{ minWidth: '45px' }}><span className="fw-black text-primary r-val">{ruta.stats.prog} <span className="r-unit">P</span></span></div>
            <div className="d-flex flex-column align-items-end" style={{ minWidth: '45px' }}><span className="fw-black text-success r-val">{ruta.stats.efec} <span className="r-unit">E</span></span></div>
            <div className="d-flex flex-column align-items-end" style={{ minWidth: '45px' }}><span className="fw-black text-danger r-val">{sinVis} <span className="r-unit">SV</span></span></div>
            <div className="d-flex flex-column align-items-end" style={{ minWidth: '55px' }}><span className="fw-black r-val" style={{ color: porcColor }}>{efPorc.toFixed(0)} <span className="r-unit">%</span></span></div>
          </div>
        </div>
      </div>
    </Col>
  );
});

const SupervisorPage: FC = () => {
  const { sedes, loadingMasterData, beverageTypes } = useData();

  // Estados para datos
  const [volumenReport, setVolumenReport] = useState<any[]>([]);
  const [volumenMetadata, setVolumenMetadata] = useState<any>(null);
  const [eficienciaReport, setEficienciaReport] = useState<any[]>([]);
  const [eficienciaMetadata, setEficienciaMetadata] = useState<any>(null);
  const [bebidasReport, setBebidasReport] = useState<any[]>([]);
  const [bebidasMetadata, setBebidasMetadata] = useState<any>(null);
  const [duplicadosReport, setDuplicadosReport] = useState<any[]>([]);
  const [duplicadosMetadata, setDuplicadosMetadata] = useState<any>(null);
  const [maestroData, setMaestroData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedSedeId, setSelectedSedeId] = useState<string>('GLOBAL');
  const [selectedReportType, setSelectedReportType] = useState<ReportType>('VOLUMEN');
  
  // Filtros para Eficiencia
  const [selectedDia, setSelectedDia] = useState<string>(['LU', 'MA', 'MI', 'JU', 'VI', 'SA', 'DO'][new Date().getDay() === 0 ? 6 : new Date().getDay() - 1]);
  const [selectedSemanas, setSelectedSemanas] = useState<string[]>([]);
  const [selectedBebidaTypes, setSelectedBebidaTypes] = useState<string[]>([]);
  const [expandedRutas, setExpandedRutas] = useState<Record<string, boolean>>({});

  // Inicializar tipos de bebida
  useEffect(() => {
    if (beverageTypes.length > 0 && selectedBebidaTypes.length === 0) {
      setSelectedBebidaTypes(beverageTypes.map(t => t.id));
    }
  }, [beverageTypes, selectedBebidaTypes.length]);

  useEffect(() => {
    setLoading(true);
    let reportsToLoad = 4;
    let loadedCount = 0;
    const checkLoaded = () => {
      loadedCount++;
      if (loadedCount >= reportsToLoad) setLoading(false);
    };

    const volumenRef = ref(rtdb, 'reportes/volumen');
    const unsubVolumen = onValue(volumenRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        setVolumenReport(data.data || []);
        setVolumenMetadata(data.metadata || null);
      }
      checkLoaded();
    });

    const eficienciaRef = ref(rtdb, 'reportes/eficiencia');
    const unsubEficiencia = onValue(eficienciaRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        setEficienciaReport(data.data || []);
        setEficienciaMetadata(data.metadata || null);
      }
      checkLoaded();
    });

    const bebidasRef = ref(rtdb, 'reportes/bebidas');
    const unsubBebidas = onValue(bebidasRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        setBebidasReport(data.data || []);
        setBebidasMetadata(data.metadata || null);
      }
      checkLoaded();
    });

    const duplicadosRef = ref(rtdb, 'reportes/duplicados');
    const unsubDuplicados = onValue(duplicadosRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        setDuplicadosReport(data.data || []);
        setDuplicadosMetadata(data.metadata || null);
      }
      checkLoaded();
    });

    const maestroRef = ref(rtdb, 'maestro/data');
    const unsubMaestro = onValue(maestroRef, (snapshot) => {
      if (snapshot.exists()) {
        setMaestroData(snapshot.val());
      }
    });

    return () => { unsubVolumen(); unsubEficiencia(); unsubBebidas(); unsubDuplicados(); unsubMaestro(); };
  }, []);

  const maestroMap = useMemo(() => {
    return maestroData.reduce((acc, m) => ({ ...acc, [String(m.Codigo)]: m }), {} as Record<string, any>);
  }, [maestroData]);

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
    return Array.from(semanas).sort((a, b) => parseInt(a) - parseInt(b));
  }, [eficienciaReport]);

  useEffect(() => {
    if (selectedSemanas.length === 0 && availableSemanas.length > 0) {
      setSelectedSemanas([availableSemanas[availableSemanas.length - 1]]);
    }
  }, [availableSemanas, selectedSemanas.length]);

  const handleSemanaToggle = (sem: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedSemanas(prev => prev.includes(sem) ? prev.filter(s => s !== sem) : [...prev, sem]);
  };

  const handleSelectAllWeeks = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedSemanas.length === availableSemanas.length) {
      setSelectedSemanas([availableSemanas[availableSemanas.length - 1]]);
    } else {
      setSelectedSemanas(availableSemanas);
    }
  };

  const filteredVolumenData = useMemo(() => {
    if (selectedSedeId === 'GLOBAL') return volumenReport;
    return volumenReport.filter(loc => loc.id === sedes.find(s => s.id === selectedSedeId)?.codigo);
  }, [volumenReport, selectedSedeId, sedes]);

  const filteredBebidasData = useMemo(() => {
    let data = selectedSedeId === 'GLOBAL' ? bebidasReport : bebidasReport.filter(loc => loc.id === sedes.find(s => s.id === selectedSedeId)?.codigo);
    if (selectedBebidaTypes.length === 0) return [];
    return data.map(loc => {
      const newTipos: Record<string, any> = {};
      Object.entries(loc.tipos || {}).forEach(([tipoId, tipo]: [string, any]) => {
        if (selectedBebidaTypes.includes(tipoId)) newTipos[tipoId] = tipo;
      });
      return Object.keys(newTipos).length > 0 ? { ...loc, tipos: newTipos } : null;
    }).filter(Boolean);
  }, [bebidasReport, selectedSedeId, sedes, selectedBebidaTypes]);

  const filteredDuplicadosData = useMemo(() => {
    if (selectedSedeId === 'GLOBAL') return duplicadosReport;
    return duplicadosReport.filter(loc => loc.id === sedes.find(s => s.id === selectedSedeId)?.codigo);
  }, [duplicadosReport, selectedSedeId, sedes]);

  const handleBebidaTypeToggle = (typeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedBebidaTypes(prev => prev.includes(typeId) ? prev.filter(t => t !== typeId) : [...prev, typeId]);
  };

  const handleSelectAllBebidas = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedBebidaTypes.length === beverageTypes.length) {
      setSelectedBebidaTypes([]);
    } else {
      setSelectedBebidaTypes(beverageTypes.map(t => t.id));
    }
  };

  const filteredEficienciaData = useMemo(() => {
    let data = selectedSedeId === 'GLOBAL' ? eficienciaReport : eficienciaReport.filter(loc => loc.id === sedes.find(s => s.id === selectedSedeId)?.codigo);
    if (selectedSemanas.length === 0) return [];
    return data.map(loc => {
      const newMesas: Record<string, any> = {};
      Object.entries(loc.mesas || {}).forEach(([mesaName, mesa]: [string, any]) => {
        const newRutas: Record<string, any> = {};
        Object.entries(mesa.rutas || {}).forEach(([rutaName, ruta]: [string, any]) => {
          const stats = { prog: 0, efec: 0 };
          selectedSemanas.forEach(sem => {
            const s = ruta.schedules[`${selectedDia}_${sem}`];
            if (s) { stats.prog += s.prog; stats.efec += s.efec; }
          });
          if (stats.prog > 0) newRutas[rutaName] = { ...ruta, stats };
        });
        if (Object.keys(newRutas).length > 0) {
          const totalProg = Object.values(newRutas).reduce((acc, r: any) => acc + r.stats.prog, 0);
          const totalEfec = Object.values(newRutas).reduce((acc, r: any) => acc + r.stats.efec, 0);
          newMesas[mesaName] = { rutas: newRutas, totalProg, totalEfec };
        }
      });
      if (Object.keys(newMesas).length > 0) {
        const totalProg = Object.values(newMesas).reduce((acc, m: any) => acc + m.totalProg, 0);
        const totalEfec = Object.values(newMesas).reduce((acc, m: any) => acc + m.totalEfec, 0);
        return { ...loc, mesas: newMesas, totalProg, totalEfec };
      }
      return null;
    }).filter(Boolean);
  }, [eficienciaReport, selectedSedeId, sedes, selectedDia, selectedSemanas]);

  const toggleRuta = useCallback((rutaKey: string) => setExpandedRutas(prev => ({ ...prev, [rutaKey]: !prev[rutaKey] })), []);

  const renderVolumenReport = () => (
    <div className="report-container-stable">
      {filteredVolumenData.length === 0 ? (
        <div className="text-center p-5 text-muted small fw-black">NO HAY DATOS DE VOLUMEN.</div>
      ) : (
        <Accordion defaultActiveKey={filteredVolumenData[0]?.id}>
          {filteredVolumenData.map(loc => (
            <Accordion.Item eventKey={loc.id} key={loc.id} className="loc-accordion-item border-0 mb-2">
              <Accordion.Header className="loc-header-compact">
                <div className="d-flex justify-content-between align-items-center w-100">
                  <div className="d-flex align-items-center gap-3">
                    <div className="loc-avatar">{loc.id}</div>
                    <div>
                      <div className="fw-black text-uppercase l-height-1">{loc.nombre}</div>
                      <div className="fw-bold sub-label">VOLUMEN</div>
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
                        {Object.entries(mesa.rutas).map(([rutaName, ruta]: [string, any]) => (
                          <RutaVolumenBebidaItem 
                            key={`${loc.id}-${mesaName}-${rutaName}`}
                            rutaName={rutaName} ruta={ruta}
                            isExpanded={!!expandedRutas[`${loc.id}-${mesaName}-${rutaName}`]}
                            onToggle={toggleRuta} rutaKey={`${loc.id}-${mesaName}-${rutaName}`}
                          />
                        ))}
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

  const renderBebidasReport = () => (
    <div className="report-container-stable">
      {filteredBebidasData.length === 0 ? (
        <div className="text-center p-5 text-muted small fw-black">NO HAY DATOS DE BEBIDAS.</div>
      ) : (
        <Accordion defaultActiveKey={filteredBebidasData[0]?.id}>
          {filteredBebidasData.map(loc => (
            <Accordion.Item eventKey={loc.id} key={loc.id} className="loc-accordion-item border-0 mb-2">
              <Accordion.Header className="loc-header-compact">
                <div className="d-flex justify-content-between align-items-center w-100">
                  <div className="d-flex align-items-center gap-3">
                    <div className="loc-avatar">{loc.id}</div>
                    <div>
                      <div className="fw-black text-uppercase l-height-1">{loc.nombre}</div>
                      <div className="fw-bold sub-label">BEBIDAS</div>
                    </div>
                  </div>
                  <div className="d-flex gap-2">
                    <Badge bg="primary" className="badge-industrial">
                      <span className="b-label text-white-50">Sede</span><span className="fw-black fs-6">{loc.id}</span>
                    </Badge>
                  </div>
                </div>
              </Accordion.Header>
              <Accordion.Body className="bg-transparent p-0 pt-1">
                {Object.entries(loc.tipos).map(([tipoId, tipo]: [string, any]) => (
                  <div key={tipoId} className="mesa-section mb-3">
                    <div className="mesa-title-bar d-flex justify-content-between align-items-center px-3 py-2 mb-2" style={{ borderLeftColor: 'var(--theme-icon-color)' }}>
                      <span className="fw-black m-label"><FaGlassMartiniAlt className="me-2"/>{tipo.nombre}</span>
                      <div className="fw-black m-stats">{tipo.totalCF.toFixed(1)} CF / {tipo.totalUC.toFixed(2)} CU</div>
                    </div>
                    <div className="px-3">
                      <Row className="g-2">
                        {Object.entries(tipo.rutas).map(([rutaName, ruta]: [string, any]) => (
                          <RutaVolumenBebidaItem 
                            key={`bebidas-${loc.id}-${tipoId}-${rutaName}`}
                            rutaName={rutaName} ruta={ruta}
                            isExpanded={!!expandedRutas[`bebidas-${loc.id}-${tipoId}-${rutaName}`]}
                            onToggle={toggleRuta} rutaKey={`bebidas-${loc.id}-${tipoId}-${rutaName}`}
                          />
                        ))}
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
    <div className="report-container-stable">
      {filteredEficienciaData.length === 0 ? (
        <div className="text-center p-5 text-muted small fw-black">NO HAY DATOS DE EFICIENCIA PARA LOS FILTROS SELECCIONADOS.</div>
      ) : (
        <Accordion defaultActiveKey={filteredEficienciaData[0]?.id}>
          {filteredEficienciaData.map((loc: any) => (
            <Accordion.Item eventKey={loc.id} key={loc.id} className="loc-accordion-item border-0 mb-2">
              <Accordion.Header className="loc-header-compact">
                <div className="d-flex justify-content-between align-items-center w-100">
                  <div className="d-flex align-items-center gap-3">
                    <div className="loc-avatar">{loc.id}</div>
                    <div>
                      <div className="fw-black text-uppercase l-height-1">{loc.nombre}</div>
                      <div className="fw-bold sub-label">EFICIENCIA</div>
                    </div>
                  </div>
                  <div className="d-flex gap-2">
                    <Badge bg="primary" className="badge-industrial">
                      <span className="b-label">PROG</span><span className="fw-black fs-6">{loc.totalProg}</span>
                    </Badge>
                    <Badge bg="success" className="badge-industrial">
                      <span className="b-label">EFEC</span><span className="fw-black fs-6">{loc.totalEfec}</span>
                    </Badge>
                    <Badge bg="danger" className="badge-industrial">
                      <span className="b-label">S. VISITA</span><span className="fw-black fs-6">{loc.totalProg - loc.totalEfec}</span>
                    </Badge>
                    <Badge bg="dark" className="badge-industrial border border-secondary">
                      <span className="b-label text-info">EF (%)</span><span className="fw-black fs-6 text-info">{((loc.totalEfec / loc.totalProg) * 100).toFixed(0)}%</span>
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
                        {Object.entries(mesa.rutas).map(([rutaName, ruta]: [string, any]) => (
                          <EficienciaRutaItem 
                            key={`eficiencia-${loc.id}-${mesaName}-${rutaName}`}
                            rutaName={rutaName} ruta={ruta}
                            sinVis={ruta.stats.prog - ruta.stats.efec}
                            efPorc={(ruta.stats.efec / ruta.stats.prog) * 100}
                            porcColor={(ruta.stats.efec / ruta.stats.prog) * 100 < 70 ? 'var(--color-red-primary)' : (ruta.stats.efec / ruta.stats.prog) * 100 < 85 ? '#ff8800' : '#00ff88'}
                          />
                        ))}
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

  const renderDuplicadosReport = () => (
    <div className="report-container-stable">
      {filteredDuplicadosData.length === 0 ? (
        <div className="text-center p-5 text-muted small fw-black">NO SE DETECTARON PEDIDOS DUPLICADOS.</div>
      ) : (
        <Accordion defaultActiveKey={filteredDuplicadosData[0]?.id}>
          {filteredDuplicadosData.map(loc => (
            <Accordion.Item eventKey={loc.id} key={loc.id} className="loc-accordion-item border-0 mb-2">
              <Accordion.Header className="loc-header-compact">
                <div className="d-flex justify-content-between align-items-center w-100">
                  <div className="d-flex align-items-center gap-3">
                    <div className="loc-avatar bg-warning text-dark"><FaExclamationTriangle /></div>
                    <div>
                      <div className="fw-black text-uppercase l-height-1">{loc.nombre}</div>
                      <div className="fw-bold sub-label">DUPLICADOS</div>
                    </div>
                  </div>
                  <Badge bg="danger" className="badge-industrial">
                    <span className="b-label">CONFLICTOS</span>
                    <span className="fw-black fs-6">{Object.keys(loc.clientes).length}</span>
                  </Badge>
                </div>
              </Accordion.Header>
              <Accordion.Body className="bg-transparent p-0 pt-1">
                {Object.values(loc.clientes).map((cliente: any) => {
                  const masterClient = maestroMap[String(cliente.codigo)];
                  const rutaCom = masterClient ? (masterClient['Ruta com'] || masterClient['RUTA COM'] || 'SIN RUTA') : 'CARGANDO...';
                  return (
                    <div key={cliente.codigo} className="mesa-section mb-3">
                      <div className="mesa-title-bar d-flex justify-content-between align-items-center px-3 py-2 mb-2" style={{ borderLeftColor: '#ffc107' }}>
                        <div className="d-flex flex-column flex-md-row align-items-md-center gap-md-3">
                          <span className="fw-black m-label">{cliente.nombre}</span>
                          <div className="d-flex gap-2 align-items-center">
                            <Badge bg="dark" className="p-badge text-warning border border-warning border-opacity-50">RUTA: {rutaCom}</Badge>
                            <span className="fw-bold text-secondary d-label">CÓDIGO: {cliente.codigo}</span>
                          </div>
                        </div>
                      </div>
                      <div className="px-3">
                        {cliente.duplas.map((dupla: any, idx: number) => (
                          <div key={idx} className="duplicado-comparativo-card mb-3">
                            <Row className="g-0 border border-warning border-opacity-25 shadow-sm">
                              <Col xs={6} className="border-end border-secondary border-opacity-25">
                                <div className="p-2 bg-dark text-center border-bottom border-secondary border-opacity-25 d-flex justify-content-center align-items-center gap-2">
                                  <span className="fw-black text-warning dup-doc-id"># {dupla.doc1.id}</span>
                                  <Badge bg="secondary" className="fw-bold dup-doc-hora">{dupla.doc1.hora}</Badge>
                                </div>
                                <div className="p-2 bg-transparent">
                                  {dupla.doc1.items.map((item: any, i: number) => (
                                    <div key={i} className="d-flex justify-content-between align-items-center mb-1 pb-1 border-bottom border-secondary border-opacity-10 last-child-no-border">
                                      <div className="d-flex flex-column min-width-0">
                                        <span className="fw-bold text-truncate dup-item-name">{item.nombre}</span>
                                        <span className="dup-item-sap">{item.sap}</span>
                                      </div>
                                      <span className="fw-black ms-2 dup-item-cant">{item.cant} {item.med}</span>
                                    </div>
                                  ))}
                                </div>
                              </Col>
                              <Col xs={6}>
                                <div className="p-2 bg-dark text-center border-bottom border-secondary border-opacity-25 d-flex justify-content-center align-items-center gap-2">
                                  <span className="fw-black text-warning dup-doc-id"># {dupla.doc2.id}</span>
                                  <Badge bg="secondary" className="fw-bold dup-doc-hora">{dupla.doc2.hora}</Badge>
                                </div>
                                <div className="p-2 bg-transparent">
                                  {dupla.doc2.items.map((item: any, i: number) => (
                                    <div key={i} className="d-flex justify-content-between align-items-center mb-1 pb-1 border-bottom border-secondary border-opacity-10 last-child-no-border">
                                      <div className="d-flex flex-column min-width-0">
                                        <span className="fw-bold text-truncate dup-item-name">{item.nombre}</span>
                                        <span className="dup-item-sap">{item.sap}</span>
                                      </div>
                                      <span className="fw-black ms-2 dup-item-cant">{item.cant} {item.med}</span>
                                    </div>
                                  ))}
                                </div>
                              </Col>
                            </Row>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </Accordion.Body>
            </Accordion.Item>
          ))}
        </Accordion>
      )}
      <style>{`
        .duplicado-comparativo-card { background: var(--theme-background-primary); border-radius: 4px; overflow: hidden; }
        .last-child-no-border:last-child { border-bottom: none !important; }
        .d-label { font-size: 0.55rem; }
        .dup-doc-id { font-size: 0.65rem; }
        .dup-doc-hora { font-size: 0.55rem; }
        .dup-item-name { font-size: 0.6rem; color: var(--theme-text-primary); }
        .dup-item-sap { font-size: 0.5rem; opacity: 0.6; }
        .dup-item-cant { font-size: 0.65rem; color: var(--color-red-primary); }
      `}</style>
    </div>
  );

  return (
    <div className="admin-layout-container flex-column gap-3" style={{ overflow: 'visible' }}>
      <div className="admin-section-table flex-shrink-0" style={{ flex: 'none', height: 'auto', padding: '0.5rem', overflow: 'visible' }}>
        <Row className="g-1 align-items-center">
          {/* 1. Sede */}
          <Col xs={12} md={2}>
            <div className="info-pill-new w-100">
              <span className="pill-icon-sober text-danger p-1"><FaWarehouse className="pill-main-icon"/></span>
              <div className="pill-content flex-grow-1">
                <span className="pill-label">SEDE</span>
                <Form.Select value={selectedSedeId} onChange={(e) => setSelectedSedeId(e.target.value)} className="pill-select-v2 w-100">
                  <option value="GLOBAL">GLOBAL</option>
                  {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre.toUpperCase()}</option>)}
                </Form.Select>
              </div>
            </div>
          </Col>

          {/* 2. Reporte */}
          <Col xs={12} md={2}>
            <div className="info-pill-new w-100">
              <span className="pill-icon-sober text-primary p-1"><FaFilter className="pill-main-icon"/></span>
              <div className="pill-content flex-grow-1">
                <span className="pill-label">REPORTE</span>
                <Form.Select value={selectedReportType} onChange={(e) => setSelectedReportType(e.target.value as ReportType)} className="pill-select-v2 w-100">
                  <option value="VOLUMEN">VOLUMEN</option>
                  <option value="EFICIENCIA">EFICIENCIA</option>
                  <option value="BEBIDAS">BEBIDAS</option>
                  <option value="DUPLICADOS">DUPLICADOS</option>
                </Form.Select>
              </div>
            </div>
          </Col>

          {selectedReportType === 'EFICIENCIA' && (
            <>
              {/* 3. Día */}
              <Col xs={4} md={1}>
                <div className="info-pill-new w-100">
                  <div className="pill-content flex-grow-1 text-center p-0 ps-1">
                    <span className="pill-label">DÍA</span>
                    <Form.Select value={selectedDia} onChange={(e) => setSelectedDia(e.target.value)} className="pill-select-v2 w-100 text-center">
                      {['LU', 'MA', 'MI', 'JU', 'VI', 'SA', 'DO'].map(d => <option key={d} value={d}>{d}</option>)}
                    </Form.Select>
                  </div>
                </div>
              </Col>
              {/* 4. Semanas (Multi-Select con estilo de Dropdown Limpio) */}
              <Col xs={8} md={3}>
                <div className="info-pill-new w-100">
                  <span className="pill-icon-sober text-info p-1"><FaCalendarAlt className="pill-main-icon"/></span>
                  <div className="pill-content flex-grow-1 ps-2">
                    <span className="pill-label">SEMANAS ({selectedSemanas.length})</span>
                    <Dropdown autoClose="outside" className="w-100 border-0 shadow-none">
                      <Dropdown.Toggle 
                        as="div"
                        className="pill-select-v2 w-100 text-start d-flex justify-content-between align-items-center p-0" 
                        style={{ background: 'none', border: 'none', boxShadow: 'none', cursor: 'pointer' }}
                      >
                        <span className="text-truncate" style={{ maxWidth: '120px' }}>
                          {selectedSemanas.length === availableSemanas.length && availableSemanas.length > 1 
                            ? 'TODAS' 
                            : ([...selectedSemanas].sort((a, b) => parseInt(a) - parseInt(b)).join(', ') || '...')}
                        </span>
                      </Dropdown.Toggle>
                      <Dropdown.Menu 
                        renderOnMount
                        flip={false}
                        popperConfig={{ 
                          strategy: 'fixed',
                          modifiers: [
                            { name: 'computeStyles', options: { gpuAcceleration: false } },
                            { name: 'preventOverflow', options: { boundary: 'viewport' } }
                          ]
                        }}
                        className="custom-scrollbar border-0 shadow-lg mt-2" 
                        style={{ maxHeight: '250px', background: 'var(--theme-background-secondary)', width: '220px', borderRadius: '0', zIndex: 99999 }}
                      >
                        <div className="px-3 py-2 d-flex align-items-center gap-2 border-bottom border-secondary border-opacity-10" onClick={(e) => handleSelectAllWeeks(e)} style={{ cursor: 'pointer' }}>
                          <Form.Check type="checkbox" checked={selectedSemanas.length === availableSemanas.length && availableSemanas.length > 0} readOnly />
                          <span className="fw-black text-danger" style={{ fontSize: '0.7rem' }}>TODAS LAS SEMANAS</span>
                        </div>
                        {availableSemanas.length === 0 ? (
                          <div className="px-3 py-3 text-center text-muted fw-bold" style={{ fontSize: '0.65rem' }}>
                            SIN SEMANAS DISPONIBLES
                          </div>
                        ) : availableSemanas.map(sem => (
                          <div key={sem} className="px-3 py-1 d-flex align-items-center gap-2 dropdown-item-custom" onClick={(e) => handleSemanaToggle(sem, e)} style={{ cursor: 'pointer' }}>
                            <Form.Check type="checkbox" checked={selectedSemanas.includes(sem)} readOnly />
                            <span className="fw-bold" style={{ fontSize: '0.75rem', color: 'var(--theme-text-primary)' }}>SEMANA {sem}</span>
                          </div>
                        ))}
                      </Dropdown.Menu>
                    </Dropdown>
                  </div>
                </div>
              </Col>
            </>
          )}

          {selectedReportType === 'BEBIDAS' && (
            <Col xs={12} md={4}>
              <div className="info-pill-new w-100">
                <span className="pill-icon-sober text-info p-1"><FaGlassMartiniAlt className="pill-main-icon"/></span>
                <div className="pill-content flex-grow-1 ps-2">
                  <span className="pill-label">CATEGORÍAS ({selectedBebidaTypes.length})</span>
                  <Dropdown autoClose="outside" className="w-100 border-0 shadow-none">
                    <Dropdown.Toggle 
                      as="div"
                      className="pill-select-v2 w-100 text-start d-flex justify-content-between align-items-center p-0" 
                      style={{ background: 'none', border: 'none', boxShadow: 'none', cursor: 'pointer' }}
                    >
                      <span className="text-truncate" style={{ maxWidth: '180px' }}>
                        {selectedBebidaTypes.length === beverageTypes.length && beverageTypes.length > 0 
                          ? 'TODAS' 
                          : (beverageTypes.filter(t => selectedBebidaTypes.includes(t.id)).map(t => t.nombre.toUpperCase()).join(', ') || '...')}
                      </span>
                    </Dropdown.Toggle>
                    <Dropdown.Menu 
                      renderOnMount
                      flip={false}
                      popperConfig={{ 
                        strategy: 'fixed',
                        modifiers: [
                          { name: 'computeStyles', options: { gpuAcceleration: false } },
                          { name: 'preventOverflow', options: { boundary: 'viewport' } }
                        ]
                      }}
                      className="custom-scrollbar border-0 shadow-lg mt-2" 
                      style={{ 
                        maxHeight: '400px', 
                        overflowY: 'auto',
                        background: 'var(--theme-background-secondary)', 
                        minWidth: '240px', 
                        width: 'auto',
                        borderRadius: '0', 
                        zIndex: 99999 
                      }}
                    >
                      <div className="px-3 py-2 d-flex align-items-center gap-2 border-bottom border-secondary border-opacity-10" onClick={(e) => { e.stopPropagation(); handleSelectAllBebidas(e); }} style={{ cursor: 'pointer' }}>
                        <Form.Check type="checkbox" checked={selectedBebidaTypes.length === beverageTypes.length && beverageTypes.length > 0} readOnly />
                        <span className="fw-black text-danger" style={{ fontSize: '0.7rem' }}>TODAS LAS CATEGORÍAS</span>
                      </div>
                      {beverageTypes.length === 0 ? (
                        <div className="px-3 py-3 text-center text-muted fw-bold" style={{ fontSize: '0.65rem' }}>
                          SIN CATEGORÍAS DISPONIBLES
                        </div>
                      ) : beverageTypes.map(type => (
                        <div key={type.id} className="px-3 py-1 d-flex align-items-center gap-2 dropdown-item-custom" onClick={(e) => handleBebidaTypeToggle(type.id, e)} style={{ cursor: 'pointer' }}>
                          <Form.Check type="checkbox" checked={selectedBebidaTypes.includes(type.id)} readOnly />
                          <span className="fw-bold" style={{ fontSize: '0.75rem', color: 'var(--theme-text-primary)' }}>{type.nombre.toUpperCase()}</span>
                        </div>
                      ))}
                    </Dropdown.Menu>
                  </Dropdown>
                </div>
              </div>
            </Col>
          )}

          <Col xs={12} md={selectedReportType === 'VOLUMEN' || selectedReportType === 'DUPLICADOS' ? 8 : 4}>
            <div className="info-pill-new w-100">
              <span className="pill-icon-sober text-success p-1"><FaSyncAlt className="pill-main-icon"/></span>
              <div className="pill-content flex-grow-1">
                <span className="pill-label">DEMANDA</span>
                <div className="sincro-val">
                  {selectedReportType === 'EFICIENCIA' ? eficienciaMetadata?.lastUpdated : selectedReportType === 'BEBIDAS' ? bebidasMetadata?.lastUpdated : selectedReportType === 'DUPLICADOS' ? duplicadosMetadata?.lastUpdated : volumenMetadata?.lastUpdated || 'SIN DATOS'}
                </div>
              </div>
            </div>
          </Col>
        </Row>
      </div>

      <div className="admin-section-table flex-grow-1 p-0 overflow-hidden">
        <div className="h-100 overflow-auto custom-scrollbar p-3">
          {loadingMasterData || loading ? <GlobalSpinner variant={SPINNER_VARIANTS.IN_PAGE} /> : (
            <div className="report-main-wrapper">
              {selectedReportType === 'VOLUMEN' && renderVolumenReport()}
              {selectedReportType === 'EFICIENCIA' && renderEficienciaReport()}
              {selectedReportType === 'BEBIDAS' && renderBebidasReport()}
              {selectedReportType === 'DUPLICADOS' && renderDuplicadosReport()}
            </div>
          )}
        </div>
      </div>

      <style>{`
        .admin-layout-container { background: var(--theme-background-primary); height: 100vh; display: flex; flex-direction: column; }
        .fw-black { font-weight: 900 !important; }
        .l-height-1 { letter-spacing: 0.5px; font-size: 0.8rem; color: var(--theme-text-primary); }
        .sub-label { font-size: 0.55rem; color: var(--theme-text-secondary); opacity: 0.7; }
        
        .info-pill-new { display: flex; align-items: center; background-color: var(--theme-background-secondary); border: 1px solid var(--theme-border-default); border-radius: 0; height: 38px; position: relative; }
        .pill-icon-sober { background-color: var(--theme-icon-bg); color: var(--theme-icon-color); height: 100%; display: flex; align-items: center; border-right: 1px solid var(--theme-border-default); min-width: 32px; justify-content: center; z-index: 2; }
        .pill-main-icon { font-size: 14px; }
        .pill-content { padding: 0 10px; display: flex; flex-direction: column; justify-content: center; min-width: 0; flex-grow: 1; position: relative; z-index: 1; }
        .pill-label { font-size: 0.5rem; font-weight: 600; opacity: 0.6; text-transform: uppercase; color: var(--theme-text-primary); margin-bottom: -1px; }
        .pill-select-v2 { background: transparent !important; border: none !important; color: var(--theme-text-primary) !important; font-weight: 600; font-size: 0.85rem; padding: 0 !important; margin-top: -2px; box-shadow: none !important; }
        .sincro-val { font-size: 0.75rem; color: var(--theme-text-primary); margin-top: -2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 600; }

        .report-main-wrapper { display: flex; flex-direction: column; gap: 1rem; width: 100%; align-items: center; }
        .report-container-stable { width: 100%; display: block; }

        .dropdown-item-custom { display: flex; align-items: center; gap: 10px; padding: 8px 15px; cursor: pointer; transition: background 0.2s ease; border-bottom: 1px solid rgba(255,255,255,0.05); background: transparent !important; }
        .dropdown-item-custom:hover { background: rgba(244, 0, 9, 0.15) !important; }

        .loc-accordion-item { background: var(--theme-background-secondary) !important; border: 1px solid var(--theme-border-default) !important; border-radius: 0 !important; overflow: hidden; }
        .loc-header-compact .accordion-button { background: transparent !important; box-shadow: none !important; padding: 10px !important; border-radius: 0 !important; width: 100%; }
        .loc-header-compact .accordion-button:not(.collapsed) { background: transparent !important; color: inherit !important; box-shadow: none !important; }
        .loc-header-compact .accordion-button:after { display: none; }
        .loc-avatar { width: 38px; height: 38px; background: var(--color-red-primary); color: white; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 0.9rem; }
        .badge-industrial { padding: 6px 10px; display: flex; flex-direction: column; align-items: center; border-radius: 0; min-width: 50px; }
        .b-label { font-size: 0.5rem; font-weight: 800; }

        .mesa-title-bar { background: var(--theme-icon-bg); border-left: 4px solid var(--color-red-primary); }
        .m-label { font-size: 0.7rem; color: var(--theme-text-primary); }
        .m-stats { font-size: 0.6rem; color: var(--theme-text-secondary); text-transform: uppercase; }

        .ruta-card-compact { background: var(--theme-background-primary); border: 1px solid var(--theme-border-default); border-radius: 0; width: 100%; }
        .r-label { font-size: 0.7rem; color: var(--theme-text-primary); }
        .r-val { font-size: 0.75rem; }
        .r-unit { font-size: 0.55rem; opacity: 0.7; }
        .chevron-icon { font-size: 0.6rem; transition: transform 0.2s ease; color: var(--theme-text-secondary); }
        .chevron-icon.active { transform: rotate(90deg); color: var(--color-red-primary); }

        .p-name { font-size: 0.65rem; color: var(--theme-text-primary); }
        .p-sap { font-size: 0.55rem; color: #00d1ff; }
        .p-badge { font-size: 0.6rem; border-radius: 0; font-weight: 900; }

        .r-dot-leader { flex-grow: 1; border-bottom: 2px dotted var(--theme-border-default); margin: 0 15px; opacity: 0.2; align-self: center; margin-bottom: 4px; }
        .p-dot-leader { flex-grow: 1; border-bottom: 1px dotted var(--theme-border-default); margin: 0 10px; opacity: 0.15; align-self: center; margin-bottom: 3px; }

        .dash-chart-box { background: var(--theme-background-secondary); border: 1px solid var(--theme-border-default); padding: 15px; }
        .dash-chart-header { font-size: 0.6rem; font-weight: 900; color: var(--theme-text-secondary); text-transform: uppercase; border-left: 3px solid var(--color-red-primary); padding-left: 8px; margin-bottom: 10px; }

        @media (min-width: 992px) {
          .info-pill-new { height: 48px; }
          .pill-icon-sober { min-width: 40px; }
          .pill-main-icon { font-size: 18px; }
          .pill-label { font-size: 0.65rem; }
          .pill-select-v2 { font-size: 1.05rem; }
          .sincro-val { font-size: 0.95rem; }

          .report-container-stable {
            max-width: 1350px;
          }
          .l-height-1 { font-size: 1.1rem; }
          .sub-label { font-size: 0.7rem; }
          .m-label { font-size: 0.9rem; }
          .m-stats { font-size: 0.8rem; }
          .r-label { font-size: 1rem; }
          .r-val { font-size: 1.1rem; }
          .r-unit { font-size: 0.75rem; }
          .p-name { font-size: 0.85rem; }
          .p-sap { font-size: 0.75rem; }
          .p-badge { font-size: 0.8rem; }

          .d-label { font-size: 0.8rem !important; }
          .dup-doc-id { font-size: 0.9rem !important; }
          .dup-doc-hora { font-size: 0.8rem !important; }
          .dup-item-name { font-size: 0.85rem !important; }
          .dup-item-sap { font-size: 0.75rem !important; }
          .dup-item-cant { font-size: 0.9rem !important; }
        }
      `}</style>
    </div>
  );
};

export default SupervisorPage;
