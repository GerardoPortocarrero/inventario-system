import type { FC } from 'react';
import { useState, useEffect, useMemo } from 'react';
import { Row, Col, Tab, Nav, Badge, Table, ProgressBar } from 'react-bootstrap';
import { FaChartLine, FaUsers, FaRoute, FaBox, FaExchangeAlt, FaHistory, FaCloudUploadAlt, FaCrown, FaExclamationTriangle, FaStar, FaBed, FaUserCheck, FaArrowUp } from 'react-icons/fa';
import { SPINNER_VARIANTS } from '../constants';
import GlobalSpinner from '../components/GlobalSpinner';
import { db, rtdb } from '../api/firebase';
import { ref, onValue } from 'firebase/database';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { calculateRFM, calculateDailyStats, calculateProductPerformance, calculateMonthlyComparison } from '../utils/analyticsUtils';
import type { RFMResult } from '../utils/analyticsUtils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, LineChart, Line } from 'recharts';

const AnalyticsProPage: FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [demandaData, setDemandaData] = useState<any[]>([]);
  const [maestroData, setMaestroData] = useState<any[]>([]);
  const [metadata, setMetadata] = useState<any>(null);

  useEffect(() => {
    setLoading(true);
    
    // 1. Escuchar Historial Agregado en Firestore
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

    // 2. Escuchar Maestro en RTDB
    const maestroRef = ref(rtdb, 'maestro/data');
    const unsubMaestro = onValue(maestroRef, (snapshot) => {
      if (snapshot.exists()) {
        setMaestroData(snapshot.val() || []);
      }
      setLoading(false);
    });

    return () => {
      unsubDemanda();
      unsubMaestro();
    };
  }, []);

  // --- MÉTRICAS ---
  const rfmResults = useMemo(() => {
    if (demandaData.length === 0) return [];
    const clientMap: Record<string, any> = {};
    const now = new Date();

    demandaData.forEach(d => {
      const solId = d.solicitante;
      if (!clientMap[solId]) {
        clientMap[solId] = { clientId: solId, clientName: d.nombreCliente, lastDate: d.fechaObj, frequency: 0, monetary: 0 };
      }
      clientMap[solId].frequency += 1;
      clientMap[solId].monetary += d.totalValor || 0;
      if (d.fechaObj > clientMap[solId].lastDate) clientMap[solId].lastDate = d.fechaObj;
    });

    const results = Object.values(clientMap).map((c: any) => ({
      ...c,
      recency: Math.floor((now.getTime() - c.lastDate.getTime()) / (1000 * 60 * 60 * 24)),
      rScore: 0, fScore: 0, mScore: 0, totalScore: 0, segment: 'Hibernando'
    }));

    const count = results.length;
    results.sort((a, b) => a.recency - b.recency);
    results.forEach((r, i) => { r.rScore = 5 - Math.floor(i / Math.ceil(count / 5)); if (r.rScore < 1) r.rScore = 1; });

    results.sort((a, b) => a.frequency - b.frequency);
    results.forEach((r, i) => { r.fScore = Math.floor(i / Math.ceil(count / 5)) + 1; if (r.fScore > 5) r.fScore = 5; });

    results.sort((a, b) => a.monetary - b.monetary);
    results.forEach((r, i) => { r.mScore = Math.floor(i / Math.ceil(count / 5)) + 1; if (r.mScore > 5) r.mScore = 5; });

    results.forEach(r => {
      if (r.rScore >= 4 && r.fScore >= 4) r.segment = 'Campeón';
      else if (r.rScore >= 4 && r.fScore <= 2) r.segment = 'Nueva Promesa';
      else if (r.rScore <= 2 && r.fScore >= 4) r.segment = 'En Riesgo';
      else if (r.rScore <= 2 && r.fScore <= 2) r.segment = 'Hibernando';
      else if (r.fScore >= 3) r.segment = 'Fiel';
      else r.segment = 'Potencial';
    });

    return results.sort((a, b) => b.monetary - a.monetary);
  }, [demandaData]);

  const dailyStats = useMemo(() => {
    if (demandaData.length === 0) return [];
    const daysMap: Record<string, any> = { 'LUNES': { total: 0, count: 0 }, 'MARTES': { total: 0, count: 0 }, 'MIÉRCOLES': { total: 0, count: 0 }, 'JUEVES': { total: 0, count: 0 }, 'VIERNES': { total: 0, count: 0 }, 'SÁBADO': { total: 0, count: 0 }, 'DOMINGO': { total: 0, count: 0 } };
    const dayNames = ['DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'];
    demandaData.forEach(d => { if (d.fechaObj) { const dayName = dayNames[d.fechaObj.getDay()]; daysMap[dayName].total += d.totalValor || 0; daysMap[dayName].count += 1; } });
    return Object.entries(daysMap).map(([name, data]: any) => ({ name, ...data }));
  }, [demandaData]);

  const productPerformance = useMemo(() => {
    if (demandaData.length === 0) return [];
    const prodMap: Record<string, any> = {};
    demandaData.forEach(d => { (d.materiales || []).forEach((m: any) => { if (!prodMap[m.sku]) { prodMap[m.sku] = { sap: m.sku, name: m.descripcion, total: 0, count: 0 }; } prodMap[m.sku].total += m.valor || 0; prodMap[m.sku].count += 1; }); });
    return Object.values(prodMap).sort((a: any, b: any) => b.total - a.total);
  }, [demandaData]);

  const monthlyComparison = useMemo(() => {
    if (demandaData.length === 0) return [];
    const monthlyMap: Record<string, number> = {};
    demandaData.forEach(d => { if (d.fechaObj) { const key = `${d.fechaObj.getFullYear()}-${String(d.fechaObj.getMonth() + 1).padStart(2, '0')}`; monthlyMap[key] = (monthlyMap[key] || 0) + (d.totalValor || 0); } });
    const sorted = Object.entries(monthlyMap).sort((a, b) => a[0].localeCompare(b[0]));
    return sorted.map(([month, total], i) => { const prevTotal = i > 0 ? sorted[i - 1][1] : 0; const delta = prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : 0; return { month, total, prevTotal, delta }; });
  }, [demandaData]);

  const segmentCounts = useMemo(() => {
    const counts: Record<string, number> = { 'Campeón': 0, 'Fiel': 0, 'Nueva Promesa': 0, 'Potencial': 0, 'En Riesgo': 0, 'Hibernando': 0 };
    rfmResults.forEach(r => { if (counts[r.segment] !== undefined) counts[r.segment]++; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [rfmResults]);

  const segmentColors: Record<string, string> = { 'Campeón': '#ff0000', 'Fiel': '#ff4d4d', 'Nueva Promesa': '#ff8080', 'Potencial': '#ffa6a6', 'En Riesgo': '#ffcccc', 'Hibernando': '#444444' };
  const segmentIcons: Record<string, any> = { 'Campeón': <FaCrown className="text-warning" />, 'Fiel': <FaStar className="text-info" />, 'Nueva Promesa': <FaArrowUp className="text-success" />, 'Potencial': <FaUserCheck className="text-primary" />, 'En Riesgo': <FaExclamationTriangle className="text-danger" />, 'Hibernando': <FaBed className="text-secondary" /> };

  if (loading) return <GlobalSpinner variant={SPINNER_VARIANTS.IN_PAGE} />;

  return (
    <div className="admin-layout-container flex-column gap-2 gap-md-3">
      {/* 1. Header (flex-shrink-0) */}
      <div className="admin-section-table flex-shrink-0" style={{ flex: 'none', height: 'auto', padding: '0.75rem 1.25rem', borderLeft: '4px solid var(--color-red-primary)' }}>
        <div className="d-flex justify-content-between align-items-center">
          <div className="d-flex flex-column">
            <h3 className="fw-black mb-0 d-flex align-items-center gap-2" style={{ letterSpacing: '-0.5px' }}>
              <FaChartLine className="text-danger" style={{ fontSize: '1.2rem' }} /> ANALÍTICA PRO
            </h3>
            <span className="text-secondary fw-bold text-uppercase" style={{ fontSize: '0.65rem', letterSpacing: '1px', opacity: 0.8 }}>
              Inteligencia de Mercado y Análisis Estratégico Acumulativo
            </span>
          </div>
          <div className="d-none d-md-block">
            <div className="d-flex align-items-center gap-3">
              {metadata && (
                <div className="text-end">
                  <div className="small fw-black text-uppercase text-secondary" style={{ fontSize: '0.55rem' }}>Última Actualización</div>
                  <div className="small fw-black text-danger" style={{ fontSize: '0.7rem' }}>{metadata.updatedAt}</div>
                </div>
              )}
              <button className="btn btn-outline-danger btn-sm fw-black rounded-0 px-4 py-2 d-flex align-items-center gap-2" style={{ fontSize: '0.75rem' }}>
                <FaCloudUploadAlt /> CARGAR DEMANDA
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Cuerpo Principal (flex-grow-1) */}
      <div className="admin-section-table flex-grow-1 p-0 overflow-hidden">
        <Tab.Container id="analytics-tabs" defaultActiveKey="dashboard">
          <div className="d-flex flex-column h-100">
            {/* Nav (flex-shrink-0) */}
            <Nav variant="tabs" className="custom-tabs-industrial px-2 pt-2 flex-shrink-0 border-bottom-0">
              <Nav.Item><Nav.Link eventKey="dashboard" className="d-flex align-items-center gap-2"><FaHistory className="d-none d-md-inline" /> RESUMEN</Nav.Link></Nav.Item>
              <Nav.Item><Nav.Link eventKey="clientes" className="d-flex align-items-center gap-2"><FaUsers className="d-none d-md-inline" /> CLIENTES (RFM)</Nav.Link></Nav.Item>
              <Nav.Item><Nav.Link eventKey="rutas" className="d-flex align-items-center gap-2"><FaRoute className="d-none d-md-inline" /> RUTAS Y DÍAS</Nav.Link></Nav.Item>
              <Nav.Item><Nav.Link eventKey="productos" className="d-flex align-items-center gap-2"><FaBox className="d-none d-md-inline" /> PRODUCTOS</Nav.Link></Nav.Item>
              <Nav.Item><Nav.Link eventKey="comparativa" className="d-flex align-items-center gap-2"><FaExchangeAlt className="d-none d-md-inline" /> COMPARATIVA</Nav.Link></Nav.Item>
            </Nav>

            {/* Content (flex-grow-1) */}
            <Tab.Content className="flex-grow-1 overflow-hidden position-relative">
              {/* --- DASHBOARD --- */}
              <Tab.Pane eventKey="dashboard" className="h-100 overflow-auto custom-scrollbar p-3">
                <div className="d-flex flex-column gap-3">
                  <Row className="g-3">
                    <Col xs={12}>
                      <div className="p-3 border-start border-4 border-info bg-dark bg-opacity-25">
                        <h6 className="fw-black mb-1 text-info text-uppercase">Motor de Inteligencia Activo</h6>
                        <p className="small mb-0 text-secondary fw-bold">Los datos procesados se acumulan históricamente.</p>
                      </div>
                    </Col>
                    {[
                      { label: 'Clientes Analizados', value: rfmResults.length.toLocaleString(), icon: <FaUsers />, color: 'text-primary' },
                      { label: 'Visitas Totales', value: demandaData.length.toLocaleString(), icon: <FaHistory />, color: 'text-success' },
                      { label: 'Venta Total Valor', value: `$${rfmResults.reduce((acc, r) => acc + r.monetary, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`, icon: <FaBox />, color: 'text-warning' }
                    ].map((kpi, i) => (
                      <Col key={i} xs={12} md={4}>
                        <div className="p-3 bg-dark bg-opacity-50 border border-secondary border-opacity-10">
                          <div className="d-flex justify-content-between align-items-start">
                            <div>
                              <div className="text-secondary fw-bold text-uppercase mb-1" style={{ fontSize: '0.55rem' }}>{kpi.label}</div>
                              <div className="fw-black fs-2">{kpi.value}</div>
                            </div>
                            <div className={`${kpi.color} opacity-25 fs-4`}>{kpi.icon}</div>
                          </div>
                        </div>
                      </Col>
                    ))}
                  </Row>
                  <Row className="g-3">
                    <Col xs={12} md={7}>
                      <div className="p-3 bg-dark bg-opacity-25 border border-secondary border-opacity-10" style={{ height: '350px' }}>
                        <h6 className="fw-black text-uppercase small mb-4">Distribución por Segmento</h6>
                        <ResponsiveContainer width="100%" height="90%">
                          <BarChart data={segmentCounts} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.05)" />
                            <XAxis type="number" hide />
                            <YAxis dataKey="name" type="category" stroke="rgba(255,255,255,0.5)" fontSize={10} width={100} />
                            <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }} />
                            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                              {segmentCounts.map((entry, index) => <Cell key={index} fill={segmentColors[entry.name]} />)}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </Col>
                    <Col xs={12} md={5}>
                      <div className="p-3 bg-dark bg-opacity-25 border border-secondary border-opacity-10" style={{ height: '350px' }}>
                        <h6 className="fw-black text-uppercase small mb-4">Composición de Cartera</h6>
                        <ResponsiveContainer width="100%" height="90%">
                          <PieChart>
                            <Pie data={segmentCounts} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                              {segmentCounts.map((entry, index) => <Cell key={index} fill={segmentColors[entry.name]} />)}
                            </Pie>
                            <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </Col>
                  </Row>
                </div>
              </Tab.Pane>

              {/* --- CLIENTES (RFM) --- */}
              <Tab.Pane eventKey="clientes" className="h-100 overflow-auto custom-scrollbar p-3">
                <div className="d-flex justify-content-between align-items-end mb-3">
                  <h5 className="fw-black mb-0 text-uppercase">Clasificación RFM</h5>
                  <Badge bg="dark" className="border border-secondary px-3 py-2 fw-black">TOTAL: {rfmResults.length} CLIENTES</Badge>
                </div>
                <div className="admin-border-industrial" style={{ backgroundColor: 'var(--theme-background-secondary)' }}>
                  <Table responsive hover variant="dark" className="mb-0 industrial-table-v2">
                    <thead className="sticky-top bg-dark">
                      <tr><th className="ps-4">CLIENTE</th><th className="text-center">SEGMENTO</th><th className="text-center">RECENCIA</th><th className="text-center">FRECUENCIA</th><th className="text-end pe-4">VALOR TOTAL</th></tr>
                    </thead>
                    <tbody>
                      {rfmResults.map((r) => (
                        <tr key={r.clientId}>
                          <td className="ps-4"><div className="d-flex flex-column"><span className="fw-black text-uppercase" style={{ fontSize: '0.85rem' }}>{r.clientName}</span><span className="text-secondary" style={{ fontSize: '0.65rem' }}>ID: {r.clientId}</span></div></td>
                          <td className="text-center align-middle"><div className="d-flex align-items-center justify-content-center gap-2">{segmentIcons[r.segment]}<span className="fw-black text-uppercase" style={{ fontSize: '0.7rem', color: segmentColors[r.segment] }}>{r.segment}</span></div></td>
                          <td className="text-center align-middle"><div className="d-flex flex-column align-items-center"><span className="fw-black">{r.recency} <small className="text-secondary">días</small></span><div className="d-flex gap-1">{[1,2,3,4,5].map(s => <div key={s} style={{ width: '8px', height: '3px', backgroundColor: s <= r.rScore ? 'var(--color-red-primary)' : 'rgba(255,255,255,0.1)' }}></div>)}</div></div></td>
                          <td className="text-center align-middle"><div className="d-flex flex-column align-items-center"><span className="fw-black">{r.frequency} <small className="text-secondary">visitas</small></span><div className="d-flex gap-1">{[1,2,3,4,5].map(s => <div key={s} style={{ width: '8px', height: '3px', backgroundColor: s <= r.fScore ? '#00d1ff' : 'rgba(255,255,255,0.1)' }}></div>)}</div></div></td>
                          <td className="text-end pe-4 align-middle"><div className="d-flex flex-column align-items-end"><span className="fw-black text-success" style={{ fontSize: '1rem' }}>${r.monetary.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span><div className="d-flex gap-1">{[1,2,3,4,5].map(s => <div key={s} style={{ width: '8px', height: '3px', backgroundColor: s <= r.mScore ? '#00ff88' : 'rgba(255,255,255,0.1)' }}></div>)}</div></div></td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              </Tab.Pane>

              {/* --- RUTAS --- */}
              <Tab.Pane eventKey="rutas" className="h-100 overflow-auto custom-scrollbar p-3">
                <h5 className="fw-black mb-3 text-uppercase">Análisis por Día y Ciclo</h5>
                <Row className="g-3">
                  <Col xs={12} lg={7}>
                    <div className="p-3 bg-dark bg-opacity-25 border border-secondary border-opacity-10" style={{ height: '400px' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={dailyStats}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                          <XAxis dataKey="name" stroke="rgba(255,255,255,0.5)" fontSize={10} /><YAxis stroke="rgba(255,255,255,0.5)" fontSize={10} /><Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }} /><Line type="monotone" dataKey="total" stroke="var(--color-red-primary)" strokeWidth={3} dot={{ fill: 'var(--color-red-primary)', r: 6 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </Col>
                  <Col xs={12} lg={5}>
                    <div className="admin-border-industrial" style={{ backgroundColor: 'var(--theme-background-secondary)' }}>
                      <Table responsive hover variant="dark" className="mb-0 industrial-table-v2">
                        <thead><tr><th className="ps-4">DÍA</th><th className="text-center">PEDIDOS</th><th className="text-end pe-4">VALOR TOTAL</th></tr></thead>
                        <tbody>{dailyStats.map((d) => (<tr key={d.name}><td className="ps-4 fw-black text-uppercase">{d.name}</td><td className="text-center fw-black">{d.count}</td><td className="text-end pe-4 fw-black text-success">${d.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td></tr>))}</tbody>
                      </Table>
                    </div>
                  </Col>
                </Row>
              </Tab.Pane>

              {/* --- PRODUCTOS --- */}
              <Tab.Pane eventKey="productos" className="h-100 overflow-auto custom-scrollbar p-3">
                <h5 className="fw-black mb-3 text-uppercase">Rendimiento de Catálogo</h5>
                <Row className="g-3">
                  <Col xs={12} lg={6}>
                    <div className="p-3 bg-dark bg-opacity-25 border border-secondary border-opacity-10" style={{ height: '400px' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={productPerformance.slice(0, 10)} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.05)" />
                          <XAxis type="number" hide /><YAxis dataKey="name" type="category" stroke="rgba(255,255,255,0.5)" fontSize={9} width={120} /><Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }} /><Bar dataKey="total" fill="#00d1ff" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </Col>
                  <Col xs={12} lg={6}>
                    <div className="admin-border-industrial" style={{ backgroundColor: 'var(--theme-background-secondary)' }}>
                      <Table responsive hover variant="dark" className="mb-0 industrial-table-v2">
                        <thead className="sticky-top bg-dark"><tr><th className="ps-4">PRODUCTO</th><th className="text-center">PEDIDOS</th><th className="text-end pe-4">VALOR TOTAL</th></tr></thead>
                        <tbody>{productPerformance.map((p) => (<tr key={p.sap}><td className="ps-4"><div className="d-flex flex-column"><span className="fw-black text-uppercase" style={{ fontSize: '0.75rem' }}>{p.name}</span><span className="text-secondary" style={{ fontSize: '0.6rem' }}>SAP: {p.sap}</span></div></td><td className="text-center fw-black">{p.count}</td><td className="text-end pe-4 fw-black text-success">${p.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td></tr>))}</tbody>
                      </Table>
                    </div>
                  </Col>
                </Row>
              </Tab.Pane>

              {/* --- COMPARATIVA --- */}
              <Tab.Pane eventKey="comparativa" className="h-100 overflow-auto custom-scrollbar p-3">
                <h5 className="fw-black mb-3 text-uppercase">Análisis Comparativo Mensual</h5>
                <Row className="g-3">
                  <Col xs={12} lg={7}>
                    <div className="p-3 bg-dark bg-opacity-25 border border-secondary border-opacity-10" style={{ height: '400px' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={monthlyComparison}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" /><XAxis dataKey="month" stroke="rgba(255,255,255,0.5)" fontSize={10} /><YAxis stroke="rgba(255,255,255,0.5)" fontSize={10} /><Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }} /><Bar dataKey="total" fill="var(--color-red-primary)" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </Col>
                  <Col xs={12} lg={5}>
                    <div className="admin-border-industrial" style={{ backgroundColor: 'var(--theme-background-secondary)' }}>
                      <Table responsive hover variant="dark" className="mb-0 industrial-table-v2">
                        <thead><tr><th className="ps-4">MES</th><th className="text-end">VENTA TOTAL</th><th className="text-end pe-4">DELTA (%)</th></tr></thead>
                        <tbody>{monthlyComparison.map((m) => (<tr key={m.month}><td className="ps-4 fw-black text-uppercase">{m.month}</td><td className="text-end fw-black">${m.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td><td className="text-end pe-4 align-middle"><Badge bg={m.delta >= 0 ? 'success' : 'danger'} className="fw-black">{m.delta >= 0 ? '+' : ''}{m.delta.toFixed(1)}%</Badge></td></tr>))}</tbody>
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
