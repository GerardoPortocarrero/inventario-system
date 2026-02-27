import type { FC } from 'react';
import { useState, useEffect, useMemo } from 'react';
import { Row, Col, Alert, Form } from 'react-bootstrap';
import { db } from '../api/firebase';
import { collection, doc, onSnapshot, query, where, getDocs, limit, orderBy } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
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
  const { userSedeId } = useAuth();
  const { beverageTypes, loadingMasterData } = useData();
  
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
    setLoading(true);

    const unsubProducts = onSnapshot(collection(db, 'productos'), (s) => {
      setProducts(s.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
    });

    const unsubToday = onSnapshot(doc(db, 'inventario_diario', `${userSedeId}_${selectedDate}`), (s) => {
      setTodayInventory(s.exists() ? s.data().productos || {} : {});
    });

    const unsubYesterday = onSnapshot(doc(db, 'inventario_diario', `${userSedeId}_${yesterdayStr}`), (s) => {
      setYesterdayInventory(s.exists() ? s.data().productos || {} : {});
    });

    const qOrders = query(collection(db, 'ordenes'), where('sedeId', '==', userSedeId), where('fechaCreacion', '>=', selectedDate));
    const unsubOrders = onSnapshot(qOrders, (s) => {
      setOrders(s.docs.map(d => ({ id: d.id, ...d.data() } as Order)));
      setLoading(false); 
    }, () => setLoading(false));

    const loadHistory = async () => {
      try {
        const q = query(collection(db, 'inventario_diario'), where('sedeId', '==', userSedeId), orderBy('fecha', 'desc'), limit(7));
        const snap = await getDocs(q);
        const hist = snap.docs.map(d => {
          const data = d.data();
          let total = 0;
          Object.values(data.productos || {}).forEach((p: any) => total += (p.almacen + p.consignacion + p.rechazo));
          return { fecha: data.fecha.substring(5), stock: total };
        }).reverse();
        setHistoryData(hist);
      } catch (e) { console.warn("Histórico pendiente."); }
    };

    loadHistory();
    return () => { unsubProducts(); unsubToday(); unsubYesterday(); unsubOrders(); };
  }, [userSedeId, selectedDate, yesterdayStr]);

  const stats = useMemo(() => {
    let tStock = 0, tInventario = 0, tTransito = 0, tPreventa = 0, tVentas = 0, tRechazo = 0;
    const chartMain: any[] = [];
    const chartOps: any[] = [];
    const typeDistribution: Record<string, number> = {};
    const productMetrics: any[] = [];

    products.forEach(p => {
      if (selectedType && p.tipoBebidaId !== selectedType) return;
      const hoy = todayInventory[p.id] || { almacen: 0, consignacion: 0, rechazo: 0 };
      const ayer = yesterdayInventory[p.id] || { almacen: 0, consignacion: 0, rechazo: 0 };
      
      let pPreventa = 0, pVentas = 0;
      orders.forEach(o => {
        const item = o.detalles.find(d => d.productoId === p.id);
        if (item) {
          if (o.estadoOrden === 'PENDIENTE') pPreventa += item.cantidad;
          else pVentas += item.cantidad;
        }
      });

      const totalAyer = ayer.almacen + ayer.consignacion + ayer.rechazo;
      const pTransito = todayInventory.hasOwnProperty(p.id) ? Math.max(0, totalAyer - hoy.almacen) : 0;
      const pInventario = hoy.almacen + hoy.consignacion + hoy.rechazo;
      const pStock = pInventario - pPreventa;

      tStock += pStock; tInventario += pInventario; tTransito += pTransito;
      tPreventa += pPreventa; tVentas += pVentas; tRechazo += hoy.rechazo;

      const metric = { id: p.id, name: p.nombre, sap: p.sap, stock: pStock, transito: pTransito, ventas: pVentas, inventario: pInventario, preventa: pPreventa, rechazo: hoy.rechazo };
      productMetrics.push(metric);

      if (pInventario > 0 || pTransito > 0 || pVentas > 0) {
        chartMain.push({ name: p.nombre.substring(0, 8), Stock: pStock, Ventas: pVentas });
        chartOps.push({ name: p.nombre.substring(0, 8), ALM: hoy.almacen, CON: hoy.consignacion, RECH: hoy.rechazo });
        const typeName = beverageTypes.find(t => t.id === p.tipoBebidaId)?.nombre || 'Otros';
        typeDistribution[typeName] = (typeDistribution[typeName] || 0) + pInventario;
      }
    });

    return { 
      tStock, tInventario, tTransito, tPreventa, tVentas, tRechazo, 
      chartMain, chartOps,
      pieData: Object.keys(typeDistribution).map(name => ({ name, value: typeDistribution[name] })),
      tops: {
        ventas: [...productMetrics].sort((a, b) => b.ventas - a.ventas).slice(0, 5),
        transito: [...productMetrics].sort((a, b) => b.transito - a.transito).slice(0, 5),
        critico: [...productMetrics].filter(p => p.inventario > 0).sort((a, b) => a.stock - b.stock).slice(0, 5)
      }
    };
  }, [products, todayInventory, yesterdayInventory, orders, selectedType, beverageTypes]);

  if (loadingMasterData) return <GlobalSpinner variant="overlay" />;

  const SYSTEM_COLORS = ['#F40009', '#FFFFFF', '#adb5bd', '#6c757d', '#343a40'];

  return (
    <div className="admin-layout-container flex-column overflow-hidden gap-3">
      
      {/* 1. SECCIÓN DE FILTROS (Caja independiente con borde y hover) */}
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
                  {stats.chartMain.length} PRODUCTOS
                </span>
              </div>
            </div>
          </Col>
        </Row>
      </div>

      {/* 2. SECCIÓN DE CONTENIDO (Caja independiente con borde, hover y scroll) */}
      <div className="admin-section-table flex-grow-1 overflow-hidden p-0">
        <div className="h-100 overflow-auto custom-scrollbar p-3">
          
          {!loading && Object.keys(todayInventory).length === 0 && (
            <Alert variant="warning" className="border-0 py-2 small fw-bold mb-3">
              <FaExclamationTriangle className="me-2" /> SIN CONTEO REGISTRADO PARA HOY.
            </Alert>
          )}

          {/* KPIs */}
          <Row className="g-2 mb-3">
            {[
              { label: 'STOCK VENTA', value: stats.tStock, icon: <FaBox />, color: '#F40009' },
              { label: 'INV. FÍSICO', value: stats.tInventario, icon: <FaWarehouse />, color: '#FFFFFF' },
              { label: 'EN TRÁNSITO', value: stats.tTransito, icon: <FaTruck />, color: '#adb5bd' },
              { label: 'VENTAS', value: stats.tVentas, icon: <FaHandHoldingUsd />, color: '#FFFFFF' },
              { label: 'PREVENTA', value: stats.tPreventa, icon: <FaShoppingCart />, color: '#6c757d' },
              { label: 'RECHAZOS', value: stats.tRechazo, icon: <FaUndoAlt />, color: '#F40009' }
            ].map((kpi, i) => (
              <Col key={i} xs={6} md={4} lg={2}>
                <div className="dash-kpi-card" style={{ borderLeft: `3px solid ${kpi.color}` }}>
                  <div className="dash-kpi-icon" style={{ color: kpi.color }}>{kpi.icon}</div>
                  <div className="dash-kpi-data">
                    <div className="dash-kpi-value">{loading ? '0' : kpi.value}</div>
                    <div className="dash-kpi-label">{kpi.label}</div>
                  </div>
                </div>
              </Col>
            ))}
          </Row>

          {/* GRÁFICAS */}
          <Row className="g-3 mb-3">
            <Col xs={12} lg={8}>
              <div className="dash-chart-box">
                <div className="dash-chart-header"><FaChartArea className="me-2 text-danger" /> TENDENCIA SEMANAL</div>
                <div style={{ height: 280 }}>
                  {historyData.length > 0 ? (
                    <ResponsiveContainer>
                      <AreaChart data={historyData}>
                        <defs><linearGradient id="c" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#F40009" stopOpacity={0.3}/><stop offset="95%" stopColor="#F40009" stopOpacity={0}/></linearGradient></defs>
                        <CartesianGrid stroke="#222" vertical={false} />
                        <XAxis dataKey="fecha" stroke="#555" fontSize={10} tickLine={false} axisLine={false} />
                        <YAxis stroke="#555" fontSize={10} tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={{ backgroundColor: '#000', border: '1px solid #333', color: '#fff' }} itemStyle={{ color: '#fff' }} />
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
                      <Pie 
                        data={stats.pieData} 
                        innerRadius={65} 
                        outerRadius={90} 
                        dataKey="value"
                        stroke="#1a1a1a"
                        strokeWidth={3}
                      >
                        {stats.pieData.map((_, i) => <Cell key={i} fill={SYSTEM_COLORS[i % SYSTEM_COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: '#000', border: '1px solid #333', borderRadius: '0', color: '#fff' }} itemStyle={{ color: '#fff' }} />
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
                    <BarChart data={stats.chartMain.slice(0, 8)}>
                      <CartesianGrid stroke="#222" vertical={false} strokeDasharray="0" />
                      <XAxis dataKey="name" fontSize={10} stroke="#555" tickLine={false} axisLine={false} />
                      <YAxis fontSize={10} stroke="#555" tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: '#000', border: '1px solid #333', borderRadius: '0', color: '#fff' }} itemStyle={{ color: '#fff' }} />
                      <Bar dataKey="Ventas" fill="#FFFFFF" radius={0} stroke="#000" strokeWidth={1} />
                      <Bar dataKey="Stock" fill="#F40009" radius={0} stroke="#000" strokeWidth={1} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </Col>
            <Col xs={12} lg={6}>
              <div className="dash-chart-box">
                <div className="dash-chart-header">ESTADO DEL PRODUCTO</div>
                <div style={{ height: 280 }}>
                  <ResponsiveContainer>
                    <BarChart data={stats.chartOps.slice(0, 8)}>
                      <CartesianGrid stroke="#222" vertical={false} strokeDasharray="0" />
                      <XAxis dataKey="name" fontSize={10} stroke="#555" tickLine={false} axisLine={false} />
                      <YAxis fontSize={10} stroke="#555" tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: '#000', border: '1px solid #333', borderRadius: '0', color: '#fff' }} itemStyle={{ color: '#fff' }} />
                      <Bar dataKey="ALM" stackId="a" fill="#adb5bd" radius={0} stroke="#000" strokeWidth={1} />
                      <Bar dataKey="CON" stackId="a" fill="#6c757d" radius={0} stroke="#000" strokeWidth={1} />
                      <Bar dataKey="RECH" stackId="a" fill="#F40009" radius={0} stroke="#000" strokeWidth={1} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </Col>
          </Row>

          {/* TOPS */}
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
        </div>
      </div>

      <style>{`
        .info-pill-new { display: flex; align-items: center; background-color: var(--theme-background-secondary); border: 1px solid var(--theme-border-default); border-radius: 4px; height: 40px; overflow: hidden; }
        .pill-icon-sober { background-color: #000; color: rgba(255,255,255,0.7); padding: 0 10px; height: 100%; display: flex; align-items: center; border-right: 1px solid var(--theme-border-default); }
        .pill-content { padding: 0 10px; display: flex; flex-direction: column; justify-content: center; }
        .pill-label { font-size: 0.45rem; font-weight: 800; opacity: 0.5; text-uppercase: uppercase; }
        .pill-date-input-v2, .pill-select-v2 { background: transparent !important; border: none !important; color: white !important; font-weight: 700; font-size: 0.85rem; cursor: pointer; padding: 2px 0 !important; margin-top: -2px; }
        .pill-date-input-v2::-webkit-calendar-picker-indicator { 
          filter: invert(1); 
          cursor: pointer;
          transform: scale(1.5);
          margin-right: 10px;
          opacity: 0.8;
        }
        .dash-kpi-card { background: var(--theme-background-secondary); padding: 10px; border: 1px solid var(--theme-border-default); display: flex; align-items: center; gap: 8px; height: 100%; }
        .dash-kpi-icon { font-size: 1rem; opacity: 0.8; }
        .dash-kpi-value { font-size: 1.1rem; font-weight: 900; color: white; line-height: 1; }
        .dash-kpi-label { font-size: 0.5rem; font-weight: 800; opacity: 0.5; text-uppercase: uppercase; margin-top: 2px; }
        .dash-chart-box { background: var(--theme-background-secondary); border: 1px solid var(--theme-border-default); padding: 15px; }
        .dash-chart-header { font-size: 0.6rem; font-weight: 900; color: var(--theme-text-secondary); margin-bottom: 10px; text-transform: uppercase; border-left: 3px solid var(--color-red-primary); padding-left: 8px; }
        .dash-top-card { background: var(--theme-background-secondary); border: 1px solid var(--theme-border-default); height: 100%; }
        .dash-top-header { padding: 10px 12px; background: #000; font-size: 0.6rem; font-weight: 900; border-bottom: 1px solid var(--theme-border-default); color: var(--theme-text-secondary); }
        .dash-top-item { display: flex; align-items: center; padding: 8px 12px; border-bottom: 1px solid rgba(255,255,255,0.02); }
        .dash-top-idx { width: 20px; font-weight: 900; color: var(--color-red-primary); font-size: 0.65rem; }
        .dash-top-info { flex: 1; min-width: 0; }
        .dash-top-name { font-size: 0.7rem; font-weight: bold; color: white; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .dash-top-sap { font-size: 0.55rem; color: #444; }
        .dash-top-val { font-weight: 900; font-size: 0.75rem; }
      `}</style>
    </div>
  );
};

export default Dashboard;
