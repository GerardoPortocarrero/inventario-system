import type { FC } from 'react';
import { useState, useEffect, useMemo } from 'react';
import { Row, Col, Tab, Nav, Badge, Table, OverlayTrigger, Popover } from 'react-bootstrap';
import { FaChartLine, FaUsers, FaRoute, FaBox, FaExchangeAlt, FaHistory, FaCrown, FaExclamationTriangle, FaStar, FaBed, FaUserCheck, FaArrowUp, FaInfoCircle } from 'react-icons/fa';
import { SPINNER_VARIANTS } from '../constants';
import GlobalSpinner from '../components/GlobalSpinner';
import { db, rtdb } from '../api/firebase';
import { ref, onValue } from 'firebase/database';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, LineChart, Line } from 'recharts';

const AnalyticsProPage: FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [demandaData, setDemandaData] = useState<any[]>([]);
  const [maestroData, setMaestroData] = useState<any[]>([]);
  const [metadata, setMetadata] = useState<any>(null);

  // --- FILTROS GLOBALES ---
  const [metric, setMetric] = useState<'valor' | 'cf' | 'cu'>('valor');
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: new Date(new Date().setMonth(new Date().getMonth() - 3)).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

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

  // --- FILTRADO POR FECHA ---
  const filteredData = useMemo(() => {
    const start = new Date(dateRange.start);
    const end = new Date(dateRange.end);
    end.setHours(23, 59, 59);
    return demandaData.filter(d => d.fechaObj >= start && d.fechaObj <= end);
  }, [demandaData, dateRange]);

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
      if (r.rScore >= 4 && r.fScore >= 4) r.segment = 'Campeón';
      else if (r.rScore >= 4 && r.fScore <= 2) r.segment = 'Nueva Promesa';
      else if (r.rScore <= 2 && r.fScore >= 4) r.segment = 'En Riesgo';
      else if (r.rScore <= 2 && r.fScore <= 2) r.segment = 'Hibernando';
      else if (r.fScore >= 3) r.segment = 'Fiel';
      else r.segment = 'Potencial';
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
    if (demandaData.length === 0) return [];
    const monthlyMap: Record<string, number> = {};
    demandaData.forEach(d => { if (d.fechaObj) { 
      const key = `${d.fechaObj.getFullYear()}-${String(d.fechaObj.getMonth() + 1).padStart(2, '0')}`; 
      const val = metric === 'valor' ? d.totalValor : metric === 'cf' ? d.totalCF : d.totalCU;
      monthlyMap[key] = (monthlyMap[key] || 0) + (val || 0); 
    } });
    const sorted = Object.entries(monthlyMap).sort((a, b) => a[0].localeCompare(b[0]));
    return sorted.map(([month, total], i) => { const prevTotal = i > 0 ? sorted[i - 1][1] : 0; const delta = prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : 0; return { month, total, prevTotal, delta }; });
  }, [demandaData, metric]);

  const statsPro = useMemo(() => {
    const lastMonth = monthlyComparison.length > 0 ? monthlyComparison[monthlyComparison.length - 1] : { delta: 0 };
    const topProd = productPerformance.length > 0 ? productPerformance[0] : { name: '---', currentValue: 0 };
    const riskCount = rfmResults.filter(r => r.segment === 'En Riesgo' || r.segment === 'Hibernando').length;
    
    return {
      growth: lastMonth.delta,
      starProduct: topProd.name,
      starProductValue: topProd.currentValue,
      atRisk: riskCount
    };
  }, [monthlyComparison, productPerformance, rfmResults]);

  // --- ANÁLISIS DE AFINIDAD (Market Basket) ---
  const affinityData = useMemo(() => {
    if (filteredData.length === 0) return [];
    const pairCounts: Record<string, { count: number; p1: string; p2: string }> = {};
    
    filteredData.forEach(visit => {
      const prods = visit.materiales || [];
      if (prods.length < 2) return;
      
      // Crear combinaciones únicas de pares de productos en la misma visita
      for (let i = 0; i < prods.length; i++) {
        for (let j = i + 1; j < prods.length; j++) {
          const names = [prods[i].descripcion, prods[j].descripcion].sort();
          const key = names.join(' + ');
          if (!pairCounts[key]) pairCounts[key] = { count: 0, p1: names[0], p2: names[1] };
          pairCounts[key].count += 1;
        }
      }
    });

    return Object.values(pairCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 20); // Top 20 combos
  }, [filteredData]);

  const segmentCounts = useMemo(() => {
    const counts: Record<string, number> = { 'Campeón': 0, 'Fiel': 0, 'Nueva Promesa': 0, 'Potencial': 0, 'En Riesgo': 0, 'Hibernando': 0 };
    rfmResults.forEach(r => { if (counts[r.segment] !== undefined) counts[r.segment]++; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [rfmResults]);

  const metricLabel = metric === 'valor' ? 'Valor ($)' : metric === 'cf' ? 'Cajas Físicas (CF)' : 'Cajas Unitarias (CU)';
  const formatValue = (val: number) => metric === 'valor' ? `$${val.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : val.toLocaleString(undefined, { maximumFractionDigits: 1 });

  // Configuración común para Tooltips de Recharts (Contraste Dinámico)
  const chartTooltipStyle = {
    contentStyle: { 
      backgroundColor: 'var(--theme-background-secondary)', 
      border: '1px solid var(--theme-border-default)',
      borderRadius: '0px',
      color: 'var(--theme-text-primary)',
      fontSize: '0.75rem',
      fontWeight: 'bold'
    },
    itemStyle: { color: 'var(--theme-text-primary)' },
    labelStyle: { color: 'var(--color-red-primary)', fontWeight: 'black', marginBottom: '4px' }
  };

  const axisStyle = {
    stroke: 'var(--theme-text-secondary)',
    fontSize: 10,
    fontWeight: 'bold'
  };

  const segmentColors: Record<string, string> = { 
    'Campeón': 'var(--rfm-campeon)', 
    'Fiel': 'var(--rfm-fiel)', 
    'Nueva Promesa': 'var(--rfm-nueva-promesa)', 
    'Potencial': 'var(--rfm-potencial)', 
    'En Riesgo': 'var(--rfm-en-riesgo)', 
    'Hibernando': 'var(--rfm-hibernando)' 
  };

  const segmentIcons: Record<string, any> = { 
    'Campeón': <FaCrown style={{ color: 'var(--rfm-campeon)' }} />, 
    'Fiel': <FaStar style={{ color: 'var(--rfm-fiel)' }} />, 
    'Nueva Promesa': <FaArrowUp style={{ color: 'var(--rfm-nueva-promesa)' }} />, 
    'Potencial': <FaUserCheck style={{ color: 'var(--rfm-potencial)' }} />, 
    'En Riesgo': <FaExclamationTriangle style={{ color: 'var(--rfm-en-riesgo)' }} />, 
    'Hibernando': <FaBed style={{ color: 'var(--rfm-hibernando)' }} /> 
  };

  const rfmPopover = (
    <Popover id="rfm-popover" style={{ backgroundColor: 'var(--theme-background-secondary)', border: '1px solid var(--theme-border-default)', color: 'var(--theme-text-primary)', maxWidth: '400px' }}>
      <Popover.Header as="h3" style={{ backgroundColor: 'var(--theme-icon-bg)', color: 'var(--color-red-primary)', borderBottom: '1px solid var(--theme-border-default)', fontWeight: 900, fontSize: '0.8rem' }}>
        GLOSARIO DE SEGMENTACIÓN RFM
      </Popover.Header>
      <Popover.Body style={{ fontSize: '0.75rem', color: 'var(--theme-text-primary)' }}>
        <div className="mb-2"><strong style={{ color: 'var(--rfm-campeon)' }}>CAMPEÓN:</strong> Clientes que compran recientemente, con alta frecuencia y gran volumen. Tu activo más valioso.</div>
        <div className="mb-2"><strong style={{ color: 'var(--rfm-fiel)' }}>FIEL:</strong> Clientes constantes que compran con buena frecuencia. Responden bien a promociones.</div>
        <div className="mb-2"><strong style={{ color: 'var(--rfm-nueva-promesa)' }}>NUEVA PROMESA:</strong> Clientes que empezaron a comprar recientemente y muestran buen volumen inicial.</div>
        <div className="mb-2"><strong style={{ color: 'var(--rfm-potencial)' }}>POTENCIAL:</strong> Clientes con actividad media; pueden convertirse en Fieles con el seguimiento correcto.</div>
        <div className="mb-2"><strong style={{ color: 'var(--rfm-en-riesgo)' }}>EN RIESGO:</strong> Clientes que solían ser muy frecuentes pero llevan tiempo sin realizar un pedido. ¡Atención!</div>
        <div><strong style={{ color: 'var(--rfm-hibernando)' }}>HIBERNANDO:</strong> Clientes con muy poca actividad histórica y larga inactividad actual.</div>
      </Popover.Body>
    </Popover>
  );

  if (loading) return <GlobalSpinner variant={SPINNER_VARIANTS.IN_PAGE} />;

  return (
    <div className="admin-layout-container flex-column gap-2 gap-md-3">
      {/* 1. Header & Global Filters */}
      <div className="admin-section-table flex-shrink-0" style={{ flex: 'none', height: 'auto', padding: '1rem 1.25rem', borderLeft: '4px solid var(--color-red-primary)' }}>
        <Row className="align-items-center g-3">
          <Col xs={12} lg={4}>
            <div className="d-flex flex-column">
              <h3 className="fw-black mb-0 d-flex align-items-center gap-2" style={{ letterSpacing: '-0.5px' }}>
                <FaChartLine className="text-danger" style={{ fontSize: '1.2rem' }} /> ANALÍTICA PRO
              </h3>
              <span className="text-secondary fw-bold text-uppercase" style={{ fontSize: '0.65rem', letterSpacing: '1px' }}>
                BI de Volumen y Rentabilidad Logística
              </span>
            </div>
          </Col>
          <Col xs={12} lg={8}>
            <div className="d-flex flex-wrap align-items-center justify-content-lg-end gap-3">
              <div className="d-flex bg-dark p-1 border border-secondary border-opacity-25" style={{ borderRadius: '4px' }}>
                {([['valor', '$'], ['cf', 'CF'], ['cu', 'CU']] as const).map(([m, label]) => (
                  <button 
                    key={m}
                    onClick={() => setMetric(m)}
                    className={`btn btn-sm px-3 fw-black ${metric === m ? 'btn-danger' : 'btn-link text-secondary text-decoration-none'}`}
                    style={{ fontSize: '0.7rem' }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="d-flex align-items-center gap-2 bg-dark p-1 border border-secondary border-opacity-25" style={{ borderRadius: '4px' }}>
                <input 
                  type="date" 
                  value={dateRange.start} 
                  onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                  className="bg-transparent text-white border-0 small fw-bold px-2"
                  style={{ outline: 'none', fontSize: '0.75rem' }}
                />
                <span className="text-secondary fw-black">AL</span>
                <input 
                  type="date" 
                  value={dateRange.end} 
                  onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                  className="bg-transparent text-white border-0 small fw-bold px-2"
                  style={{ outline: 'none', fontSize: '0.75rem' }}
                />
              </div>
            </div>
          </Col>
        </Row>
      </div>

      {/* 2. Cuerpo Principal */}
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
                    <Col xs={12} md={4}>
                      <div className="p-3 bg-dark bg-opacity-50 border border-secondary border-opacity-10 h-100">
                        <div className="d-flex justify-content-between align-items-start">
                          <div>
                            <div className="text-secondary fw-bold text-uppercase mb-1" style={{ fontSize: '0.55rem' }}>Analizando {metricLabel}</div>
                            <div className="fw-black fs-3">{formatValue(rfmResults.reduce((acc, r) => acc + (metric === 'valor' ? r.monetary : metric === 'cf' ? r.cf : r.cu), 0))}</div>
                          </div>
                          <FaBox className="text-warning opacity-25 fs-4" />
                        </div>
                      </div>
                    </Col>
                    <Col xs={12} md={4}>
                      <div className="p-3 bg-dark bg-opacity-50 border border-info border-opacity-25 h-100">
                        <div className="d-flex justify-content-between align-items-start">
                          <div>
                            <div className="text-info fw-bold text-uppercase mb-1" style={{ fontSize: '0.55rem' }}>Crecimiento Mensual ({metric.toUpperCase()})</div>
                            <div className={`fw-black fs-3 ${statsPro.growth >= 0 ? 'text-success' : 'text-danger'}`}>
                              {statsPro.growth >= 0 ? '+' : ''}{statsPro.growth.toFixed(1)}%
                            </div>
                          </div>
                          <FaArrowUp className={`${statsPro.growth >= 0 ? 'text-success' : 'text-danger'} opacity-25 fs-4 ${statsPro.growth < 0 ? 'rotate-180' : ''}`} />
                        </div>
                      </div>
                    </Col>
                    <Col xs={12} md={4}>
                      <div className="p-3 bg-dark bg-opacity-50 border border-danger border-opacity-25 h-100">
                        <div className="d-flex justify-content-between align-items-start">
                          <div>
                            <div className="text-danger fw-bold text-uppercase mb-1" style={{ fontSize: '0.55rem' }}>Cartera en Riesgo</div>
                            <div className="fw-black fs-3 text-danger">{statsPro.atRisk}</div>
                            <div className="text-secondary fw-bold" style={{ fontSize: '0.6rem' }}>CLIENTES BAJO PROMEDIO</div>
                          </div>
                          <FaExclamationTriangle className="text-danger opacity-25 fs-4" />
                        </div>
                      </div>
                    </Col>
                  </Row>
                  
                  <div className="p-3 bg-dark bg-opacity-25 border border-secondary border-opacity-10" style={{ height: '350px' }}>
                    <h6 className="fw-black text-uppercase small mb-4">Tendencia de {metricLabel}</h6>
                    <ResponsiveContainer width="100%" height="90%">
                      <BarChart data={dailyStats}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="name" {...axisStyle} />
                        <YAxis {...axisStyle} />
                        <Tooltip 
                          {...chartTooltipStyle}
                          formatter={(value: any) => [formatValue(value), metricLabel]}
                        />
                        <Bar dataKey="value" fill="var(--color-red-primary)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <Row className="g-3">
                    <Col xs={12} md={7}>
                      <div className="p-3 bg-dark bg-opacity-25 border border-secondary border-opacity-10" style={{ height: '350px' }}>
                        <h6 className="fw-black text-uppercase small mb-4">Distribución por Segmento</h6>
                        <ResponsiveContainer width="100%" height="90%">
                          <BarChart data={segmentCounts} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.05)" />
                            <XAxis type="number" hide />
                            <YAxis dataKey="name" type="category" {...axisStyle} width={100} />
                            <Tooltip {...chartTooltipStyle} />
                            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                              {segmentCounts.map((entry, index) => <Cell key={index} fill={segmentColors[entry.name]} />)}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </Col>
                    <Col xs={12} md={5}>
                      <div className="p-3 bg-dark bg-opacity-25 border border-secondary border-opacity-10 h-100 overflow-auto custom-scrollbar">
                        <h6 className="fw-black text-uppercase small mb-3">Top Combinaciones (Market Basket)</h6>
                        <div className="d-flex flex-column gap-2">
                          {affinityData.slice(0, 5).map((combo, i) => (
                            <div key={i} className="p-2 border border-secondary border-opacity-10 bg-dark bg-opacity-50">
                              <div className="d-flex justify-content-between align-items-center mb-1">
                                <Badge bg="danger" className="fw-black" style={{ fontSize: '0.6rem' }}>RANK #{i+1}</Badge>
                                <span className="fw-black text-white" style={{ fontSize: '0.7rem' }}>{combo.count} CO-OCURRENCIAS</span>
                              </div>
                              <div className="small text-secondary fw-bold text-truncate" style={{ fontSize: '0.65rem' }}>{combo.p1}</div>
                              <div className="small text-secondary fw-bold text-truncate" style={{ fontSize: '0.65rem' }}>+ {combo.p2}</div>
                            </div>
                          ))}
                          {affinityData.length === 0 && <div className="text-center py-4 text-secondary small italic">Sin datos de afinidad suficientes</div>}
                        </div>
                      </div>
                    </Col>
                  </Row>
                </div>
              </Tab.Pane>

              {/* ... Clientes, Rutas, Productos Panes ... */}

              <Tab.Pane eventKey="afinidad" className="h-100 overflow-auto custom-scrollbar p-3">
                <div className="d-flex justify-content-between align-items-end mb-4">
                  <div>
                    <h5 className="fw-black mb-1 text-uppercase">Análisis de Afinidad (Market Basket)</h5>
                    <p className="text-secondary small fw-bold mb-0">Identifica qué productos se venden juntos con mayor frecuencia.</p>
                  </div>
                  <Badge bg="danger" className="px-3 py-2 fw-black">TOP 20 COMBOS DETECTADOS</Badge>
                </div>

                <div className="admin-border-industrial" style={{ backgroundColor: 'var(--theme-background-secondary)' }}>
                  <Table responsive hover variant="dark" className="mb-0 industrial-table-v2">
                    <thead>
                      <tr>
                        <th className="ps-4">PRODUCTO A</th>
                        <th className="text-center">+</th>
                        <th>PRODUCTO B</th>
                        <th className="text-end pe-4">FRECUENCIA (VISITAS)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {affinityData.map((combo, i) => (
                        <tr key={i}>
                          <td className="ps-4 fw-black text-uppercase" style={{ fontSize: '0.75rem' }}>{combo.p1}</td>
                          <td className="text-center text-danger fw-black">+</td>
                          <td className="fw-black text-uppercase" style={{ fontSize: '0.75rem' }}>{combo.p2}</td>
                          <td className="text-end pe-4 fw-black text-info fs-5">{combo.count.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              </Tab.Pane>

              <Tab.Pane eventKey="clientes" className="h-100 overflow-auto custom-scrollbar p-3">
                <div className="d-flex justify-content-between align-items-end mb-3">
                  <div className="d-flex align-items-center gap-2">
                    <h5 className="fw-black mb-0 text-uppercase">Clasificación RFM</h5>
                    <OverlayTrigger trigger="click" placement="right" overlay={rfmPopover} rootClose>
                      <button className="btn btn-link p-0 text-info" style={{ lineHeight: 1 }}>
                        <FaInfoCircle size={18} />
                      </button>
                    </OverlayTrigger>
                  </div>
                  <Badge bg="dark" className="border border-secondary px-3 py-2 fw-black">TOTAL: {rfmResults.length} CLIENTES</Badge>
                </div>
                <div className="admin-border-industrial" style={{ backgroundColor: 'var(--theme-background-secondary)' }}>
                  <Table responsive hover variant="dark" className="mb-0 industrial-table-v2">
                    <thead className="sticky-top bg-dark">
                      <tr>
                        <th className="ps-4">CLIENTE</th>
                        <th className="text-center">SEGMENTO</th>
                        <th className="text-center">RECENCIA</th>
                        <th className="text-end">V. MONETARIO ($)</th>
                        <th className="text-end">VOLUMEN (CF)</th>
                        <th className="text-end pe-4">VOLUMEN (CU)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rfmResults.map((r) => (
                        <tr key={r.clientId}>
                          <td className="ps-4"><div className="d-flex flex-column"><span className="fw-black text-uppercase" style={{ fontSize: '0.85rem' }}>{r.clientName}</span><span className="text-secondary" style={{ fontSize: '0.65rem' }}>ID: {r.clientId}</span></div></td>
                          <td className="text-center align-middle"><div className="d-flex align-items-center justify-content-center gap-2">{segmentIcons[r.segment]}<span className="fw-black text-uppercase" style={{ fontSize: '0.7rem', color: segmentColors[r.segment] }}>{r.segment}</span></div></td>
                          <td className="text-center align-middle fw-black">{r.recency} <small className="text-secondary">días</small></td>
                          <td className="text-end align-middle fw-black text-info">${r.monetary.toLocaleString()}</td>
                          <td className="text-end align-middle fw-black text-success">{r.cf.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
                          <td className="text-end align-middle fw-black text-warning pe-4">{r.cu.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              </Tab.Pane>
              
              <Tab.Pane eventKey="rutas" className="h-100 overflow-auto custom-scrollbar p-3">
                <h5 className="fw-black mb-3 text-uppercase">Análisis por Día y Ciclo</h5>
                <Row className="g-3">
                  <Col xs={12} lg={7}>
                    <div className="p-3 bg-dark bg-opacity-25 border border-secondary border-opacity-10" style={{ height: '400px' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={dailyStats}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                          <XAxis dataKey="name" {...axisStyle} />
                          <YAxis {...axisStyle} />
                          <Tooltip {...chartTooltipStyle} />
                          <Line type="monotone" dataKey="value" stroke="var(--color-red-primary)" strokeWidth={3} dot={{ fill: 'var(--color-red-primary)', r: 6 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </Col>
                  <Col xs={12} lg={5}>
                    <div className="admin-border-industrial" style={{ backgroundColor: 'var(--theme-background-secondary)' }}>
                      <Table responsive hover variant="dark" className="mb-0 industrial-table-v2">
                        <thead><tr><th className="ps-4">DÍA</th><th className="text-center">PEDIDOS</th><th className="text-end pe-4">VALOR TOTAL</th></tr></thead>
                        <tbody>{dailyStats.map((d) => (<tr key={d.name}><td className="ps-4 fw-black text-uppercase">{d.name}</td><td className="text-center fw-black">{d.count}</td><td className="text-end pe-4 fw-black text-success">{formatValue(d.value)}</td></tr>))}</tbody>
                      </Table>
                    </div>
                  </Col>
                </Row>
              </Tab.Pane>

              <Tab.Pane eventKey="productos" className="h-100 overflow-auto custom-scrollbar p-3">
                <div className="admin-border-industrial" style={{ backgroundColor: 'var(--theme-background-secondary)' }}>
                  <Table responsive hover variant="dark" className="mb-0 industrial-table-v2">
                    <thead className="sticky-top bg-dark">
                      <tr>
                        <th className="ps-4">PRODUCTO</th>
                        <th className="text-end">TOTAL VALOR ($)</th>
                        <th className="text-end">TOTAL CF</th>
                        <th className="text-end pe-4">TOTAL CU</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productPerformance.map((p) => (
                        <tr key={p.sap}>
                          <td className="ps-4">
                            <div className="d-flex flex-column">
                              <span className="fw-black text-uppercase" style={{ fontSize: '0.75rem' }}>{p.name}</span>
                              <span className="text-secondary" style={{ fontSize: '0.6rem' }}>SAP: {p.sap}</span>
                            </div>
                          </td>
                          <td className="text-end align-middle fw-black">${p.valor.toLocaleString()}</td>
                          <td className="text-end align-middle fw-black text-success">{p.cf.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
                          <td className="text-end align-middle fw-black text-warning pe-4">{p.cu.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              </Tab.Pane>

              <Tab.Pane eventKey="comparativa" className="h-100 overflow-auto custom-scrollbar p-3">
                <h5 className="fw-black mb-3 text-uppercase">Análisis Comparativo Mensual</h5>
                <Row className="g-3">
                  <Col xs={12} lg={7}>
                    <div className="p-3 bg-dark bg-opacity-25 border border-secondary border-opacity-10" style={{ height: '400px' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={monthlyComparison}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                          <XAxis dataKey="month" {...axisStyle} />
                          <YAxis {...axisStyle} />
                          <Tooltip {...chartTooltipStyle} />
                          <Bar dataKey="total" fill="var(--color-red-primary)" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </Col>
                  <Col xs={12} lg={5}>
                    <div className="admin-border-industrial" style={{ backgroundColor: 'var(--theme-background-secondary)' }}>
                      <Table responsive hover variant="dark" className="mb-0 industrial-table-v2">
                        <thead><tr><th className="ps-4">MES</th><th className="text-end">VENTA TOTAL</th><th className="text-end pe-4">DELTA (%)</th></tr></thead>
                        <tbody>{monthlyComparison.map((m) => (<tr key={m.month}><td className="ps-4 fw-black text-uppercase">{m.month}</td><td className="text-end fw-black">{formatValue(m.total)}</td><td className="text-end pe-4 align-middle"><Badge bg={m.delta >= 0 ? 'success' : 'danger'} className="fw-black">{m.delta >= 0 ? '+' : ''}{m.delta.toFixed(1)}%</Badge></td></tr>))}</tbody>
                      </Table>
                    </div>
                  </Col>
                </Row>
              </Tab.Pane>
            </Tab.Content>
          </div>
        </Tab.Container>
      </div>

      <style>{`
        .fw-black { font-weight: 900 !important; }
        .rotate-180 { transform: rotate(180deg); }
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
