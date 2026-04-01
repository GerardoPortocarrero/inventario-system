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
  FaTruck, FaBox, FaExclamationTriangle, 
  FaCalendarAlt, FaWarehouse, FaFilter, FaChartArea, FaDownload 
} from 'react-icons/fa';
import { toast } from 'react-hot-toast';
import GlobalSpinner from '../components/GlobalSpinner';

interface Product { id: string; nombre: string; sap: string; basis: string; tipoBebidaId: string; unidades: number; }
interface InventoryEntry { almacen: number; consignacion: number; }

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
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedType, setSelectedType] = useState<string>('');

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
      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });

    const unsubYesterday = onSnapshot(doc(db, 'inventario_diario', `${userSedeId}_${yesterdayStr}`), (s) => {
      setYesterdayInventory(s.exists() ? s.data().productos || {} : {});
    });

    return () => { unsubToday(); unsubYesterday(); };
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
            totalCajas += ((pData.almacen || 0) + (pData.consignacion || 0)) / factor;
          });
          return { fecha: data.fecha.substring(5), stock: Number(totalCajas.toFixed(2)) };
        }).reverse();
        setHistoryData(hist);
      } catch (e) { console.warn("Histórico pendiente."); }
    };
    loadHistory();
  }, [userSedeId, products]);

  const stats = useMemo(() => {
    let tInventarioCJ = 0, tTransitoCJ = 0;
    let totalAlmCJ = 0, totalConCJ = 0;
    
    const catMetrics: Record<string, { name: string, Stock: number }> = {};
    const typeDistribution: Record<string, number> = {};
    const productMetrics: any[] = [];

    beverageTypes.forEach(t => {
      catMetrics[t.id] = { name: t.nombre.toUpperCase(), Stock: 0 };
    });

    products.forEach(p => {
      if (selectedType !== '' && p.tipoBebidaId !== selectedType) return;

      const hoy = todayInventory[p.id] || { almacen: 0, consignacion: 0 };
      const ayer = yesterdayInventory[p.id] || { almacen: 0, consignacion: 0 };
      const factor = p.unidades || 1;

      const totalAyerU = (ayer.almacen || 0) + (ayer.consignacion || 0);
      const uTransito = todayInventory.hasOwnProperty(p.id) ? Math.max(0, totalAyerU - (hoy.almacen || 0)) : 0;
      const uInventario = (hoy.almacen || 0) + (hoy.consignacion || 0);

      const cInventario = uInventario / factor;
      const cTransito = uTransito / factor;

      tInventarioCJ += cInventario; tTransitoCJ += cTransito;
      totalAlmCJ += (hoy.almacen || 0) / factor; 
      totalConCJ += (hoy.consignacion || 0) / factor; 

      if (catMetrics[p.tipoBebidaId]) {
        catMetrics[p.tipoBebidaId].Stock += cInventario;
      }

      productMetrics.push({ 
        id: p.id, name: p.nombre, sap: p.sap, basis: p.basis,
        tipo: beverageTypes.find(t => t.id === p.tipoBebidaId)?.nombre || 'Otros',
        transito: uTransito, inventario: uInventario, stock: Number(cInventario.toFixed(2))
      });

      if (uInventario > 0) {
        const typeName = beverageTypes.find(t => t.id === p.tipoBebidaId)?.nombre || 'Otros';
        typeDistribution[typeName] = (typeDistribution[typeName] || 0) + cInventario;
      }
    });

    return { 
      tInventario: Number(tInventarioCJ.toFixed(2)), tTransito: Number(tTransitoCJ.toFixed(2)), 
      chartMain: Object.values(catMetrics).filter(c => c.Stock > 0).map(c => ({
        ...c, Stock: Number(c.Stock.toFixed(2))
      })),
      chartOps: [
        { name: 'ALMACÉN', value: Number(totalAlmCJ.toFixed(2)), color: '#6c757d' },
        { name: 'CONSIGNACIÓN', value: Number(totalConCJ.toFixed(2)), color: '#adb5bd' }
      ],
      pieData: Object.keys(typeDistribution).map(name => ({ name, value: Number(typeDistribution[name].toFixed(2)) })).filter(d => d.value > 0),
      tops: {
        transito: [...productMetrics].filter(p => p.transito > 0).sort((a, b) => b.transito - a.transito).slice(0, 5),
        critico: [...productMetrics].filter(p => p.inventario > 0).sort((a, b) => a.stock - b.stock).slice(0, 5)
      }
    };
  }, [products, todayInventory, yesterdayInventory, selectedType, beverageTypes]);

  const handleDownloadCSV = async () => {
    setIsDownloading(true);
    try {
      const getDaysArray = (s: string, e: string) => {
        const a = [];
        const d = new Date(s + 'T12:00:00');
        const end = new Date(e + 'T12:00:00');
        while (d <= end) { a.push(d.toISOString().split('T')[0]); d.setDate(d.getDate() + 1); }
        return a;
      };
      const days = getDaysArray(reportStartDate, reportEndDate);
      const dStart = new Date(reportStartDate + 'T12:00:00'); dStart.setDate(dStart.getDate() - 1);
      const dayBeforeStart = dStart.toISOString().split('T')[0];

      const qInv = query(collection(db, 'inventario_diario'), where('sedeId', '==', userSedeId), where('fecha', '>=', dayBeforeStart), where('fecha', '<=', reportEndDate));
      const snapInv = await getDocs(qInv);
      const invMap: Record<string, any> = {};
      snapInv.docs.forEach(d => { invMap[d.data().fecha] = d.data().productos || {}; });
      
      const fixedHeaders = ["PRODUCTO", "SAP", "BASIS", "CATEGORIA"];
      const dynamicHeaders: string[] = [];
      days.forEach(day => {
        const d = day.split('-').slice(1).reverse().join('/');
        if (reportType === 'TOTAL') {
          dynamicHeaders.push(`${d} ALM(C)`, `${d} ALM(U)`, `${d} CON(C)`, `${d} CON(U)`, `${d} INV(C)`, `${d} INV(U)`, `${d} TRA(C)`, `${d} TRA(U)`);
        } else {
          const sc = reportType.substring(0, 3);
          dynamicHeaders.push(`${d} ${sc}(C)`, `${d} ${sc}(U)`);
        }
      });

      const rows = products.map(p => {
        const factor = p.unidades || 1;
        const rowBase = [`"${p.nombre}"`, `"${p.sap}"`, `"${p.basis}"`, `"${beverageTypes.find(t => t.id === p.tipoBebidaId)?.nombre || 'Otros'}"`];
        const rowData: string[] = [];

        days.forEach(day => {
          const prevD = new Date(day + 'T12:00:00'); prevD.setDate(prevD.getDate() - 1);
          const prevStr = prevD.toISOString().split('T')[0];
          const hoy = invMap[day]?.[p.id] || { almacen: 0, consignacion: 0 };
          const ayer = invMap[prevStr]?.[p.id] || { almacen: 0, consignacion: 0 };
          const dInv = (hoy.almacen || 0) + (hoy.consignacion || 0);
          const dTra = invMap[day] ? Math.max(0, ((ayer.almacen || 0) + (ayer.consignacion || 0)) - (hoy.almacen || 0)) : 0;
          const getCU = (val: number) => [Math.floor(val / factor), val % factor];

          if (reportType === 'TOTAL') {
            const [alC, alU] = getCU(hoy.almacen); const [coC, coU] = getCU(hoy.consignacion);
            const [inC, inU] = getCU(dInv); const [trC, trU] = getCU(dTra);
            rowData.push(alC.toString(), alU.toString(), coC.toString(), coU.toString(), inC.toString(), inU.toString(), trC.toString(), trU.toString());
          } else {
            let val = 0;
            if (reportType === 'ALMACEN') val = hoy.almacen;
            else if (reportType === 'CONSIGNACION') val = hoy.consignacion;
            else if (reportType === 'TRANSITO') val = dTra;
            else if (reportType === 'INVENTARIO') val = dInv;
            const [c, u] = getCU(val); rowData.push(c.toString(), u.toString());
          }
        });
        return [...rowBase, ...rowData].join(",");
      });

      const csv = ["\ufeffREPORTE " + reportType, "", [...fixedHeaders, ...dynamicHeaders].join(","), ...rows].join("\n");
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url; link.download = `Reporte_${reportType}_${reportStartDate}.csv`;
      document.body.appendChild(link); link.click(); document.body.removeChild(link);
      toast.success("Reporte generado");
      setShowReportModal(false);
    } catch (e) { toast.error("Error al generar reporte"); } finally { setIsDownloading(false); }
  };

  const isDark = isDarkMode;
  const SYSTEM_COLORS = ['#F40009', '#6c757d', '#adb5bd', '#343a40', '#495057', '#212529', '#000000'];
  const GRID_COLOR = isDark ? '#333333' : '#dee2e6';
  const AXIS_COLOR = isDark ? '#aaa' : '#666';
  const TOOLTIP_BG = isDark ? '#1a1a1a' : '#fff';
  const TOOLTIP_BORDER = isDark ? '#333' : '#ced4da';
  const TOOLTIP_TEXT = isDark ? '#fff' : '#000';

  if (loadingMasterData) return <GlobalSpinner variant={SPINNER_VARIANTS.OVERLAY} />;

  return (
    <div className="admin-layout-container flex-column overflow-hidden gap-3">
      <div className="admin-section-table flex-shrink-0" style={{ flex: 'none', height: 'auto' }}>
        <Row className="g-2">
          <Col xs={6} md={3}>
            <div className="info-pill-new">
              <span className="pill-icon-sober"><FaCalendarAlt /></span>
              <div className="pill-content flex-grow-1">
                <span className="pill-label">FECHA DASHBOARD</span>
                <Form.Control type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="pill-date-input-v2" />
              </div>
            </div>
          </Col>
          <Col xs={6} md={3}>
            <div className="info-pill-new">
              <span className="pill-icon-sober"><FaFilter /></span>
              <div className="pill-content flex-grow-1">
                <span className="pill-label">FILTRAR CATEGORÍA</span>
                <Form.Select value={selectedType} onChange={(e) => setSelectedType(e.target.value)} className="pill-select-v2">
                  <option value="">TODAS</option>
                  {beverageTypes.map(t => <option key={t.id} value={t.id}>{t.nombre.toUpperCase()}</option>)}
                </Form.Select>
              </div>
            </div>
          </Col>
          <Col xs={6} md={3}>
            <div className="info-pill-new">
              <span className="pill-icon-sober"><FaBox /></span>
              <div className="pill-content flex-grow-1">
                <span className="pill-label">ESTADO</span>
                <span className="pill-date-input-v2">{loading ? '...' : 'SINCRONIZADO'}</span>
              </div>
            </div>
          </Col>
          <Col xs={6} md={3}>
            <Button variant="danger" className="w-100 fw-bold text-uppercase h-100" onClick={() => setShowReportModal(true)} style={{ fontSize: '0.75rem' }}>
              <FaDownload className="me-2" /> REPORTE CSV
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
                  { label: 'INV. FÍSICO TOTAL', value: stats.tInventario, icon: <FaWarehouse />, color: '#F40009' },
                  { label: 'TRÁNSITO TOTAL', value: stats.tTransito, icon: <FaTruck />, color: '#6c757d' }
                ].map((kpi, i) => (
                  <Col key={i} xs={6}>
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
                    <div className="dash-chart-header"><FaChartArea className="me-2 text-danger" /> TENDENCIA STOCK (7 DÍAS)</div>
                    <div style={{ height: 280 }}>
                      <ResponsiveContainer>
                        <AreaChart data={historyData}>
                          <defs><linearGradient id="c" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#F40009" stopOpacity={0.3}/><stop offset="95%" stopColor="#F40009" stopOpacity={0}/></linearGradient></defs>
                          <CartesianGrid stroke={GRID_COLOR} vertical={false} horizontal={true} />
                          <XAxis dataKey="fecha" stroke={AXIS_COLOR} fontSize={10} />
                          <YAxis stroke={AXIS_COLOR} fontSize={10} />
                          <Tooltip contentStyle={{ backgroundColor: TOOLTIP_BG, border: `1px solid ${TOOLTIP_BORDER}`, color: TOOLTIP_TEXT }} />
                          <Area type="monotone" dataKey="stock" stroke="#F40009" fill="url(#c)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </Col>
                <Col xs={12} lg={4}>
                  <div className="dash-chart-box">
                    <div className="dash-chart-header">DISTRIBUCIÓN POR CATEGORÍA</div>
                    <div style={{ height: 280 }}>
                      <ResponsiveContainer>
                        <PieChart>
                          <Pie data={stats.pieData} innerRadius={65} outerRadius={90} dataKey="value" stroke="none">
                            {stats.pieData.map((_, i) => <Cell key={i} fill={SYSTEM_COLORS[i % SYSTEM_COLORS.length]} />)}
                          </Pie>
                          <Tooltip contentStyle={{ backgroundColor: TOOLTIP_BG, border: `1px solid ${TOOLTIP_BORDER}` }} />
                          <Legend iconType="circle" />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </Col>
              </Row>

              <div className="dash-chart-box mb-3">
                <div className="dash-chart-header">INVENTARIO POR CATEGORÍA (CJ)</div>
                <div style={{ height: 280 }}>
                  <ResponsiveContainer>
                    <BarChart data={stats.chartMain}>
                      <CartesianGrid stroke={GRID_COLOR} vertical={false} horizontal={true} />
                      <XAxis dataKey="name" fontSize={10} stroke={AXIS_COLOR} />
                      <YAxis fontSize={10} stroke={AXIS_COLOR} />
                      <Tooltip contentStyle={{ backgroundColor: TOOLTIP_BG, border: `1px solid ${TOOLTIP_BORDER}` }} />
                      <Bar dataKey="Stock" fill="#F40009" radius={2} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <Row className="g-2">
                {[
                  { title: 'TOP TRÁNSITO', data: stats.tops.transito, key: 'transito', color: 'text-warning', icon: <FaTruck /> },
                  { title: 'STOCK BAJO', data: stats.tops.critico, key: 'stock', color: 'text-danger', icon: <FaExclamationTriangle /> }
                ].map((top, i) => (
                  <Col key={i} xs={12} md={6}>
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

      <Modal show={showReportModal} onHide={() => setShowReportModal(false)} centered className="inventory-modal-v3">
        <Modal.Body className="p-4">
          <h5 className="fw-bold text-uppercase mb-4">Configurar Reporte CSV</h5>
          <Form>
            <Row className="g-3 mb-3">
              <Col xs={6}><Form.Label className="small fw-bold">DESDE</Form.Label><Form.Control type="date" value={reportStartDate} onChange={(e) => setReportStartDate(e.target.value)} /></Col>
              <Col xs={6}><Form.Label className="small fw-bold">HASTA</Form.Label><Form.Control type="date" value={reportEndDate} onChange={(e) => setReportEndDate(e.target.value)} /></Col>
            </Row>
            <Form.Group className="mb-4">
              <Form.Label className="small fw-bold">TIPO DE MÉTRICA</Form.Label>
              <Form.Select value={reportType} onChange={(e) => setReportType(e.target.value)}>
                <option value="TOTAL">TOTAL (CONSOLIDADO)</option>
                <option value="ALMACEN">ALMACÉN</option>
                <option value="CONSIGNACION">CONSIGNACIÓN</option>
                <option value="TRANSITO">TRÁNSITO</option>
                <option value="INVENTARIO">INVENTARIO (A+C)</option>
              </Form.Select>
            </Form.Group>
            <Button variant="danger" className="w-100 py-2 fw-bold" onClick={handleDownloadCSV} disabled={isDownloading}>
              {isDownloading ? <Spinner animation="border" size="sm" /> : 'GENERAR DESCARGA'}
            </Button>
          </Form>
        </Modal.Body>
      </Modal>

      <style>{`
        .info-pill-new { display: flex; align-items: center; background-color: var(--theme-background-secondary); border: 1px solid var(--theme-border-default); border-radius: 4px; height: 40px; overflow: hidden; width: 100%; }
        .pill-icon-sober { background-color: var(--theme-icon-bg); color: var(--theme-icon-color); padding: 0 10px; height: 100%; display: flex; align-items: center; border-right: 1px solid var(--theme-border-default); }
        .pill-content { padding: 0 10px; display: flex; flex-direction: column; justify-content: center; overflow: hidden; }
        .pill-label { font-size: 0.45rem; font-weight: 800; opacity: 0.5; text-uppercase: uppercase; color: var(--theme-text-primary); }
        .pill-date-input-v2, .pill-select-v2 { background: transparent !important; border: none !important; color: var(--theme-text-primary) !important; font-weight: 700; font-size: 0.8rem; cursor: pointer; padding: 0 !important; width: 100%; }
        .dash-kpi-card { background: var(--theme-background-secondary); padding: 15px; border: 1px solid var(--theme-border-default); display: flex; align-items: center; gap: 12px; height: 100%; }
        .dash-kpi-icon { font-size: 1.5rem; }
        .dash-kpi-value { font-size: 1.3rem; font-weight: 900; color: var(--theme-text-primary); line-height: 1; }
        .dash-kpi-label { font-size: 0.55rem; font-weight: 800; opacity: 0.6; text-uppercase: uppercase; margin-top: 4px; color: var(--theme-text-primary); }
        .dash-chart-box { background: var(--theme-background-secondary); border: 1px solid var(--theme-border-default); padding: 15px; }
        .dash-chart-header { font-size: 0.65rem; font-weight: 900; color: var(--theme-text-secondary); margin-bottom: 15px; text-transform: uppercase; border-left: 3px solid var(--color-red-primary); padding-left: 10px; }
        .dash-top-card { background: var(--theme-background-secondary); border: 1px solid var(--theme-border-default); height: 100%; }
        .dash-top-header { padding: 10px 12px; background: var(--theme-icon-bg); font-size: 0.65rem; font-weight: 900; border-bottom: 1px solid var(--theme-border-default); color: var(--theme-text-secondary); }
        .dash-top-item { display: flex; align-items: center; padding: 8px 12px; border-bottom: 1px solid var(--theme-table-border-color); }
        .dash-top-idx { width: 20px; font-weight: 900; color: var(--color-red-primary); font-size: 0.7rem; }
        .dash-top-info { flex: 1; min-width: 0; }
        .dash-top-name { font-size: 0.75rem; font-weight: bold; color: var(--theme-text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .dash-top-sap { font-size: 0.6rem; color: var(--theme-text-secondary); }
        .dash-top-val { font-weight: 900; font-size: 0.8rem; }
      `}</style>
    </div>
  );
};

export default Dashboard;
