import type { FC } from 'react';
import { useState, useEffect, useMemo } from 'react';
import { Row, Col, Form, Badge } from 'react-bootstrap';
import { db } from '../api/firebase';
import { collection, onSnapshot, query, where, getDocs } from 'firebase/firestore';
import { useData } from '../context/DataContext';
import { SPINNER_VARIANTS } from '../constants';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { 
  FaUserTie, FaShoppingCart, FaTruck, FaHandHoldingUsd, FaUndoAlt, 
  FaChartLine, FaWarehouse, FaCalendarAlt, FaSearch, FaBox,
  FaSort, FaSortUp, FaSortDown
} from 'react-icons/fa';
import GlobalSpinner from '../components/GlobalSpinner';
import GenericTable from '../components/GenericTable';

interface Product { id: string; nombre: string; sap: string; tipoBebidaId: string; precio: number; unidades: number; }
interface Order { id: string; preventistaId: string; sedeId: string; fechaCreacion: string; detalles: { productoId: string; cantidad: number; }[]; }
interface User { id: string; nombre: string; rolId: string; sedeId: string; }
interface DailyInventory { id: string; productos: Record<string, { almacen: number; consignacion: number; rechazo: number; }>; }

const SupervisorPage: FC = () => {
  const [isDarkMode, setIsDarkMode] = useState(() => document.body.classList.contains('theme-dark'));
  const { sedes, beverageTypes, loadingMasterData } = useData();

  const [products, setProducts] = useState<Product[]>([]);
  const [ordersToday, setOrdersToday] = useState<Order[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [allInventory, setAllInventory] = useState<Record<string, DailyInventory>>({});
  const [yesterdayInventory, setYesterdayInventory] = useState<Record<string, DailyInventory>>({});
  const [loading, setLoading] = useState(true);
  
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedSedeId, setSelectedSedeId] = useState<string>('GLOBAL');
  const [searchTerm, setSearchTerm] = useState('');

  const [sortConfig1, setSortConfig1] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);
  const [sortConfig2, setSortConfig2] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

  const yesterdayStr = useMemo(() => {
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  }, [selectedDate]);

  useEffect(() => {
    const observer = new MutationObserver(() => setIsDarkMode(document.body.classList.contains('theme-dark')));
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setLoading(true);
    const unsubProducts = onSnapshot(collection(db, 'productos'), s => setProducts(s.docs.map(d => ({ id: d.id, ...d.data() } as Product))));
    const unsubUsers = onSnapshot(collection(db, 'usuarios'), s => setUsers(s.docs.map(d => ({ id: d.id, ...d.data() } as User))));
    
    const unsubOrdersToday = onSnapshot(query(collection(db, 'ordenes'), where('fechaCreacion', '==', selectedDate)), s => setOrdersToday(s.docs.map(d => ({ id: d.id, ...d.data() } as Order))));

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
    return () => { 
      unsubProducts(); 
      unsubUsers(); 
      unsubOrdersToday(); 
    };
  }, [selectedDate, yesterdayStr]);

  const stats = useMemo(() => {
    const prevStats: Record<string, any> = {};
    const masterLog: any[] = [];
    const catStats: Record<string, any> = {};
    let tPrev = 0, tTrans = 0, tRech = 0, tVenta = 0;

    beverageTypes.forEach(t => { catStats[t.id] = { name: t.nombre, PREVENTA: 0, VENTA: 0 }; });

    const productMap = products.reduce((acc, p) => ({ ...acc, [p.id]: p }), {} as Record<string, Product>);

    ordersToday.forEach(order => {
      if (selectedSedeId !== 'GLOBAL' && order.sedeId !== selectedSedeId) return;
      
      if (!prevStats[order.preventistaId]) {
        const u = users.find(u => u.id === order.preventistaId);
        const s = sedes.find(s => s.id === order.sedeId);
        prevStats[order.preventistaId] = { id: order.preventistaId, nombre: u?.nombre || 'Desconocido', sede: s?.nombre || 'Sede', prevHoy: 0, ventaReal: 0, ventaRealMoney: 0 };
      }

      order.detalles.forEach(det => {
        const prod = productMap[det.productoId];
        if (!prod) return;

        tPrev += det.cantidad;
        catStats[prod.tipoBebidaId].PREVENTA += det.cantidad;
        prevStats[order.preventistaId].prevHoy += det.cantidad;
        
        prevStats[order.preventistaId].ventaReal += det.cantidad;
        const subtotal = (det.cantidad / (prod.unidades || 1)) * (prod.precio || 0);
        prevStats[order.preventistaId].ventaRealMoney += subtotal;

        masterLog.push({ id: `${order.id}_${prod.id}`, sap: prod.sap, producto: prod.nombre, sede: prevStats[order.preventistaId].sede, preventista: prevStats[order.preventistaId].nombre, tipo: 'PREVENTA (HOY)', cant: det.cantidad });
      });
    });

    sedes.forEach(sede => {
      if (selectedSedeId !== 'GLOBAL' && sede.id !== selectedSedeId) return;
      
      const hoySede = allInventory[sede.id]?.productos || {};
      const ayerSede = yesterdayInventory[sede.id]?.productos || {};

      products.forEach(prod => {
        const ayerData = ayerSede[prod.id] || { almacen: 0, consignacion: 0, rechazo: 0 };
        const hoyData = hoySede[prod.id] || { almacen: 0, consignacion: 0, rechazo: 0 };
        const totalAyer = ayerData.almacen + ayerData.consignacion + ayerData.rechazo;
        const pTransito = allInventory[sede.id] ? Math.max(0, totalAyer - hoyData.almacen) : 0;
        const pRechazo = hoyData.rechazo;
        const pVenta = Math.max(0, pTransito - pRechazo);

        tTrans += pTransito; tRech += pRechazo; tVenta += pVenta;
        catStats[prod.tipoBebidaId].VENTA += pVenta;
      });
    });

    return {
      totals: { tPrev, tTrans, tRech, tVenta, efectividad: tTrans > 0 ? (tVenta / tTrans) * 100 : 0 },
      preventistas: Object.values(prevStats),
      masterLog,
      chartData: Object.values(catStats).filter(c => c.PREVENTA > 0 || c.VENTA > 0)
    };
  }, [sedes, beverageTypes, allInventory, yesterdayInventory, products, ordersToday, users, selectedSedeId]);

  const sortedPreventistas = useMemo(() => {
    if (!sortConfig1) return [...stats.preventistas].sort((a, b) => b.ventaRealMoney - a.ventaRealMoney);
    return [...stats.preventistas].sort((a, b) => {
      if (a[sortConfig1.key] < b[sortConfig1.key]) return sortConfig1.direction === 'asc' ? -1 : 1;
      if (a[sortConfig1.key] > b[sortConfig1.key]) return sortConfig1.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [stats.preventistas, sortConfig1]);

  const sortedLog = useMemo(() => {
    let list = stats.masterLog.filter(l => l.producto.toLowerCase().includes(searchTerm.toLowerCase()) || l.preventista.toLowerCase().includes(searchTerm.toLowerCase()) || l.sap.toLowerCase().includes(searchTerm.toLowerCase()));
    if (!sortConfig2) return list;
    return [...list].sort((a, b) => {
      if (a[sortConfig2.key] < b[sortConfig2.key]) return sortConfig2.direction === 'asc' ? -1 : 1;
      if (a[sortConfig2.key] > b[sortConfig2.key]) return sortConfig2.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [stats.masterLog, searchTerm, sortConfig2]);

  const handleSort1 = (key: string) => {
    setSortConfig1(prev => {
      if (prev?.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  const handleSort2 = (key: string) => {
    setSortConfig2(prev => {
      if (prev?.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  const SortableHeader = ({ label, sortKey, config, onSort }: any) => {
    const isSorted = config?.key === sortKey;
    return (
      <div className="d-flex align-items-center gap-1 cursor-pointer select-none" onClick={() => onSort(sortKey)} style={{ cursor: 'pointer' }}>
        {label}
        {isSorted ? (
          config.direction === 'asc' ? <FaSortUp size={10} /> : <FaSortDown size={10} />
        ) : (
          <FaSort size={10} style={{ opacity: 0.3 }} />
        )}
      </div>
    );
  };

  if (loadingMasterData) return <GlobalSpinner variant={SPINNER_VARIANTS.OVERLAY} />;

  const isDark = isDarkMode;
  const GRID_COLOR = isDark ? '#333' : '#eee';
  const TEXT_COLOR = isDark ? '#fff' : '#000';

  return (
    <div className="admin-layout-container flex-column overflow-hidden gap-3">
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
                <span className="pill-label">FECHA DE AUDITORÍA</span>
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

      <div className="admin-section-table flex-grow-1 overflow-hidden p-0">
        <div className="h-100 overflow-auto custom-scrollbar p-3">
          {loading ? (
            <GlobalSpinner variant={SPINNER_VARIANTS.IN_PAGE} />
          ) : (
            <>
              <Row className="g-2 mb-3">
                {[
                  { label: 'PREVENTA (HOY)', value: stats.totals.tPrev, icon: <FaShoppingCart />, color: '#adb5bd' },
                  { label: 'TRÁNSITO (SALIDA)', value: stats.totals.tTrans, icon: <FaTruck />, color: '#6c757d' },
                  { label: 'RECHAZO (RETORNO)', value: stats.totals.tRech, icon: <FaUndoAlt />, color: '#F40009' },
                  { label: 'VENTA (LOGRO REAL)', value: stats.totals.tVenta, icon: <FaHandHoldingUsd />, color: '#FFFFFF' }
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

              <div className="dash-chart-box mb-4">
                <div className="dash-chart-header"><FaChartLine className="me-2 text-danger" /> DESEMPEÑO POR CATEGORÍA DE PRODUCTO</div>
                <div style={{ height: 300 }}>
                  <ResponsiveContainer>
                    <BarChart data={stats.chartData}>
                      <CartesianGrid stroke={GRID_COLOR} vertical={false} />
                      <XAxis dataKey="name" fontSize={10} stroke={TEXT_COLOR} tickLine={false} axisLine={false} />
                      <YAxis fontSize={10} stroke={TEXT_COLOR} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: '#000', border: 'none', color: '#fff' }} />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                      <Bar name="PREVENTA (HOY)" dataKey="PREVENTA" fill="#adb5bd" radius={0} />
                      <Bar name="VENTA (LOGRO)" dataKey="VENTA" fill="#F40009" radius={0} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="dash-chart-box mb-4">
                <div className="dash-chart-header"><FaUserTie className="me-2 text-danger" /> RENDIMIENTO POR PREVENTISTA</div>
                <GenericTable 
                  data={sortedPreventistas} 
                  columns={[
                    { accessorKey: 'sede', header: 'SEDE' },
                    { accessorKey: 'nombre', header: 'PREVENTISTA' },
                    { 
                      header: <SortableHeader label="PREVENTA (U)" sortKey="prevHoy" config={sortConfig1} onSort={handleSort1} />,
                      render: (p: any) => <span>{p.prevHoy} U</span>
                    },
                    { 
                      header: <SortableHeader label="UNIDADES" sortKey="ventaReal" config={sortConfig1} onSort={handleSort1} />,
                      render: (p: any) => <span className="fw-bold text-success">{p.ventaReal} U</span> 
                    },
                    { 
                      header: <SortableHeader label="INGRESOS" sortKey="ventaRealMoney" config={sortConfig1} onSort={handleSort1} />,
                      render: (p: any) => <span className="fw-bold">S/ {p.ventaRealMoney.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span> 
                    }
                  ]} 
                />
              </div>

              <div className="dash-chart-box">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <div className="dash-chart-header mb-0"><FaBox className="me-2 text-danger" /> AUDITORÍA DETALLADA (FILTRABLE)</div>
                  <div className="d-flex align-items-center gap-2 px-2" style={{ background: 'var(--theme-background-secondary)', border: '1px solid var(--theme-border-default)', height: '32px' }}>
                    <FaSearch size={12} opacity={0.5} />
                    <Form.Control size="sm" placeholder="Buscar..." className="border-0 bg-transparent p-0 shadow-none" style={{ fontSize: '0.75rem', width: '180px' }} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                  </div>
                </div>
                <GenericTable 
                  data={sortedLog} 
                  columns={[
                    { accessorKey: 'sede', header: 'SEDE' },
                    { accessorKey: 'sap', header: 'SAP' },
                    { accessorKey: 'producto', header: 'PRODUCTO' },
                    { accessorKey: 'preventista', header: 'PREVENTISTA' },
                    { 
                      header: 'TIPO', 
                      render: (l: any) => <Badge bg={l.tipo.includes('VENTA') ? 'success' : 'secondary'}>{l.tipo}</Badge> 
                    },
                    { 
                      header: <SortableHeader label="CANTIDAD (U)" sortKey="cant" config={sortConfig2} onSort={handleSort2} />,
                      render: (l: any) => <span>{l.cant} U</span>
                    }
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
        .pill-date-input-v2, .pill-select-v2 { background: transparent !important; border: none !important; color: var(--theme-text-primary) !important; font-weight: 700; font-size: 0.85rem; cursor: pointer; padding: 2px 0 !important; margin-top: -2px; width: 100% !important; }
        
        .pill-date-input-v2::-webkit-calendar-picker-indicator { 
          filter: invert(var(--theme-calendar-invert, 1)); 
          cursor: pointer;
          transform: scale(1.5);
          margin-right: 10px;
          opacity: 0.8;
        }

        .dash-kpi-card { background: var(--theme-background-secondary); padding: 10px; border: 1px solid var(--theme-border-default); display: flex; align-items: center; gap: 8px; height: 100%; }
        .dash-kpi-icon { font-size: 1rem; opacity: 0.8; }
        .dash-kpi-value { font-size: 1.1rem; font-weight: 900; color: var(--theme-text-primary); line-height: 1; }
        .dash-kpi-label { font-size: 0.5rem; font-weight: 800; opacity: 0.5; text-uppercase: uppercase; margin-top: 2px; color: var(--theme-text-primary); }
        
        .dash-chart-box { background: var(--theme-background-secondary); border: 1px solid var(--theme-border-default); padding: 15px; }
        .dash-chart-header { font-size: 0.6rem; font-weight: 900; color: var(--theme-text-secondary); margin-bottom: 10px; text-transform: uppercase; border-left: 3px solid var(--color-red-primary); padding-left: 8px; }
      `}</style>
    </div>
  );
};

export default SupervisorPage;
