import type { FC } from 'react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Tab, Nav, Form } from 'react-bootstrap';
import { FaChartLine, FaUsers, FaBox, FaHistory, FaMapMarkerAlt, FaFilter, FaRoute, FaSortUp, FaSortDown, FaSort } from 'react-icons/fa';
import { SPINNER_VARIANTS } from '../constants';
import GlobalSpinner from '../components/GlobalSpinner';
import useMediaQuery from '../hooks/useMediaQuery';
import { db, rtdb } from '../api/firebase';
import { useData } from '../context/DataContext';
import { ref, onValue } from 'firebase/database';
import { collection, getDocs, query, orderBy, where, Timestamp } from 'firebase/firestore';
import DatePicker, { registerLocale } from 'react-datepicker';
import { es } from 'date-fns/locale/es';
import "react-datepicker/dist/react-datepicker.css";

// Subcomponentes
import DashboardTab from './analytics/DashboardTab';
import ClientsTab from './analytics/ClientsTab';
import CoberturaTab from './analytics/CoberturaTab';
import ProductsTab from './analytics/ProductsTab';

registerLocale('es', es);

const AnalyticsProPage: FC = () => {
  const { sedes, marcas, beverageTypes } = useData();
  const isMobile = useMediaQuery('(max-width: 991px)');
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [demandaData, setDemandaData] = useState<any[]>([]);
  const [maestroData, setMaestroData] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);

  // --- FILTROS GLOBALES ---
  const [metric, setMetric] = useState<'valor' | 'cf' | 'cu'>('valor');
  const [selectedSede, setSelectedSede] = useState<string>('ALL');
  const [selectedRoute, setSelectedRoute] = useState<string>('ALL');
  const [selectedMarcasCobertura, setSelectedMarcasCobertura] = useState<string[]>([]);
  
  // --- FILTROS EXCLUSIVOS COBERTURA ---
  const [selectedDiaCobertura, setSelectedDiaCobertura] = useState<string>('ALL');
  const [selectedSubCanalCobertura, setSelectedSubCanalCobertura] = useState<string>('ALL');
  const [selectedTipoCobertura, setSelectedTipoCobertura] = useState<string>('ALL');

  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  // --- BUSQUEDA CON DEBOUNCE ---
  const [clientSearch, setClientSearch] = useState('');
  const [debouncedClientSearch, setDebouncedClientSearch] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [debouncedProductSearch, setDebouncedProductSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedClientSearch(clientSearch), 400);
    return () => clearTimeout(t);
  }, [clientSearch]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedProductSearch(productSearch), 400);
    return () => clearTimeout(t);
  }, [productSearch]);

  const [clientSort, setClientSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>({ key: 'monetary', dir: 'desc' });
  const [productSort, setProductSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>({ key: 'valor', dir: 'desc' });
  const [expandedCoberturaRutas, setExpandedCoberturaRutas] = useState<Record<string, boolean>>({});

  // Carga inicial optimizada
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const start = new Date(dateRange.start + 'T00:00:00');
        const end = new Date(dateRange.end + 'T23:59:59');
        const q = query(collection(db, 'demanda_historica'), where('fecha', '>=', Timestamp.fromDate(start)), where('fecha', '<=', Timestamp.fromDate(end)), orderBy('fecha', 'desc'));
        const [dSnap, pSnap] = await Promise.all([getDocs(q), getDocs(collection(db, 'productos'))]);
        setDemandaData(dSnap.docs.map(doc => ({ ...doc.data(), fechaObj: (doc.data() as any).fecha?.toDate() })));
        setProducts(pSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        
        // Cargar Maestro para Filtros de Cobertura
        onValue(ref(rtdb, 'maestro/data'), (snapshot) => {
          if (snapshot.exists()) setMaestroData(snapshot.val() || []);
          setLoading(false);
        }, { onlyOnce: true });

      } catch (e) { console.error(e); setLoading(false); }
    };
    loadData();
  }, [dateRange.start, dateRange.end]);

  const filteredData = useMemo(() => {
    let d = demandaData;
    if (selectedSede !== 'ALL') d = d.filter(x => String(x.sede).trim() === String(selectedSede).trim());
    if (selectedRoute !== 'ALL') d = d.filter(x => String(x.ruta) === selectedRoute);
    return d;
  }, [demandaData, selectedSede, selectedRoute]);

  const availableRoutes = useMemo(() => {
    const r = new Set<string>();
    const base = selectedSede === 'ALL' ? demandaData : demandaData.filter(x => String(x.sede).trim() === String(selectedSede).trim());
    base.forEach(x => { if (x.ruta) r.add(String(x.ruta)); });
    return Array.from(r).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [demandaData, selectedSede]);

  const handleSort = useCallback((key: string, set: any) => {
    set((prev: any) => ({ key, dir: prev?.key === key && prev?.dir === 'asc' ? 'desc' : 'asc' }));
  }, []);

  const SortHeader = useCallback(({ label, sortKey, currentSort, onSort, align = 'start' }: any) => {
    const active = currentSort?.key === sortKey;
    return (
      <th className={`text-${align} align-middle cursor-pointer user-select-none`} onClick={() => onSort(sortKey)} style={{ whiteSpace: 'nowrap' }}>
        <div className={`d-flex align-items-center justify-content-${align === 'center' ? 'center' : align === 'end' ? 'end' : 'start'} gap-2`}>
          {label} {active ? (currentSort.dir === 'asc' ? <FaSortUp className="text-danger" /> : <FaSortDown className="text-danger" />) : <FaSort className="opacity-25" />}
        </div>
      </th>
    );
  }, []);

  const chartTooltipStyle = useMemo(() => ({ contentStyle: { backgroundColor: 'var(--theme-background-secondary)', border: '1px solid var(--theme-border-default)', color: 'var(--theme-text-primary)', fontSize: '0.75rem', fontWeight: 'bold' }, labelStyle: { color: 'var(--color-red-primary)', fontWeight: 'black' } }), []);
  const axisStyle = useMemo(() => ({ stroke: 'var(--theme-text-secondary)', fontSize: 10, fontWeight: 'bold' }), []);
  const formatValue = useCallback((v: number) => metric === 'valor' ? `$${v.toLocaleString()}` : v.toLocaleString(undefined, { maximumFractionDigits: 1 }), [metric]);
  const metricLabel = metric === 'valor' ? 'Valor ($)' : metric === 'cf' ? 'Cajas Físicas (CF)' : 'Cajas Unitarias (CU)';

  const dashboardMetrics = useMemo(() => {
    if (activeTab !== 'dashboard') return null;
    const timeMap: Record<string, number> = {};
    const daysMap: any = { 'LUNES': { t: 0 }, 'MARTES': { t: 0 }, 'MIÉRCOLES': { t: 0 }, 'JUEVES': { t: 0 }, 'VIERNES': { t: 0 }, 'SÁBADO': { t: 0 }, 'DOMINGO': { t: 0 } };
    const dayNames = ['DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'];
    const pMap: Record<string, any> = {};
    const rMap: Record<string, any> = {};
    const sMap: Record<string, number> = {};
    let total = 0;

    filteredData.forEach(d => {
      const v = metric === 'valor' ? d.totalValor : metric === 'cf' ? d.totalCF : d.totalCU;
      total += v || 0;
      if (d.fechaObj) {
        const k = d.fechaObj.toISOString().split('T')[0];
        timeMap[k] = (timeMap[k] || 0) + v;
        daysMap[dayNames[d.fechaObj.getDay()]].t += v;
      }
      (d.materiales || []).forEach((m: any) => {
        if (!pMap[m.sku]) pMap[m.sku] = { name: m.descripcion, v: 0 };
        pMap[m.sku].v += (metric === 'valor' ? m.valor : metric === 'cf' ? m.cf : m.cu) || 0;
      });
      const rid = d.ruta || 'S/R';
      if (!rMap[rid]) rMap[rid] = { ruta: rid, v: 0 };
      rMap[rid].v += v;
      const sid = String(d.sede).trim();
      sMap[sid] = (sMap[sid] || 0) + v;
    });

    const timeline = [];
    let curr = new Date(dateRange.start + 'T00:00:00');
    const end = new Date(dateRange.end + 'T00:00:00');
    while (curr <= end) {
      const k = curr.toISOString().split('T')[0];
      timeline.push({ date: k.split('-').slice(1).reverse().join('/'), value: timeMap[k] || 0 });
      curr.setDate(curr.getDate() + 1);
    }
    const pPerf = Object.values(pMap).sort((a: any, b: any) => b.v - a.v);
    const rPerf = Object.values(rMap).sort((a: any, b: any) => b.v - a.v);
    return { timelineStats: timeline, dailyStats: Object.entries(daysMap).map(([name, x]: any) => ({ name, value: x.t })), routePerformance: rPerf.map((x: any) => ({ ...x, currentValue: x.v })), statsPro: { starProduct: pPerf[0]?.name || '---', starProductValue: pPerf[0]?.v || 0, starRoute: rPerf[0]?.ruta || '---', starRouteValue: rPerf[0]?.v || 0, sedePerformance: Object.entries(sMap).map(([sede, value]) => ({ sede, value })).sort((a, b) => b.value - a.value) }, totalMetric: total };
  }, [filteredData, metric, activeTab, dateRange]);

  // OPTIMIZACIÓN: Separar agregación de filtrado
  const groupedClients = useMemo(() => {
    if (activeTab !== 'clientes') return [];
    const cMap: Record<string, any> = {};
    filteredData.forEach(d => {
      const id = String(d.solicitante || '').trim();
      if (!cMap[id]) {
        const sedeCodigo = String(d.sede || '').trim();
        const sedeMatch = sedes.find(s => s.codigo === sedeCodigo);
        cMap[id] = {
          clientId: id,
          clientName: String(d.nombreCliente || 'SIN NOMBRE'),
          sedeNombre: sedeMatch?.nombre || sedeCodigo || 'SIN SEDE',
          ruta: String(d.ruta || 'S/R').trim(),
          monetary: 0, cf: 0, cu: 0
        };
      }
      cMap[id].monetary += d.totalValor || 0;
      cMap[id].cf += d.totalCF || 0;
      cMap[id].cu += d.totalCU || 0;
    });
    return Object.values(cMap);
  }, [filteredData, activeTab, sedes]);

  const clientMetrics = useMemo(() => {
    let res = [...groupedClients];
    if (debouncedClientSearch) {
      const t = debouncedClientSearch.toLowerCase();
      res = res.filter(x => x.clientName.toLowerCase().includes(t) || x.clientId.toLowerCase().includes(t));
    }
    if (clientSort) {
      res.sort((a, b) => {
        const va = a[clientSort.key as keyof typeof a];
        const vb = b[clientSort.key as keyof typeof b];
        return clientSort.dir === 'asc' ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
      });
    }
    return res;
  }, [groupedClients, debouncedClientSearch, clientSort]);

  const availableSubCanales = useMemo(() => {
    const s = new Set<string>();
    maestroData.forEach(m => { if (m.SubCanal) s.add(String(m.SubCanal).trim()); });
    return Array.from(s).sort();
  }, [maestroData]);

  const matrixCoberturaData = useMemo(() => {
    if (activeTab !== 'cobertura' || selectedMarcasCobertura.length === 0) return { rutas: [], data: {} };
    
    const matrix: Record<string, any> = {};
    const routeSet = new Set<string>();
    const prodMap = products.reduce((acc, p) => ({ ...acc, [String(p.sap).trim()]: p }), {} as any);
    const marcasMap = marcas.reduce((acc, m) => ({ ...acc, [m.id]: m }), {} as any);

    // 1. Identificar clientes que cumplen los filtros (Día y SubCanal)
    const validClients = new Set<string>();
    const clientMeta: Record<string, any> = {};

    maestroData.forEach(m => {
      const cid = String(m.Codigo || '').trim();
      if (!cid) return;

      // Filtro SubCanal
      if (selectedSubCanalCobertura !== 'ALL' && String(m.SubCanal).trim() !== selectedSubCanalCobertura) return;

      // Filtro Día (Normalización estricta de 2 letras: LU, MA, MI, etc.)
      if (selectedDiaCobertura !== 'ALL') {
        const diasArray = String(m['SEGDIAS'] || m['SEG DIAS'] || m['SEG.DIAS'] || '')
          .split(/[, -]/)
          .map(d => d.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").substring(0, 2))
          .filter(d => d.length === 2);
        
        if (!diasArray.includes(selectedDiaCobertura)) return;
      }

      // Filtro Sede
      if (selectedSede !== 'ALL' && String(m.Loc || '').trim() !== selectedSede) return;

      validClients.add(cid);
      const rid = String(m['Ruta com'] || m.Ruta || 'S/R').trim();
      clientMeta[cid] = { rid, nombre: m.Cliente || 'SIN NOMBRE' };

      if (!matrix[rid]) matrix[rid] = { total: {}, totalClientesRuta: 0, clientes: {} };
      if (!matrix[rid].clientes[cid]) {
        matrix[rid].totalClientesRuta++;
        matrix[rid].clientes[cid] = { nombre: m.Cliente, marcas: {} };
        routeSet.add(rid);
      }
    });

    // Trackear clientes únicos por ruta y tipo de bebida
    const routeTypeClients: Record<string, Record<string, Set<string>>> = {};

    // 2. Llenar con ventas (solo para clientes válidos)
    filteredData.forEach(d => {
      const cid = String(d.solicitante || '').trim();
      if (!validClients.has(cid)) return;

      const rid = clientMeta[cid].rid;
      
      (d.materiales || []).forEach((m: any) => {
        const p = prodMap[String(m.sku).trim()];
        if (p && selectedMarcasCobertura.includes(p.marcaId)) {
          const mid = p.marcaId;
          if (!matrix[rid].clientes[cid].marcas[mid]) matrix[rid].clientes[cid].marcas[mid] = { cf: 0, cu: 0 };
          const hadS = matrix[rid].clientes[cid].marcas[mid].cf > 0 || matrix[rid].clientes[cid].marcas[mid].cu > 0;
          
          matrix[rid].clientes[cid].marcas[mid].cf += m.cf || 0;
          matrix[rid].clientes[cid].marcas[mid].cu += m.cu || 0;
          
          if (!matrix[rid].total[mid]) matrix[rid].total[mid] = { cf: 0, cu: 0, cliConVenta: 0 };
          matrix[rid].total[mid].cf += m.cf || 0;
          matrix[rid].total[mid].cu += m.cu || 0;
          
          if (!hadS && (m.cf > 0 || m.cu > 0)) matrix[rid].total[mid].cliConVenta++;

          // Contar clientes únicos por ruta+tipo (para cobertura correcta)
          const tipoId = marcasMap[mid]?.tipoBebidaId;
          if (tipoId) {
            if (!routeTypeClients[rid]) routeTypeClients[rid] = {};
            if (!routeTypeClients[rid][tipoId]) routeTypeClients[rid][tipoId] = new Set();
            routeTypeClients[rid][tipoId].add(cid);
          }
        }
      });
    });

    // Calcular cliConVentaPorTipo (clientes únicos con venta por tipo de bebida)
    Object.keys(routeTypeClients).forEach(rid => {
      matrix[rid].cliConVentaPorTipo = {};
      Object.keys(routeTypeClients[rid]).forEach(tipoId => {
        matrix[rid].cliConVentaPorTipo[tipoId] = routeTypeClients[rid][tipoId].size;
      });
    });

    return { rutas: Array.from(routeSet).sort((a,b) => a.localeCompare(b, undefined, {numeric: true})), data: matrix };
  }, [filteredData, maestroData, activeTab, selectedMarcasCobertura, products, selectedDiaCobertura, selectedSubCanalCobertura, selectedSede, marcas]);

  // OPTIMIZACIÓN: Separar agregación de filtrado de productos
  const groupedProducts = useMemo(() => {
    if (activeTab !== 'productos') return [];
    const pMap: Record<string, any> = {};
    filteredData.forEach(d => {
      (d.materiales || []).forEach((m: any) => {
        if (!pMap[m.sku]) pMap[m.sku] = { sap: m.sku, name: m.descripcion, valor: 0, cf: 0, cu: 0 };
        pMap[m.sku].valor += m.valor || 0;
        pMap[m.sku].cf += m.cf || 0;
        pMap[m.sku].cu += m.cu || 0;
      });
    });
    return Object.values(pMap);
  }, [filteredData, activeTab]);

  const productMetrics = useMemo(() => {
    let res = [...groupedProducts];
    if (debouncedProductSearch) {
      const t = debouncedProductSearch.toLowerCase();
      res = res.filter(x => x.name.toLowerCase().includes(t) || x.sap.toLowerCase().includes(t));
    }
    if (productSort) {
      res.sort((a: any, b: any) => {
        const va = a[productSort.key as keyof typeof a];
        const vb = b[productSort.key as keyof typeof b];
        return productSort.dir === 'asc' ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
      });
    }
    return res;
  }, [groupedProducts, debouncedProductSearch, productSort]);

  if (loading) return <GlobalSpinner variant={SPINNER_VARIANTS.IN_PAGE} />;

  return (
    <div className="admin-layout-container flex-column gap-2 gap-md-3">
      {/* HEADER Y FILTROS */}
      <div className="admin-section-table flex-shrink-0" style={{ flex: 'none', height: 'auto', padding: '0.75rem 1rem', borderLeft: '4px solid var(--color-red-primary)' }}>
        {isMobile ? (
          <div className="d-flex flex-column gap-1">
            <h3 className="fw-black mb-0 d-flex align-items-center gap-2" style={{ fontSize: '1rem' }}>
              <FaChartLine className="text-danger" size={16} /> ANALÍTICA PRO
            </h3>
            <div className="d-flex gap-1">
              <div className="d-flex align-items-center p-1" style={{ flex: 1, minWidth: 0, backgroundColor: 'var(--theme-background-secondary)', height: '30px' }}>
                <FaMapMarkerAlt className="text-danger ms-1 flex-shrink-0" size={9} />
                <Form.Select value={selectedSede} onChange={(e) => setSelectedSede(e.target.value)} className="bg-transparent border-0 small fw-bold px-1 py-0" style={{ fontSize: '0.65rem', width: '100%', minWidth: 0, color: 'var(--theme-text-primary)' }}>
                  <option value="ALL">GLOBAL</option>
                  {sedes.map(s => <option key={s.id} value={s.codigo}>{s.nombre.toUpperCase()}</option>)}
                </Form.Select>
              </div>
              <div className="d-flex align-items-center p-1" style={{ flex: 1, minWidth: 0, backgroundColor: 'var(--theme-background-secondary)', height: '30px' }}>
                <FaRoute className="text-danger ms-1 flex-shrink-0" size={9} />
                <Form.Select value={selectedRoute} onChange={(e) => setSelectedRoute(e.target.value)} className="bg-transparent border-0 small fw-bold px-1 py-0" style={{ fontSize: '0.65rem', width: '100%', minWidth: 0, color: 'var(--theme-text-primary)' }}>
                  <option value="ALL">RUTAS</option>
                  {availableRoutes.map(r => <option key={r} value={r}>RUTA {r}</option>)}
                </Form.Select>
              </div>
            </div>
            <div className="d-flex align-items-center p-1 gap-1" style={{ backgroundColor: 'var(--theme-background-secondary)', height: '30px' }}>
              <DatePicker selected={new Date(dateRange.start + 'T00:00:00')} onChange={(date: any) => date && setDateRange(prev => ({ ...prev, start: date.toISOString().split('T')[0] }))} dateFormat="dd/MM/yyyy" locale="es" className="date-picker-industrial" wrapperClassName="date-wrapper-flex" />
              <span className="text-secondary fw-black flex-shrink-0" style={{ fontSize: '0.65rem' }}>-</span>
              <DatePicker selected={new Date(dateRange.end + 'T00:00:00')} onChange={(date: any) => date && setDateRange(prev => ({ ...prev, end: date.toISOString().split('T')[0] }))} dateFormat="dd/MM/yyyy" locale="es" className="date-picker-industrial" wrapperClassName="date-wrapper-flex" />
            </div>
          </div>
        ) : (
          <div className="d-flex align-items-center justify-content-between">
            <h3 className="fw-black mb-0 d-flex align-items-center gap-2" style={{ fontSize: '1.2rem' }}>
              <FaChartLine className="text-danger" /> ANALÍTICA PRO
            </h3>
            <div className="d-flex align-items-center gap-2 flex-wrap justify-content-end">
              <div className="d-flex align-items-center p-1" style={{ backgroundColor: 'var(--theme-background-secondary)', height: '32px' }}>
                <FaMapMarkerAlt className="text-danger ms-2" size={12} />
                <Form.Select value={selectedSede} onChange={(e) => setSelectedSede(e.target.value)} className="bg-transparent border-0 small fw-bold px-2 py-0" style={{ fontSize: '0.75rem', width: 'auto', minWidth: '85px', color: 'var(--theme-text-primary)' }}>
                  <option value="ALL">GLOBAL</option>
                  {sedes.map(s => <option key={s.id} value={s.codigo}>{s.nombre.toUpperCase()}</option>)}
                </Form.Select>
              </div>
              <div className="d-flex align-items-center p-1" style={{ backgroundColor: 'var(--theme-background-secondary)', height: '32px' }}>
                <FaRoute className="text-danger ms-2" size={12} />
                <Form.Select value={selectedRoute} onChange={(e) => setSelectedRoute(e.target.value)} className="bg-transparent border-0 small fw-bold px-2 py-0" style={{ fontSize: '0.75rem', width: 'auto', minWidth: '80px', color: 'var(--theme-text-primary)' }}>
                  <option value="ALL">RUTAS</option>
                  {availableRoutes.map(r => <option key={r} value={r}>RUTA {r}</option>)}
                </Form.Select>
              </div>
              <div className="d-flex align-items-center p-1 gap-1" style={{ backgroundColor: 'var(--theme-background-secondary)', height: '32px' }}>
                <DatePicker selected={new Date(dateRange.start + 'T00:00:00')} onChange={(date: any) => date && setDateRange(prev => ({ ...prev, start: date.toISOString().split('T')[0] }))} dateFormat="dd/MM/yyyy" locale="es" className="date-picker-industrial" />
                <span className="text-secondary fw-black" style={{ fontSize: '0.7rem' }}>-</span>
                <DatePicker selected={new Date(dateRange.end + 'T00:00:00')} onChange={(date: any) => date && setDateRange(prev => ({ ...prev, end: date.toISOString().split('T')[0] }))} dateFormat="dd/MM/yyyy" locale="es" className="date-picker-industrial" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* CONTENIDO PRINCIPAL */}
      <div className="admin-section-table flex-grow-1 p-0 overflow-hidden">
        <Tab.Container id="analytics-tabs" activeKey={activeTab} onSelect={(k) => setActiveTab(k as string)}>
          <div className="d-flex flex-column h-100">
            {isMobile ? (
              <div className="px-3 pt-3 flex-shrink-0">
                <div className="info-pill-new w-100">
                  <span className="pill-icon-sober text-danger p-1"><FaFilter className="pill-main-icon"/></span>
                  <div className="pill-content flex-grow-1">
                    <Form.Select value={activeTab} onChange={(e) => setActiveTab(e.target.value)} className="pill-select-v2 w-100">
                      <option value="dashboard">RESUMEN</option>
                      <option value="clientes">CLIENTES</option>
                      <option value="cobertura">COBERTURA</option>
                      <option value="productos">PRODUCTOS</option>
                    </Form.Select>
                  </div>
                </div>
              </div>
            ) : (
              <Nav variant="tabs" className="custom-tabs-industrial px-2 pt-2 flex-shrink-0 border-bottom-0">
                <Nav.Item><Nav.Link eventKey="dashboard" className="d-flex align-items-center gap-2"><FaHistory /> RESUMEN</Nav.Link></Nav.Item>
                <Nav.Item><Nav.Link eventKey="clientes" className="d-flex align-items-center gap-2"><FaUsers /> CLIENTES</Nav.Link></Nav.Item>
                <Nav.Item><Nav.Link eventKey="cobertura" className="d-flex align-items-center gap-2"><FaMapMarkerAlt /> COBERTURA</Nav.Link></Nav.Item>
                <Nav.Item><Nav.Link eventKey="productos" className="d-flex align-items-center gap-2"><FaBox /> PRODUCTOS</Nav.Link></Nav.Item>
              </Nav>
            )}

            <Tab.Content className="flex-grow-1 overflow-hidden position-relative">
              <Tab.Pane eventKey="dashboard" className="h-100 overflow-auto custom-scrollbar p-3">
                <div className="d-flex justify-content-between align-items-center p-3 mb-3 border-start border-danger border-4" style={{ backgroundColor: 'var(--theme-background-secondary)' }}>
                  <div><h6 className="fw-black mb-0 text-uppercase">Dimensión del Análisis</h6><span className="text-secondary small fw-bold">Unidad de medida para gráficos</span></div>
                  <div className="d-flex p-1" style={{ backgroundColor: 'var(--theme-background-tertiary)' }}>
                    {([['valor', '$'], ['cf', 'CF'], ['cu', 'CU']] as const).map(([m, label]) => (
                      <button key={m} onClick={() => setMetric(m)} className={`btn btn-sm px-4 fw-black ${metric === m ? 'btn-danger' : 'btn-link text-secondary text-decoration-none'}`} style={{ fontSize: '0.75rem', borderRadius: '2px' }}>{label}</button>
                    ))}
                  </div>
                </div>
                {activeTab === 'dashboard' && dashboardMetrics && (
                  <DashboardTab {...dashboardMetrics} metric={metric} metricLabel={metricLabel} formatValue={formatValue} sedes={sedes} chartTooltipStyle={chartTooltipStyle} axisStyle={axisStyle} rfmResultsLength={dashboardMetrics.totalMetric} />
                )}
              </Tab.Pane>
              
              <Tab.Pane eventKey="clientes" className="h-100 overflow-hidden custom-scrollbar p-3">
                {activeTab === 'clientes' && (
                  <ClientsTab 
                    finalRfmResults={clientMetrics}
                    clientSearch={clientSearch}
                    setClientSearch={setClientSearch}
                    clientSort={clientSort}
                    handleSort={handleSort}
                    setClientSort={setClientSort}
                    SortHeader={SortHeader}
                    isMobile={isMobile}
                  />
                )}
              </Tab.Pane>
              
              <Tab.Pane eventKey="cobertura" className="h-100 overflow-auto custom-scrollbar p-3">
                {activeTab === 'cobertura' && (
                  <CoberturaTab 
                    marcas={marcas} 
                    beverageTypes={beverageTypes}
                    selectedMarcasCobertura={selectedMarcasCobertura} 
                    setSelectedMarcasCobertura={setSelectedMarcasCobertura} 
                    matrixCoberturaData={matrixCoberturaData} 
                    expandedCoberturaRutas={expandedCoberturaRutas} 
                    setExpandedCoberturaRutas={setExpandedCoberturaRutas} 
                    selectedDia={selectedDiaCobertura}
                    setSelectedDia={setSelectedDiaCobertura}
                    selectedSubCanal={selectedSubCanalCobertura}
                    setSelectedSubCanal={setSelectedSubCanalCobertura}
                    selectedTipoCobertura={selectedTipoCobertura}
                    setSelectedTipoCobertura={setSelectedTipoCobertura}
                    availableSubCanales={availableSubCanales}
                  />
                )}
              </Tab.Pane>

              <Tab.Pane eventKey="productos" className="h-100 overflow-hidden custom-scrollbar p-3">
                {activeTab === 'productos' && <ProductsTab productSearch={productSearch} setProductSearch={setProductSearch} productSort={productSort} handleSort={handleSort} setProductSort={setProductSort} finalProductPerformance={productMetrics} SortHeader={SortHeader} />}
              </Tab.Pane>
            </Tab.Content>
          </div>
        </Tab.Container>
      </div>
    </div>
  );
};

export default AnalyticsProPage;
