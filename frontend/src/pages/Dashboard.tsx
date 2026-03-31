import type { FC } from 'react';
import { useState, useEffect, useMemo } from 'react';
import { Row, Col, Alert, Form, Button, Modal, Spinner } from 'react-bootstrap';
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
  FaCalendarAlt, FaWarehouse, FaHandHoldingUsd, FaUndoAlt, FaFilter, FaTrophy, FaChartArea, FaDownload 
} from 'react-icons/fa';
import { toast } from 'react-hot-toast';
import GlobalSpinner from '../components/GlobalSpinner';

interface Product { id: string; nombre: string; sap: string; basis: string; tipoBebidaId: string; unidades: number; }
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

  // Estados para el Modal de Reporte
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportStartDate, setReportStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportEndDate, setReportEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportType, setReportType] = useState('TOTAL');
  const [isDownloading, setIsDownloading] = useState(false);

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
      if (selectedType !== '' && p.tipoBebidaId !== selectedType) return;

      const hoy = todayInventory[p.id] || { almacen: 0, consignacion: 0, rechazo: 0 };
      const ayer = yesterdayInventory[p.id] || { almacen: 0, consignacion: 0, rechazo: 0 };
      const factor = p.unidades || 1;

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

      productMetrics.push({ 
        id: p.id, 
        name: p.nombre, 
        sap: p.sap, 
        basis: p.basis,
        tipo: beverageTypes.find(t => t.id === p.tipoBebidaId)?.nombre || 'Otros',
        almacen: hoy.almacen,
        consignacion: hoy.consignacion,
        rechazo: hoy.rechazo,
        transito: uTransito,
        inventario: uInventario,
        stock: Number(cStock.toFixed(2)), 
        ventas: Number(cVentaReal.toFixed(2)), 
        preventa: Number(cPreventa.toFixed(2)),
        factor: p.unidades
      });

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
      },
      productMetrics 
    };
  }, [products, todayInventory, yesterdayInventory, orders, selectedType, beverageTypes]);

  const handleDownloadCSV = async () => {
    if (products.length === 0) {
      toast.error("No hay productos cargados");
      return;
    }

    setIsDownloading(true);
    try {
      const getDaysArray = (s: string, e: string) => {
        const a = [];
        const d = new Date(s + 'T12:00:00');
        const end = new Date(e + 'T12:00:00');
        while (d <= end) {
          a.push(d.toISOString().split('T')[0]);
          d.setDate(d.getDate() + 1);
        }
        return a;
      };
      const days = getDaysArray(reportStartDate, reportEndDate);
      
      const dStart = new Date(reportStartDate + 'T12:00:00');
      dStart.setDate(dStart.getDate() - 1);
      const dayBeforeStart = dStart.toISOString().split('T')[0];

      const qInv = query(collection(db, 'inventario_diario'), where('sedeId', '==', userSedeId), where('fecha', '>=', dayBeforeStart), where('fecha', '<=', reportEndDate));
      const qOrd = query(collection(db, 'ordenes'), where('sedeId', '==', userSedeId), where('fechaCreacion', '>=', reportStartDate), where('fechaCreacion', '<=', reportEndDate));
      
      const [snapInv, snapOrd] = await Promise.all([getDocs(qInv), getDocs(qOrd)]);
      
      const invMap: Record<string, any> = {};
      snapInv.docs.forEach(d => { invMap[d.data().fecha] = d.data().productos || {}; });
      
      const ordMap: Record<string, Record<string, number>> = {};
      snapOrd.docs.forEach(d => {
        const data = d.data();
        const date = data.fechaCreacion;
        if (!ordMap[date]) ordMap[date] = {};
        data.detalles.forEach((det: any) => {
          ordMap[date][det.productoId] = (ordMap[date][det.productoId] || 0) + det.cantidad;
        });
      });

      const fixedHeaders = ["PRODUCTO", "SAP", "BASIS", "CATEGORIA"];
      const dynamicHeaders: string[] = [];
      days.forEach(day => {
        const d = day.split('-').slice(1).reverse().join('/');
        if (reportType === 'TOTAL') {
          dynamicHeaders.push(
            `${d} ALM(C)`, `${d} ALM(U)`,
            `${d} CON(C)`, `${d} CON(U)`,
            `${d} REC(C)`, `${d} REC(U)`,
            `${d} INV(C)`, `${d} INV(U)`,
            `${d} TRA(C)`, `${d} TRA(U)`,
            `${d} PRE(C)`, `${d} PRE(U)`,
            `${d} VTA(C)`, `${d} VTA(U)`
          );
        } else {
          const sc = reportType.substring(0, 3);
          dynamicHeaders.push(`${d} ${sc}(C)`, `${d} ${sc}(U)`);
        }
      });
      const headers = [...fixedHeaders, ...dynamicHeaders];

      const rows = products.map(p => {
        const factor = p.unidades || 1;
        const rowBase = [`"${p.nombre}"`, `"${p.sap}"`, `"${p.basis}"`, `"${beverageTypes.find(t => t.id === p.tipoBebidaId)?.nombre || 'Otros'}"`];
        const rowData: string[] = [];

        days.forEach(day => {
          const prevD = new Date(day + 'T12:00:00');
          prevD.setDate(prevD.getDate() - 1);
          const prevStr = prevD.toISOString().split('T')[0];

          const hoy = invMap[day]?.[p.id] || { almacen: 0, consignacion: 0, rechazo: 0 };
          const ayer = invMap[prevStr]?.[p.id] || { almacen: 0, consignacion: 0, rechazo: 0 };
          
          const dInv = hoy.almacen + hoy.consignacion + hoy.rechazo;
          const dPre = ordMap[day]?.[p.id] || 0;
          const dTra = invMap[day] ? Math.max(0, (ayer.almacen + ayer.consignacion + ayer.rechazo) - hoy.almacen) : 0;
          const dVta = Math.max(0, dTra - hoy.rechazo);

          const getCU = (val: number) => [Math.floor(val / factor), val % factor];

          if (reportType === 'TOTAL') {
            const [alC, alU] = getCU(hoy.almacen);
            const [coC, coU] = getCU(hoy.consignacion);
            const [reC, reU] = getCU(hoy.rechazo);
            const [inC, inU] = getCU(dInv);
            const [trC, trU] = getCU(dTra);
            const [prC, prU] = getCU(dPre);
            const [vtC, vtU] = getCU(dVta);
            
            rowData.push(
              alC.toString(), alU.toString(),
              coC.toString(), coU.toString(),
              reC.toString(), reU.toString(),
              inC.toString(), inU.toString(),
              trC.toString(), trU.toString(),
              prC.toString(), prU.toString(),
              vtC.toString(), vtU.toString()
            );
          } else {
            let val = 0;
            if (reportType === 'ALMACEN') val = hoy.almacen;
            else if (reportType === 'CONSIGNACION') val = hoy.consignacion;
            else if (reportType === 'RECHAZOS') val = hoy.rechazo;
            else if (reportType === 'TRANSITO') val = dTra;
            else if (reportType === 'INVENTARIO') val = dInv;
            else if (reportType === 'VENTAS') val = dVta;
            else if (reportType === 'PREVENTAS') val = dPre;
            const [c, u] = getCU(val);
            rowData.push(c.toString(), u.toString());
          }
        });
        return [...rowBase, ...rowData].join(",");
      });

      const title = `REPORTE ${reportType} - ${reportStartDate} AL ${reportEndDate}`;
      const csv = ["\ufeff" + title, "", headers.join(","), ...rows].join("\n");
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Reporte_${reportType}_${reportStartDate}_${reportEndDate}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Reporte generado con éxito");
      setShowReportModal(false);
    } catch (e) {
      console.error(e);
      toast.error("Error al generar reporte");
    } finally {
      setIsDownloading(false);
    }
  };

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
          <Col xs={6} md={3}>
            <div className="info-pill-new w-100">
              <span className="pill-icon-sober"><FaCalendarAlt /></span>
              <div className="pill-content flex-grow-1">
                <span className="pill-label">FECHA DASHBOARD</span>
                <Form.Control type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="pill-date-input-v2 w-100" />
              </div>
            </div>
          </Col>
          <Col xs={6} md={3}>
            <div className="info-pill-new w-100">
              <span className="pill-icon-sober"><FaFilter /></span>
              <div className="pill-content flex-grow-1">
                <span className="pill-label">FILTRAR BEBIDA</span>
                <Form.Select value={selectedType} onChange={(e) => setSelectedType(e.target.value)} className="pill-select-v2 w-100">
                  <option value="">TODAS LAS BEBIDAS</option>
                  {beverageTypes.map(t => <option key={t.id} value={t.id}>{t.nombre.toUpperCase()}</option>)}
                </Form.Select>
              </div>
            </div>
          </Col>
          <Col xs={6} md={3}>
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
          <Col xs={6} md={3}>
            <Button 
              variant="danger" 
              className="w-100 fw-black text-uppercase d-flex align-items-center justify-content-center gap-2" 
              onClick={() => setShowReportModal(true)} 
              style={{ fontSize: '0.75rem', height: '40px', borderRadius: '4px' }}
            >
              <FaTruck /> DESCARGAR DATA
            </Button>
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

      {/* Modal de Configuración de Reporte - Estilo Sinergia Sistema */}
      <Modal show={showReportModal} onHide={() => setShowReportModal(false)} centered className="inventory-modal-v3">
        <Modal.Body className="p-0 overflow-hidden">
          <div className="modal-header-v3">
            <h5 className="mb-0 fw-bold text-uppercase">Configuración de Reporte</h5>
            <span className="text-white-50 small fw-bold">RANGOS Y MÉTRICAS</span>
          </div>
          
          <div className="p-4">
            <Form>
              <div className="field-group-v3 mb-4">
                <span className="label-v3">SELECCIONAR RANGO DE FECHAS</span>
                <Row className="g-2">
                  <Col xs={6}>
                    <Form.Label className="label-v3 opacity-50 mt-2">DESDE</Form.Label>
                    <Form.Control 
                      type="date" 
                      value={reportStartDate} 
                      onChange={(e) => setReportStartDate(e.target.value)} 
                      className="input-v3"
                    />
                  </Col>
                  <Col xs={6}>
                    <Form.Label className="label-v3 opacity-50 mt-2">HASTA</Form.Label>
                    <Form.Control 
                      type="date" 
                      value={reportEndDate} 
                      onChange={(e) => setReportEndDate(e.target.value)} 
                      className="input-v3"
                    />
                  </Col>
                </Row>
              </div>

              <div className="field-group-v3 mb-4">
                <span className="label-v3">TIPO DE MÉTRICA A DESCARGAR</span>
                <Form.Select 
                  value={reportType} 
                  onChange={(e) => setReportType(e.target.value)}
                  className="input-v3 mt-2 text-start px-3"
                  style={{ fontSize: '0.9rem' }}
                >
                  <option value="TOTAL">TOTAL (Consolidado)</option>
                  <option value="ALMACEN">ALMACÉN (Físico)</option>
                  <option value="CONSIGNACION">CONSIGNACIÓN</option>
                  <option value="RECHAZOS">RECHAZOS</option>
                  <option value="TRANSITO">TRÁNSITO</option>
                  <option value="INVENTARIO">INVENTARIO (A+C+R)</option>
                  <option value="VENTAS">VENTAS REALES</option>
                  <option value="PREVENTAS">PREVENTAS</option>
                </Form.Select>
              </div>

              <Button 
                variant="danger" 
                className="w-100 py-3 fw-bold text-uppercase d-flex align-items-center justify-content-center gap-2" 
                onClick={handleDownloadCSV}
                disabled={isDownloading}
                style={{ borderRadius: '4px', letterSpacing: '1px' }}
              >
                {isDownloading ? <Spinner animation="border" size="sm" /> : <FaDownload />}
                {isDownloading ? 'GENERANDO ARCHIVO...' : 'INICIAR DESCARGA'}
              </Button>
              
              <Button 
                variant="link" 
                className="w-100 mt-2 text-muted small fw-bold text-decoration-none" 
                onClick={() => setShowReportModal(false)}
              >
                CANCELAR
              </Button>
            </Form>
          </div>
        </Modal.Body>
      </Modal>

      <style>{`
        .inventory-modal-v3 .modal-content { background: var(--theme-background-primary) !important; border: 1px solid var(--theme-border-default) !important; color: var(--theme-text-primary) !important; border-radius: 8px; overflow: hidden; }
        .modal-header-v3 { background: var(--color-red-primary); padding: 20px; color: white; border-bottom: 4px solid rgba(0,0,0,0.1); }
        .input-v3 { background: var(--theme-background-secondary) !important; border: none !important; border-bottom: 2px solid var(--theme-border-default) !important; color: var(--theme-text-primary) !important; font-weight: bold; text-align: center; font-size: 1rem; border-radius: 0; padding: 10px; }
        .input-v3:focus { border-color: var(--color-red-primary) !important; box-shadow: none; }
        .label-v3 { font-size: 0.65rem; font-weight: 900; color: var(--theme-text-secondary); text-transform: uppercase; display: block; letter-spacing: 0.5px; }
        
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
