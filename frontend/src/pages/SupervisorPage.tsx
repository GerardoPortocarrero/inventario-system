import type { FC } from 'react';
import { useState, useEffect, useMemo } from 'react';
import { Row, Col, Form, Badge } from 'react-bootstrap';
import { db, rtdb } from '../api/firebase';
import { collection, onSnapshot, query, where, getDocs } from 'firebase/firestore';
import { ref, onValue } from 'firebase/database';
import { useData } from '../context/DataContext';
import { SPINNER_VARIANTS } from '../constants';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { 
  FaUserTie, FaShoppingCart, FaTruck, FaHandHoldingUsd, FaUndoAlt, 
  FaChartLine, FaWarehouse, FaCalendarAlt, FaSearch, FaBox,
  FaSort, FaSortUp, FaSortDown, FaFilter
} from 'react-icons/fa';
import GlobalSpinner from '../components/GlobalSpinner';
import GenericTable from '../components/GenericTable';

interface Product { id: string; nombre: string; sap: string; tipoBebidaId: string; precio: number; unidades: number; }
interface Order { id: string; preventistaId: string; sedeId: string; fechaCreacion: string; detalles: { productoId: string; cantidad: number; }[]; }
interface User { id: string; nombre: string; rolId: string; sedeId: string; }
interface DailyInventory { id: string; productos: Record<string, { almacen: number; consignacion: number; rechazo: number; }>; }

type ReportType = 'VOLUMEN' | 'EFICIENCIA' | 'DIAGEO' | 'ACL';

const SupervisorPage: FC = () => {
  const [isDarkMode, setIsDarkMode] = useState(() => document.body.classList.contains('theme-dark'));
  const { sedes, beverageTypes, loadingMasterData } = useData();

  const [products, setProducts] = useState<Product[]>([]);
  const [ordersToday, setOrdersToday] = useState<Order[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [allInventory, setAllInventory] = useState<Record<string, DailyInventory>>({});
  const [yesterdayInventory, setYesterdayInventory] = useState<Record<string, DailyInventory>>({});
  
  // Estados para RTDB
  const [maestroData, setMaestroData] = useState<any[]>([]);
  const [demandaData, setDemandaData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedSedeId, setSelectedSedeId] = useState<string>('GLOBAL');
  const [selectedReportType, setSelectedReportType] = useState<ReportType>('VOLUMEN');
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

    // Sincronización con RTDB
    const maestroRef = ref(rtdb, 'maestro/data');
    const demandaRef = ref(rtdb, 'demanda/data');

    const unsubMaestro = onValue(maestroRef, (snapshot) => {
      setMaestroData(snapshot.exists() ? snapshot.val() : []);
    });

    const unsubDemanda = onValue(demandaRef, (snapshot) => {
      setDemandaData(snapshot.exists() ? snapshot.val() : []);
    });

    return () => { 
      unsubProducts(); 
      unsubUsers(); 
      unsubOrdersToday(); 
      unsubMaestro();
      unsubDemanda();
    };
  }, [selectedDate, yesterdayStr]);

  const renderVolumenReport = () => (
    <div className="dash-chart-box">
      <div className="dash-chart-header text-uppercase">
        <FaShoppingCart className="me-2 text-danger" /> Reporte de Volumen
      </div>
      <div className="p-3 text-center text-muted small">
        Sincronizando con Maestro y Demanda para análisis de carga...
      </div>
    </div>
  );

  const renderEficienciaReport = () => (
    <div className="dash-chart-box">
      <div className="dash-chart-header text-uppercase">
        <FaChartLine className="me-2 text-danger" /> Reporte de Eficiencia
      </div>
      <div className="p-3 text-center text-muted small">
        Análisis de efectividad logística y rechazos...
      </div>
    </div>
  );

  const renderDiageoReport = () => (
    <div className="dash-chart-box">
      <div className="dash-chart-header text-uppercase">
        <FaGlassMartiniAlt className="me-2 text-danger" /> Reporte Diageo
      </div>
      <div className="p-3 text-center text-muted small">
        Seguimiento de cuotas y productos especializados...
      </div>
    </div>
  );

  const renderACLReport = () => (
    <div className="dash-chart-box">
      <div className="dash-chart-header text-uppercase">
        <FaBox className="me-2 text-danger" /> Reporte ACL
      </div>
      <div className="p-3 text-center text-muted small">
        Auditoría y Control Logístico...
      </div>
    </div>
  );

  return (
    <div className="admin-layout-container flex-column overflow-hidden gap-3">
      <div className="admin-section-table flex-shrink-0" style={{ flex: 'none', height: 'auto' }}>
        <Row className="g-2 align-items-center">
          <Col xs={12} md={6}>
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
          <Col xs={12} md={6}>
            <div className="info-pill-new w-100">
              <span className="pill-icon-sober text-primary"><FaFilter /></span>
              <div className="pill-content flex-grow-1">
                <span className="pill-label">TIPO DE REPORTE</span>
                <Form.Select value={selectedReportType} onChange={(e) => setSelectedReportType(e.target.value as ReportType)} className="pill-select-v2 w-100">
                  <option value="VOLUMEN">VOLUMEN</option>
                  <option value="EFICIENCIA">EFICIENCIA</option>
                  <option value="DIAGEO">DIAGEO</option>
                  <option value="ACL">ACL</option>
                </Form.Select>
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
            <div className="d-flex flex-column gap-3">
              {selectedReportType === 'VOLUMEN' && renderVolumenReport()}
              {selectedReportType === 'EFICIENCIA' && renderEficienciaReport()}
              {selectedReportType === 'DIAGEO' && renderDiageoReport()}
              {selectedReportType === 'ACL' && renderACLReport()}
            </div>
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
