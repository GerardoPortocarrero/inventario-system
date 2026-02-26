import type { FC } from 'react';
import { useState, useEffect, useMemo } from 'react';
import { Row, Col, Badge, Alert, Form, Spinner } from 'react-bootstrap';
import { db } from '../api/firebase';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend 
} from 'recharts';
import { 
  FaTruck, FaBox, FaShoppingCart, FaExclamationTriangle, 
  FaCalendarAlt, FaWarehouse, FaHandHoldingUsd, FaUndoAlt, FaFilter, FaTrophy 
} from 'react-icons/fa';
import GlobalSpinner from '../components/GlobalSpinner';

interface Product {
  id: string;
  nombre: string;
  sap: string;
  tipoBebidaId: string;
  unidades: number;
}

interface InventoryEntry {
  almacen: number;
  consignacion: number;
  rechazo: number;
}

interface Order {
  id: string;
  estadoOrden: 'PENDIENTE' | 'DESPACHADA' | 'COMPLETADA';
  detalles: {
    productoId: string;
    cantidad: number;
  }[];
}

const Dashboard: FC = () => {
  const { userSedeId } = useAuth();
  const { beverageTypes, loadingMasterData } = useData();
  
  const [products, setProducts] = useState<Product[]>([]);
  const [todayInventory, setTodayInventory] = useState<Record<string, InventoryEntry>>({});
  const [yesterdayInventory, setYesterdayInventory] = useState<Record<string, InventoryEntry>>({});
  const [orders, setOrders] = useState<Order[]>([]);
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
    });

    return () => { unsubProducts(); unsubToday(); unsubYesterday(); unsubOrders(); };
  }, [userSedeId, selectedDate, yesterdayStr]);

  const stats = useMemo(() => {
    let tStock = 0, tInventario = 0, tTransito = 0, tPreventa = 0, tVentas = 0, tRechazo = 0;
    const chartData: any[] = [];
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

      const pTransito = todayInventory.hasOwnProperty(p.id) ? Math.max(0, (ayer.almacen + ayer.consignacion + ayer.rechazo) - hoy.almacen) : 0;
      const pInventario = hoy.almacen + hoy.consignacion + hoy.rechazo;
      const pStock = pInventario - pPreventa;

      tStock += pStock; tInventario += pInventario; tTransito += pTransito;
      tPreventa += pPreventa; tVentas += pVentas; tRechazo += hoy.rechazo;

      const metric = { id: p.id, name: p.nombre, sap: p.sap, stock: pStock, transito: pTransito, ventas: pVentas, inventario: pInventario };
      productMetrics.push(metric);

      if (pInventario > 0 || pTransito > 0 || pVentas > 0) {
        chartData.push({ name: p.nombre.substring(0, 10), Stock: pStock, Tránsito: pTransito, Ventas: pVentas });
        const typeName = beverageTypes.find(t => t.id === p.tipoBebidaId)?.nombre || 'Otros';
        typeDistribution[typeName] = (typeDistribution[typeName] || 0) + pInventario;
      }
    });

    return { 
      tStock, tInventario, tTransito, tPreventa, tVentas, tRechazo, 
      chartData, 
      pieData: Object.keys(typeDistribution).map(name => ({ name, value: typeDistribution[name] })),
      tops: {
        ventas: [...productMetrics].sort((a, b) => b.ventas - a.ventas).slice(0, 5),
        transito: [...productMetrics].sort((a, b) => b.transito - a.transito).slice(0, 5),
        critico: [...productMetrics].filter(p => p.inventario > 0).sort((a, b) => a.stock - b.stock).slice(0, 5)
      }
    };
  }, [products, todayInventory, yesterdayInventory, orders, selectedType, beverageTypes]);

  if (loadingMasterData) return <GlobalSpinner variant="overlay" />;

  const COLORS = ['#F40009', '#007bff', '#ffc107', '#28a745', '#17a2b8', '#6c757d'];

  return (
    <div className="admin-layout-container overflow-hidden">
      <div className="admin-section-table d-flex flex-column h-100 overflow-auto custom-scrollbar p-3">
        
        {/* 1. FILTROS (Mismo diseño que AlmacenPage) */}
        <Row className="g-2 mb-4">
          <Col xs={12} md={4}>
            <div className="info-pill-new w-100">
              <span className="pill-icon pill-icon-sober"><FaCalendarAlt /></span>
              <div className="pill-content w-100">
                <span className="pill-label">FECHA ANÁLISIS</span>
                <Form.Control type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="pill-date-input-v2" />
              </div>
            </div>
          </Col>
          <Col xs={12} md={4}>
            <div className="info-pill-new w-100">
              <span className="pill-icon pill-icon-sober"><FaFilter /></span>
              <div className="pill-content w-100">
                <span className="pill-label">TIPO BEBIDA</span>
                <Form.Select value={selectedType} onChange={(e) => setSelectedType(e.target.value)} className="pill-select-v2">
                  <option value="">TODAS</option>
                  {beverageTypes.map(t => <option key={t.id} value={t.id}>{t.nombre.toUpperCase()}</option>)}
                </Form.Select>
              </div>
            </div>
          </Col>
          <Col xs={12} md={4} className="d-flex align-items-center justify-content-end">
            {loading && <Spinner animation="border" size="sm" className="text-danger me-2" />}
            <Badge bg="dark" className="border py-2 px-3">{stats.chartData.length} PRODUCTOS</Badge>
          </Col>
        </Row>

        {!loading && Object.keys(todayInventory).length === 0 && (
          <Alert variant="warning" className="border-0 shadow-sm mb-4 py-2 small fw-bold">
            <FaExclamationTriangle className="me-2" /> CONTEO PENDIENTE PARA ESTA FECHA.
          </Alert>
        )}

        {/* 2. KPIs COMPACTOS */}
        <Row className="g-2 mb-4">
          {[
            { label: 'STOCK', value: stats.tStock, icon: <FaBox />, color: '#F40009' },
            { label: 'INVENTARIO', value: stats.tInventario, icon: <FaWarehouse />, color: '#007bff' },
            { label: 'TRÁNSITO', value: stats.tTransito, icon: <FaTruck />, color: '#ffc107' },
            { label: 'VENTAS', value: stats.tVentas, icon: <FaHandHoldingUsd />, color: '#28a745' },
            { label: 'PREVENTA', value: stats.tPreventa, icon: <FaShoppingCart />, color: '#17a2b8' },
            { label: 'RECHAZOS', value: stats.tRechazo, icon: <FaUndoAlt />, color: '#6c757d' }
          ].map((kpi, i) => (
            <Col key={i} xs={6} md={4} lg={2}>
              <div className="dash-kpi-card" style={{ borderLeft: `3px solid ${kpi.color}` }}>
                <div className="dash-kpi-icon" style={{ color: kpi.color }}>{kpi.icon}</div>
                <div className="dash-kpi-data">
                  <div className="dash-kpi-value">{loading ? '...' : kpi.value}</div>
                  <div className="dash-kpi-label">{kpi.label}</div>
                </div>
              </div>
            </Col>
          ))}
        </Row>

        {/* 3. GRÁFICAS */}
        <Row className="g-3 mb-4">
          <Col xs={12} lg={7}>
            <div className="dash-chart-box">
              <div className="dash-chart-header">MOVIMIENTOS DE PRODUCTOS</div>
              <div style={{ width: '100%', height: 300 }}>
                <ResponsiveContainer>
                  <BarChart data={stats.chartData.slice(0, 12)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                    <XAxis dataKey="name" stroke="#555" fontSize={10} tickLine={false} />
                    <YAxis stroke="#555" fontSize={10} tickLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: '#000', border: '1px solid #333' }} />
                    <Legend />
                    <Bar dataKey="Stock" fill="#F40009" />
                    <Bar dataKey="Tránsito" fill="#ffc107" />
                    <Bar dataKey="Ventas" fill="#28a745" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </Col>
          <Col xs={12} lg={5}>
            <div className="dash-chart-box">
              <div className="dash-chart-header">MIX DE INVENTARIO</div>
              <div style={{ width: '100%', height: 300 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={stats.pieData} innerRadius={60} outerRadius={90} paddingAngle={5} dataKey="value">
                      {stats.pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#000', border: '1px solid #333' }} />
                    <Legend verticalAlign="bottom" />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </Col>
        </Row>

        {/* 4. RANKINGS */}
        <Row className="g-2">
          {[
            { title: 'TOP VENTAS', data: stats.tops.ventas, valKey: 'ventas', color: 'text-success', icon: <FaTrophy /> },
            { title: 'MÁS TRÁNSITO', data: stats.tops.transito, valKey: 'transito', color: 'text-warning', icon: <FaTruck /> },
            { title: 'STOCK CRÍTICO', data: stats.tops.critico, valKey: 'stock', color: 'text-danger', icon: <FaExclamationTriangle /> }
          ].map((top, i) => (
            <Col key={i} xs={12} md={4}>
              <div className="dash-top-card">
                <div className="dash-top-header">{top.icon} {top.title}</div>
                {top.data.map((p, idx) => (
                  <div key={idx} className="dash-top-item">
                    <span className="dash-top-idx">{idx + 1}</span>
                    <div className="dash-top-info">
                      <div className="dash-top-name">{p.name}</div>
                      <div className="dash-top-sap">{p.sap}</div>
                    </div>
                    <div className={`dash-top-val ${top.color}`}>{p[top.valKey]} U</div>
                  </div>
                ))}
              </div>
            </Col>
          ))}
        </Row>

      </div>

      <style>{`
        .admin-layout-container { padding: 0 !important; }
        
        .info-pill-new { display: flex; align-items: center; background-color: var(--theme-background-secondary); border: 1px solid var(--theme-border-default); border-radius: 4px; height: 45px; overflow: hidden; }
        .pill-icon-sober { background-color: #000; color: rgba(255,255,255,0.7); padding: 0 12px; height: 100%; display: flex; align-items: center; border-right: 1px solid var(--theme-border-default); }
        .pill-content { padding: 0 10px; display: flex; flex-direction: column; justify-content: center; }
        .pill-label { font-size: 0.5rem; font-weight: 800; opacity: 0.5; text-transform: uppercase; }
        .pill-date-input-v2, .pill-select-v2 { background: transparent !important; border: none !important; color: white !important; font-weight: 700; font-size: 0.75rem; cursor: pointer; padding: 0 !important; }
        .pill-date-input-v2::-webkit-calendar-picker-indicator { filter: invert(1); }

        .dash-kpi-card { background: var(--theme-background-secondary); padding: 12px; border: 1px solid var(--theme-border-default); display: flex; align-items: center; gap: 10px; height: 100%; }
        .dash-kpi-icon { font-size: 1.2rem; opacity: 0.8; }
        .dash-kpi-value { font-size: 1.1rem; font-weight: 900; color: white; line-height: 1; }
        .dash-kpi-label { font-size: 0.55rem; font-weight: 800; opacity: 0.5; text-transform: uppercase; margin-top: 2px; }

        .dash-chart-box { background: var(--theme-background-secondary); border: 1px solid var(--theme-border-default); padding: 15px; height: 100%; }
        .dash-chart-header { font-size: 0.65rem; font-weight: 900; color: var(--theme-text-secondary); margin-bottom: 15px; text-transform: uppercase; border-left: 3px solid var(--color-red-primary); padding-left: 8px; }

        .dash-top-card { background: var(--theme-background-secondary); border: 1px solid var(--theme-border-default); height: 100%; }
        .dash-top-header { padding: 10px 12px; background: #000; font-size: 0.65rem; font-weight: 900; border-bottom: 1px solid var(--theme-border-default); color: var(--theme-text-secondary); }
        .dash-top-item { display: flex; align-items: center; padding: 8px 12px; border-bottom: 1px solid rgba(255,255,255,0.03); }
        .dash-top-idx { width: 20px; font-weight: 900; color: var(--color-red-primary); font-size: 0.7rem; }
        .dash-top-info { flex: 1; min-width: 0; }
        .dash-top-name { font-size: 0.7rem; font-weight: bold; color: white; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .dash-top-sap { font-size: 0.55rem; color: #555; }
        .dash-top-val { font-weight: 900; font-size: 0.75rem; }

        @media (max-width: 768px) {
          .dash-kpi-value { font-size: 1rem; }
          .dash-chart-box { height: auto; }
        }
      `}</style>
    </div>
  );
};

export default Dashboard;
