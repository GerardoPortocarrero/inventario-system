import type { FC } from 'react';
import { useState, useEffect, useMemo, useCallback, memo, Fragment } from 'react';
import { Row, Col, Form, Badge, Accordion, ListGroup, Dropdown, Spinner, Button, Modal, Table } from 'react-bootstrap';
import { rtdb, db } from '../api/firebase';
import { ref, onValue } from 'firebase/database';
import { collection, getDocs } from 'firebase/firestore';
import { useData } from '../context/DataContext';
import { SPINNER_VARIANTS } from '../constants';
import useMediaQuery from '../hooks/useMediaQuery';
import { FaWarehouse, FaFilter, FaGlassMartiniAlt, FaChevronRight, FaSyncAlt, FaCalendarAlt, FaExclamationTriangle, FaCopy, FaBox, FaSlidersH } from 'react-icons/fa';
import html2canvas from 'html2canvas';
import GlobalSpinner from '../components/GlobalSpinner';

type ReportType = 'VOLUMEN' | 'EFICIENCIA' | 'BEBIDAS' | 'DUPLICADOS' | 'COBERTURA';

// --- COMPONENTES MEMOIZADOS PARA MANTENER EL DISEÑO Y GANAR FLUIDEZ ---

const RutaVolumenBebidaItem = memo(({ 
  rutaName, ruta, isExpanded, onToggle, rutaKey 
}: { 
  rutaName: string, ruta: any, isExpanded: boolean, onToggle: (key: string) => void, rutaKey: string 
}) => {
  return (
    <Col xs={12}>
      <div className={`ruta-card-compact ${isExpanded ? 'expanded' : ''}`}>
        <div className="ruta-main-row d-flex justify-content-between align-items-center" onClick={() => onToggle(rutaKey)}>
          <div className="d-flex align-items-center gap-2 flex-grow-1 overflow-hidden">
            <div className={`chevron-icon ${isExpanded ? 'active' : ''}`}><FaChevronRight /></div>
            <span className="r-label text-nowrap">RUTA {rutaName}</span>
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
                    <Badge bg="secondary" className="p-badge border border-secondary border-opacity-25" style={{ backgroundColor: 'var(--theme-background-tertiary)', color: 'var(--theme-text-primary)' }}>{p.cantU} UND</Badge>
                    <Badge bg="secondary" className="p-badge border border-secondary border-opacity-25" style={{ backgroundColor: 'var(--theme-background-secondary)', color: 'var(--theme-text-primary)' }}>{p.cantC.toFixed(1)} CJ</Badge>
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
        <div className="ruta-main-row d-flex justify-content-between align-items-center">
          <div className="d-flex align-items-center gap-2 flex-grow-1 overflow-hidden">
            <div style={{ width: '12px' }}></div>
            <span className="r-label text-nowrap">RUTA {rutaName}</span>
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
  const { sedes, loadingMasterData, beverageTypes, marcas } = useData();
  const isMobile = useMediaQuery('(max-width: 991px)');
  const cleanId = useCallback((id: any) => String(id || '').trim().replace(/^0+/, ''), []);

  // Estados para datos
  const [volumenReport, setVolumenReport] = useState<any[]>([]);
  const [volumenMetadata, setVolumenMetadata] = useState<any>(null);
  const [eficienciaReport, setEficienciaReport] = useState<any[]>([]);
  const [eficienciaMetadata, setEficienciaMetadata] = useState<any>(null);
  const [bebidasReport, setBebidasReport] = useState<any[]>([]);
  const [bebidasMetadata, setBebidasMetadata] = useState<any>(null);
  const [duplicadosReport, setDuplicadosReport] = useState<any[]>([]);
  const [duplicadosMetadata, setDuplicadosMetadata] = useState<any>(null);
  const [coberturaReport, setCoberturaReport] = useState<any[]>([]);
  const [coberturaMetadata, setCoberturaMetadata] = useState<any>(null);
  const [supProducts, setSupProducts] = useState<any[]>([]);
  const [maestroData, setMaestroData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros COBERTURA (espejo de Analítica Pro)
  const [selectedDiaCobertura, setSelectedDiaCobertura] = useState<string>('ALL');
  const [selectedSubCanalCobertura, setSelectedSubCanalCobertura] = useState<string>('ALL');
  const [selectedTipoCobertura, setSelectedTipoCobertura] = useState<string>('');
  const [selectedMarcasCobertura, setSelectedMarcasCobertura] = useState<string[]>([]);
  const [selectedProductosCobertura, setSelectedProductosCobertura] = useState<string[]>([]);
  const [showCoberturaModal, setShowCoberturaModal] = useState(false);
  const [tempDiaCobertura, setTempDiaCobertura] = useState<string>('ALL');
  const [tempSubCanalCobertura, setTempSubCanalCobertura] = useState<string>('ALL');
  const [tempTipoBebidaCobertura, setTempTipoBebidaCobertura] = useState<string>('');
  const [tempMarcasCobertura, setTempMarcasCobertura] = useState<string[]>([]);
  const [tempProductosCobertura, setTempProductosCobertura] = useState<string[]>([]);
  
  const [selectedSedeId, setSelectedSedeId] = useState<string>(() => localStorage.getItem('sup_selectedSedeId') || 'GLOBAL');
  const [selectedReportType, setSelectedReportType] = useState<ReportType>(() => (localStorage.getItem('sup_selectedReportType') as ReportType) || 'VOLUMEN');
  
  // Filtros para Eficiencia
  const [selectedDia, setSelectedDia] = useState<string>(() => localStorage.getItem('sup_selectedDia') || ['LU', 'MA', 'MI', 'JU', 'VI', 'SA', 'DO'][new Date().getDay() === 0 ? 6 : new Date().getDay() - 1]);
  const [selectedSemanas, setSelectedSemanas] = useState<string[]>(() => {
    const saved = localStorage.getItem('sup_selectedSemanas');
    return saved ? JSON.parse(saved) : [];
  });
  const [selectedBebidaTypes, setSelectedBebidaTypes] = useState<string[]>(() => {
    const saved = localStorage.getItem('sup_selectedBebidaTypes');
    return saved ? JSON.parse(saved) : [];
  });
  const [selectedBebidaProducts, setSelectedBebidaProducts] = useState<string[]>(() => {
    const saved = localStorage.getItem('sup_selectedBebidaProducts');
    return saved ? JSON.parse(saved) : [];
  });
  const [expandedRutas, setExpandedRutas] = useState<Record<string, boolean>>({});

  // Efectos para persistencia
  useEffect(() => { localStorage.setItem('sup_selectedSedeId', selectedSedeId); }, [selectedSedeId]);
  useEffect(() => { localStorage.setItem('sup_selectedReportType', selectedReportType); }, [selectedReportType]);
  useEffect(() => { localStorage.setItem('sup_selectedDia', selectedDia); }, [selectedDia]);
  useEffect(() => { localStorage.setItem('sup_selectedSemanas', JSON.stringify(selectedSemanas)); }, [selectedSemanas]);
  useEffect(() => { localStorage.setItem('sup_selectedBebidaTypes', JSON.stringify(selectedBebidaTypes)); }, [selectedBebidaTypes]);
  useEffect(() => { localStorage.setItem('sup_selectedBebidaProducts', JSON.stringify(selectedBebidaProducts)); }, [selectedBebidaProducts]);

  // Estado para controlar qué sede está abierta en el acordeón (Lazy Rendering técnico)
  const [activeLocId, setActiveLocId] = useState<string | null>(null);
  const [capturingLocId, setCapturingLocId] = useState<string | null>(null);

  // Inicializar tipos de bebida solo si no hay persistencia
  useEffect(() => {
    if (beverageTypes.length > 0 && selectedBebidaTypes.length === 0 && !localStorage.getItem('sup_selectedBebidaTypes')) {
      setSelectedBebidaTypes(beverageTypes.map(t => t.id));
    }
  }, [beverageTypes, selectedBebidaTypes.length]);

  useEffect(() => {
    setLoading(true);
    let reportsToLoad = 5;
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

    const coberturaRef = ref(rtdb, 'reportes/cobertura');
    const unsubCobertura = onValue(coberturaRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        setCoberturaReport(data.data || []);
        setCoberturaMetadata(data.metadata || null);
      }
      checkLoaded();
    });

    const maestroRef = ref(rtdb, 'maestro/data');
    const unsubMaestro = onValue(maestroRef, (snapshot) => {
      if (snapshot.exists()) {
        setMaestroData(snapshot.val());
      }
    });

    return () => { unsubVolumen(); unsubEficiencia(); unsubBebidas(); unsubDuplicados(); unsubCobertura(); unsubMaestro(); };
  }, []);

  // Carga perezosa de productos para el reporte COBERTURA
  useEffect(() => {
    if (selectedReportType !== 'COBERTURA') return;
    let active = true;
    setSupProducts([]);
    getDocs(collection(db, 'productos'))
      .then(snap => { if (active) setSupProducts(snap.docs.map(d => ({ id: d.id, ...d.data() } as any))); })
      .catch(console.error);
    return () => { active = false; };
  }, [selectedReportType]);

  const maestroMap = useMemo(() => {
    const map: Record<string, any> = {};
    maestroData.forEach(m => { map[String(m.Codigo)] = m; });
    return map;
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
    if (selectedSemanas.length === 0 && availableSemanas.length > 0 && !localStorage.getItem('sup_selectedSemanas')) {
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
    const raw = selectedSedeId === 'GLOBAL' ? volumenReport : volumenReport.filter(loc => String(loc.id).trim() === String(sedes.find(s => s.id === selectedSedeId)?.codigo).trim());
    return raw.map(loc => ({
      ...loc,
      nombre: sedes.find(s => String(s.codigo).trim() === String(loc.id).trim())?.nombre.toUpperCase() || `SEDE ${loc.id}`
    }));
  }, [volumenReport, selectedSedeId, sedes]);

  const filteredBebidasData = useMemo(() => {
    let data = selectedSedeId === 'GLOBAL' ? bebidasReport : bebidasReport.filter(loc => String(loc.id).trim() === String(sedes.find(s => s.id === selectedSedeId)?.codigo).trim());
    if (selectedBebidaTypes.length === 0) return [];
    const productFiltering = selectedBebidaProducts.length > 0;
    return data.map(loc => {
      const newTipos: Record<string, any> = {};
      let totalCF = 0;
      let totalUC = 0;
      Object.entries(loc.tipos || {}).forEach(([tipoId, tipo]: [string, any]) => {
        if (!selectedBebidaTypes.includes(tipoId)) return;
        if (!productFiltering) {
          newTipos[tipoId] = tipo;
          totalCF += tipo.totalCF || 0;
          totalUC += tipo.totalUC || 0;
          return;
        }
        const newRutas: Record<string, any> = {};
        Object.entries(tipo.rutas || {}).forEach(([rutaName, ruta]: [string, any]) => {
          const newProductos: Record<string, any> = {};
          let rCF = 0;
          let rUC = 0;
          Object.entries(ruta.productos || {}).forEach(([sap, p]: [string, any]) => {
            if (selectedBebidaProducts.includes(sap)) {
              newProductos[sap] = p;
              rCF += p.cantC || 0;
              rUC += p.uc || 0;
            }
          });
          if (Object.keys(newProductos).length > 0) {
            newRutas[rutaName] = { ...ruta, productos: newProductos, totalCF: rCF, totalUC: rUC };
          }
        });
        if (Object.keys(newRutas).length > 0) {
          const tCF = Object.values(newRutas).reduce((acc, r: any) => acc + r.totalCF, 0);
          const tUC = Object.values(newRutas).reduce((acc, r: any) => acc + r.totalUC, 0);
          newTipos[tipoId] = { ...tipo, rutas: newRutas, totalCF: tCF, totalUC: tUC };
          totalCF += tCF;
          totalUC += tUC;
        }
      });
      if (Object.keys(newTipos).length === 0) return null;
      const sede = sedes.find(s => String(s.codigo).trim() === String(loc.id).trim());
      return { 
        ...loc, 
        tipos: newTipos,
        totalCF,
        totalUC,
        nombre: sede ? sede.nombre.toUpperCase() : `SEDE ${loc.id}`
      };
    }).filter(Boolean);
  }, [bebidasReport, selectedSedeId, sedes, selectedBebidaTypes, selectedBebidaProducts]);

  const filteredDuplicadosData = useMemo(() => {
    const raw = selectedSedeId === 'GLOBAL' ? duplicadosReport : duplicadosReport.filter(loc => String(loc.id).trim() === String(sedes.find(s => s.id === selectedSedeId)?.codigo).trim());
    return raw.map(loc => ({
      ...loc,
      nombre: sedes.find(s => String(s.codigo).trim() === String(loc.id).trim())?.nombre.toUpperCase() || `SEDE ${loc.id}`
    }));
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

  const availableBebidaProducts = useMemo(() => {
    const map = new Map<string, string>();
    bebidasReport.forEach(loc => {
      Object.entries(loc.tipos || {}).forEach(([tipoId, tipo]: [string, any]) => {
        if (!selectedBebidaTypes.includes(tipoId)) return;
        Object.entries(tipo.rutas || {}).forEach(([, ruta]: [string, any]) => {
          Object.entries(ruta.productos || {}).forEach(([sap, p]: [string, any]) => {
            if (!map.has(sap)) map.set(sap, p.nombre || sap);
          });
        });
      });
    });
    return Array.from(map.entries())
      .map(([sap, nombre]) => ({ sap, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [bebidasReport, selectedBebidaTypes]);

  const handleBebidaProductToggle = (sap: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedBebidaProducts(prev => prev.includes(sap) ? prev.filter(p => p !== sap) : [...prev, sap]);
  };

  const handleSelectAllBebidaProducts = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedBebidaProducts.length === availableBebidaProducts.length) {
      setSelectedBebidaProducts([]);
    } else {
      setSelectedBebidaProducts(availableBebidaProducts.map(p => p.sap));
    }
  };

  const filteredEficienciaData = useMemo(() => {
    if (selectedSedeId === 'GLOBAL') {
      if (selectedSemanas.length === 0) return [];
      return eficienciaReport.map(loc => {
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
          const sede = sedes.find(s => String(s.codigo).trim() === String(loc.id).trim());
          return { 
            ...loc, 
            mesas: newMesas, totalProg, totalEfec,
            nombre: sede ? sede.nombre.toUpperCase() : `SEDE ${loc.id}`
          };
        }
        return null;
      }).filter(Boolean);
    }

    const targetCodigo = String(sedes.find(s => s.id === selectedSedeId)?.codigo || '').trim();
    const locData = eficienciaReport.find(loc => String(loc.id).trim() === targetCodigo);
    
    if (!locData || selectedSemanas.length === 0) return [];

    const newMesas: Record<string, any> = {};
    Object.entries(locData.mesas || {}).forEach(([mesaName, mesa]: [string, any]) => {
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
      const sede = sedes.find(s => String(s.codigo).trim() === String(locData.id).trim());
      return [{ 
        ...locData, 
        mesas: newMesas, totalProg, totalEfec,
        nombre: sede ? sede.nombre.toUpperCase() : `SEDE ${locData.id}`
      }];
    }
    
    return [];
  }, [eficienciaReport, selectedSedeId, sedes, selectedDia, selectedSemanas]);

  const availableSubCanalesCob = useMemo(() => {
    const s = new Set<string>();
    maestroData.forEach(m => { if (m.SubCanal) s.add(String(m.SubCanal).trim()); });
    return Array.from(s).sort();
  }, [maestroData]);

  const brandGroupsCob = useMemo(() => {
    if (selectedTipoCobertura === 'ALL') {
      return new Map<string, string[]>([['__ALL__', [...selectedMarcasCobertura]]]);
    }
    const groups = new Map<string, string[]>();
    selectedMarcasCobertura.forEach(mId => {
      const marca = marcas.find(m => m.id === mId);
      if (!marca) return;
      const tipoId = marca.tipoBebidaId || '__none__';
      if (!groups.has(tipoId)) groups.set(tipoId, []);
      groups.get(tipoId)!.push(mId);
    });
    return groups;
  }, [selectedMarcasCobertura, marcas, selectedTipoCobertura]);

  const typeColumnHeadersCob = useMemo(() => {
    return Array.from(brandGroupsCob.entries()).map(([tipoId, brandIds]) => {
      const typeName = tipoId === '__ALL__' ? 'TODOS' : (beverageTypes.find(t => t.id === tipoId)?.nombre || tipoId);
      return { tipoId, typeName, brandIds };
    });
  }, [brandGroupsCob, beverageTypes]);

  const selectedTipoNombreCob = selectedTipoCobertura === 'ALL' ? 'TODOS' : (beverageTypes.find(t => t.id === selectedTipoCobertura)?.nombre?.toUpperCase() || 'TIPO');

  const activeFilterCobCount = [
    selectedDiaCobertura !== 'ALL' && 1,
    selectedSubCanalCobertura !== 'ALL' && 1,
    selectedTipoCobertura && selectedTipoCobertura !== 'ALL' && 1,
    selectedProductosCobertura.length > 0 && 1
  ].filter(Boolean).length;

  const filteredMarcasCob = tempTipoBebidaCobertura === 'ALL' ? marcas : marcas.filter(m => m.tipoBebidaId === tempTipoBebidaCobertura);
  const filteredProductosCob = tempMarcasCobertura.length === 0 ? [] : supProducts.filter(p => tempMarcasCobertura.includes(p.marcaId));

  const handleOpenCoberturaModal = () => {
    setTempDiaCobertura(selectedDiaCobertura);
    setTempSubCanalCobertura(selectedSubCanalCobertura);
    setTempTipoBebidaCobertura(selectedTipoCobertura === 'ALL' ? 'ALL' : (beverageTypes.some(t => t.id === selectedTipoCobertura) ? selectedTipoCobertura : (beverageTypes[0]?.id || '')));
    setTempMarcasCobertura(selectedTipoCobertura ? selectedMarcasCobertura : marcas.filter(m => m.tipoBebidaId === (beverageTypes[0]?.id || '')).map(m => m.id));
    setTempProductosCobertura(selectedProductosCobertura);
    setShowCoberturaModal(true);
  };

  const handleTipoBebidaCobChange = (tipoId: string) => {
    setTempTipoBebidaCobertura(tipoId);
    setTempMarcasCobertura(tipoId === 'ALL' ? marcas.map(m => m.id) : marcas.filter(m => m.tipoBebidaId === tipoId).map(m => m.id));
    setTempProductosCobertura([]);
  };

  const handleToggleMarcaCob = (marcaId: string) => {
    setTempMarcasCobertura(prev => prev.includes(marcaId) ? prev.filter(id => id !== marcaId) : [...prev, marcaId]);
    setTempProductosCobertura([]);
  };

  const handleApplyCobertura = () => {
    setSelectedDiaCobertura(tempDiaCobertura);
    setSelectedSubCanalCobertura(tempSubCanalCobertura);
    setSelectedTipoCobertura(tempTipoBebidaCobertura === 'ALL' ? 'ALL' : tempTipoBebidaCobertura);
    setSelectedMarcasCobertura(tempMarcasCobertura);
    setSelectedProductosCobertura(tempProductosCobertura);
    setShowCoberturaModal(false);
  };

  const handleCancelCobertura = () => setShowCoberturaModal(false);

  const clearCoberturaFilters = () => {
    setSelectedDiaCobertura('ALL');
    setSelectedSubCanalCobertura('ALL');
    setSelectedTipoCobertura('');
    setSelectedMarcasCobertura([]);
    setSelectedProductosCobertura([]);
  };

  const groupSumCob = (total: Record<string, { cf: number; cu: number }>, brandIds: string[]) =>
    brandIds.reduce((acc, bId) => {
      const v = total[bId];
      return { cf: acc.cf + (v?.cf || 0), cu: acc.cu + (v?.cu || 0) };
    }, { cf: 0, cu: 0 });

  const groupHasCob = (total: Record<string, any>, brandIds: string[]) => brandIds.some(bId => total[bId] !== undefined);

  const filteredCoberturaData = useMemo(() => {
    if (selectedReportType !== 'COBERTURA' || typeColumnHeadersCob.length === 0) return [];
    const raw = selectedSedeId === 'GLOBAL'
      ? coberturaReport
      : coberturaReport.filter(loc => String(loc.id).trim() === String(sedes.find(s => s.id === selectedSedeId)?.codigo).trim());

    const prodMap = supProducts.reduce((acc, p) => ({ ...acc, [cleanId(p.sap)]: p }), {} as Record<string, any>);
    const UNIT_CASE_ML = 5677.92;
    const resultado: any[] = [];

    const calcMat = (mat: any): { marcaId: string; cf: number; cu: number } | null => {
      const prod = prodMap[cleanId(mat.sku)];
      if (!prod) return null;
      if (!selectedMarcasCobertura.includes(prod.marcaId)) return null;
      if (selectedProductosCobertura.length > 0 && !selectedProductosCobertura.includes(cleanId(mat.sku))) return null;
      const unitsPerCase = parseFloat(prod.unidades) || 1;
      const mlPerUnit = parseFloat(prod.mililitros) || 0;
      const medida = String(mat.medida || '').toUpperCase();
      const isCase = (medida === 'CAJ' || medida === 'CJ' || medida === 'CS' || medida === 'CASE' || medida.includes('CJ'));
      const totalUnits = isCase ? (mat.cantidad * unitsPerCase) : mat.cantidad;
      let cf = 0;
      if (mlPerUnit > 0) cf = isCase ? mat.cantidad : (mat.cantidad / unitsPerCase);
      const cu = (totalUnits * mlPerUnit) / UNIT_CASE_ML;
      return { marcaId: prod.marcaId, cf, cu };
    };

    raw.forEach(loc => {
      const locTotal: Record<string, { cf: number; cu: number }> = {};
      const locClients = new Set<string>();
      const locTipoClients: Record<string, Set<string>> = {};
      const mesasOut: Record<string, any> = {};

      Object.entries(loc.mesas || {}).forEach(([mesaName, mesa]: [string, any]) => {
        const mesaTotal: Record<string, { cf: number; cu: number }> = {};
        const mesaClients = new Set<string>();
        const mesaTipoClients: Record<string, Set<string>> = {};
        const rutasOut: Record<string, any> = {};

        Object.entries(mesa.rutas || {}).forEach(([rutaName, ruta]: [string, any]) => {
          const rTotal: Record<string, { cf: number; cu: number }> = {};
          const rClients = new Set<string>();
          const rTipoClients: Record<string, Set<string>> = {};

          Object.entries(ruta.clientes || {}).forEach(([cid, cliente]: [string, any]) => {
            if (selectedSubCanalCobertura !== 'ALL' && String(cliente.subCanal).trim() !== selectedSubCanalCobertura) return;
            if (selectedDiaCobertura !== 'ALL' && !((cliente.dias || []) as string[]).includes(selectedDiaCobertura)) return;

            const marcaIds: string[] = [];
            Object.values(cliente.materiales || {}).forEach((mat: any) => {
              const c = calcMat(mat);
              if (!c) return;
              if (!rTotal[c.marcaId]) rTotal[c.marcaId] = { cf: 0, cu: 0 };
              rTotal[c.marcaId].cf += c.cf;
              rTotal[c.marcaId].cu += c.cu;
              if (!mesaTotal[c.marcaId]) mesaTotal[c.marcaId] = { cf: 0, cu: 0 };
              mesaTotal[c.marcaId].cf += c.cf;
              mesaTotal[c.marcaId].cu += c.cu;
              if (!locTotal[c.marcaId]) locTotal[c.marcaId] = { cf: 0, cu: 0 };
              locTotal[c.marcaId].cf += c.cf;
              locTotal[c.marcaId].cu += c.cu;
              if (!marcaIds.includes(c.marcaId)) marcaIds.push(c.marcaId);
            });

            if (marcaIds.length > 0) {
              rClients.add(cid);
              mesaClients.add(cid);
              locClients.add(cid);
            }

            marcaIds.forEach(mId => {
              const tipoId = marcas.find(m => m.id === mId)?.tipoBebidaId;
              if (!tipoId) return;
              if (!rTipoClients[tipoId]) rTipoClients[tipoId] = new Set();
              rTipoClients[tipoId].add(cid);
              if (!mesaTipoClients[tipoId]) mesaTipoClients[tipoId] = new Set();
              mesaTipoClients[tipoId].add(cid);
              if (!locTipoClients[tipoId]) locTipoClients[tipoId] = new Set();
              locTipoClients[tipoId].add(cid);
            });
          });

          if (rClients.size > 0 || Object.keys(rTotal).length > 0) {
            if (selectedTipoCobertura === 'ALL') rTipoClients['__ALL__'] = rClients;
            rutasOut[rutaName] = {
              total: rTotal,
              totalClientesRuta: rClients.size,
              cliConVentaPorTipo: Object.fromEntries(Object.entries(rTipoClients).map(([t, s]) => [t, (s as Set<string>).size]))
            };
          }
        });

        if (mesaClients.size > 0 || Object.keys(mesaTotal).length > 0) {
          if (selectedTipoCobertura === 'ALL') mesaTipoClients['__ALL__'] = mesaClients;
          mesasOut[mesaName] = {
            total: mesaTotal,
            totalClientesMesa: mesaClients.size,
            cliConVentaPorTipo: Object.fromEntries(Object.entries(mesaTipoClients).map(([t, s]) => [t, (s as Set<string>).size])),
            rutas: rutasOut
          };
        }
      });

      if (locClients.size > 0 || Object.keys(locTotal).length > 0) {
        if (selectedTipoCobertura === 'ALL') locTipoClients['__ALL__'] = locClients;
        const sede = sedes.find(s => String(s.codigo).trim() === String(loc.id).trim());
        resultado.push({
          id: loc.id,
          nombre: sede ? sede.nombre.toUpperCase() : `SEDE ${loc.id}`,
          total: locTotal,
          totalClientesLoc: locClients.size,
          cliConVentaPorTipo: Object.fromEntries(Object.entries(locTipoClients).map(([t, s]) => [t, (s as Set<string>).size])),
          mesas: mesasOut
        });
      }
    });

    return resultado;
  }, [coberturaReport, selectedSedeId, sedes, supProducts, marcas, selectedSubCanalCobertura, selectedDiaCobertura, selectedMarcasCobertura, selectedProductosCobertura, typeColumnHeadersCob, selectedReportType, selectedTipoCobertura, cleanId]);

  const toggleRuta = useCallback((rutaKey: string) => setExpandedRutas(prev => ({ ...prev, [rutaKey]: !prev[rutaKey] })), []);

  const handleCaptureSede = useCallback(async (locId: string, reportType: ReportType) => {
    if (capturingLocId) return;
    const el = document.getElementById(`sup-capture-${reportType}-${locId}`);
    if (!el) return;
    setCapturingLocId(locId);

    await new Promise(r => setTimeout(r, 50));

    try {
      const original = el;
      const clone = original.cloneNode(true) as HTMLElement;
      clone.style.position = 'fixed';
      clone.style.top = '-9999px';
      clone.style.left = '0px';
      clone.style.overflow = 'visible';
      clone.style.height = 'auto';
      clone.style.width = original.scrollWidth + 'px';
      clone.style.maxHeight = 'none';

      clone.querySelectorAll('.sticky-column, thead').forEach(node => {
        (node as HTMLElement).style.position = 'static';
        (node as HTMLElement).style.zIndex = 'auto';
      });
      clone.querySelectorAll('.sticky-column').forEach(node => {
        (node as HTMLElement).style.boxShadow = 'none';
      });

      const bgColor = getComputedStyle(document.documentElement).getPropertyValue('--theme-background-secondary').trim() || '#1a1a1a';
      clone.style.backgroundColor = bgColor;
      document.body.appendChild(clone);

      await new Promise(r => setTimeout(r, 150));

      const canvas = await html2canvas(clone, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: bgColor,
        logging: false,
      });

      document.body.removeChild(clone);

      canvas.toBlob(async (blob) => {
        if (blob) {
          try {
            await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
          } catch (err) {
            const dataUrl = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.href = dataUrl;
            link.download = `supervision_${reportType.toLowerCase()}_${locId}_${new Date().toISOString().split('T')[0]}.png`;
            link.click();
          }
        }
      }, 'image/png', 1.0);
    } catch (err) {
      console.error(err);
    } finally {
      setCapturingLocId(null);
    }
  }, [capturingLocId]);

  const renderVolumenReport = () => (
    <div className="report-container-stable">
      {filteredVolumenData.length === 0 ? (
        <div className="text-center p-5 text-muted small fw-black">NO HAY DATOS DE VOLUMEN.</div>
      ) : (
        <Accordion 
          activeKey={activeLocId} 
          onSelect={(k) => setActiveLocId(k as string)}
        >
          {filteredVolumenData.map(loc => (
            <Accordion.Item eventKey={loc.id} key={loc.id} id={`sup-capture-VOLUMEN-${loc.id}`} className="loc-accordion-item border-0">
              <Accordion.Header className="loc-header-compact">
                <div className="d-flex flex-wrap justify-content-between align-items-center w-100">
                  <div className="d-flex align-items-center gap-2 gap-md-3">
                    <div className="loc-avatar">{loc.id}</div>
                    <div className="d-flex align-items-center gap-2 gap-md-3">
                      <div className="fw-black text-uppercase l-height-1">{loc.nombre}</div>
                      <div className="fw-black sub-label-new">VOLUMEN</div>
                    </div>
                  </div>
                  <span className="capture-btn" role="button" title="Copiar captura al portapapeles"
                    onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleCaptureSede(loc.id, 'VOLUMEN'); }}>
                    {capturingLocId === loc.id ? <Spinner size="sm" animation="border" /> : <FaCopy />}
                  </span>
                  <div className="loc-header-badges d-flex gap-1 gap-md-2">
                    <Badge bg="primary" className="badge-industrial">
                      <span className="b-label">CF</span><span className="fw-black b-val">{loc.totalCF.toFixed(1)}</span>
                    </Badge>
                    <Badge bg="success" className="badge-industrial">
                      <span className="b-label">CU</span><span className="fw-black b-val">{loc.totalUC.toFixed(2)}</span>
                    </Badge>
                  </div>
                </div>
              </Accordion.Header>
              <Accordion.Body className="bg-transparent p-0 pt-1">
                {activeLocId === loc.id && Object.entries(loc.mesas).map(([mesaName, mesa]: [string, any]) => (
                  <div key={mesaName} className="mesa-section mb-2">
                    <div className="mesa-title-bar d-flex justify-content-between align-items-center px-3 py-1 mb-1">
                      <span className="fw-black m-label">MESA: {mesaName.toUpperCase()}</span>
                      <div className="fw-black m-stats">{mesa.totalCF.toFixed(1)} CF / {mesa.totalUC.toFixed(2)} CU</div>
                    </div>
                    <div className="px-2 px-md-3">
                      <Row className="g-1">
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
        <Accordion 
          activeKey={activeLocId} 
          onSelect={(k) => setActiveLocId(k as string)}
        >
          {filteredBebidasData.map(loc => (
            <Accordion.Item eventKey={loc.id} key={loc.id} id={`sup-capture-BEBIDAS-${loc.id}`} className="loc-accordion-item border-0">
              <Accordion.Header className="loc-header-compact">
                <div className="d-flex flex-wrap justify-content-between align-items-center w-100">
                  <div className="d-flex align-items-center gap-2 gap-md-3">
                    <div className="loc-avatar">{loc.id}</div>
                    <div className="d-flex align-items-center gap-2 gap-md-3">
                      <div className="fw-black text-uppercase l-height-1">{loc.nombre}</div>
                      <div className="fw-black sub-label-new">BEBIDAS</div>
                    </div>
                  </div>
                  <span className="capture-btn" role="button" title="Copiar captura al portapapeles"
                    onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleCaptureSede(loc.id, 'BEBIDAS'); }}>
                    {capturingLocId === loc.id ? <Spinner size="sm" animation="border" /> : <FaCopy />}
                  </span>
                  <div className="loc-header-badges d-flex gap-1 gap-md-2">
                    <Badge bg="primary" className="badge-industrial">
                      <span className="b-label">CF</span><span className="fw-black b-val">{loc.totalCF.toFixed(1)}</span>
                    </Badge>
                    <Badge bg="success" className="badge-industrial">
                      <span className="b-label">CU</span><span className="fw-black b-val">{loc.totalUC.toFixed(2)}</span>
                    </Badge>
                  </div>
                </div>
              </Accordion.Header>
              <Accordion.Body className="bg-transparent p-0 pt-1">
                {activeLocId === loc.id && Object.entries(loc.tipos).map(([tipoId, tipo]: [string, any]) => (
                  <div key={tipoId} className="mesa-section mb-2">
                    <div className="mesa-title-bar d-flex justify-content-between align-items-center px-3 py-1 mb-1" style={{ borderLeftColor: 'var(--theme-icon-color)' }}>
                      <span className="fw-black m-label"><FaGlassMartiniAlt className="me-2"/>{tipo.nombre}</span>
                      <div className="fw-black m-stats">{tipo.totalCF.toFixed(1)} CF / {tipo.totalUC.toFixed(2)} CU</div>
                    </div>
                    <div className="px-2 px-md-3">
                      <Row className="g-1">
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
        <Accordion 
          activeKey={activeLocId} 
          onSelect={(k) => setActiveLocId(k as string)}
        >
          {filteredEficienciaData.map((loc: any) => (
            <Accordion.Item eventKey={loc.id} key={loc.id} id={`sup-capture-EFICIENCIA-${loc.id}`} className="loc-accordion-item border-0">
              <Accordion.Header className="loc-header-compact">
                <div className="d-flex flex-wrap justify-content-between align-items-center w-100">
                  <div className="d-flex align-items-center gap-2 gap-md-3">
                    <div className="loc-avatar">{loc.id}</div>
                    <div className="d-flex align-items-center gap-2 gap-md-3">
                      <div className="fw-black text-uppercase l-height-1">{loc.nombre}</div>
                      <div className="fw-black sub-label-new">EFICIENCIA</div>
                    </div>
                  </div>
                  <span className="capture-btn" role="button" title="Copiar captura al portapapeles"
                    onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleCaptureSede(loc.id, 'EFICIENCIA'); }}>
                    {capturingLocId === loc.id ? <Spinner size="sm" animation="border" /> : <FaCopy />}
                  </span>
                  <div className="loc-header-badges d-flex gap-1 gap-md-2">
                    <Badge bg="primary" className="badge-industrial">
                      <span className="b-label">PROG</span><span className="fw-black b-val">{loc.totalProg}</span>
                    </Badge>
                    <Badge bg="success" className="badge-industrial">
                      <span className="b-label">EFEC</span><span className="fw-black b-val">{loc.totalEfec}</span>
                    </Badge>
                    <Badge bg="danger" className="badge-industrial">
                      <span className="b-label text-nowrap">S. VISITA</span><span className="fw-black b-val">{loc.totalProg - loc.totalEfec}</span>
                    </Badge>
                    <Badge bg="dark" className="badge-industrial border border-secondary">
                      <span className="b-label text-info">EF (%)</span><span className="fw-black b-val text-info">{((loc.totalEfec / loc.totalProg) * 100).toFixed(0)}%</span>
                    </Badge>
                  </div>
                </div>
              </Accordion.Header>
              <Accordion.Body className="bg-transparent p-0 pt-1">
                {activeLocId === loc.id && Object.entries(loc.mesas).map(([mesaName, mesa]: [string, any]) => (
                  <div key={mesaName} className="mesa-section mb-2">
                    <div className="mesa-title-bar d-flex justify-content-between align-items-center px-3 py-1 mb-1">
                      <span className="fw-black m-label">MESA: {mesaName.toUpperCase()}</span>
                      <div className="fw-black m-stats">{mesa.totalProg} P / {mesa.totalEfec} E / {((mesa.totalEfec / mesa.totalProg) * 100).toFixed(1)}% EF</div>
                    </div>
                    <div className="px-2 px-md-3">
                      <Row className="g-1">
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
            <Accordion.Item eventKey={loc.id} key={loc.id} id={`sup-capture-DUPLICADOS-${loc.id}`} className="loc-accordion-item border-0">
              <Accordion.Header className="loc-header-compact">
                <div className="d-flex flex-wrap justify-content-between align-items-center w-100">
                  <div className="d-flex align-items-center gap-2 gap-md-3">
                    <div className="loc-avatar bg-warning text-dark"><FaExclamationTriangle /></div>
                    <div className="d-flex align-items-center gap-2 gap-md-3">
                      <div className="fw-black text-uppercase l-height-1">{loc.nombre}</div>
                      <div className="fw-black sub-label-new">DUPLICADOS</div>
                    </div>
                  </div>
                  <span className="capture-btn" role="button" title="Copiar captura al portapapeles"
                    onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleCaptureSede(loc.id, 'DUPLICADOS'); }}>
                    {capturingLocId === loc.id ? <Spinner size="sm" animation="border" /> : <FaCopy />}
                  </span>
                  <div className="loc-header-badges d-flex gap-1 gap-md-2">
                    <Badge bg="danger" className="badge-industrial">
                      <span className="b-label">CONFLICTOS</span>
                      <span className="fw-black b-val">{Object.keys(loc.clientes).length}</span>
                    </Badge>
                  </div>
                </div>
              </Accordion.Header>
              <Accordion.Body className="bg-transparent p-0 pt-1">
                {Object.values(loc.clientes).map((cliente: any) => {
                  const masterClient = maestroMap[String(cliente.codigo)];
                  const rutaCom = masterClient ? (masterClient['Ruta com'] || masterClient['RUTA COM'] || 'SIN RUTA') : '...';
                  return (
                    <div key={cliente.codigo} className="mesa-section mb-2">
                      <div className="mesa-title-bar d-flex justify-content-between align-items-center px-3 py-2 mb-1" style={{ borderLeftColor: '#ffc107' }}>
                        <div className="d-flex flex-wrap align-items-center gap-2 gap-md-3">
                          <span className="fw-black m-label text-uppercase mb-0">{cliente.nombre}</span>
                          <span className="m-label text-secondary opacity-25 d-none d-md-inline mb-0">•</span>
                          <span className="fw-black m-label text-warning mb-0">RUTA {rutaCom}</span>
                          <span className="m-label text-secondary opacity-25 d-none d-md-inline mb-0">•</span>
                          <span className="fw-black m-label text-secondary mb-0">ID {cliente.codigo}</span>
                        </div>
                      </div>
                      <div className="px-2 px-md-3">
                        {cliente.duplas.map((dupla: any, idx: number) => (
                          <div key={idx} className="duplicado-comparativo-card mb-3">
                            <Row className="g-0">
                              <Col xs={6} className="border-end border-theme-default">
                                <div className="dup-doc-header">
                                  <span className="fw-black"># {dupla.doc1.id}</span>
                                  <span className="fw-black text-danger ms-auto" style={{ fontSize: '0.85rem', letterSpacing: '0.5px' }}>{dupla.doc1.hora}</span>
                                </div>
                                <div className="p-2">
                                  {dupla.doc1.items.map((item: any, i: number) => (
                                    <div key={i} className="dup-item-row border-bottom border-theme-default last-child-no-border">
                                      <div className="d-flex flex-column min-width-0 flex-grow-1">
                                        <span className="fw-bold dup-item-name">{item.nombre}</span>
                                        <span className="dup-item-sap">SAP: {item.sap}</span>
                                      </div>
                                      <div className="dup-qty-val text-end ms-2">
                                        {item.cant} <small>{item.med}</small>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </Col>
                              <Col xs={6}>
                                <div className="dup-doc-header">
                                  <span className="fw-black"># {dupla.doc2.id}</span>
                                  <span className="fw-black text-danger ms-auto" style={{ fontSize: '0.85rem', letterSpacing: '0.5px' }}>{dupla.doc2.hora}</span>
                                </div>
                                <div className="p-2">
                                  {dupla.doc2.items.map((item: any, i: number) => (
                                    <div key={i} className="dup-item-row border-bottom border-theme-default last-child-no-border">
                                      <div className="d-flex flex-column min-width-0 flex-grow-1">
                                        <span className="fw-bold dup-item-name">{item.nombre}</span>
                                        <span className="dup-item-sap">SAP: {item.sap}</span>
                                      </div>
                                      <div className="dup-qty-val text-end ms-2">
                                        {item.cant} <small>{item.med}</small>
                                      </div>
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
    </div>
  );

  const renderCoberturaReport = () => (
    <div className="report-container-stable">
      {typeColumnHeadersCob.length === 0 ? (
        <div className="text-center p-5 text-muted small fw-black">SELECCIONE FILTROS DE COBERTURA.</div>
      ) : filteredCoberturaData.length === 0 ? (
        <div className="text-center p-5 text-muted small fw-black">NO HAY DATOS DE COBERTURA.</div>
      ) : (
        <Accordion
          activeKey={activeLocId}
          onSelect={(k) => setActiveLocId(k as string)}
        >
          {filteredCoberturaData.map(loc => {
            const firstTipo = typeColumnHeadersCob[0];
            const firstSum = groupSumCob(loc.total, firstTipo.brandIds);
            const firstHasData = groupHasCob(loc.total, firstTipo.brandIds);
            const firstCli = loc.cliConVentaPorTipo?.[firstTipo.tipoId] || 0;
            const firstPct = loc.totalClientesLoc > 0 ? Math.round((firstCli * 100) / loc.totalClientesLoc) : 0;
            return (
              <Accordion.Item eventKey={loc.id} key={loc.id} id={`sup-capture-COBERTURA-${loc.id}`} className="loc-accordion-item border-0">
                <Accordion.Header className="loc-header-compact">
                  <div className="d-flex flex-wrap justify-content-between align-items-center w-100">
                    <div className="d-flex align-items-center gap-2 gap-md-3">
                      <div className="loc-avatar">{loc.id}</div>
                      <div className="d-flex align-items-center gap-2 gap-md-3">
                        <div className="fw-black text-uppercase l-height-1">{loc.nombre}</div>
                        <div className="fw-black sub-label-new">COBERTURA</div>
                      </div>
                    </div>
                    <span className="capture-btn" role="button" title="Copiar captura al portapapeles"
                      onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleCaptureSede(loc.id, 'COBERTURA'); }}>
                      {capturingLocId === loc.id ? <Spinner size="sm" animation="border" /> : <FaCopy />}
                    </span>
                    <div className="loc-header-badges d-flex gap-1 gap-md-2">
                      <Badge bg="primary" className="badge-industrial" style={{ opacity: firstHasData ? 1 : 0.25 }}>
                        <span className="b-label">CF</span><span className="fw-black b-val">{firstSum.cf.toFixed(1)}</span>
                      </Badge>
                      <Badge bg="success" className="badge-industrial" style={{ opacity: firstHasData ? 1 : 0.25 }}>
                        <span className="b-label">CU</span><span className="fw-black b-val">{firstSum.cu.toFixed(2)}</span>
                      </Badge>
                      <Badge bg="info" className="badge-industrial" style={{ opacity: firstHasData ? 1 : 0.25 }}>
                        <span className="fw-black b-val">{firstCli}/{loc.totalClientesLoc} ({firstPct}%)</span>
                      </Badge>
                    </div>
                  </div>
                </Accordion.Header>
                <Accordion.Body className="bg-transparent p-0 pt-1">
                  {activeLocId === loc.id && (isMobile ? (
                    Object.entries(loc.mesas || {}).map(([mesaName, mesa]: [string, any]) => {
                      const mSum = groupSumCob(mesa.total, firstTipo.brandIds);
                      const mHas = groupHasCob(mesa.total, firstTipo.brandIds);
                      const mCli = mesa.cliConVentaPorTipo?.[firstTipo.tipoId] || 0;
                      const mPct = mesa.totalClientesMesa > 0 ? Math.round((mCli * 100) / mesa.totalClientesMesa) : 0;
                      return (
                        <div key={mesaName} className="mesa-section mb-2">
                          <div className="mesa-title-bar d-flex justify-content-between align-items-center px-3 py-1 mb-1">
                            <span className="fw-black m-label">MESA: {mesaName.toUpperCase()}</span>
                            <div className="fw-black m-stats">
                              <span className={mHas ? 'text-success' : 'text-secondary opacity-25'}>{mSum.cf.toFixed(1)} CF</span>
                              <span className="text-secondary opacity-50 mx-1">/</span>
                              <span className={mHas ? 'text-success' : 'text-secondary opacity-25'}>{mSum.cu.toFixed(2)} CU</span>
                              <span className="text-info ms-1">| {mCli}/{mesa.totalClientesMesa} ({mPct}%)</span>
                            </div>
                          </div>
                          <div className="px-2 px-md-3">
                            {Object.entries(mesa.rutas || {}).map(([rutaName, ruta]: [string, any]) => {
                              const rSum = groupSumCob(ruta.total, firstTipo.brandIds);
                              const rHas = groupHasCob(ruta.total, firstTipo.brandIds);
                              const rCli = ruta.cliConVentaPorTipo?.[firstTipo.tipoId] || 0;
                              const rPct = ruta.totalClientesRuta > 0 ? Math.round((rCli * 100) / ruta.totalClientesRuta) : 0;
                              return (
                                <div key={rutaName} className="ruta-card-compact mb-1">
                                  <div className="ruta-main-row d-flex justify-content-between align-items-center px-2 py-1">
                                    <span className="r-label"><FaChevronRight size={10} /> RUTA {rutaName}</span>
                                    <div className="d-flex gap-2 align-items-center">
                                      <span className={rHas ? 'text-success fw-bold' : 'text-secondary opacity-25'} style={{ fontSize: '0.7rem' }}>{rSum.cf.toFixed(1)}/{rSum.cu.toFixed(2)}</span>
                                      <span className={rHas ? 'text-info fw-bold' : 'text-secondary opacity-25'} style={{ fontSize: '0.7rem' }}>{rCli}/{ruta.totalClientesRuta} ({rPct}%)</span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="table-responsive" style={{ maxWidth: '100%' }}>
                      <Table hover className="mb-0 industrial-table-v2 matrix-table">
                        <thead>
                          <tr>
                            <th rowSpan={2} className="align-middle text-center ps-4 sticky-column" style={{ width: '180px', minWidth: '180px', fontSize: '0.65rem', zIndex: 11 }}>ID MESA</th>
                            {typeColumnHeadersCob.map((tipo) => (
                              <th key={tipo.tipoId} colSpan={2} className="text-center text-uppercase fw-black text-white py-2 brand-header-cell brand-separator" style={{ fontSize: '0.7rem', letterSpacing: '1px', backgroundColor: 'var(--color-red-primary)' }}>
                                {tipo.typeName} <span className="text-white-50" style={{ fontSize: '0.55rem', opacity: 0.7 }}>({tipo.brandIds.length})</span>
                              </th>
                            ))}
                          </tr>
                          <tr>
                            {typeColumnHeadersCob.map((tipo) => (
                              <Fragment key={`sub-${tipo.tipoId}`}>
                                <th className="text-center small fw-black py-1" style={{ fontSize: '0.55rem' }}>CF / CU</th>
                                <th className="text-center small fw-black py-1 brand-separator" style={{ fontSize: '0.55rem' }}>CLI</th>
                              </Fragment>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(loc.mesas || {}).map(([mesaName, mesa]: [string, any]) => {
                            const rutas = Object.entries(mesa.rutas || {});
                            return (
                              <Fragment key={mesaName}>
                                <tr>
                                  <td className="align-middle py-3 sticky-column ps-3" style={{ backgroundColor: 'var(--theme-background-secondary)', zIndex: 10 }}>
                                    <span className="fw-black fs-5 text-uppercase" style={{ letterSpacing: '1px' }}>{mesaName}</span>
                                  </td>
                                  {typeColumnHeadersCob.map((tipo) => {
                                    const s = groupSumCob(mesa.total, tipo.brandIds);
                                    const has = groupHasCob(mesa.total, tipo.brandIds);
                                    const cli = mesa.cliConVentaPorTipo?.[tipo.tipoId] || 0;
                                    const pct = mesa.totalClientesMesa > 0 ? Math.round((cli * 100) / mesa.totalClientesMesa) : 0;
                                    return (
                                      <Fragment key={`${mesaName}-${tipo.tipoId}`}>
                                        <td className="text-center align-middle fw-black" style={{ fontSize: '1rem', backgroundColor: has ? 'rgba(244, 0, 9, 0.03)' : 'transparent' }}>
                                          <span className={has ? 'text-success' : 'text-secondary opacity-25'}>{s.cf.toFixed(1)}</span>
                                          <span className="mx-2 text-secondary opacity-50">/</span>
                                          <span className={has ? 'text-warning' : 'text-secondary opacity-25'}>{s.cu.toFixed(2)}</span>
                                        </td>
                                        <td className="text-center align-middle fw-black brand-separator" style={{ fontSize: '1rem', backgroundColor: has ? 'rgba(244, 0, 9, 0.03)' : 'transparent' }}>
                                          <span className={has ? 'text-info' : 'text-secondary opacity-25'}>
                                            {cli} <span className="text-secondary opacity-50 mx-1">/</span> {mesa.totalClientesMesa}
                                            <span className="text-secondary ms-1" style={{ fontSize: '0.7rem' }}>({pct}%)</span>
                                          </span>
                                        </td>
                                      </Fragment>
                                    );
                                  })}
                                </tr>
                                {rutas.map(([rutaName, ruta]: [string, any]) => (
                                  <tr key={rutaName}>
                                    <td className="sticky-column text-start ps-5 py-2" style={{ backgroundColor: 'var(--theme-background-secondary)', zIndex: 10 }}>
                                      <span className="fw-bold text-uppercase" style={{ fontSize: '0.75rem', letterSpacing: '1px' }}>{rutaName}</span>
                                    </td>
                                    {typeColumnHeadersCob.map((tipo) => {
                                      const s = groupSumCob(ruta.total, tipo.brandIds);
                                      const has = groupHasCob(ruta.total, tipo.brandIds);
                                      const cli = ruta.cliConVentaPorTipo?.[tipo.tipoId] || 0;
                                      const pct = ruta.totalClientesRuta > 0 ? Math.round((cli * 100) / ruta.totalClientesRuta) : 0;
                                      return (
                                        <Fragment key={`${rutaName}-${tipo.tipoId}`}>
                                          <td className="text-center py-2 fw-bold" style={{ fontSize: '0.85rem', backgroundColor: has ? 'rgba(244, 0, 9, 0.03)' : 'transparent' }}>
                                            <span className={has ? 'text-success' : 'text-secondary opacity-25'}>{s.cf.toFixed(1)}</span>
                                            <span className="mx-2 text-secondary opacity-50">/</span>
                                            <span className={has ? 'text-warning' : 'text-secondary opacity-25'}>{s.cu.toFixed(2)}</span>
                                          </td>
                                          <td className="text-center py-2 fw-bold brand-separator" style={{ fontSize: '0.85rem', backgroundColor: has ? 'rgba(244, 0, 9, 0.03)' : 'transparent' }}>
                                            <span className={has ? 'text-info' : 'text-secondary opacity-25'}>
                                              {cli} <span className="text-secondary opacity-50 mx-1">/</span> {ruta.totalClientesRuta}
                                              <span className="text-secondary ms-1" style={{ fontSize: '0.65rem' }}>({pct}%)</span>
                                            </span>
                                          </td>
                                        </Fragment>
                                      );
                                    })}
                                  </tr>
                                ))}
                              </Fragment>
                            );
                          })}
                        </tbody>
                      </Table>
                    </div>
                  ))}
                </Accordion.Body>
              </Accordion.Item>
            );
          })}
        </Accordion>
      )}
    </div>
  );

  return (
    <div className="admin-layout-container flex-column overflow-hidden gap-2 gap-md-3">
      <div className="admin-section-table flex-shrink-0" style={{ flex: 'none', height: 'auto', padding: '0.5rem' }}>
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
                  <option value="COBERTURA">COBERTURA</option>
                </Form.Select>
              </div>
            </div>
          </Col>

          {selectedReportType === 'COBERTURA' && (
            <Col xs={12} md={2}>
              <div className="info-pill-new w-100" role="button" onClick={handleOpenCoberturaModal} style={{ cursor: 'pointer' }}>
                <span className="pill-icon-sober text-warning p-1"><FaSlidersH className="pill-main-icon"/></span>
                <div className="pill-content flex-grow-1">
                  <span className="pill-label">FILTROS</span>
                  <div className="sincro-val fw-black text-uppercase d-flex align-items-center gap-1" style={{ color: 'var(--theme-text-primary)' }}>
                    COBERTURA
                    {activeFilterCobCount > 0 && <Badge bg="danger" className="ms-1" style={{ fontSize: '0.6rem' }}>{activeFilterCobCount}</Badge>}
                  </div>
                </div>
              </div>
            </Col>
          )}

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
            <>
            <Col xs={6} md={3}>
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
                      <span className="text-truncate" style={{ maxWidth: '110px' }}>
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
            <Col xs={6} md={3}>
              <div className="info-pill-new w-100">
                <span className="pill-icon-sober text-warning p-1"><FaBox className="pill-main-icon"/></span>
                <div className="pill-content flex-grow-1 ps-2">
                  <span className="pill-label">PRODUCTOS ({selectedBebidaProducts.length})</span>
                  <Dropdown autoClose="outside" className="w-100 border-0 shadow-none">
                    <Dropdown.Toggle 
                      as="div"
                      className="pill-select-v2 w-100 text-start d-flex justify-content-between align-items-center p-0" 
                      style={{ background: 'none', border: 'none', boxShadow: 'none', cursor: 'pointer' }}
                    >
                      <span className="text-truncate" style={{ maxWidth: '110px' }}>
                        {selectedBebidaProducts.length === 0
                          ? 'TODOS'
                          : (selectedBebidaProducts.length === availableBebidaProducts.length && availableBebidaProducts.length > 0
                            ? 'TODOS'
                            : (availableBebidaProducts.filter(p => selectedBebidaProducts.includes(p.sap)).map(p => p.nombre.toUpperCase()).join(', ') || '...'))}
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
                        minWidth: '260px', 
                        width: 'auto',
                        borderRadius: '0', 
                        zIndex: 99999 
                      }}
                    >
                      <div className="px-3 py-2 d-flex align-items-center gap-2 border-bottom border-secondary border-opacity-10" onClick={(e) => { e.stopPropagation(); handleSelectAllBebidaProducts(e); }} style={{ cursor: 'pointer' }}>
                        <Form.Check type="checkbox" checked={selectedBebidaProducts.length === availableBebidaProducts.length && availableBebidaProducts.length > 0} readOnly />
                        <span className="fw-black text-danger" style={{ fontSize: '0.7rem' }}>TODOS LOS PRODUCTOS</span>
                      </div>
                      {availableBebidaProducts.length === 0 ? (
                        <div className="px-3 py-3 text-center text-muted fw-bold" style={{ fontSize: '0.65rem' }}>
                          SIN PRODUCTOS DISPONIBLES
                        </div>
                      ) : availableBebidaProducts.map(p => (
                        <div key={p.sap} className="px-3 py-1 d-flex align-items-center gap-2 dropdown-item-custom" onClick={(e) => handleBebidaProductToggle(p.sap, e)} style={{ cursor: 'pointer' }}>
                          <Form.Check type="checkbox" checked={selectedBebidaProducts.includes(p.sap)} readOnly />
                          <span className="fw-bold" style={{ fontSize: '0.75rem', color: 'var(--theme-text-primary)' }}>{p.nombre.toUpperCase()}</span>
                          <small className="text-secondary ms-auto" style={{ fontSize: '0.55rem' }}>SAP {p.sap}</small>
                        </div>
                      ))}
                      <div className="px-3 py-2 d-flex align-items-center gap-2 border-top border-secondary border-opacity-10" onClick={(e) => { e.stopPropagation(); setSelectedBebidaProducts([]); }} style={{ cursor: 'pointer' }}>
                        <span className="fw-black text-danger" style={{ fontSize: '0.7rem' }}>LIMPIAR PRODUCTOS</span>
                      </div>
                    </Dropdown.Menu>
                  </Dropdown>
                </div>
              </div>
            </Col>
            </>
          )}

          <Col xs={12} md={selectedReportType === 'VOLUMEN' || selectedReportType === 'DUPLICADOS' ? 8 : selectedReportType === 'BEBIDAS' ? 2 : selectedReportType === 'COBERTURA' ? 6 : 4}>
            <div className="info-pill-new w-100">
              <span className="pill-icon-sober text-success p-1"><FaSyncAlt className="pill-main-icon"/></span>
              <div className="pill-content flex-grow-1">
                <span className="pill-label">DEMANDA</span>
                <div className="sincro-val">
                  {selectedReportType === 'EFICIENCIA' ? eficienciaMetadata?.lastUpdated : selectedReportType === 'BEBIDAS' ? bebidasMetadata?.lastUpdated : selectedReportType === 'DUPLICADOS' ? duplicadosMetadata?.lastUpdated : selectedReportType === 'COBERTURA' ? coberturaMetadata?.lastUpdated : volumenMetadata?.lastUpdated || 'SIN DATOS'}
                </div>
              </div>
            </div>
          </Col>
        </Row>
      </div>

      <div className="admin-section-table flex-grow-1 p-0 overflow-hidden">
        <div className="h-100 overflow-auto custom-scrollbar p-2 p-md-3">
          {loadingMasterData || loading ? <GlobalSpinner variant={SPINNER_VARIANTS.IN_PAGE} /> : (
            <div className="report-main-wrapper">
              {selectedReportType === 'COBERTURA' && activeFilterCobCount > 0 && (
                <div className="admin-border-industrial p-2 p-md-3 mb-1 w-100" style={{ backgroundColor: 'var(--theme-background-secondary)', borderLeft: '4px solid var(--color-red-primary)' }}>
                  <div className="d-flex align-items-center gap-2 gap-md-3 flex-wrap">
                    <div className="d-flex align-items-center gap-2 flex-wrap">
                      {selectedDiaCobertura !== 'ALL' && <Badge bg="dark" className="fw-black text-uppercase px-3 py-2" style={{ fontSize: '0.65rem', borderRadius: '2px' }}>DÍA: {selectedDiaCobertura}</Badge>}
                      {selectedSubCanalCobertura !== 'ALL' && <Badge bg="dark" className="fw-black text-uppercase px-3 py-2" style={{ fontSize: '0.65rem', borderRadius: '2px' }}>CANAL: {selectedSubCanalCobertura}</Badge>}
                      {selectedTipoCobertura && selectedTipoCobertura !== 'ALL' && <Badge bg="danger" className="fw-black text-uppercase px-3 py-2" style={{ fontSize: '0.65rem', borderRadius: '2px' }}>{selectedTipoNombreCob}</Badge>}
                      {selectedProductosCobertura.length > 0 && <Badge bg="warning" text="dark" className="fw-black text-uppercase px-3 py-2" style={{ fontSize: '0.65rem', borderRadius: '2px' }}>{selectedProductosCobertura.length} PRODUCTO{selectedProductosCobertura.length > 1 ? 'S' : ''}</Badge>}
                      <Button variant="link" className="text-secondary small fw-black p-0 ms-2 text-decoration-none" onClick={clearCoberturaFilters} style={{ fontSize: '0.65rem' }}>LIMPIAR</Button>
                    </div>
                  </div>
                </div>
              )}
              {selectedReportType === 'VOLUMEN' && renderVolumenReport()}
              {selectedReportType === 'EFICIENCIA' && renderEficienciaReport()}
              {selectedReportType === 'BEBIDAS' && renderBebidasReport()}
              {selectedReportType === 'DUPLICADOS' && renderDuplicadosReport()}
              {selectedReportType === 'COBERTURA' && renderCoberturaReport()}
            </div>
          )}
        </div>
      </div>

      <Modal show={showCoberturaModal} onHide={handleCancelCobertura} backdrop="static" centered size="lg" className="bg-transparent">
        <div className="analitica-lite-modal" style={{ background: 'var(--theme-background-primary)', border: '1px solid var(--theme-border-default)', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
          <div className="modal-header d-flex justify-content-between align-items-center px-3 py-2" style={{ borderBottom: '1px solid var(--theme-border-default)' }}>
            <span className="fw-black text-uppercase" style={{ fontSize: '0.8rem', letterSpacing: '1px', color: 'var(--theme-text-primary)' }}>
              <FaFilter className="me-2 text-danger" size={14} />
              Filtros de Cobertura
            </span>
          </div>
          <div className="modal-body p-4 d-flex flex-column gap-4">
            <div>
              <label className="text-danger fw-black text-uppercase mb-2" style={{ fontSize: '0.7rem', letterSpacing: '1px' }}>DÍA</label>
              <Form.Select value={tempDiaCobertura} onChange={(e) => setTempDiaCobertura(e.target.value)} className="fw-black text-uppercase" style={{ fontSize: '0.8rem' }}>
                <option value="ALL">TODOS</option>
                {['LU', 'MA', 'MI', 'JU', 'VI', 'SA', 'DO'].map(d => <option key={d} value={d}>{d}</option>)}
              </Form.Select>
            </div>

            <div>
              <label className="text-danger fw-black text-uppercase mb-2" style={{ fontSize: '0.7rem', letterSpacing: '1px' }}>CANAL</label>
              <Form.Select value={tempSubCanalCobertura} onChange={(e) => setTempSubCanalCobertura(e.target.value)} className="fw-black text-uppercase" style={{ fontSize: '0.8rem' }}>
                <option value="ALL">TODOS</option>
                {availableSubCanalesCob.map(sc => <option key={sc} value={sc}>{sc}</option>)}
              </Form.Select>
            </div>

            <div>
              <label className="text-danger fw-black text-uppercase mb-2" style={{ fontSize: '0.7rem', letterSpacing: '1px' }}>TIPO DE BEBIDA</label>
              <Form.Select value={tempTipoBebidaCobertura} onChange={(e) => handleTipoBebidaCobChange(e.target.value)} className="fw-black text-uppercase" style={{ fontSize: '0.8rem' }}>
                <option value="ALL">TODOS</option>
                {beverageTypes.map(t => (
                  <option key={t.id} value={t.id}>{t.nombre.toUpperCase()}</option>
                ))}
              </Form.Select>
            </div>

            <div>
              <div className="d-flex align-items-center justify-content-between mb-2">
                <label className="text-danger fw-black text-uppercase mb-0" style={{ fontSize: '0.7rem', letterSpacing: '1px' }}>
                  MARCAS <span className="text-secondary">({tempMarcasCobertura.length} seleccionadas)</span>
                </label>
                <div className="d-flex gap-2">
                  <Button variant="link" className="text-success fw-black p-0 text-decoration-none" style={{ fontSize: '0.65rem' }}
                    onClick={() => { setTempMarcasCobertura(filteredMarcasCob.map(m => m.id)); setTempProductosCobertura([]); }}>
                    TODO
                  </Button>
                  <Button variant="link" className="text-danger fw-black p-0 text-decoration-none" style={{ fontSize: '0.65rem' }}
                    onClick={() => { setTempMarcasCobertura([]); setTempProductosCobertura([]); }}>
                    LIMPIAR
                  </Button>
                </div>
              </div>
              <div className="d-flex flex-wrap gap-2 p-3" style={{ backgroundColor: 'var(--theme-background-secondary)', border: '1px solid var(--theme-border-default)', maxHeight: '180px', overflowY: 'auto' }}>
                {filteredMarcasCob.length === 0 ? (
                  <span className="text-secondary fw-bold small">No hay marcas disponibles</span>
                ) : (
                  filteredMarcasCob.sort((a, b) => a.nombre.localeCompare(b.nombre)).map(m => (
                    <Form.Check
                      key={m.id}
                      type="checkbox"
                      id={`marca-${m.id}`}
                      label={m.nombre.toUpperCase()}
                      checked={tempMarcasCobertura.includes(m.id)}
                      onChange={() => handleToggleMarcaCob(m.id)}
                      className="fw-black text-uppercase"
                      style={{ fontSize: '0.75rem', minWidth: '140px' }}
                    />
                  ))
                )}
              </div>
            </div>

            {tempMarcasCobertura.length > 0 && (
              <div>
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <label className="text-danger fw-black text-uppercase mb-0" style={{ fontSize: '0.7rem', letterSpacing: '1px' }}>
                    PRODUCTOS <span className="text-secondary">({tempProductosCobertura.length > 0 ? `${tempProductosCobertura.length} seleccionados` : 'todos'})</span>
                  </label>
                  <div className="d-flex gap-2">
                    <Button variant="link" className="text-success fw-black p-0 text-decoration-none" style={{ fontSize: '0.65rem' }}
                      onClick={() => setTempProductosCobertura(filteredProductosCob.map(p => cleanId(p.sap)))}>
                      TODO
                    </Button>
                    <Button variant="link" className="text-danger fw-black p-0 text-decoration-none" style={{ fontSize: '0.65rem' }}
                      onClick={() => setTempProductosCobertura([])}>
                      LIMPIAR
                    </Button>
                  </div>
                </div>
                <div className="d-flex flex-column gap-1 p-3" style={{ backgroundColor: 'var(--theme-background-secondary)', border: '1px solid var(--theme-border-default)', maxHeight: '240px', overflowY: 'auto' }}>
                  {filteredProductosCob.length === 0 ? (
                    <span className="text-secondary fw-bold small">No hay productos disponibles</span>
                  ) : (
                    filteredProductosCob.sort((a, b) => (parseFloat(b.mililitros) || 0) - (parseFloat(a.mililitros) || 0)).map(p => (
                      <Form.Check
                        key={String(p.sap).trim()}
                        type="checkbox"
                        id={`prod-${p.sap}`}
                        label={p.nombre?.toUpperCase() || String(p.sap)}
                        checked={tempProductosCobertura.includes(cleanId(p.sap))}
                        onChange={() => {
                          const pid = cleanId(p.sap);
                          setTempProductosCobertura(prev => prev.includes(pid) ? prev.filter(s => s !== pid) : [...prev, pid]);
                        }}
                        className="fw-black"
                        style={{ fontSize: '0.75rem' }}
                      />
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="modal-footer d-flex justify-content-end gap-2 px-4 py-3" style={{ backgroundColor: 'var(--theme-background-secondary)', borderTop: '1px solid var(--theme-border-default)' }}>
            <Button variant="secondary" onClick={handleCancelCobertura} className="fw-black px-4" style={{ fontSize: '0.75rem', borderRadius: '2px' }}>CANCELAR</Button>
            <Button variant="danger" onClick={handleApplyCobertura} disabled={!tempTipoBebidaCobertura} className="fw-black px-4" style={{ fontSize: '0.75rem', borderRadius: '2px' }}>APLICAR</Button>
          </div>
        </div>
      </Modal>

      <style>{`
        .admin-border-industrial { 
          border: 1px solid var(--theme-border-default) !important;
          transition: border-color 0.2s ease-in-out;
        }
        .admin-border-industrial:hover {
          border-color: var(--color-red-primary) !important;
        }
        .fw-black { font-weight: 900 !important; }
        .l-height-1 { letter-spacing: 0.2px; font-size: 1.1rem; color: var(--theme-text-primary); line-height: 1; }
        .sub-label-new { font-size: 1.1rem; color: var(--theme-text-secondary); opacity: 0.8; letter-spacing: 0.5px; border-left: 2px solid var(--color-red-primary); padding-left: 8px; line-height: 1; }
        
        .info-pill-new { display: flex; align-items: center; background-color: var(--theme-background-secondary); border: 1px solid var(--theme-border-default); border-radius: 0; height: 38px; position: relative; }
        .pill-icon-sober { background-color: var(--theme-icon-bg); color: var(--theme-icon-color); height: 100%; display: flex; align-items: center; border-right: 1px solid var(--theme-border-default); min-width: 32px; justify-content: center; z-index: 2; }
        .pill-main-icon { font-size: 14px; }
        .pill-content { padding: 0 10px; display: flex; flex-direction: column; justify-content: center; min-width: 0; flex-grow: 1; position: relative; z-index: 1; }
        .pill-label { font-size: 0.5rem; font-weight: 600; opacity: 0.6; text-transform: uppercase; color: var(--theme-text-primary); margin-bottom: -1px; }
        .pill-select-v2 { background: transparent !important; border: none !important; color: var(--theme-text-primary) !important; font-weight: 600; font-size: 0.85rem; padding: 0 !important; margin-top: -2px; box-shadow: none !important; }
        .sincro-val { font-size: 0.75rem; color: var(--theme-text-primary); margin-top: -2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 600; }

        .report-main-wrapper { display: flex; flex-direction: column; gap: 0.25rem; width: 100%; align-items: center; }
        .report-container-stable { width: 100%; display: block; }

        .dropdown-item-custom { display: flex; align-items: center; gap: 10px; padding: 8px 15px; cursor: pointer; transition: background 0.2s ease; border-bottom: 1px solid rgba(255,255,255,0.05); background: transparent !important; }
        .dropdown-item-custom:hover { background: rgba(244, 0, 9, 0.15) !important; }

        .loc-accordion-item { background: var(--theme-background-secondary) !important; border: 1px solid var(--theme-border-default) !important; border-radius: 0 !important; overflow: hidden; margin-bottom: .5rem !important; }
        .loc-header-compact .accordion-button { background: transparent !important; box-shadow: none !important; padding: 2px 8px !important; border-radius: 0 !important; width: 100%; min-height: 28px; }
        .loc-header-compact .accordion-button:not(.collapsed) { background: transparent !important; color: inherit !important; box-shadow: none !important; }
        .loc-header-compact .accordion-button:after { display: none; }
        .loc-avatar { width: 28px; height: 28px; background: var(--color-red-primary); color: white; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 0.95rem; flex-shrink: 0; border-radius: 1px; }
        .badge-industrial { padding: 1px 5px; display: flex; flex-direction: column; align-items: center; border-radius: 0; min-width: 42px; height: 26px; justify-content: center; }
        .capture-btn { display: inline-flex; align-items: center; justify-content: center; align-self: center; width: 26px; height: 26px; color: var(--theme-text-secondary, #bbb); cursor: pointer; line-height: 1; flex-shrink: 0; }
        .capture-btn:hover { color: var(--theme-text-primary, #fff); }
        .capture-btn { margin-left: auto; }
        .loc-header-badges { flex: 0 0 100%; justify-content: flex-end; }
        .b-label { font-size: 0.45rem; font-weight: 800; line-height: 1; margin-bottom: -2px; opacity: 0.8; }
        .b-val { font-size: 1rem !important; line-height: 1; }

        .mesa-title-bar { background: var(--theme-icon-bg); border-left: 4px solid var(--color-red-primary); }
        .m-label { font-size: 0.9rem; font-weight: 900; color: var(--theme-text-primary); }
        .m-stats { font-size: 0.9rem; font-weight: 800; color: var(--theme-text-secondary); text-transform: uppercase; }

        .ruta-card-compact { background: var(--theme-background-primary); border: 1px solid var(--theme-border-default); border-radius: 0; width: 100%; }
        .r-label { font-size: 0.8rem; color: var(--theme-text-primary); }
        .r-val { font-size: 0.8rem; }
        .r-unit { font-size: 0.8rem; opacity: 0.7; }
        .chevron-icon { font-size: 0.6rem; transition: transform 0.2s ease; color: var(--theme-text-secondary); }
        .chevron-icon.active { transform: rotate(90deg); color: var(--color-red-primary); }

        .p-name { font-size: 0.65rem; color: var(--theme-text-primary); }
        .p-sap { font-size: 0.55rem; color: #00d1ff; }
        .p-badge { font-size: 0.6rem; border-radius: 0; font-weight: 900; }

        .r-dot-leader { flex-grow: 1; border-bottom: 2px dotted var(--theme-border-default); margin: 0 15px; opacity: 0.2; align-self: center; margin-bottom: 4px; }
        .p-dot-leader { flex-grow: 1; border-bottom: 1px dotted var(--theme-border-default); margin: 0 10px; opacity: 0.15; align-self: center; margin-bottom: 3px; }

        .dash-chart-box { background: var(--theme-background-secondary); border: 1px solid var(--theme-border-default); padding: 15px; }
        .dash-chart-header { font-size: 0.6rem; font-weight: 900; color: var(--theme-text-secondary); text-transform: uppercase; border-left: 3px solid var(--color-red-primary); padding-left: 8px; margin-bottom: 10px; }

        .duplicado-comparativo-card { background: var(--theme-background-secondary); border: 1px solid var(--theme-border-default); border-radius: 0; overflow: hidden; }
        .dup-doc-header { background: var(--theme-icon-bg); padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; border-left: 3px solid var(--color-red-primary); border-bottom: 1px solid var(--theme-border-default); color: var(--theme-text-primary); font-size: 0.85rem; }
        .dup-time-badge { font-size: 0.75rem !important; border-radius: 0; font-weight: 800; opacity: 0.8; }
        
        .dup-item-row { display: flex; justify-content: space-between; align-items: center; padding: 6px 4px; background: transparent; }
        .last-child-no-border:last-child { border-bottom: none !important; }
        
        .dup-item-name { font-size: 0.65rem; color: var(--theme-text-primary); line-height: 1.1; word-break: break-word; }
        .dup-item-sap { font-size: 0.55rem; color: #00d1ff; font-weight: 700; margin-top: 1px; display: block; }
        .theme-light .dup-item-sap { color: #007bff; }
        
        .dup-qty-val { font-size: 0.85rem; font-weight: 900; color: var(--color-red-primary); white-space: nowrap; }
        .border-theme-default { border-color: var(--theme-border-default) !important; }

        @media (min-width: 768px) {
          .dup-item-row { padding: 8px 6px; }
        }

        @media (min-width: 992px) {
          .info-pill-new { height: 48px; }
          .pill-icon-sober { min-width: 40px; }
          .pill-main-icon { font-size: 18px; }
          .pill-label { font-size: 0.65rem; }
          .pill-select-v2 { font-size: 1.05rem; }
          .sincro-val { font-size: 0.95rem; }

          .report-container-stable {
            max-width: 1400px;
          }
          .l-height-1 { font-size: 1.45rem; }
          .sub-label-new { font-size: 1.45rem; padding-left: 12px; }
          .capture-btn { margin-left: 0; order: 3; }
          .loc-header-badges { flex: 0 0 auto; margin-left: auto; order: 2; }
          .loc-avatar { width: 34px; height: 34px; font-size: 1.2rem; }
          .loc-header-compact .accordion-button { padding: 4px 0px !important; min-height: 36px; }
          .b-val { font-size: 1.2rem !important; }
          .badge-industrial { height: 32px; min-width: 52px; }
          
          .m-label { font-size: 1.2rem; }
          .m-stats { font-size: 1.2rem; }
          .r-label { font-size: 1rem; }
          .r-val { font-size: 1rem; }
          .r-unit { font-size: 1rem; }

          .d-label { font-size: 0.8rem !important; }
          .dup-doc-id { font-size: 0.9rem !important; }
          .dup-doc-hora { font-size: 0.8rem !important; }
          .dup-item-name { font-size: 0.85rem !important; }
          .dup-item-sap { font-size: 0.75rem !important; color: #00d1ff !important; opacity: 1 !important; }
          .dup-item-cant { font-size: 0.9rem !important; }
        }
      `}</style>
    </div>
  );
};

export default SupervisorPage;
