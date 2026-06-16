import type { FC } from 'react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Tab, Nav, Form } from 'react-bootstrap';
import { FaChartLine, FaUsers, FaBox, FaHistory, FaMapMarkerAlt, FaFilter, FaRoute, FaSortUp, FaSortDown, FaSort } from 'react-icons/fa';
import { SPINNER_VARIANTS } from '../constants';
import GlobalSpinner from '../components/GlobalSpinner';
import useMediaQuery from '../hooks/useMediaQuery';
import { db } from '../api/firebase';
import { useData } from '../context/DataContext';
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
  const { sedes, marcas } = useData();
  const isMobile = useMediaQuery('(max-width: 991px)');
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [demandaData, setDemandaData] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);

  // --- FILTROS GLOBALES ---
  const [metric, setMetric] = useState<'valor' | 'cf' | 'cu'>('valor');
  const [selectedSede, setSelectedSede] = useState<string>('ALL');
  const [selectedRoute, setSelectedRoute] = useState<string>('ALL');
  const [selectedMarcasCobertura, setSelectedMarcasCobertura] = useState<string[]>([]);
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
        setLoading(false);
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
      if (!cMap[id]) cMap[id] = { clientId: id, clientName: String(d.nombreCliente || 'SIN NOMBRE'), monetary: 0, cf: 0, cu: 0 };
      cMap[id].monetary += d.totalValor || 0;
      cMap[id].cf += d.totalCF || 0;
      cMap[id].cu += d.totalCU || 0;
    });
    return Object.values(cMap);
  }, [filteredData, activeTab]);

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

  const matrixCoberturaData = useMemo(() => {
    if (activeTab !== 'cobertura' || selectedMarcasCobertura.length === 0) return { rutas: [], data: {} };
    const matrix: Record<string, any> = {};
    const routeSet = new Set<string>();
    const prodMap = products.reduce((acc, p) => ({ ...acc, [String(p.sap).trim()]: p }), {} as any);
    filteredData.forEach(d => {
      const rid = String(d.ruta || 'S/R').trim();
      const cid = String(d.solicitante).trim();
      routeSet.add(rid);
      if (!matrix[rid]) matrix[rid] = { total: {}, totalClientesRuta: 0, clientes: {} };
      if (!matrix[rid].clientes[cid]) { matrix[rid].totalClientesRuta++; matrix[rid].clientes[cid] = { nombre: d.nombreCliente, marcas: {} }; }
      (d.materiales || []).forEach((m: any) => {
        const p = prodMap[String(m.sku).trim()];
        if (p && selectedMarcasCobertura.includes(p.marcaId)) {
          const mid = p.marcaId;
          if (!matrix[rid].clientes[cid].marcas[mid]) matrix[rid].clientes[cid].marcas[mid] = { cf: 0, cu: 0 };
          const hadS = matrix[rid].clientes[cid].marcas[mid].cf > 0;
          matrix[rid].clientes[cid].marcas[mid].cf += m.cf || 0;
          matrix[rid].clientes[cid].marcas[mid].cu += m.cu || 0;
          if (!matrix[rid].total[mid]) matrix[rid].total[mid] = { cf: 0, cu: 0, cliConVenta: 0 };
          matrix[rid].total[mid].cf += m.cf || 0;
          matrix[rid].total[mid].cu += m.cu || 0;
          if (!hadS) matrix[rid].total[mid].cliConVenta++;
        }
      });
    });
    return { rutas: Array.from(routeSet).sort(), data: matrix };
  }, [filteredData, activeTab, selectedMarcasCobertura, products]);

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
      <div className="admin-section-table flex-shrink-0" style={{ flex: 'none', height: 'auto', padding: '1rem 1.25rem', borderLeft: '4px solid var(--color-red-primary)' }}>
        <div className={`d-flex ${isMobile ? 'flex-column gap-2' : 'align-items-center justify-content-between'} g-3`}>
          <h3 className="fw-black mb-0 d-flex align-items-center gap-2" style={{ fontSize: '1.2rem' }}>
            <FaChartLine className="text-danger" /> ANALÍTICA PRO
          </h3>
          <div className="d-flex align-items-center gap-2 flex-wrap justify-content-end">
            <div className="d-flex align-items-center p-1" style={{ borderRadius: '4px', backgroundColor: 'var(--theme-background-secondary)', height: '32px' }}>
              <FaMapMarkerAlt className="text-danger ms-2" size={12} />
              <Form.Select value={selectedSede} onChange={(e) => setSelectedSede(e.target.value)} className="bg-transparent border-0 small fw-bold px-2 py-0" style={{ fontSize: '0.75rem', width: 'auto', minWidth: '85px', color: 'var(--theme-text-primary)' }}>
                <option value="ALL">GLOBAL</option>
                {sedes.map(s => <option key={s.id} value={s.codigo}>{s.nombre.toUpperCase()}</option>)}
              </Form.Select>
            </div>
            <div className="d-flex align-items-center p-1" style={{ borderRadius: '4px', backgroundColor: 'var(--theme-background-secondary)', height: '32px' }}>
              <FaRoute className="text-danger ms-2" size={12} />
              <Form.Select value={selectedRoute} onChange={(e) => setSelectedRoute(e.target.value)} className="bg-transparent border-0 small fw-bold px-2 py-0" style={{ fontSize: '0.75rem', width: 'auto', minWidth: '80px', color: 'var(--theme-text-primary)' }}>
                <option value="ALL">RUTAS</option>
                {availableRoutes.map(r => <option key={r} value={r}>RUTA {r}</option>)}
              </Form.Select>
            </div>
            <div className="d-flex align-items-center p-1" style={{ borderRadius: '4px', backgroundColor: 'var(--theme-background-secondary)', height: '32px' }}>
              <DatePicker selected={new Date(dateRange.start + 'T00:00:00')} onChange={(date: any) => date && setDateRange(prev => ({ ...prev, start: date.toISOString().split('T')[0] }))} dateFormat="dd/MM/yyyy" locale="es" className="date-picker-industrial" />
              <DatePicker selected={new Date(dateRange.end + 'T00:00:00')} onChange={(date: any) => date && setDateRange(prev => ({ ...prev, end: date.toISOString().split('T')[0] }))} dateFormat="dd/MM/yyyy" locale="es" className="date-picker-industrial" />
            </div>
          </div>
        </div>
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
                  <div className="d-flex p-1" style={{ borderRadius: '4px', backgroundColor: 'var(--theme-background-tertiary)' }}>
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
                  />
                )}
              </Tab.Pane>
              
              <Tab.Pane eventKey="cobertura" className="h-100 overflow-auto custom-scrollbar p-3">
                {activeTab === 'cobertura' && <CoberturaTab marcas={marcas} selectedMarcasCobertura={selectedMarcasCobertura} setSelectedMarcasCobertura={setSelectedMarcasCobertura} matrixCoberturaData={matrixCoberturaData} expandedCoberturaRutas={expandedCoberturaRutas} setExpandedCoberturaRutas={setExpandedCoberturaRutas} />}
              </Tab.Pane>

              <Tab.Pane eventKey="productos" className="h-100 overflow-hidden custom-scrollbar p-3">
                {activeTab === 'productos' && <ProductsTab productSearch={productSearch} setProductSearch={setProductSearch} productSort={productSort} handleSort={handleSort} setProductSort={setProductSort} finalProductPerformance={productMetrics} SortHeader={SortHeader} />}
              </Tab.Pane>
            </Tab.Content>
          </div>
        </Tab.Container>
      </div>

      <style>{`
        .fw-black { font-weight: 900 !important; }
        .info-pill-new { display: flex; align-items: center; background-color: var(--theme-background-secondary); border: 1px solid var(--theme-border-default); border-radius: 0; height: 38px; position: relative; }
        .pill-icon-sober { background-color: var(--theme-icon-bg); color: var(--theme-icon-color); height: 100%; display: flex; align-items: center; border-right: 1px solid var(--theme-border-default); min-width: 32px; justify-content: center; z-index: 2; }
        .pill-main-icon { font-size: 14px; }
        .pill-content { padding: 0 10px; display: flex; flex-direction: column; justify-content: center; min-width: 0; flex-grow: 1; position: relative; z-index: 1; }
        .pill-select-v2 { background: transparent !important; border: none !important; color: var(--theme-text-primary) !important; font-weight: 600; font-size: 0.85rem; padding: 0 !important; margin-top: -2px; box-shadow: none !important; appearance: none; }
        .custom-tabs-industrial .nav-link { color: var(--theme-text-secondary); border: none; border-bottom: 3px solid transparent; font-weight: 800; text-transform: uppercase; font-size: 0.75rem; padding: 10px 20px; border-radius: 0; transition: all 0.2s ease; }
        .custom-tabs-industrial .nav-link:hover { color: var(--theme-text-primary); background: rgba(244, 0, 9, 0.05); }
        .custom-tabs-industrial .nav-link.active { color: var(--color-red-primary) !important; background: transparent !important; border-bottom-color: var(--color-red-primary) !important; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0,0,0,0.1); }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: var(--color-red-primary); }
        .date-picker-industrial { background: transparent; border: none; font-weight: 900; font-size: 0.75rem; color: var(--theme-text-primary); text-align: center; width: 100px; outline: none; }
        .industrial-table-v2 thead th { background-color: var(--theme-background-tertiary) !important; color: var(--theme-text-secondary); font-weight: 900; font-size: 0.65rem; text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px solid var(--theme-border-default); padding: 15px 10px; }
        .industrial-table-v2 tbody tr { border-bottom: 1px solid var(--theme-table-border-color); transition: background 0.2s ease; }
        .industrial-table-v2 tbody tr:hover { background-color: rgba(244, 0, 9, 0.05) !important; }
      `}</style>
    </div>
  );
};

export default AnalyticsProPage;
