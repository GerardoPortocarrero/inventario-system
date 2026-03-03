import type { FC } from 'react';
import { useState, useEffect, useMemo } from 'react';
import { Row, Col, Alert, Form, Badge } from 'react-bootstrap';
import { db } from '../api/firebase';
import { collection, onSnapshot, query, where, getDocs } from 'firebase/firestore';
import { useData } from '../context/DataContext';
import { SPINNER_VARIANTS } from '../constants';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { 
  FaUserTie, FaShoppingCart, FaTruck, FaHandHoldingUsd, FaUndoAlt, 
  FaChartLine, FaWarehouse, FaCalendarAlt, FaSearch, FaBox, FaFilter
} from 'react-icons/fa';
import GlobalSpinner from '../components/GlobalSpinner';
import GenericTable, { type Column } from '../components/GenericTable';

interface Product { id: string; nombre: string; sap: string; tipoBebidaId: string; }
interface Order { id: string; preventistaId: string; sedeId: string; fechaCreacion: string; detalles: { productoId: string; cantidad: number; }[]; }
interface User { id: string; nombre: string; rolId: string; sedeId: string; }
interface DailyInventory { id: string; productos: Record<string, { almacen: number; consignacion: number; rechazo: number; }>; }

const SupervisorPage: FC = () => {
  const [isDarkMode, setIsDarkMode] = useState(() => document.body.classList.contains('theme-dark'));
  const { sedes, loadingMasterData } = useData();

  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [allInventory, setAllInventory] = useState<Record<string, DailyInventory>>({});
  const [yesterdayInventory, setYesterdayInventory] = useState<Record<string, DailyInventory>>({});
  const [loading, setLoading] = useState(true);
  
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedSedeId, setSelectedSedeId] = useState<string>('GLOBAL');
  const [searchTerm, setSearchTerm] = useState('');

  const yesterdayStr = useMemo(() => {
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  }, [selectedDate]);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDarkMode(document.body.classList.contains('theme-dark'));
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setLoading(true);
    const unsubProducts = onSnapshot(collection(db, 'productos'), s => setProducts(s.docs.map(d => ({ id: d.id, ...d.data() } as Product))));
    const unsubUsers = onSnapshot(collection(db, 'usuarios'), s => setUsers(s.docs.map(d => ({ id: d.id, ...d.data() } as User))));
    const qOrders = query(collection(db, 'ordenes'), where('fechaCreacion', '==', selectedDate));
    const unsubOrders = onSnapshot(qOrders, s => setOrders(s.docs.map(d => ({ id: d.id, ...d.data() } as Order))));

    const fetchInventories = async () => {
      const qToday = query(collection(db, 'inventario_diario'), where('fecha', '==', selectedDate));
      const qYesterday = query(collection(db, 'inventario_diario'), where('fecha', '==', yesterdayStr));
      const [snapToday, snapYesterday] = await Promise.all([getDocs(qToday), getDocs(qYesterday)]);
      
      const invToday: Record<string, DailyInventory> = {};
      snapToday.docs.forEach(d => { invToday[d.data().sedeId] = { id: d.id, productos: d.data().productos || {} }; });
      const invYesterday: Record<string, DailyInventory> = {};
      snapYesterday.docs.forEach(d => { invYesterday[d.data().sedeId] = { id: d.id, productos: d.data().productos || {} }; });

      setAllInventory(invToday);
      setYesterdayInventory(invYesterday);
      setLoading(false);
    };

    fetchInventories();
    return () => { unsubProducts(); unsubUsers(); unsubOrders(); };
  }, [selectedDate, yesterdayStr]);

  const stats = useMemo(() => {
    const preventistasStats: Record<string, any> = {};
    const productStats: any[] = [];
    let gPreventa = 0, gTransito = 0, gRechazo = 0, gVentaNeta = 0;

    sedes.forEach(sede => {
      if (selectedSedeId !== 'GLOBAL' && sede.id !== selectedSedeId) return;
      const hoySede = allInventory[sede.id]?.productos || {};
      const ayerSede = yesterdayInventory[sede.id]?.productos || {};

      products.forEach(prod => {
        let pPreventa = 0;
        const prodOrders = orders.filter(o => o.sedeId === sede.id);
        prodOrders.forEach(o => {
          const item = o.detalles.find(d => d.productoId === prod.id);
          if (item) {
            pPreventa += item.cantidad;
            if (!preventistasStats[o.preventistaId]) {
              const u = users.find(u => u.id === o.preventistaId);
              preventistasStats[o.preventistaId] = { id: o.preventistaId, nombre: u?.nombre || 'Desconocido', sede: sedes.find(s => s.id === u?.sedeId)?.nombre || 'N/A', ordenes: 0, preventa: 0, rechazo: 0, ventaNeta: 0 };
            }
            preventistasStats[o.preventistaId].preventa += item.cantidad;
          }
        });

        const uniqueOrders = new Set(prodOrders.map(o => o.id));
        uniqueOrders.forEach(oid => {
          const o = orders.find(ord => ord.id === oid);
          if (o && preventistasStats[o.preventistaId]) preventistasStats[o.preventistaId].ordenes++;
        });

        const ayerData = ayerSede[prod.id] || { almacen: 0, consignacion: 0, rechazo: 0 };
        const hoyData = hoySede[prod.id] || { almacen: 0, consignacion: 0, rechazo: 0 };
        const totalAyer = ayerData.almacen + ayerData.consignacion + ayerData.rechazo;
        const pTransito = allInventory[sede.id] ? Math.max(0, totalAyer - hoyData.almacen) : 0;
        const pRechazo = hoyData.rechazo;
        const pVentaNeta = Math.max(0, pTransito - pRechazo);

        gPreventa += pPreventa; gTransito += pTransito; gRechazo += pRechazo; gVentaNeta += pVentaNeta;

        if (pPreventa > 0 || pTransito > 0 || pRechazo > 0) {
          productStats.push({ id: `${sede.id}_${prod.id}`, producto: prod.nombre, sap: prod.sap, sede: sede.nombre, preventa: pPreventa, transito: pTransito, rechazo: pRechazo, ventaNeta: pVentaNeta, efectividad: pTransito > 0 ? (pVentaNeta / pTransito) * 100 : 0 });
        }
      });
    });

    return {
      totals: { gPreventa, gTransito, gRechazo, gVentaNeta, efectividad: gTransito > 0 ? (gVentaNeta / gTransito) * 100 : 0 },
      preventistas: Object.values(preventistasStats).sort((a, b) => b.ventaNeta - a.ventaNeta),
      products: productStats,
      chartData: productStats.slice(0, 8).map(p => ({ name: p.producto.substring(0, 8), Prev: p.preventa, Venta: p.ventaNeta }))
    };
  }, [sedes, products, orders, users, allInventory, yesterdayInventory, selectedDate, selectedSedeId]);

  const filteredMaster = useMemo(() => stats.products.filter(p => p.producto.toLowerCase().includes(searchTerm.toLowerCase()) || p.sap.toLowerCase().includes(searchTerm.toLowerCase()) || p.sede.toLowerCase().includes(searchTerm.toLowerCase())), [stats.products, searchTerm]);

  if (loadingMasterData) return <GlobalSpinner variant={SPINNER_VARIANTS.OVERLAY} />;

  const isDark = isDarkMode;
  const GRID_COLOR = isDark ? '#333333' : '#dee2e6';
  const AXIS_COLOR = isDark ? '#555' : '#888';
  const TOOLTIP_BG = isDark ? '#000' : '#fff';
  const TOOLTIP_TEXT = isDark ? '#fff' : '#000';

  return (
    <div className="admin-layout-container flex-column overflow-hidden gap-3">
      
      {/* 1. SECCIÓN DE FILTROS (ESPEJO DASHBOARD) */}
      <div className="admin-section-table flex-shrink-0" style={{ flex: 'none', height: 'auto' }}>
        <Row className="g-2 align-items-center">
          <Col xs={12} md={4}>
            <div className="info-pill-new w-100">
              <span className="pill-icon-sober text-danger"><FaWarehouse /></span>
              <div className="pill-content flex-grow-1">
                <span className="pill-label">SEDE AUDITADA</span>
                <Form.Select value={selectedSedeId} onChange={(e) => setSelectedSedeId(e.target.value)} className="pill-select-v2 w-100">
                  <option value="GLOBAL">TODAS LAS SEDES (GLOBAL)</option>
                  {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre.toUpperCase()}</option>)}
                </Form.Select>
              </div>
            </div>
          </Col>
          <Col xs={6} md={4}>
            <div className="info-pill-new w-100">
              <span className="pill-icon-sober"><FaCalendarAlt /></span>
              <div className="pill-content flex-grow-1">
                <span className="pill-label">FECHA DE ANÁLISIS</span>
                <Form.Control type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="pill-date-input-v2 w-100" />
              </div>
            </div>
          </Col>
          <Col xs={6} md={4}>
            <div className="info-pill-new w-100 border-danger">
              <span className="pill-icon-sober text-danger"><FaChartLine /></span>
              <div className="pill-content flex-grow-1">
                <span className="pill-label">EFECTIVIDAD DE ENTREGA</span>
                <span className="pill-date-input-v2 d-block">{stats.totals.efectividad.toFixed(2)}%</span>
              </div>
            </div>
          </Col>
        </Row>
      </div>

      {/* 2. SECCIÓN DE CONTENIDO (ESPEJO DASHBOARD) */}
      <div className="admin-section-table flex-grow-1 overflow-hidden p-0">
        <div className="h-100 overflow-auto custom-scrollbar p-3">
          {loading ? (
            <GlobalSpinner variant={SPINNER_VARIANTS.IN_PAGE} />
          ) : (
            <>
              {/* KPIs (ESPEJO DASHBOARD) */}
              <Row className="g-2 mb-3">
                {[
                  { label: 'DEMANDA (PREVENTA)', value: stats.totals.gPreventa, icon: <FaShoppingCart />, color: '#adb5bd' },
                  { label: 'SALIDAS (TRÁNSITO)', value: stats.totals.gTransito, icon: <FaTruck />, color: '#6c757d' },
                  { label: 'DEVOLUCIONES', value: stats.totals.gRechazo, icon: <FaUndoAlt />, color: '#F40009' },
                  { label: 'VENTA NETA (LOGRO)', value: stats.totals.gVentaNeta, icon: <FaHandHoldingUsd />, color: '#FFFFFF' }
                ].map((kpi, i) => (
                  <Col key={i} xs={6} md={3}>
                    <div className="dash-kpi-card" style={{ borderLeft: `3px solid ${kpi.color}` }}>
                      <div className="dash-kpi-icon" style={{ color: kpi.color }}>{kpi.icon}</div>
                      <div className="dash-kpi-data">
                        <div className="dash-kpi-value">{kpi.value}</div>
                        <div className="dash-kpi-label">{kpi.label}</div>
                      </div>
                    </div>
                  </Col>
                ))}
              </Row>

              {/* GRÁFICA COMERCIAL */}
              <div className="dash-chart-box mb-4">
                <div className="dash-chart-header"><FaChartLine className="me-2 text-danger" /> COMPARATIVO PREVENTA VS LOGRO REAL</div>
                <div style={{ height: 250 }}>
                  <ResponsiveContainer>
                    <BarChart data={stats.chartData}>
                      <CartesianGrid stroke={GRID_COLOR} vertical={false} />
                      <XAxis dataKey="name" fontSize={10} stroke={AXIS_COLOR} tickLine={false} axisLine={false} />
                      <YAxis fontSize={10} stroke={AXIS_COLOR} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: TOOLTIP_BG, border: 'none', borderRadius: '0', color: TOOLTIP_TEXT }} />
                      <Bar dataKey="Prev" fill="#adb5bd" radius={0} />
                      <Bar dataKey="Venta" fill="#F40009" radius={0} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* AUDITORÍA DE PREVENTISTAS */}
              <div className="dash-chart-box mb-4">
                <div className="dash-chart-header"><FaUserTie className="me-2 text-danger" /> RENDIMIENTO POR PREVENTISTA</div>
                <GenericTable 
                  data={stats.preventistas} 
                  columns={[
                    { accessorKey: 'nombre', header: 'PREVENTISTA' },
                    { accessorKey: 'sede', header: 'SEDE' },
                    { accessorKey: 'ordenes', header: 'ÓRDENES' },
                    { accessorKey: 'preventa', header: 'DEMANDA (U)' },
                    { header: 'LOGRO (VENTA)', render: (p) => <span className="fw-bold text-success">{p.ventaNeta} U</span> }
                  ]} 
                />
              </div>

              {/* DETALLE GRANULAR */}
              <div className="dash-chart-box">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <div className="dash-chart-header mb-0"><FaBox className="me-2 text-danger" /> DETALLE GRANULAR POR PRODUCTO</div>
                  <div className="d-flex align-items-center gap-2 px-2" style={{ background: 'var(--theme-background-secondary)', border: '1px solid var(--theme-border-default)', height: '32px' }}>
                    <FaSearch size={12} opacity={0.5} />
                    <Form.Control size="sm" placeholder="Buscar..." className="border-0 bg-transparent p-0 shadow-none" style={{ fontSize: '0.75rem', width: '150px' }} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                  </div>
                </div>
                <GenericTable 
                  data={filteredMaster} 
                  columns={[
                    { accessorKey: 'sap', header: 'SAP' },
                    { accessorKey: 'producto', header: 'PRODUCTO' },
                    { accessorKey: 'sede', header: 'SEDE' },
                    { accessorKey: 'preventa', header: 'PREV.' },
                    { accessorKey: 'transito', header: 'TRANS.' },
                    { accessorKey: 'rechazo', header: 'RECH.' },
                    { accessorKey: 'ventaNeta', header: 'NETA' },
                    { header: '% EFECT.', render: (p) => <Badge bg={p.efectividad > 90 ? 'success' : p.efectividad > 70 ? 'warning' : 'danger'}>{p.efectividad.toFixed(1)}%</Badge> }
                  ]} 
                />
              </div>
            </>
          )}
        </div>
      </div>

      <style>{`
        .info-pill-new { display: flex; align-items: center; background-color: var(--theme-background-secondary); border: 1px solid var(--theme-border-default); border-radius: 4px; height: 40px; overflow: hidden; }
        .pill-icon-sober { background-color: var(--theme-icon-bg); color: var(--theme-icon-color); padding: 0 10px; height: 100%; display: flex; align-items: center; border-right: 1px solid var(--theme-border-default); }
        .pill-content { padding: 0 10px; display: flex; flex-direction: column; justify-content: center; }
        .pill-label { font-size: 0.45rem; font-weight: 800; opacity: 0.5; text-transform: uppercase; color: var(--theme-text-primary); }
        .pill-date-input-v2, .pill-select-v2 { background: transparent !important; border: none !important; color: var(--theme-text-primary) !important; font-weight: 700; font-size: 0.85rem; cursor: pointer; padding: 2px 0 !important; margin-top: -2px; }
        
        .dash-kpi-card { background: var(--theme-background-secondary); padding: 10px; border: 1px solid var(--theme-border-default); display: flex; align-items: center; gap: 8px; height: 100%; }
        .dash-kpi-icon { font-size: 1rem; opacity: 0.8; }
        .dash-kpi-value { font-size: 1.1rem; font-weight: 900; color: var(--theme-text-primary); line-height: 1; }
        .dash-kpi-label { font-size: 0.5rem; font-weight: 800; opacity: 0.5; text-transform: uppercase; margin-top: 2px; color: var(--theme-text-primary); }
        
        .dash-chart-box { background: var(--theme-background-secondary); border: 1px solid var(--theme-border-default); padding: 15px; }
        .dash-chart-header { font-size: 0.6rem; font-weight: 900; color: var(--theme-text-secondary); margin-bottom: 10px; text-transform: uppercase; border-left: 3px solid var(--color-red-primary); padding-left: 8px; }
      `}</style>
    </div>
  );
};

export default SupervisorPage;
