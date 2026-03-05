import type { FC } from 'react';
import { useState, useEffect, useMemo } from 'react';
import { Row, Col, Alert, Form } from 'react-bootstrap';
import { db } from '../api/firebase';
import { collection, doc, onSnapshot, query, where, getDocs, limit, orderBy } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { SPINNER_VARIANTS } from '../constants';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend, AreaChart, Area
} from 'recharts';
import { 
  FaTruck, FaBox, FaShoppingCart, FaExclamationTriangle, 
  FaCalendarAlt, FaWarehouse, FaHandHoldingUsd, FaUndoAlt, FaFilter, FaTrophy, FaChartArea 
} from 'react-icons/fa';
import GlobalSpinner from '../components/GlobalSpinner';

interface Product { id: string; nombre: string; sap: string; tipoBebidaId: string; unidades: number; }
interface InventoryEntry { almacen: number; consignacion: number; rechazo: number; }
interface Order { id: string; estadoOrden: string; detalles: { productoId: string; cantidad: number; }[]; }

const Dashboard: FC = () => {
  const [isDarkMode, setIsDarkMode] = useState(() => document.body.classList.contains('theme-dark'));
  const { userSedeId } = useAuth();
  const { beverageTypes, loadingMasterData } = useData();

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDarkMode(document.body.classList.contains('theme-dark'));
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  
  const [products, setProducts] = useState<Product[]>([]);
  const [todayInventory, setTodayInventory] = useState<Record<string, InventoryEntry>>({});
  const [yesterdayInventory, setYesterdayInventory] = useState<Record<string, InventoryEntry>>({});
  const [orders, setOrders] = useState<Order[]>([]);
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedType, setSelectedType] = useState<string>('');

  const yesterdayStr = useMemo(() => {
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  }, [selectedDate]);

  useEffect(() => {
    if (!userSedeId) return;
    const unsubProducts = onSnapshot(collection(db, 'productos'), (s) => {
      setProducts(s.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
    });
    return () => unsubProducts();
  }, [userSedeId]);

  useEffect(() => {
    if (!userSedeId) return;
    setLoading(true);

    const unsubToday = onSnapshot(doc(db, 'inventario_diario', `${userSedeId}_${selectedDate}`), (s) => {
      setTodayInventory(s.exists() ? s.data().productos || {} : {});
    });

    const unsubYesterday = onSnapshot(doc(db, 'inventario_diario', `${userSedeId}_${yesterdayStr}`), (s) => {
      setYesterdayInventory(s.exists() ? s.data().productos || {} : {});
    });

    const qOrders = query(collection(db, 'ordenes'), where('sedeId', '==', userSedeId), where('fechaCreacion', '==', selectedDate));
    const unsubOrders = onSnapshot(qOrders, (s) => {
      setOrders(s.docs.map(d => ({ id: d.id, ...d.data() } as Order)));
      setLoading(false); 
    }, (err) => { 
      console.error("Error en órdenes:", err);
      setLoading(false); 
    });

    return () => { unsubToday(); unsubYesterday(); unsubOrders(); };
  }, [userSedeId, selectedDate, yesterdayStr]);

  useEffect(() => {
    if (!userSedeId || products.length === 0) return;

    const loadHistory = async () => {
      try {
        const q = query(collection(db, 'inventario_diario'), where('sedeId', '==', userSedeId), orderBy('fecha', 'desc'), limit(7));
        const snap = await getDocs(q);
        const hist = snap.docs.map(d => {
          const data = d.data();
          let totalCajas = 0;
          Object.entries(data.productos || {}).forEach(([pId, pData]: [string, any]) => {
            const prod = products.find(p => p.id === pId);
            const factor = prod?.unidades || 1;
            totalCajas += (pData.almacen + pData.consignacion + pData.rechazo) / factor;
          });
          return { fecha: data.fecha.substring(5), stock: Number(totalCajas.toFixed(2)) };
        }).reverse();
        setHistoryData(hist);
      } catch (e) { console.warn("Histórico pendiente."); }
    };

    loadHistory();
  }, [userSedeId, products]);

  const stats = useMemo(() => {
    let tStockCJ = 0, tInventarioCJ = 0, tTransitoCJ = 0, tPreventaCJ = 0, tVentasCJ = 0, tRechazoCJ = 0;
    let totalAlmCJ = 0, totalConCJ = 0, totalRechCJ = 0;
    
    const catMetrics: Record<string, { name: string, Stock: number, Preventa: number, Ventas: number }> = {};
    const typeDistribution: Record<string, number> = {};
    const productMetrics: any[] = [];

    beverageTypes.forEach(t => {
      catMetrics[t.id] = { name: t.nombre.toUpperCase(), Stock: 0, Preventa: 0, Ventas: 0 };
    });

    products.forEach(p => {
      if (selectedType && p.tipoBebidaId !== selectedType) return;
      const factor = p.unidades || 1;

      const hoy = todayInventory[p.id] || { almacen: 0, consignacion: 0, rechazo: 0 };
      const ayer = yesterdayInventory[p.id] || { almacen: 0, consignacion: 0, rechazo: 0 };
      
      let uPreventa = 0;
      orders.forEach(o => {
        const item = o.detalles.find(d => d.productoId === p.id);
        if (item) uPreventa += item.cantidad;
      });

      const totalAyerU = ayer.almacen + ayer.consignacion + ayer.rechazo;
      const uTransito = todayInventory.hasOwnProperty(p.id) ? Math.max(0, totalAyerU - hoy.almacen) : 0;
      const uVentaReal = Math.max(0, uTransito - hoy.rechazo); 
      const uInventario = hoy.almacen + hoy.consignacion + hoy.rechazo;
      const uStock = uInventario - uPreventa;

      const cStock = uStock / factor;
      const cInventario = uInventario / factor;
      const cTransito = uTransito / factor;
      const cPreventa = uPreventa / factor;
      const cVentaReal = uVentaReal / factor;
      const cRechazo = hoy.rechazo / factor;

      tStockCJ += cStock; tInventarioCJ += cInventario; tTransitoCJ += cTransito;
      tPreventaCJ += cPreventa; tVentasCJ += cVentaReal; tRechazoCJ += cRechazo;

      totalAlmCJ += hoy.almacen / factor; 
      totalConCJ += hoy.consignacion / factor; 
      totalRechCJ += hoy.rechazo / factor;

      if (catMetrics[p.tipoBebidaId]) {
        catMetrics[p.tipoBebidaId].Stock += cStock;
        catMetrics[p.tipoBebidaId].Preventa += cPreventa;
        catMetrics[p.tipoBebidaId].Ventas += cVentaReal;
      }

      productMetrics.push({ id: p.id, name: p.nombre, sap: p.sap, stock: Number(cStock.toFixed(2)), transito: Number(cTransito.toFixed(2)), ventas: Number(cVentaReal.toFixed(2)), inventario: Number(cInventario.toFixed(2)), preventa: Number(cPreventa.toFixed(2)), rechazo: Number(cRechazo.toFixed(2)) });

      if (uInventario > 0) {
        const typeName = beverageTypes.find(t => t.id === p.tipoBebidaId)?.nombre || 'Otros';
        typeDistribution[typeName] = (typeDistribution[typeName] || 0) + cInventario;
      }
    });

    return { 
      tStock: Number(tStockCJ.toFixed(2)), 
      tInventario: Number(tInventarioCJ.toFixed(2)), 
      tTransito: Number(tTransitoCJ.toFixed(2)), 
      tPreventa: Number(tPreventaCJ.toFixed(2)), 
      tVentas: Number(tVentasCJ.toFixed(2)), 
      tRechazo: Number(tRechazoCJ.toFixed(2)), 
      chartMain: Object.values(catMetrics).filter(c => c.Stock > 0 || c.Preventa > 0 || c.Ventas > 0).map(c => ({
        ...c, Stock: Number(c.Stock.toFixed(2)), Preventa: Number(c.Preventa.toFixed(2)), Ventas: Number(c.Ventas.toFixed(2))
      })),
      chartOps: [
        { name: 'ALMACÉN', value: Number(totalAlmCJ.toFixed(2)), color: '#6c757d' },
        { name: 'CONSIGNACIÓN', value: Number(totalConCJ.toFixed(2)), color: '#adb5bd' },
        { name: 'RECHAZO', value: Number(totalRechCJ.toFixed(2)), color: '#F40009' }
      ],
      pieData: Object.keys(typeDistribution).map(name => ({ name, value: Number(typeDistribution[name].toFixed(2)) })).filter(d => d.value > 0),
      tops: {
        ventas: [...productMetrics].sort((a, b) => b.ventas - a.ventas).slice(0, 5),
        transito: [...productMetrics].sort((a, b) => b.transito - a.transito).slice(0, 5),
        critico: [...productMetrics].filter(p => p.inventario > 0).sort((a, b) => a.stock - b.stock).slice(0, 5)
      }
    };
  }, [products, todayInventory, yesterdayInventory, orders, selectedType, beverageTypes]);

  const isDark = isDarkMode;
  const SYSTEM_COLORS = ['#F40009', '#6c757d', '#adb5bd', '#343a40', '#495057', '#212529', '#000000'];
  const CHART_TEXT_COLOR = isDark ? '#FFFFFF' : '#212529';
  const GRID_COLOR = isDark ? '#333333' : '#dee2e6';
  const AXIS_COLOR = isDark ? '#aaa' : '#666';
  const TOOLTIP_BG = isDark ? '#1a1a1a' : '#fff';
  const TOOLTIP_BORDER = isDark ? '#333' : '#ced4da';
  const TOOLTIP_TEXT = isDark ? '#fff' : '#000';

  if (loadingMasterData) return <GlobalSpinner variant={SPINNER_VARIANTS.OVERLAY} />;

  return (
    <div className="admin-layout-container flex-column overflow-hidden gap-3">
      <div className="admin-section-table flex-shrink-0" style={{ flex: 'none', height: 'auto' }}>
        <Row className="g-2 align-items-center">
          <Col xs={6} md={4}>
            <div className="info-pill-new w-100">
              <span className="pill-icon-sober"><FaCalendarAlt /></span>
              <div className="pill-content flex-grow-1">
                <span className="pill-label">FECHA</span>
                <Form.Control type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="pill-date-input-v2 w-100" />
              </div>
            </div>
          </Col>
          <Col xs={6} md={4}>
            <div className="info-pill-new w-100">
              <span className="pill-icon-sober"><FaFilter /></span>
              <div className="pill-content flex-grow-1">
                <span className="pill-label">FILTRAR</span>
                <Form.Select value={selectedType} onChange={(e) => setSelectedType(e.target.value)} className="pill-select-v2 w-100">
                  <option value="">TODAS LAS BEBIDAS</option>
                  {beverageTypes.map(t => <option key={t.id} value={t.id}>{t.nombre.toUpperCase()}</option>)}
                </Form.Select>
              </div>
            </div>
          </Col>
          <Col xs={12} md={4}>
            <div className="info-pill-new w-100">
              <span className="pill-icon-sober"><FaBox /></span>
              <div className="pill-content flex-grow-1">
                <span className="pill-label">RESULTADOS</span>
                <span className="pill-date-input-v2 d-block text-uppercase">
                  {loading ? '...' : `${stats.chartMain.length} CATEGORÍAS`}
                </span>
              </div>
            </div>
          </Col>
        </Row>
      </div>

      <div className="admin-section-table flex-grow-1 overflow-hidden p-0">
        <div className="h-100 overflow-auto custom-scrollbar p-3">
          {loading ? ( <GlobalSpinner variant={SPINNER_VARIANTS.IN_PAGE} /> ) : (
            <>
              {!loading && Object.keys(todayInventory).length === 0 && (
                <Alert variant="warning" className="border-0 py-2 small fw-bold mb-3">
                  <FaExclamationTriangle className="me-2" /> SIN CONTEO REGISTRADO PARA HOY.
                </Alert>
              )}

              <Row className="g-2 mb-3">
                {[
                  { label: 'INV. FÍSICO', value: stats.tInventario, icon: <FaWarehouse />, color: '#FFFFFF' },
                  { label: 'STOCK VENTA', value: stats.tStock, icon: <FaBox />, color: '#F40009' },
                  { label: 'PREVENTA HOY', value: stats.tPreventa, icon: <FaShoppingCart />, color: '#adb5bd' },
                  { label: 'TRÁNSITO', value: stats.tTransito, icon: <FaTruck />, color: '#6c757d' },
                  { label: 'VENTA REAL', value: stats.tVentas, icon: <FaHandHoldingUsd />, color: '#FFFFFF' },
                  { label: 'RECHAZOS HOY', value: stats.tRechazo, icon: <FaUndoAlt />, color: '#F40009' }
                ].map((kpi, i) => (
                  <Col key={i} xs={6} md={4} lg={2}>
                    <div className="dash-kpi-card" style={{ borderLeft: `3px solid ${kpi.color}` }}>
                      <div className="dash-kpi-icon" style={{ color: kpi.color }}>{kpi.icon}</div>
                      <div className="dash-kpi-data">
                        <div className="dash-kpi-value">{kpi.value} CJ</div>
                        <div className="dash-kpi-label">{kpi.label}</div>
                      </div>
                    </div>
                  </Col>
                ))}
              </Row>

              <Row className="g-3 mb-3">
                <Col xs={12} lg={8}>
                  <div className="dash-chart-box">
                    <div className="dash-chart-header"><FaChartArea className="me-2 text-danger" /> TENDENCIA SEMANAL</div>
                    <div style={{ height: 280 }}>
                      {historyData.length > 0 ? (
                        <ResponsiveContainer>
                          <AreaChart data={historyData}>
                            <defs><linearGradient id="c" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#F40009" stopOpacity={0.3}/><stop offset="95%" stopColor="#F40009" stopOpacity={0}/></linearGradient></defs>
                            <CartesianGrid stroke={GRID_COLOR} vertical={false} horizontal={true} />
                            <XAxis dataKey="fecha" stroke={AXIS_COLOR} fontSize={10} tickLine={false} axisLine={false} />
                            <YAxis stroke={AXIS_COLOR} fontSize={10} tickLine={false} axisLine={false} />
                            <Tooltip contentStyle={{ backgroundColor: TOOLTIP_BG, border: `1px solid ${TOOLTIP_BORDER}`, color: TOOLTIP_TEXT }} itemStyle={{ color: TOOLTIP_TEXT }} formatter={(val: any) => [`${val} CJ`, 'STOCK']} />
                            <Area type="monotone" dataKey="stock" stroke="#F40009" strokeWidth={2} fillOpacity={1} fill="url(#c)" />
                          </AreaChart>
                        </ResponsiveContainer>
                      ) : <div className="d-flex align-items-center justify-content-center h-100 text-muted small">Cargando histórico...</div>}
                    </div>
                  </div>
                </Col>
                <Col xs={12} lg={4}>
                  <div className="dash-chart-box">
                    <div className="dash-chart-header">DISTRIBUCIÓN</div>
                    <div style={{ height: 280 }}>
                      <ResponsiveContainer>
                        <PieChart>
                          <Pie data={stats.pieData} innerRadius={65} outerRadius={90} dataKey="value" stroke="none">
                            {stats.pieData.map((_, i) => <Cell key={i} fill={SYSTEM_COLORS[i % SYSTEM_COLORS.length]} />)}
                          </Pie>
                          <Tooltip 
                            contentStyle={{ backgroundColor: TOOLTIP_BG, border: `1px solid ${TOOLTIP_BORDER}`, borderRadius: '4px' }} 
                            itemStyle={{ color: TOOLTIP_TEXT, fontSize: '12px', fontWeight: 'bold' }}
                            formatter={(val: any) => [`${val} CJ`]} 
                          />
                          <Legend iconType="circle" />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </Col>
              </Row>

              <Row className="g-3 mb-3">
                <Col xs={12} lg={6}>
                  <div className="dash-chart-box">
                    <div className="dash-chart-header">BALANCE COMERCIAL</div>
                    <div style={{ height: 280 }}>
                      <ResponsiveContainer>
                        <BarChart data={stats.chartMain}>
                          <CartesianGrid stroke={GRID_COLOR} vertical={false} horizontal={true} />
                          <XAxis dataKey="name" fontSize={9} stroke={AXIS_COLOR} tickLine={false} axisLine={false} />
                          <YAxis fontSize={10} stroke={AXIS_COLOR} tickLine={false} axisLine={false} />
                          <Tooltip 
                            cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                            contentStyle={{ backgroundColor: TOOLTIP_BG, border: `1px solid ${TOOLTIP_BORDER}`, borderRadius: '4px' }} 
                            itemStyle={{ color: TOOLTIP_TEXT, fontSize: '11px' }}
                            labelStyle={{ color: '#F40009', fontWeight: 'bold', marginBottom: '5px', fontSize: '12px' }}
                            formatter={(val: any, name: string | undefined) => [`${val} CJ`, name || '']} 
                          />
                          <Legend iconType="circle" wrapperStyle={{ fontSize: '10px' }} />
                          <Bar name="STOCK VENTA" dataKey="Stock" fill="#F40009" radius={0} />
                          <Bar name="PREVENTA" dataKey="Preventa" fill="#adb5bd" radius={0} />
                          <Bar name="VENTA REAL" dataKey="Ventas" fill={CHART_TEXT_COLOR} radius={0} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </Col>
                <Col xs={12} lg={6}>
                  <div className="dash-chart-box">
                    <div className="dash-chart-header">ESTADO GLOBAL DEL INVENTARIO</div>
                    <div style={{ height: 280 }}>
                      <ResponsiveContainer>
                        <BarChart data={stats.chartOps}>
                          <CartesianGrid stroke={GRID_COLOR} vertical={false} horizontal={true} />
                          <XAxis dataKey="name" fontSize={10} stroke={AXIS_COLOR} tickLine={false} axisLine={false} />
                          <YAxis fontSize={10} stroke={AXIS_COLOR} tickLine={false} axisLine={false} />
                          <Tooltip 
                            cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                            contentStyle={{ backgroundColor: TOOLTIP_BG, border: `1px solid ${TOOLTIP_BORDER}`, borderRadius: '4px' }} 
                            itemStyle={{ color: TOOLTIP_TEXT, fontSize: '12px', fontWeight: 'bold' }}
                            formatter={(val: any) => [`${val} CJ`]}
                          />
                          <Bar dataKey="value" radius={0}>
                            {stats.chartOps.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </Col>
              </Row>

              <Row className="g-2 pb-2">
                {[
                  { title: 'TOP VENTAS', data: stats.tops.ventas, key: 'ventas', color: 'text-success', icon: <FaTrophy /> },
                  { title: 'MÁS TRÁNSITO', data: stats.tops.transito, key: 'transito', color: 'text-warning', icon: <FaTruck /> },
                  { title: 'STOCK CRÍTICO', data: stats.tops.critico, key: 'stock', color: 'text-danger', icon: <FaExclamationTriangle /> }
                ].map((top, i) => (
                  <Col key={i} xs={12} md={4}>
                    <div className="dash-top-card">
                      <div className="dash-top-header">{top.icon} {top.title}</div>
                      {top.data.map((p, idx) => (
                        <div key={idx} className="dash-top-item">
                          <span className="dash-top-idx">{idx + 1}</span>
                          <div className="dash-top-info"><div className="dash-top-name">{p.name}</div><div className="dash-top-sap">{p.sap}</div></div>
                          <div className={`dash-top-val ${top.color}`}>{p[top.key]} U</div>
                        </div>
                      ))}
                    </div>
                  </Col>
                ))}
              </Row>
            </>
          )}
        </div>
      </div>

      <style>{`
        .info-pill-new { display: flex; align-items: center; background-color: var(--theme-background-secondary); border: 1px solid var(--theme-border-default); border-radius: 4px; height: 40px; overflow: hidden; }
        .pill-icon-sober { background-color: var(--theme-icon-bg); color: var(--theme-icon-color); padding: 0 10px; height: 100%; display: flex; align-items: center; border-right: 1px solid var(--theme-border-default); }
        .pill-content { padding: 0 10px; display: flex; flex-direction: column; justify-content: center; }
        .pill-label { font-size: 0.45rem; font-weight: 800; opacity: 0.5; text-uppercase: uppercase; color: var(--theme-text-primary); }
        .pill-date-input-v2, .pill-select-v2 { background: transparent !important; border: none !important; color: var(--theme-text-primary) !important; font-weight: 700; font-size: 0.85rem; cursor: pointer; padding: 2px 0 !important; margin-top: -2px; }
        .pill-date-input-v2::-webkit-calendar-picker-indicator { filter: invert(var(--theme-calendar-invert, 1)); cursor: pointer; transform: scale(1.5); margin-right: 10px; opacity: 0.8; }
        .dash-kpi-card { background: var(--theme-background-secondary); padding: 10px; border: 1px solid var(--theme-border-default); display: flex; align-items: center; gap: 8px; height: 100%; }
        .dash-kpi-icon { font-size: 1rem; opacity: 0.8; }
        .dash-kpi-value { font-size: 1.1rem; font-weight: 900; color: var(--theme-text-primary); line-height: 1; }
        .dash-kpi-label { font-size: 0.5rem; font-weight: 800; opacity: 0.5; text-uppercase: uppercase; margin-top: 2px; color: var(--theme-text-primary); }
        .dash-chart-box { background: var(--theme-background-secondary); border: 1px solid var(--theme-border-default); padding: 15px; }
        .dash-chart-header { font-size: 0.6rem; font-weight: 900; color: var(--theme-text-secondary); margin-bottom: 10px; text-transform: uppercase; border-left: 3px solid var(--color-red-primary); padding-left: 8px; }
        .dash-top-card { background: var(--theme-background-secondary); border: 1px solid var(--theme-border-default); height: 100%; }
        .dash-top-header { padding: 10px 12px; background: var(--theme-icon-bg); font-size: 0.6rem; font-weight: 900; border-bottom: 1px solid var(--theme-border-default); color: var(--theme-text-secondary); }
        .dash-top-item { display: flex; align-items: center; padding: 8px 12px; border-bottom: 1px solid var(--theme-table-border-color); }
        .dash-top-idx { width: 20px; font-weight: 900; color: var(--color-red-primary); font-size: 0.65rem; }
        .dash-top-info { flex: 1; min-width: 0; }
        .dash-top-name { font-size: 0.7rem; font-weight: bold; color: var(--theme-text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .dash-top-sap { font-size: 0.55rem; color: var(--theme-text-secondary); }
        .dash-top-val { font-weight: 900; font-size: 0.75rem; }
      `}</style>
    </div>
  );
};

export default Dashboard;
