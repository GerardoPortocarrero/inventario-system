import type { FC } from 'react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Tab, Nav, Form, Popover } from 'react-bootstrap';
import { FaChartLine, FaUsers, FaBox, FaHistory, FaMapMarkerAlt, FaFilter, FaRoute, FaSortUp, FaSortDown, FaSort, FaCrown, FaStar, FaExclamationTriangle, FaBed } from 'react-icons/fa';
import { SPINNER_VARIANTS } from '../constants';
import GlobalSpinner from '../components/GlobalSpinner';
import useMediaQuery from '../hooks/useMediaQuery';
import { db } from '../api/firebase';
import { useData } from '../context/DataContext';
import { collection, getDocs, query, orderBy, where, Timestamp } from 'firebase/firestore';
import DatePicker, { registerLocale } from 'react-datepicker';
import { es } from 'date-fns/locale/es';
import "react-datepicker/dist/react-datepicker.css";

// Subcomponentes optimizados
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

  // --- BUSQUEDA Y ORDENAMIENTO POR PESTAÑA ---
  const [clientSearch, setClientSearch] = useState('');
  const [clientSort, setClientSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null);
  const [productSearch, setProductSearch] = useState('');
  const [productSort, setProductSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null);
  const [expandedCoberturaRutas, setExpandedCoberturaRutas] = useState<Record<string, boolean>>({});

  // Carga inicial optimizada
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const start = new Date(dateRange.start + 'T00:00:00');
        const end = new Date(dateRange.end + 'T23:59:59');

        const demandaQuery = query(
          collection(db, 'demanda_historica'), 
          where('fecha', '>=', Timestamp.fromDate(start)),
          where('fecha', '<=', Timestamp.fromDate(end)),
          orderBy('fecha', 'desc')
        );

        const [demandaSnap, productsSnap] = await Promise.all([
          getDocs(demandaQuery),
          getDocs(collection(db, 'productos'))
        ]);

        setDemandaData(demandaSnap.docs.map(doc => ({
          ...doc.data(),
          fechaObj: (doc.data() as any).fecha?.toDate()
        })));
        setProducts(productsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setLoading(false);
      } catch (error) {
        console.error("Error loading analytics data:", error);
        setLoading(false);
      }
    };
    loadData();
  }, [dateRange.start, dateRange.end]);

  const filteredData = useMemo(() => {
    let data = demandaData;
    if (selectedSede !== 'ALL') data = data.filter(d => String(d.sede).trim() === String(selectedSede).trim());
    if (selectedRoute !== 'ALL') data = data.filter(d => String(d.ruta) === selectedRoute);
    return data;
  }, [demandaData, selectedSede, selectedRoute]);

  const availableRoutes = useMemo(() => {
    const routes = new Set<string>();
    const baseData = selectedSede === 'ALL' ? demandaData : demandaData.filter(d => String(d.sede).trim() === String(selectedSede).trim());
    baseData.forEach(d => { if (d.ruta) routes.add(String(d.ruta)); });
    return Array.from(routes).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [demandaData, selectedSede]);

  // --- LÓGICA COMPARTIDA Y HELPERS ---
  const handleSort = useCallback((key: string, set: any) => {
    set((prev: any) => ({ key, dir: prev?.key === key && prev?.dir === 'asc' ? 'desc' : 'asc' }));
  }, []);

  const SortHeader = useCallback(({ label, sortKey, currentSort, onSort, align = 'start' }: any) => {
    const isSorted = currentSort?.key === sortKey;
    return (
      <th className={`text-${align} align-middle cursor-pointer user-select-none`} onClick={() => onSort(sortKey)} style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>
        <div className={`d-flex align-items-center justify-content-${align === 'center' ? 'center' : align === 'end' ? 'end' : 'start'} gap-2`}>
          {label}
          {isSorted ? (currentSort.dir === 'asc' ? <FaSortUp className="text-danger" /> : <FaSortDown className="text-danger" />) : <FaSort className="opacity-25" />}
        </div>
      </th>
    );
  }, []);

  const chartTooltipStyle = useMemo(() => ({
    contentStyle: { backgroundColor: 'var(--theme-background-secondary)', border: '1px solid var(--theme-border-default)', borderRadius: '0px', color: 'var(--theme-text-primary)', fontSize: '0.75rem', fontWeight: 'bold' },
    itemStyle: { color: 'var(--theme-text-primary)' },
    labelStyle: { color: 'var(--color-red-primary)', fontWeight: 'black', marginBottom: '4px' }
  }), []);

  const axisStyle = useMemo(() => ({ stroke: 'var(--theme-text-secondary)', fontSize: 10, fontWeight: 'bold' }), []);
  const formatValue = useCallback((val: number) => metric === 'valor' ? `$${val.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : val.toLocaleString(undefined, { maximumFractionDigits: 1 }), [metric]);
  const metricLabel = metric === 'valor' ? 'Valor ($)' : metric === 'cf' ? 'Cajas Físicas (CF)' : 'Cajas Unitarias (CU)';

  // --- CÁLCULOS PEREZOSOS ---
  const dashboardMetrics = useMemo(() => {
    if (activeTab !== 'dashboard') return null;
    const timeMap: Record<string, number> = {};
    const daysMap: any = { 'LUNES': { t: 0 }, 'MARTES': { t: 0 }, 'MIÉRCOLES': { t: 0 }, 'JUEVES': { t: 0 }, 'VIERNES': { t: 0 }, 'SÁBADO': { t: 0 }, 'DOMINGO': { t: 0 } };
    const dayNames = ['DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'];
    const prodMap: Record<string, any> = {};
    const routeMap: Record<string, any> = {};
    const sedeMap: Record<string, number> = {};
    let totalMetric = 0;

    filteredData.forEach(d => {
      const val = metric === 'valor' ? d.totalValor : metric === 'cf' ? d.totalCF : d.totalCU;
      totalMetric += val || 0;
      if (d.fechaObj) {
        const dateKey = d.fechaObj.toISOString().split('T')[0];
        timeMap[dateKey] = (timeMap[dateKey] || 0) + val;
        daysMap[dayNames[d.fechaObj.getDay()]].t += val;
      }
      (d.materiales || []).forEach((m: any) => {
        if (!prodMap[m.sku]) prodMap[m.sku] = { name: m.descripcion, v: 0 };
        prodMap[m.sku].v += (metric === 'valor' ? m.valor : metric === 'cf' ? m.cf : m.cu) || 0;
      });
      const rId = d.ruta || 'S/R';
      if (!routeMap[rId]) routeMap[rId] = { ruta: rId, v: 0 };
      routeMap[rId].v += val;
      const sId = String(d.sede).trim();
      sedeMap[sId] = (sedeMap[sId] || 0) + val;
    });

    const timeline = [];
    let curr = new Date(dateRange.start + 'T00:00:00');
    const end = new Date(dateRange.end + 'T00:00:00');
    while (curr <= end) {
      const k = curr.toISOString().split('T')[0];
      timeline.push({ date: k.split('-').slice(1).reverse().join('/'), value: timeMap[k] || 0 });
      curr.setDate(curr.getDate() + 1);
    }

    const productsPerf = Object.values(prodMap).sort((a, b) => b.v - a.v);
    const routesPerf = Object.values(routeMap).sort((a, b) => b.v - a.v);

    return {
      timelineStats: timeline,
      dailyStats: Object.entries(daysMap).map(([name, d]: any) => ({ name, value: d.t })),
      routePerformance: routesPerf.map((r: any) => ({ ...r, currentValue: r.v })),
      statsPro: {
        starProduct: productsPerf[0]?.name || '---',
        starProductValue: productsPerf[0]?.v || 0,
        starRoute: routesPerf[0]?.ruta || '---',
        starRouteValue: routesPerf[0]?.v || 0,
        sedePerformance: Object.entries(sedeMap).map(([sede, value]) => ({ sede, value })).sort((a, b) => b.value - a.value)
      },
      totalMetric
    };
  }, [filteredData, metric, activeTab, dateRange]);

  const rfmMetrics = useMemo(() => {
    if (activeTab !== 'clientes') return null;
    const clientMap: Record<string, any> = {};
    const now = new Date();
    filteredData.forEach(d => {
      const solId = String(d.solicitante).trim();
      if (!clientMap[solId]) clientMap[solId] = { clientId: solId, clientName: d.nombreCliente, lastDate: d.fechaObj, frequency: 0, monetary: 0, cf: 0, cu: 0, purchaseDates: new Set() };
      clientMap[solId].frequency += 1;
      clientMap[solId].monetary += d.totalValor || 0;
      clientMap[solId].cf += d.totalCF || 0;
      clientMap[solId].cu += d.totalCU || 0;
      if (d.fechaObj > clientMap[solId].lastDate) clientMap[solId].lastDate = d.fechaObj;
    });

    const allMetrics = Object.values(clientMap).map((c: any) => metric === 'valor' ? c.monetary : metric === 'cf' ? c.cf : c.cu);
    const avgVolume = allMetrics.length > 0 ? allMetrics.reduce((a, b) => a + b, 0) / allMetrics.length : 0;
    const avgFrequency = Object.values(clientMap).length > 0 ? Object.values(clientMap).reduce((a: any, b: any) => a + b.frequency, 0) / Object.values(clientMap).length : 0;

    const rfmResults = Object.values(clientMap).map((c: any) => {
      const recency = Math.floor((now.getTime() - c.lastDate.getTime()) / (86400000));
      const volume = metric === 'valor' ? c.monetary : metric === 'cf' ? c.cf : c.cu;
      let segment = 'Fiel';
      if (recency > 30) segment = 'Hibernando';
      else if (c.frequency < avgFrequency && volume < avgVolume * 0.5) segment = 'Poco Frecuente';
      else if (c.frequency >= avgFrequency && volume >= avgVolume) segment = 'Campeón';
      return { ...c, recency, segment };
    }).sort((a, b) => b.monetary - a.monetary);

    const segmentCounts = ['Campeón', 'Fiel', 'Poco Frecuente', 'Hibernando'].map(name => ({ name, value: rfmResults.filter(r => r.segment === name).length }));
    
    return { rfmResults, segmentCounts };
  }, [filteredData, metric, activeTab]);

  const finalRfmResults = useMemo(() => {
    if (!rfmMetrics) return [];
    let data = [...rfmMetrics.rfmResults];
    if (clientSearch) {
      const t = clientSearch.toLowerCase();
      data = data.filter(r => r.clientName.toLowerCase().includes(t) || r.clientId.toLowerCase().includes(t));
    }
    if (clientSort) {
      data.sort((a, b) => {
        const va = a[clientSort.key as keyof typeof a];
        const vb = b[clientSort.key as keyof typeof b];
        return clientSort.dir === 'asc' ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
      });
    }
    return data;
  }, [rfmMetrics, clientSearch, clientSort]);

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
      if (!matrix[rid].clientes[cid]) {
        matrix[rid].totalClientesRuta++;
        matrix[rid].clientes[cid] = { nombre: d.nombreCliente, marcas: {} };
      }
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

  const productMetrics = useMemo(() => {
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
    let data = Object.values(pMap).sort((a, b) => b.valor - a.valor);
    if (productSearch) {
      const t = productSearch.toLowerCase();
      data = data.filter(p => p.name.toLowerCase().includes(t) || p.sap.toLowerCase().includes(t));
    }
    if (productSort) {
      data.sort((a, b) => {
        const va = a[productSort.key as keyof typeof a];
        const vb = b[productSort.key as keyof typeof b];
        return productSort.dir === 'asc' ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
      });
    }
    return data;
  }, [filteredData, activeTab, productSearch, productSort]);

  const segmentColors: any = { 'Campeón': 'var(--rfm-campeon)', 'Fiel': 'var(--rfm-fiel)', 'Poco Frecuente': 'var(--rfm-en-riesgo)', 'Hibernando': 'var(--rfm-hibernando)' };
  const segmentIcons: any = { 'Campeón': <FaCrown style={{ color: 'var(--rfm-campeon)' }} />, 'Fiel': <FaStar style={{ color: 'var(--rfm-fiel)' }} />, 'Poco Frecuente': <FaExclamationTriangle style={{ color: 'var(--rfm-en-riesgo)' }} />, 'Hibernando': <FaBed style={{ color: 'var(--rfm-hibernando)' }} /> };

  if (loading) return <GlobalSpinner variant={SPINNER_VARIANTS.IN_PAGE} />;

  return (
    <div className="admin-layout-container flex-column gap-2 gap-md-3">
      <div className="admin-section-table flex-shrink-0" style={{ flex: 'none', height: 'auto', padding: '1rem 1.25rem', borderLeft: '4px solid var(--color-red-primary)' }}>
        <div className={`d-flex ${isMobile ? 'flex-column gap-2' : 'align-items-center justify-content-between'} g-3`}>
          <h3 className="fw-black mb-0 d-flex align-items-center gap-2" style={{ fontSize: '1.2rem' }}>
            <FaChartLine className="text-danger" /> ANALÍTICA PRO
          </h3>
          <div className="d-flex align-items-center gap-2 flex-wrap justify-content-end">
            <div className="d-flex align-items-center p-1 border border-secondary border-opacity-25" style={{ borderRadius: '4px', backgroundColor: 'var(--theme-background-secondary)', height: '32px' }}>
              <FaMapMarkerAlt className="text-danger ms-2" size={12} />
              <Form.Select value={selectedSede} onChange={(e) => setSelectedSede(e.target.value)} className="bg-transparent border-0 small fw-bold px-2 py-0" style={{ fontSize: '0.75rem', width: 'auto', minWidth: '85px', color: 'var(--theme-text-primary)' }}>
                <option value="ALL">GLOBAL</option>
                {sedes.map(s => <option key={s.id} value={s.codigo}>{s.nombre.toUpperCase()}</option>)}
              </Form.Select>
            </div>
            <div className="d-flex align-items-center p-1 border border-secondary border-opacity-25" style={{ borderRadius: '4px', backgroundColor: 'var(--theme-background-secondary)', height: '32px' }}>
              <FaRoute className="text-danger ms-2" size={12} />
              <Form.Select value={selectedRoute} onChange={(e) => setSelectedRoute(e.target.value)} className="bg-transparent border-0 small fw-bold px-2 py-0" style={{ fontSize: '0.75rem', width: 'auto', minWidth: '80px', color: 'var(--theme-text-primary)' }}>
                <option value="ALL">RUTAS</option>
                {availableRoutes.map(r => <option key={r} value={r}>RUTA {r}</option>)}
              </Form.Select>
            </div>
            <div className="d-flex align-items-center p-1 border border-secondary border-opacity-25" style={{ borderRadius: '4px', backgroundColor: 'var(--theme-background-secondary)', height: '32px' }}>
              <DatePicker selected={new Date(dateRange.start + 'T00:00:00')} onChange={(date: any) => date && setDateRange(prev => ({ ...prev, start: date.toISOString().split('T')[0] }))} dateFormat="dd/MM/yyyy" locale="es" className="date-picker-industrial" />
              <DatePicker selected={new Date(dateRange.end + 'T00:00:00')} onChange={(date: any) => date && setDateRange(prev => ({ ...prev, end: date.toISOString().split('T')[0] }))} dateFormat="dd/MM/yyyy" locale="es" className="date-picker-industrial" />
            </div>
          </div>
        </div>
      </div>

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
                      <option value="clientes">CLIENTES (RFM)</option>
                      <option value="cobertura">COBERTURA</option>
                      <option value="productos">PRODUCTOS</option>
                    </Form.Select>
                  </div>
                </div>
              </div>
            ) : (
              <Nav variant="tabs" className="custom-tabs-industrial px-2 pt-2 flex-shrink-0 border-bottom-0">
                <Nav.Item><Nav.Link eventKey="dashboard" className="d-flex align-items-center gap-2"><FaHistory /> RESUMEN</Nav.Link></Nav.Item>
                <Nav.Item><Nav.Link eventKey="clientes" className="d-flex align-items-center gap-2"><FaUsers /> CLIENTES (RFM)</Nav.Link></Nav.Item>
                <Nav.Item><Nav.Link eventKey="cobertura" className="d-flex align-items-center gap-2"><FaMapMarkerAlt /> COBERTURA</Nav.Link></Nav.Item>
                <Nav.Item><Nav.Link eventKey="productos" className="d-flex align-items-center gap-2"><FaBox /> PRODUCTOS</Nav.Link></Nav.Item>
              </Nav>
            )}

            <Tab.Content className="flex-grow-1 overflow-hidden position-relative">
              <Tab.Pane eventKey="dashboard" className="h-100 overflow-auto custom-scrollbar p-3">
                <div className="d-flex justify-content-between align-items-center p-3 mb-3 border-start border-danger border-4" style={{ backgroundColor: 'var(--theme-background-secondary)' }}>
                  <div><h6 className="fw-black mb-0 text-uppercase">Dimensión del Análisis</h6><span className="text-secondary small fw-bold">Unidad de medida para gráficos</span></div>
                  <div className="d-flex p-1 border border-secondary border-opacity-25 shadow-sm" style={{ borderRadius: '4px', backgroundColor: 'var(--theme-background-tertiary)' }}>
                    {([['valor', '$'], ['cf', 'CF'], ['cu', 'CU']] as const).map(([m, label]) => (
                      <button key={m} onClick={() => setMetric(m)} className={`btn btn-sm px-4 fw-black ${metric === m ? 'btn-danger shadow-sm' : 'btn-link text-secondary text-decoration-none'}`} style={{ fontSize: '0.75rem', borderRadius: '2px' }}>{label}</button>
                    ))}
                  </div>
                </div>
                {activeTab === 'dashboard' && dashboardMetrics && (
                  <DashboardTab {...dashboardMetrics} metric={metric} metricLabel={metricLabel} formatValue={formatValue} sedes={sedes} chartTooltipStyle={chartTooltipStyle} axisStyle={axisStyle} rfmResultsLength={dashboardMetrics.totalMetric} />
                )}
              </Tab.Pane>
              
              <Tab.Pane eventKey="clientes" className="h-100 overflow-auto custom-scrollbar p-3">
                {activeTab === 'clientes' && rfmMetrics && (
                  <ClientsTab {...rfmMetrics} segmentColors={segmentColors} segmentIcons={segmentIcons} clientSearch={clientSearch} setClientSearch={setClientSearch} clientSort={clientSort} handleSort={handleSort} setClientSort={setClientSort} finalRfmResults={finalRfmResults} rfmPopover={<Popover id="rfm-p" style={{ background: 'var(--theme-background-secondary)', border: '1px solid var(--theme-border-default)' }}><Popover.Header as="h3" style={{ background: 'var(--theme-icon-bg)', color: 'var(--color-red-primary)', fontWeight: 900, fontSize: '0.8rem' }}>RFM</Popover.Header><Popover.Body style={{ fontSize: '0.75rem', color: 'var(--theme-text-primary)' }}>Clasificación por Recencia y Frecuencia.</Popover.Body></Popover>} chartTooltipStyle={chartTooltipStyle} axisStyle={axisStyle} SortHeader={SortHeader} />
                )}
              </Tab.Pane>
              
              <Tab.Pane eventKey="cobertura" className="h-100 overflow-auto custom-scrollbar p-3">
                {activeTab === 'cobertura' && <CoberturaTab marcas={marcas} selectedMarcasCobertura={selectedMarcasCobertura} setSelectedMarcasCobertura={setSelectedMarcasCobertura} matrixCoberturaData={matrixCoberturaData} expandedCoberturaRutas={expandedCoberturaRutas} setExpandedCoberturaRutas={setExpandedCoberturaRutas} />}
              </Tab.Pane>

              <Tab.Pane eventKey="productos" className="h-100 overflow-auto custom-scrollbar p-3">
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
        .industrial-table-v2 tbody tr { border-bottom: 1px solid rgba(255,255,255,0.05); transition: background 0.2s ease; }
        .industrial-table-v2 tbody tr:hover { background-color: rgba(244, 0, 9, 0.05) !important; }
      `}</style>
    </div>
  );
};

export default AnalyticsProPage;
