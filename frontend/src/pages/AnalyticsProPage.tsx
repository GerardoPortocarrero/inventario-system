import type { FC } from 'react';
import { useState, useEffect, useMemo } from 'react';
import { Row, Col, Tab, Nav, Badge, Table, OverlayTrigger, Popover, Form } from 'react-bootstrap';
import { FaChartLine, FaUsers, FaRoute, FaBox, FaExchangeAlt, FaHistory, FaCrown, FaExclamationTriangle, FaStar, FaBed, FaUserCheck, FaArrowUp, FaInfoCircle, FaMapMarkerAlt, FaSort, FaSortUp, FaSortDown } from 'react-icons/fa';
import { SPINNER_VARIANTS } from '../constants';
import GlobalSpinner from '../components/GlobalSpinner';
import SearchInput from '../components/SearchInput';
import { db, rtdb } from '../api/firebase';
import { useData } from '../context/DataContext';
import { ref, onValue } from 'firebase/database';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LineChart, Line } from 'recharts';

const AnalyticsProPage: FC = () => {
  const { sedes } = useData();
  const [loading, setLoading] = useState<boolean>(true);
  const [demandaData, setDemandaData] = useState<any[]>([]);
  const [maestroData, setMaestroData] = useState<any[]>([]);
  const [metadata, setMetadata] = useState<any>(null);

  // --- FILTROS GLOBALES ---
  const [metric, setMetric] = useState<'valor' | 'cf' | 'cu'>('valor');
  const [selectedSede, setSelectedSede] = useState<string>('ALL');
  const [selectedRoute, setSelectedRoute] = useState<string>('ALL');
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: new Date(new Date().setMonth(new Date().getMonth() - 3)).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  // --- BUSQUEDA Y ORDENAMIENTO POR PESTAÑA ---
  const [clientSearch, setClientSearch] = useState('');
  const [clientSort, setClientSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null);
  
  const [routeSearch, setRouteSearch] = useState('');
  const [routeSort, setRouteSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null);
  
  const [productSearch, setProductSearch] = useState('');
  const [productSort, setProductSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null);

  useEffect(() => {
    setLoading(true);
    const demandaQuery = query(collection(db, 'demanda_historica'), orderBy('fecha', 'desc'));
    const unsubDemanda = onSnapshot(demandaQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        ...doc.data(),
        fechaObj: (doc.data() as any).fecha?.toDate()
      }));
      setDemandaData(data);
      if (data.length > 0) {
        setMetadata({ updatedAt: (data[0] as any).updatedAt?.toDate().toLocaleString() });
      }
    });

    const maestroRef = ref(rtdb, 'maestro/data');
    const unsubMaestro = onValue(maestroRef, (snapshot) => {
      if (snapshot.exists()) setMaestroData(snapshot.val() || []);
      setLoading(false);
    });

    return () => { unsubDemanda(); unsubMaestro(); };
  }, []);

  // --- FILTRADO JERÁRQUICO ---
  const sedeFilteredData = useMemo(() => {
    if (selectedSede === 'ALL') return demandaData;
    return demandaData.filter(d => String(d.sede).trim() === String(selectedSede).trim());
  }, [demandaData, selectedSede]);

  const availableRoutes = useMemo(() => {
    const routes = new Set<string>();
    sedeFilteredData.forEach(d => { if (d.ruta) routes.add(String(d.ruta)); });
    return Array.from(routes).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [sedeFilteredData]);

  // Si la sede cambia, resetear ruta si no existe en la nueva sede
  useEffect(() => {
    if (selectedRoute !== 'ALL' && !availableRoutes.includes(selectedRoute)) {
      setSelectedRoute('ALL');
    }
  }, [selectedSede, availableRoutes]);

  const dateFilteredData = useMemo(() => {
    const start = new Date(dateRange.start);
    const end = new Date(dateRange.end);
    end.setHours(23, 59, 59);
    return sedeFilteredData.filter(d => d.fechaObj >= start && d.fechaObj <= end);
  }, [sedeFilteredData, dateRange]);

  const filteredData = useMemo(() => {
    if (selectedRoute === 'ALL') return dateFilteredData;
    return dateFilteredData.filter(d => String(d.ruta) === selectedRoute);
  }, [dateFilteredData, selectedRoute]);

  // --- MÉTRICAS CENTRALIZADAS ---
  const rfmResults = useMemo(() => {
    if (filteredData.length === 0) return [];
    const clientMap: Record<string, any> = {};
    const now = new Date();

    filteredData.forEach(d => {
      const solId = d.solicitante;
      if (!clientMap[solId]) {
        clientMap[solId] = { clientId: solId, clientName: d.nombreCliente, lastDate: d.fechaObj, frequency: 0, monetary: 0, cf: 0, cu: 0 };
      }
      clientMap[solId].frequency += 1;
      clientMap[solId].monetary += d.totalValor || 0;
      clientMap[solId].cf += d.totalCF || 0;
      clientMap[solId].cu += d.totalCU || 0;
      if (d.fechaObj > clientMap[solId].lastDate) clientMap[solId].lastDate = d.fechaObj;
    });

    const results = Object.values(clientMap).map((c: any) => ({
      ...c,
      recency: Math.floor((now.getTime() - c.lastDate.getTime()) / (1000 * 60 * 60 * 24)),
      currentMetricValue: metric === 'valor' ? c.monetary : metric === 'cf' ? c.cf : c.cu,
      rScore: 0, fScore: 0, mScore: 0, totalScore: 0, segment: 'Hibernando'
    }));

    const count = results.length;
    if (count === 0) return [];
    
    results.sort((a, b) => a.recency - b.recency);
    results.forEach((r, i) => { r.rScore = 5 - Math.floor(i / Math.ceil(count / 5)); if (r.rScore < 1) r.rScore = 1; });
    results.sort((a, b) => a.frequency - b.frequency);
    results.forEach((r, i) => { r.fScore = Math.floor(i / Math.ceil(count / 5)) + 1; if (r.fScore > 5) r.fScore = 5; });
    results.sort((a, b) => a.currentMetricValue - b.currentMetricValue);
    results.forEach((r, i) => { r.mScore = Math.floor(i / Math.ceil(count / 5)) + 1; if (r.mScore > 5) r.mScore = 5; });

    results.forEach(r => {
      if (r.frequency <= 0 || r.currentMetricValue <= 0) {
        r.segment = 'Hibernando';
      } else if (r.rScore >= 4 && r.fScore >= 4) {
        r.segment = 'Campeón';
      } else if (r.rScore >= 4 && r.fScore <= 2) {
        r.segment = 'Nueva Promesa';
      } else if (r.rScore <= 2 && r.fScore >= 4) {
        r.segment = 'En Riesgo';
      } else if (r.rScore <= 2 && r.fScore <= 2) {
        r.segment = 'Hibernando';
      } else if (r.fScore >= 3) {
        r.segment = 'Fiel';
      } else {
        r.segment = 'Potencial';
      }
    });

    return results.sort((a, b) => b.currentMetricValue - a.currentMetricValue);
  }, [filteredData, metric]);

  const dailyStats = useMemo(() => {
    if (filteredData.length === 0) return [];
    const daysMap: Record<string, any> = { 'LUNES': { total: 0, count: 0 }, 'MARTES': { total: 0, count: 0 }, 'MIÉRCOLES': { total: 0, count: 0 }, 'JUEVES': { total: 0, count: 0 }, 'VIERNES': { total: 0, count: 0 }, 'SÁBADO': { total: 0, count: 0 }, 'DOMINGO': { total: 0, count: 0 } };
    const dayNames = ['DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'];
    filteredData.forEach(d => { if (d.fechaObj) { 
      const dayName = dayNames[d.fechaObj.getDay()]; 
      const val = metric === 'valor' ? d.totalValor : metric === 'cf' ? d.totalCF : d.totalCU;
      daysMap[dayName].total += val || 0; 
      daysMap[dayName].count += 1; 
    } });
    return Object.entries(daysMap).map(([name, data]: any) => ({ name, value: data.total, count: data.count }));
  }, [filteredData, metric]);

  const productPerformance = useMemo(() => {
    if (filteredData.length === 0) return [];
    const prodMap: Record<string, any> = {};
    filteredData.forEach(d => { 
      (d.materiales || []).forEach((m: any) => { 
        if (!prodMap[m.sku]) { 
          prodMap[m.sku] = { sap: m.sku, name: m.descripcion, valor: 0, cf: 0, cu: 0, count: 0 }; 
        } 
        prodMap[m.sku].valor += m.valor || 0; 
        prodMap[m.sku].cf += m.cf || 0; 
        prodMap[m.sku].cu += m.cu || 0; 
        prodMap[m.sku].count += 1; 
      }); 
    });
    return Object.values(prodMap).map((p: any) => ({
      ...p,
      currentValue: metric === 'valor' ? p.valor : metric === 'cf' ? p.cf : p.cu
    })).sort((a: any, b: any) => b.currentValue - a.currentValue);
  }, [filteredData, metric]);

  const monthlyComparison = useMemo(() => {
    if (sedeFilteredData.length === 0) return [];
    const monthlyMap: Record<string, number> = {};
    sedeFilteredData.forEach(d => { if (d.fechaObj) { 
      const key = `${d.fechaObj.getFullYear()}-${String(d.fechaObj.getMonth() + 1).padStart(2, '0')}`; 
      const val = metric === 'valor' ? d.totalValor : metric === 'cf' ? d.totalCF : d.totalCU;
      monthlyMap[key] = (monthlyMap[key] || 0) + (val || 0); 
    } });
    const sorted = Object.entries(monthlyMap).sort((a, b) => a[0].localeCompare(b[0]));
    return sorted.map(([month, total], i) => { const prevTotal = i > 0 ? sorted[i - 1][1] : 0; const delta = prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : 0; return { month, total, prevTotal, delta }; });
  }, [sedeFilteredData, metric]);

  const routePerformance = useMemo(() => {
    if (dateFilteredData.length === 0) return [];
    const routeMap: Record<string, any> = {};
    dateFilteredData.forEach(d => {
      const rId = d.ruta || 'S/R';
      if (!routeMap[rId]) {
        routeMap[rId] = { ruta: rId, monetary: 0, cf: 0, cu: 0, count: 0, clients: new Set() };
      }
      routeMap[rId].monetary += d.totalValor || 0;
      routeMap[rId].cf += d.totalCF || 0;
      routeMap[rId].cu += d.totalCU || 0;
      routeMap[rId].count += 1;
      routeMap[rId].clients.add(d.solicitante);
    });
    return Object.values(routeMap).map((r: any) => ({
      ...r,
      clientCount: r.clients.size,
      currentValue: metric === 'valor' ? r.monetary : metric === 'cf' ? r.cf : r.cu
    })).sort((a: any, b: any) => b.currentValue - a.currentValue);
  }, [dateFilteredData, metric]);

  const statsPro = useMemo(() => {
    const lastMonth = monthlyComparison.length > 0 ? monthlyComparison[monthlyComparison.length - 1] : { delta: 0 };
    const topProd = productPerformance.length > 0 ? productPerformance[0] : { name: '---', currentValue: 0 };
    const topRoute = routePerformance.length > 0 ? routePerformance[0] : { ruta: '---', currentValue: 0 };
    const riskCount = rfmResults.filter(r => r.segment === 'En Riesgo' || r.segment === 'Hibernando').length;
    
    return {
      growth: lastMonth.delta,
      starProduct: topProd.name,
      starProductValue: topProd.currentValue,
      starRoute: topRoute.ruta,
      starRouteValue: topRoute.currentValue,
      atRisk: riskCount
    };
  }, [monthlyComparison, productPerformance, routePerformance, rfmResults]);

  // --- ANÁLISIS DE AFINIDAD (Market Basket) ---
  const affinityData = useMemo(() => {
    if (filteredData.length === 0) return [];
    const pairCounts: Record<string, { count: number; p1: string; p2: string }> = {};
    
    filteredData.forEach(visit => {
      const prods = visit.materiales || [];
      if (prods.length < 2) return;
      
      for (let i = 0; i < prods.length; i++) {
        for (let j = i + 1; j < prods.length; j++) {
          const names = [prods[i].descripcion, prods[j].descripcion].sort();
          const key = names.join(' + ');
          if (!pairCounts[key]) pairCounts[key] = { count: 0, p1: names[0], p2: names[1] };
          pairCounts[key].count += 1;
        }
      }
    });

    return Object.values(pairCounts).sort((a, b) => b.count - a.count).slice(0, 20);
  }, [filteredData]);

  const segmentCounts = useMemo(() => {
    const counts: Record<string, number> = { 'Campeón': 0, 'Fiel': 0, 'Nueva Promesa': 0, 'Potencial': 0, 'En Riesgo': 0, 'Hibernando': 0 };
    rfmResults.forEach(r => { if (counts[r.segment] !== undefined) counts[r.segment]++; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [rfmResults]);

  // --- LOGICA DE BUSQUEDA Y ORDENAMIENTO FINAL ---
  const finalRfmResults = useMemo(() => {
    let data = [...rfmResults];
    if (clientSearch) {
      const term = clientSearch.toLowerCase();
      data = data.filter(r => r.clientName.toLowerCase().includes(term) || r.clientId.toLowerCase().includes(term));
    }
    if (clientSort) {
      data.sort((a, b) => {
        const valA = a[clientSort.key as keyof typeof a];
        const valB = b[clientSort.key as keyof typeof b];
        if (typeof valA === 'string') return clientSort.dir === 'asc' ? valA.localeCompare(valB as string) : (valB as string).localeCompare(valA);
        return clientSort.dir === 'asc' ? ((valA as number) || 0) - ((valB as number) || 0) : ((valB as number) || 0) - ((valA as number) || 0);
      });
    }
    return data;
  }, [rfmResults, clientSearch, clientSort]);

  const finalRoutePerformance = useMemo(() => {
    let data = [...routePerformance];
    if (routeSearch) {
      const term = routeSearch.toLowerCase();
      data = data.filter(r => String(r.ruta).toLowerCase().includes(term));
    }
    if (routeSort) {
      data.sort((a, b) => {
        const valA = a[routeSort.key as keyof typeof a];
        const valB = b[routeSort.key as keyof typeof b];
        if (typeof valA === 'string') return routeSort.dir === 'asc' ? valA.localeCompare(valB as string) : (valB as string).localeCompare(valA);
        return routeSort.dir === 'asc' ? ((valA as number) || 0) - ((valB as number) || 0) : ((valB as number) || 0) - ((valA as number) || 0);
      });
    }
    return data;
  }, [routePerformance, routeSearch, routeSort]);

  const finalProductPerformance = useMemo(() => {
    let data = [...productPerformance];
    if (productSearch) {
      const term = productSearch.toLowerCase();
      data = data.filter(p => p.name.toLowerCase().includes(term) || p.sap.toLowerCase().includes(term));
    }
    if (productSort) {
      data.sort((a, b) => {
        const valA = a[productSort.key as keyof typeof a];
        const valB = b[productSort.key as keyof typeof b];
        if (typeof valA === 'string') return productSort.dir === 'asc' ? valA.localeCompare(valB as string) : (valB as string).localeCompare(valA);
        return productSort.dir === 'asc' ? ((valA as number) || 0) - ((valB as number) || 0) : ((valB as number) || 0) - ((valA as number) || 0);
      });
    }
    return data;
  }, [productPerformance, productSearch, productSort]);

  const handleSort = (key: string, current: any, set: any) => {
    set((prev: any) => ({
      key,
      dir: prev?.key === key && prev?.dir === 'asc' ? 'desc' : 'asc'
    }));
  };

  const SortHeader = ({ label, sortKey, currentSort, onSort, align = 'start' }: any) => {
    const isSorted = currentSort?.key === sortKey;
    return (
      <th 
        className={`text-${align} align-middle cursor-pointer user-select-none`} 
        onClick={() => onSort(sortKey)}
        style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}
      >
        <div className={`d-flex align-items-center justify-content-${align === 'center' ? 'center' : align === 'end' ? 'end' : 'start'} gap-2`}>
          {label}
          {isSorted ? (currentSort.dir === 'asc' ? <FaSortUp className="text-danger" /> : <FaSortDown className="text-danger" />) : <FaSort className="opacity-25" />}
        </div>
      </th>
    );
  };

  const metricLabel = metric === 'valor' ? 'Valor ($)' : metric === 'cf' ? 'Cajas Físicas (CF)' : 'Cajas Unitarias (CU)';
  const formatValue = (val: number) => metric === 'valor' ? `$${val.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : val.toLocaleString(undefined, { maximumFractionDigits: 1 });

  const chartTooltipStyle = {
    contentStyle: { backgroundColor: 'var(--theme-background-secondary)', border: '1px solid var(--theme-border-default)', borderRadius: '0px', color: 'var(--theme-text-primary)', fontSize: '0.75rem', fontWeight: 'bold' },
    itemStyle: { color: 'var(--theme-text-primary)' },
    labelStyle: { color: 'var(--color-red-primary)', fontWeight: 'black', marginBottom: '4px' }
  };

  const axisStyle = { stroke: 'var(--theme-text-secondary)', fontSize: 10, fontWeight: 'bold' };

  const segmentColors: Record<string, string> = { 'Campeón': 'var(--rfm-campeon)', 'Fiel': 'var(--rfm-fiel)', 'Nueva Promesa': 'var(--rfm-nueva-promesa)', 'Potencial': 'var(--rfm-potencial)', 'En Riesgo': 'var(--rfm-en-riesgo)', 'Hibernando': 'var(--rfm-hibernando)' };
  const segmentIcons: Record<string, any> = { 'Campeón': <FaCrown style={{ color: 'var(--rfm-campeon)' }} />, 'Fiel': <FaStar style={{ color: 'var(--rfm-fiel)' }} />, 'Nueva Promesa': <FaArrowUp style={{ color: 'var(--rfm-nueva-promesa)' }} />, 'Potencial': <FaUserCheck style={{ color: 'var(--rfm-potencial)' }} />, 'En Riesgo': <FaExclamationTriangle style={{ color: 'var(--rfm-en-riesgo)' }} />, 'Hibernando': <FaBed style={{ color: 'var(--rfm-hibernando)' }} /> };

  const rfmPopover = (
    <Popover id="rfm-popover" style={{ backgroundColor: 'var(--theme-background-secondary)', border: '1px solid var(--theme-border-default)', color: 'var(--theme-text-primary)', maxWidth: '400px' }}>
      <Popover.Header as="h3" style={{ backgroundColor: 'var(--theme-icon-bg)', color: 'var(--color-red-primary)', borderBottom: '1px solid var(--theme-border-default)', fontWeight: 900, fontSize: '0.8rem' }}>GLOSARIO DE SEGMENTACIÓN RFM</Popover.Header>
      <Popover.Body style={{ fontSize: '0.75rem', color: 'var(--theme-text-primary)' }}>
        <div className="mb-2"><strong style={{ color: 'var(--rfm-campeon)' }}>CAMPEÓN:</strong> Clientes que compran recientemente, con alta frecuencia y gran volumen.</div>
        <div className="mb-2"><strong style={{ color: 'var(--rfm-fiel)' }}>FIEL:</strong> Clientes constantes que compran con buena frecuencia.</div>
        <div className="mb-2"><strong style={{ color: 'var(--rfm-nueva-promesa)' }}>NUEVA PROMESA:</strong> Clientes que empezaron a comprar recientemente.</div>
        <div className="mb-2"><strong style={{ color: 'var(--rfm-potencial)' }}>POTENCIAL:</strong> Clientes con actividad media.</div>
        <div className="mb-2"><strong style={{ color: 'var(--rfm-en-riesgo)' }}>EN RIESGO:</strong> Clientes que solían ser muy frecuentes pero llevan tiempo sin pedir.</div>
        <div><strong style={{ color: 'var(--rfm-hibernando)' }}>HIBERNANDO:</strong> Clientes con muy poca actividad histórica.</div>
      </Popover.Body>
    </Popover>
  );

  if (loading) return <GlobalSpinner variant={SPINNER_VARIANTS.IN_PAGE} />;

  return (
    <div className="admin-layout-container flex-column gap-2 gap-md-3">
      <div className="admin-section-table flex-shrink-0" style={{ flex: 'none', height: 'auto', padding: '1rem 1.25rem', borderLeft: '4px solid var(--color-red-primary)' }}>
        <Row className="align-items-center g-3">
          <Col xs={12} lg={4}>
            <div className="d-flex flex-column">
              <h3 className="fw-black mb-0 d-flex align-items-center gap-2"><FaChartLine className="text-danger" style={{ fontSize: '1.2rem' }} /> ANALÍTICA PRO</h3>
              <span className="text-secondary fw-bold text-uppercase" style={{ fontSize: '0.65rem', letterSpacing: '1px' }}>BI de Volumen y Rentabilidad Logística</span>
            </div>
          </Col>
          <Col xs={12} lg={8}>
            <div className="d-flex flex-wrap align-items-center justify-content-lg-end gap-3">
              <div className="d-flex align-items-center gap-2 bg-dark p-1 border border-secondary border-opacity-25" style={{ borderRadius: '4px' }}>
                <FaMapMarkerAlt className="text-danger ms-2" size={12} />
                <Form.Select value={selectedSede} onChange={(e) => setSelectedSede(e.target.value)} className="bg-transparent text-white border-0 small fw-bold px-2 py-0" style={{ outline: 'none', fontSize: '0.75rem', width: 'auto', minWidth: '120px', cursor: 'pointer' }}>
                  <option value="ALL" className="bg-dark">GLOBAL (TODAS)</option>
                  {sedes.map(s => <option key={s.id} value={s.codigo} className="bg-dark">{s.nombre.toUpperCase()}</option>)}
                </Form.Select>
              </div>

              <div className="d-flex align-items-center gap-2 bg-dark p-1 border border-secondary border-opacity-25" style={{ borderRadius: '4px' }}>
                <FaRoute className="text-danger ms-2" size={12} />
                <Form.Select 
                  value={selectedRoute} 
                  onChange={(e) => setSelectedRoute(e.target.value)} 
                  className="bg-transparent text-white border-0 small fw-bold px-2 py-0" 
                  style={{ outline: 'none', fontSize: '0.75rem', width: 'auto', minWidth: '100px', cursor: 'pointer' }}
                >
                  <option value="ALL" className="bg-dark">TODAS LAS RUTAS</option>
                  {availableRoutes.map(r => (
                    <option key={r} value={r} className="bg-dark">RUTA {r}</option>
                  ))}
                </Form.Select>
              </div>
              <div className="d-flex bg-dark p-1 border border-secondary border-opacity-25" style={{ borderRadius: '4px' }}>
                {([['valor', '$'], ['cf', 'CF'], ['cu', 'CU']] as const).map(([m, label]) => (
                  <button key={m} onClick={() => setMetric(m)} className={`btn btn-sm px-3 fw-black ${metric === m ? 'btn-danger' : 'btn-link text-secondary text-decoration-none'}`} style={{ fontSize: '0.7rem' }}>{label}</button>
                ))}
              </div>
              <div className="d-flex align-items-center gap-2 bg-dark p-1 border border-secondary border-opacity-25" style={{ borderRadius: '4px' }}>
                <input type="date" value={dateRange.start} onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))} className="bg-transparent text-white border-0 small fw-bold px-2" style={{ outline: 'none', fontSize: '0.75rem' }} />
                <span className="text-secondary fw-black">AL</span>
                <input type="date" value={dateRange.end} onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))} className="bg-transparent text-white border-0 small fw-bold px-2" style={{ outline: 'none', fontSize: '0.75rem' }} />
              </div>
            </div>
          </Col>
        </Row>
      </div>

      <div className="admin-section-table flex-grow-1 p-0 overflow-hidden">
        <Tab.Container id="analytics-tabs" defaultActiveKey="dashboard">
          <div className="d-flex flex-column h-100">
            <Nav variant="tabs" className="custom-tabs-industrial px-2 pt-2 flex-shrink-0 border-bottom-0">
              <Nav.Item><Nav.Link eventKey="dashboard" className="d-flex align-items-center gap-2"><FaHistory className="d-none d-md-inline" /> RESUMEN</Nav.Link></Nav.Item>
              <Nav.Item><Nav.Link eventKey="clientes" className="d-flex align-items-center gap-2"><FaUsers className="d-none d-md-inline" /> CLIENTES (RFM)</Nav.Link></Nav.Item>
              <Nav.Item><Nav.Link eventKey="rutas" className="d-flex align-items-center gap-2"><FaRoute className="d-none d-md-inline" /> RUTAS Y DÍAS</Nav.Link></Nav.Item>
              <Nav.Item><Nav.Link eventKey="productos" className="d-flex align-items-center gap-2"><FaBox className="d-none d-md-inline" /> PRODUCTOS</Nav.Link></Nav.Item>
              <Nav.Item><Nav.Link eventKey="afinidad" className="d-flex align-items-center gap-2"><FaExchangeAlt className="d-none d-md-inline" /> AFINIDAD</Nav.Link></Nav.Item>
              <Nav.Item><Nav.Link eventKey="comparativa" className="d-flex align-items-center gap-2"><FaArrowUp className="d-none d-md-inline" /> COMPARATIVA</Nav.Link></Nav.Item>
            </Nav>

            <Tab.Content className="flex-grow-1 overflow-hidden position-relative">
              <Tab.Pane eventKey="dashboard" className="h-100 overflow-auto custom-scrollbar p-3">
                <div className="d-flex flex-column gap-3">
                  <Row className="g-3">
                    <Col xs={12} md={4}><div className="p-3 bg-dark bg-opacity-50 border border-secondary border-opacity-10 h-100"><div className="d-flex justify-content-between align-items-start"><div><div className="text-secondary fw-bold text-uppercase mb-1" style={{ fontSize: '0.55rem' }}>Analizando {metricLabel}</div><div className="fw-black fs-3">{formatValue(rfmResults.reduce((acc, r) => acc + (metric === 'valor' ? r.monetary : metric === 'cf' ? r.cf : r.cu), 0))}</div></div><FaBox className="text-warning opacity-25 fs-4" /></div></div></Col>
                    <Col xs={12} md={4}><div className="p-3 bg-dark bg-opacity-50 border border-info border-opacity-25 h-100"><div className="d-flex justify-content-between align-items-start"><div><div className="text-info fw-bold text-uppercase mb-1" style={{ fontSize: '0.55rem' }}>Producto Estrella</div><div className="fw-black fs-5 text-truncate" style={{ maxWidth: '200px' }}>{statsPro.starProduct}</div><div className="text-info fw-bold" style={{ fontSize: '0.65rem' }}>{formatValue(statsPro.starProductValue)} ACUMULADO</div></div><FaCrown className="text-info opacity-25 fs-4" /></div></div></Col>
                    <Col xs={12} md={4}><div className="p-3 bg-dark bg-opacity-50 border border-danger border-opacity-25 h-100"><div className="d-flex justify-content-between align-items-start"><div><div className="text-danger fw-bold text-uppercase mb-1" style={{ fontSize: '0.55rem' }}>Ruta Líder (Preventista)</div><div className="fw-black fs-3 text-danger">{statsPro.starRoute}</div><div className="text-secondary fw-bold" style={{ fontSize: '0.6rem' }}>{formatValue(statsPro.starRouteValue)} EN {metric.toUpperCase()}</div></div><FaRoute className="text-danger opacity-25 fs-4" /></div></div></Col>
                  </Row>
                  
                  <div className="p-3 bg-dark bg-opacity-25 border border-secondary border-opacity-10" style={{ height: '350px' }}>
                    <h6 className="fw-black text-uppercase small mb-4">Tendencia Temporal de Demanda ({metricLabel})</h6>
                    <ResponsiveContainer width="100%" height="90%">
                      <BarChart data={dailyStats}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="name" {...axisStyle} />
                        <YAxis {...axisStyle} />
                        <Tooltip {...chartTooltipStyle} formatter={(value: any) => [formatValue(value), metricLabel]} />
                        <Bar dataKey="value" fill="var(--color-red-primary)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <Row className="g-3">
                    <Col xs={12} lg={7}>
                      <div className="p-3 bg-dark bg-opacity-25 border border-secondary border-opacity-10" style={{ height: '450px', display: 'flex', flexDirection: 'column' }}>
                        <h6 className="fw-black text-uppercase small mb-4 flex-shrink-0">Ranking Completo de Rutas (Preventistas)</h6>
                        <div className="custom-scrollbar flex-grow-1" style={{ overflowY: 'auto', overflowX: 'hidden' }}>
                          <div style={{ height: `${Math.max(routePerformance.length * 40, 400)}px`, width: '100%' }}>
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={routePerformance} layout="vertical" margin={{ left: 0, right: 30, top: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.05)" />
                                <XAxis type="number" hide />
                                <YAxis dataKey="ruta" type="category" {...axisStyle} width={80} tickFormatter={(val) => `${val}`} />
                                <Tooltip {...chartTooltipStyle} formatter={(val: any) => [formatValue(val), metricLabel]} />
                                <Bar dataKey="currentValue" fill="var(--color-red-primary)" radius={[0, 4, 4, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      </div>
                    </Col>
                    <Col xs={12} lg={5}>
                      <div className="p-3 bg-dark bg-opacity-25 border border-secondary border-opacity-10" style={{ height: '450px', display: 'flex', flexDirection: 'column' }}>
                        <h6 className="fw-black text-uppercase small mb-3 flex-shrink-0">Alertas RFM: Cartera en Riesgo</h6>
                        <div className="custom-scrollbar flex-grow-1" style={{ overflowY: 'auto' }}>
                          <div className="p-3 bg-danger bg-opacity-10 border border-danger border-opacity-20 text-center mb-3 flex-shrink-0">
                            <div className="fw-black fs-2 text-danger">{statsPro.atRisk}</div>
                            <div className="small fw-black text-danger text-uppercase">Clientes a punto de perderse</div>
                          </div>
                          <div className="d-flex flex-column gap-2">
                            {rfmResults.filter(r => r.segment === 'En Riesgo').map((r, i) => (
                              <div key={i} className="p-2 border border-secondary border-opacity-10 bg-dark bg-opacity-50 d-flex justify-content-between align-items-center flex-shrink-0">
                                <div className="min-width-0"><div className="fw-black text-white text-truncate" style={{ fontSize: '0.7rem' }}>{r.clientName}</div><div className="text-secondary fw-bold" style={{ fontSize: '0.6rem' }}>{r.recency} DÍAS SIN COMPRAR</div></div>
                                <Badge bg="danger" style={{ fontSize: '0.55rem' }}>{formatValue(r.currentMetricValue)}</Badge>
                              </div>
                            ))}
                            {rfmResults.filter(r => r.segment === 'En Riesgo').length === 0 && <div className="text-center py-4 text-secondary small italic">No hay alertas críticas</div>}
                          </div>
                        </div>
                      </div>
                    </Col>
                  </Row>
                </div>
              </Tab.Pane>

              <Tab.Pane eventKey="clientes" className="h-100 overflow-auto custom-scrollbar p-3">
                <div className="d-flex justify-content-between align-items-center mb-4">
                  <div className="d-flex align-items-center gap-2"><h5 className="fw-black mb-0 text-uppercase">Clasificación RFM y Segmentación</h5><OverlayTrigger trigger="click" placement="right" overlay={rfmPopover} rootClose><button className="btn btn-link p-0 text-info" style={{ lineHeight: 1 }}><FaInfoCircle size={18} /></button></OverlayTrigger></div>
                  <Badge bg="dark" className="border border-secondary px-3 py-2 fw-black">TOTAL: {rfmResults.length} CLIENTES</Badge>
                </div>
                <Row className="g-3 mb-4">
                  <Col xs={12} lg={8}><div className="admin-border-industrial p-3 d-flex flex-column" style={{ backgroundColor: 'var(--theme-background-secondary)', height: '400px' }}><h6 className="fw-black text-uppercase small mb-4 flex-shrink-0">Distribución del Valor por Segmento</h6><div className="flex-grow-1"><ResponsiveContainer width="100%" height="100%"><BarChart data={segmentCounts} layout="vertical"><CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.05)" /><XAxis type="number" hide /><YAxis dataKey="name" type="category" {...axisStyle} width={100} /><Tooltip {...chartTooltipStyle} /><Bar dataKey="value" radius={[0, 4, 4, 0]}>{segmentCounts.map((entry, index) => <Cell key={index} fill={segmentColors[entry.name]} />)}</Bar></BarChart></ResponsiveContainer></div></div></Col>
                  <Col xs={12} lg={4}><div className="admin-border-industrial p-3 d-flex flex-column" style={{ backgroundColor: 'var(--theme-background-secondary)', height: '400px' }}><h6 className="fw-black text-uppercase small mb-3 flex-shrink-0">Resumen de Cartera</h6><div className="flex-grow-1 d-flex flex-column gap-2 overflow-auto custom-scrollbar pe-1">{segmentCounts.map(s => (<div key={s.name} className="d-flex justify-content-between align-items-center p-2 bg-dark bg-opacity-25 border border-secondary border-opacity-10 flex-shrink-0"><div className="d-flex align-items-center gap-2">{segmentIcons[s.name]}<span className="fw-black text-uppercase" style={{ fontSize: '0.65rem' }}>{s.name}</span></div><span className="fw-black fs-5" style={{ color: segmentColors[s.name] }}>{s.value}</span></div>))}</div></div></Col>
                </Row>
                <div className="admin-border-industrial" style={{ backgroundColor: 'var(--theme-background-secondary)' }}>
                  <div className="p-3 border-bottom border-secondary border-opacity-10"><SearchInput searchTerm={clientSearch} onSearchChange={setClientSearch} placeholder="BUSCAR CLIENTE POR NOMBRE O ID..." className="mb-0" /></div>
                  <Table responsive hover variant="dark" className="mb-0 industrial-table-v2">
                    <thead className="sticky-top bg-dark">
                      <tr>
                        <SortHeader label="CLIENTE" sortKey="clientName" currentSort={clientSort} onSort={(k: string) => handleSort(k, clientSort, setClientSort)} />
                        <SortHeader label="SEGMENTO" sortKey="segment" currentSort={clientSort} onSort={(k: string) => handleSort(k, clientSort, setClientSort)} align="center" />
                        <SortHeader label="RECENCIA" sortKey="recency" currentSort={clientSort} onSort={(k: string) => handleSort(k, clientSort, setClientSort)} align="center" />
                        <SortHeader label="V. MONETARIO ($)" sortKey="monetary" currentSort={clientSort} onSort={(k: string) => handleSort(k, clientSort, setClientSort)} align="end" />
                        <SortHeader label="VOLUMEN (CF)" sortKey="cf" currentSort={clientSort} onSort={(k: string) => handleSort(k, clientSort, setClientSort)} align="end" />
                        <SortHeader label="VOLUMEN (CU)" sortKey="cu" currentSort={clientSort} onSort={(k: string) => handleSort(k, clientSort, setClientSort)} align="end" />
                      </tr>
                    </thead>
                    <tbody>{finalRfmResults.map((r) => (<tr key={r.clientId}><td className="ps-4"><div className="d-flex flex-column"><span className="fw-black text-uppercase" style={{ fontSize: '0.85rem' }}>{r.clientName}</span><span className="text-secondary" style={{ fontSize: '0.65rem' }}>ID: {r.clientId}</span></div></td><td className="text-center align-middle"><div className="d-flex align-items-center justify-content-center gap-2">{segmentIcons[r.segment]}<span className="fw-black text-uppercase" style={{ fontSize: '0.7rem', color: segmentColors[r.segment] }}>{r.segment}</span></div></td><td className="text-center align-middle fw-black">{r.recency} <small className="text-secondary">días</small></td><td className="text-end align-middle fw-black text-info">${r.monetary.toLocaleString()}</td><td className="text-end align-middle fw-black text-success">{r.cf.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td><td className="text-end align-middle fw-black text-warning pe-4">{r.cu.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td></tr>))}</tbody>
                  </Table>
                </div>
              </Tab.Pane>
              
              <Tab.Pane eventKey="rutas" className="h-100 overflow-auto custom-scrollbar p-3">
                <div className="d-flex justify-content-between align-items-end mb-4"><div><h5 className="fw-black mb-1 text-uppercase">Desempeño de Rutas y Preventistas</h5><p className="text-secondary small fw-bold mb-0">Análisis comparativo de volumen y efectividad.</p></div></div>
                <div className="admin-border-industrial mb-4" style={{ backgroundColor: 'var(--theme-background-secondary)' }}>
                  <div className="p-3 border-bottom border-secondary border-opacity-10"><SearchInput searchTerm={routeSearch} onSearchChange={setRouteSearch} placeholder="BUSCAR RUTA..." className="mb-0" /></div>
                  <Table responsive hover variant="dark" className="mb-0 industrial-table-v2">
                    <thead>
                      <tr>
                        <SortHeader label="RUTA / PREVENTISTA" sortKey="ruta" currentSort={routeSort} onSort={(k: string) => handleSort(k, routeSort, setRouteSort)} />
                        <SortHeader label="CLIENTES ACTIVOS" sortKey="clientCount" currentSort={routeSort} onSort={(k: string) => handleSort(k, routeSort, setRouteSort)} align="center" />
                        <SortHeader label="PEDIDOS TOT." sortKey="count" currentSort={routeSort} onSort={(k: string) => handleSort(k, routeSort, setRouteSort)} align="center" />
                        <SortHeader label="VALOR TOTAL" sortKey="monetary" currentSort={routeSort} onSort={(k: string) => handleSort(k, routeSort, setRouteSort)} align="end" />
                        <SortHeader label="VOL. CF" sortKey="cf" currentSort={routeSort} onSort={(k: string) => handleSort(k, routeSort, setRouteSort)} align="end" />
                        <SortHeader label="VOL. CU" sortKey="cu" currentSort={routeSort} onSort={(k: string) => handleSort(k, routeSort, setRouteSort)} align="end" />
                      </tr>
                    </thead>
                    <tbody>{finalRoutePerformance.map((r) => (<tr key={r.ruta}><td className="ps-4"><div className="d-flex align-items-center gap-3"><div className="loc-avatar" style={{ backgroundColor: 'var(--color-red-primary)' }}>{r.ruta}</div><span className="fw-black fs-5">{r.ruta}</span></div></td><td className="text-center align-middle fw-black text-info fs-5">{r.clientCount}</td><td className="text-center align-middle fw-black">{r.count}</td><td className="text-end align-middle fw-black">${r.monetary.toLocaleString()}</td><td className="text-end align-middle fw-black text-success">{r.cf.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td><td className="text-end align-middle fw-black text-warning pe-4">{r.cu.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td></tr>))}</tbody>
                  </Table>
                </div>
              </Tab.Pane>

              <Tab.Pane eventKey="productos" className="h-100 overflow-auto custom-scrollbar p-3">
                <div className="admin-border-industrial" style={{ backgroundColor: 'var(--theme-background-secondary)' }}>
                  <div className="p-3 border-bottom border-secondary border-opacity-10"><SearchInput searchTerm={productSearch} onSearchChange={setProductSearch} placeholder="BUSCAR PRODUCTO POR NOMBRE O SAP..." className="mb-0" /></div>
                  <Table responsive hover variant="dark" className="mb-0 industrial-table-v2">
                    <thead className="sticky-top bg-dark">
                      <tr>
                        <SortHeader label="PRODUCTO" sortKey="name" currentSort={productSort} onSort={(k: string) => handleSort(k, productSort, setProductSort)} />
                        <SortHeader label="TOTAL VALOR ($)" sortKey="valor" currentSort={productSort} onSort={(k: string) => handleSort(k, productSort, setProductSort)} align="end" />
                        <SortHeader label="TOTAL CF" sortKey="cf" currentSort={productSort} onSort={(k: string) => handleSort(k, productSort, setProductSort)} align="end" />
                        <SortHeader label="TOTAL CU" sortKey="cu" currentSort={productSort} onSort={(k: string) => handleSort(k, productSort, setProductSort)} align="end" />
                      </tr>
                    </thead>
                    <tbody>{finalProductPerformance.map((p) => (<tr key={p.sap}><td className="ps-4"><div className="d-flex flex-column"><span className="fw-black text-uppercase" style={{ fontSize: '0.75rem' }}>{p.name}</span><span className="text-secondary" style={{ fontSize: '0.6rem' }}>SAP: {p.sap}</span></div></td><td className="text-end align-middle fw-black">${p.valor.toLocaleString()}</td><td className="text-end align-middle fw-black text-success">{p.cf.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td><td className="text-end align-middle fw-black text-warning pe-4">{p.cu.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td></tr>))}</tbody>
                  </Table>
                </div>
              </Tab.Pane>

              <Tab.Pane eventKey="afinidad" className="h-100 overflow-auto custom-scrollbar p-3">
                <div className="d-flex justify-content-between align-items-end mb-4"><div><h5 className="fw-black mb-1 text-uppercase">Análisis de Afinidad (Market Basket)</h5><p className="text-secondary small fw-bold mb-0">Identifica qué productos se venden juntos.</p></div><Badge bg="danger" className="px-3 py-2 fw-black">TOP 20 COMBOS DETECTADOS</Badge></div>
                <div className="admin-border-industrial" style={{ backgroundColor: 'var(--theme-background-secondary)' }}><Table responsive hover variant="dark" className="mb-0 industrial-table-v2"><thead><tr><th className="ps-4">PRODUCTO A</th><th className="text-center">+</th><th>PRODUCTO B</th><th className="text-end pe-4">FRECUENCIA (VISITAS)</th></tr></thead><tbody>{affinityData.map((combo, i) => (<tr key={i}><td className="ps-4 fw-black text-uppercase" style={{ fontSize: '0.75rem' }}>{combo.p1}</td><td className="text-center text-danger fw-black">+</td><td className="fw-black text-uppercase" style={{ fontSize: '0.75rem' }}>{combo.p2}</td><td className="text-end pe-4 fw-black text-info fs-5">{combo.count.toLocaleString()}</td></tr>))}</tbody></Table></div>
              </Tab.Pane>

              <Tab.Pane eventKey="comparativa" className="h-100 overflow-auto custom-scrollbar p-3">
                <h5 className="fw-black mb-3 text-uppercase">Análisis Comparativo Mensual</h5>
                <Row className="g-3">
                  <Col xs={12} lg={7}><div className="p-3 bg-dark bg-opacity-25 border border-secondary border-opacity-10" style={{ height: '400px' }}><ResponsiveContainer width="100%" height="100%"><BarChart data={monthlyComparison}><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" /><XAxis dataKey="month" {...axisStyle} /><YAxis {...axisStyle} /><Tooltip {...chartTooltipStyle} /><Bar dataKey="total" fill="var(--color-red-primary)" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div></Col>
                  <Col xs={12} lg={5}><div className="admin-border-industrial" style={{ backgroundColor: 'var(--theme-background-secondary)' }}><Table responsive hover variant="dark" className="mb-0 industrial-table-v2"><thead><tr><th className="ps-4">MES</th><th className="text-end">VENTA TOTAL</th><th className="text-end pe-4">DELTA (%)</th></tr></thead><tbody>{monthlyComparison.map((m) => (<tr key={m.month}><td className="ps-4 fw-black text-uppercase">{m.month}</td><td className="text-end fw-black">{formatValue(m.total)}</td><td className="text-end pe-4 align-middle"><Badge bg={m.delta >= 0 ? 'success' : 'danger'} className="fw-black">{m.delta >= 0 ? '+' : ''}{m.delta.toFixed(1)}%</Badge></td></tr>))}</tbody></Table></div></Col>
                </Row>
              </Tab.Pane>
            </Tab.Content>
          </div>
        </Tab.Container>
      </div>

      <style>{`
        .fw-black { font-weight: 900 !important; }
        .custom-tabs-industrial .nav-link { color: var(--theme-text-secondary); border: none; border-bottom: 3px solid transparent; font-weight: 800; text-transform: uppercase; font-size: 0.75rem; padding: 10px 20px; border-radius: 0; transition: all 0.2s ease; letter-spacing: 0.5px; }
        .custom-tabs-industrial .nav-link:hover { color: var(--theme-text-primary); background: rgba(244, 0, 9, 0.05); }
        .custom-tabs-industrial .nav-link.active { color: var(--color-red-primary) !important; background: transparent !important; border-bottom-color: var(--color-red-primary) !important; }
        .industrial-table-v2 { background-color: transparent !important; }
        .industrial-table-v2 thead th { background-color: var(--theme-background-tertiary) !important; color: var(--theme-text-secondary); font-weight: 900; font-size: 0.65rem; text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px solid var(--theme-border-default); padding: 15px 10px; }
        .industrial-table-v2 tbody tr { border-bottom: 1px solid rgba(255,255,255,0.05); transition: background 0.2s ease; }
        .industrial-table-v2 tbody tr:hover { background-color: rgba(244, 0, 9, 0.05) !important; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0,0,0,0.1); }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: var(--color-red-primary); }
      `}</style>
    </div>
  );
};

export default AnalyticsProPage;
