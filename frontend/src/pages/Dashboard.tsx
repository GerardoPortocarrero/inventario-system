import type { FC } from 'react';
import { useState, useEffect, useMemo } from 'react';
import { Row, Col, Badge, Alert, Form } from 'react-bootstrap';
import { db } from '../api/firebase';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { FaTruck, FaBox, FaShoppingCart, FaExclamationTriangle, FaCalendarAlt } from 'react-icons/fa';
import GlobalSpinner from '../components/GlobalSpinner';
import GenericTable, { type Column } from '../components/GenericTable';

interface Product {
  id: string;
  nombre: string;
  sap: string;
  unidades: number;
}

interface InventoryEntry {
  almacen: number;
  consignacion: number;
  rechazo: number;
}

interface Order {
  id: string;
  detalles: {
    productoId: string;
    cantidad: number;
  }[];
}

const Dashboard: FC = () => {
  const { userSedeId } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [todayInventory, setTodayInventory] = useState<Record<string, InventoryEntry>>({});
  const [yesterdayInventory, setYesterdayInventory] = useState<Record<string, InventoryEntry>>({});
  const [todayPreventa, setTodayPreventa] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);

  const yesterdayStr = useMemo(() => {
    const d = new Date(selectedDate + 'T12:00:00'); // Evitar problemas de zona horaria
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

    const q = query(
      collection(db, 'ordenes'),
      where('sedeId', '==', userSedeId),
      where('fechaCreacion', '>=', selectedDate)
    );
    const unsubOrders = onSnapshot(q, (s) => {
      const preventaMap: Record<string, number> = {};
      s.docs.forEach(d => {
        (d.data() as Order).detalles.forEach(item => {
          preventaMap[item.productoId] = (preventaMap[item.productoId] || 0) + item.cantidad;
        });
      });
      setTodayPreventa(preventaMap);
      setLoading(false);
    });

    return () => { unsubProducts(); unsubToday(); unsubYesterday(); unsubOrders(); };
  }, [userSedeId, selectedDate, yesterdayStr]);

  const dashboardData = useMemo(() => {
    return products.map(p => {
      const hoy = todayInventory[p.id];
      const totalAyer = yesterdayInventory[p.id] ? (yesterdayInventory[p.id].almacen + yesterdayInventory[p.id].consignacion + yesterdayInventory[p.id].rechazo) : 0;
      const hasTodayCount = todayInventory.hasOwnProperty(p.id);
      const preventa = todayPreventa[p.id] || 0;

      return {
        id: p.id,
        nombre: p.nombre,
        sap: p.sap,
        almacen: hoy?.almacen ?? 0,
        consignacion: hoy?.consignacion ?? 0,
        rechazo: hoy?.rechazo ?? 0,
        preventa,
        transito: hasTodayCount ? Math.max(0, totalAyer - hoy.almacen) : null,
        stock: hasTodayCount ? (hoy.almacen + hoy.consignacion + hoy.rechazo - preventa) : null,
        hasTodayCount
      };
    });
  }, [products, todayInventory, yesterdayInventory, todayPreventa]);

  const totals = useMemo(() => {
    let tTransito = 0, tStock = 0, tPreventa = 0, productsCounted = 0;
    dashboardData.forEach(d => {
      if (d.hasTodayCount) { tTransito += d.transito || 0; tStock += d.stock || 0; productsCounted++; }
      tPreventa += d.preventa;
    });
    return { tTransito, tStock, tPreventa, productsCounted, totalProducts: products.length };
  }, [dashboardData, products.length]);

  if (loading) return <GlobalSpinner variant="overlay" />;

  const columns: Column<any>[] = [
    { header: 'PRODUCTO', render: (d) => (
      <div className="ps-2">
        <div className="fw-bold text-white" style={{ fontSize: '0.85rem' }}>{d.nombre}</div>
        <div className="text-secondary mono-font" style={{ fontSize: '0.7rem' }}>{d.sap}</div>
      </div>
    )},
    { header: 'A / C / R', render: (d) => (
      <div className="text-light small opacity-75">
        {d.hasTodayCount ? `${d.almacen}/${d.consignacion}/${d.rechazo}` : '---'}
      </div>
    )},
    { header: 'PREVENTA', render: (d) => <span className="fw-bold text-white">{d.preventa}</span> },
    { header: 'TRÁNSITO', render: (d) => (
      d.hasTodayCount ? (
        <Badge bg={d.transito > 0 ? "warning" : "light"} className={`border ${d.transito > 0 ? 'text-dark' : 'text-muted'}`}>
          {d.transito}
        </Badge>
      ) : <span className="text-muted">---</span>
    )},
    { header: 'STOCK REAL', render: (d) => (
      d.hasTodayCount ? (
        <Badge bg={d.stock > 0 ? "success" : "danger"} className="shadow-sm">
          {d.stock}
        </Badge>
      ) : <span className="text-muted">---</span>
    )}
  ];

  return (
    <div className="admin-layout-container overflow-hidden">
      <div className="admin-section-table d-flex flex-column h-100 overflow-hidden">
        
        {/* Cabecera de KPIs Compacta */}
        <Row className="g-2 mb-3 px-1">
          <Col xs={6} md={3}>
            <div className="info-pill-new w-100 h-100">
              <span className="pill-icon pill-icon-sober"><FaTruck /></span>
              <div className="pill-content">
                <span className="pill-label">TRÁNSITO TOTAL</span>
                <span className="pill-value h6 mb-0">{totals.productsCounted === 0 ? '---' : totals.tTransito}</span>
              </div>
            </div>
          </Col>
          <Col xs={6} md={3}>
            <div className="info-pill-new w-100 h-100">
              <span className="pill-icon pill-icon-sober highlight-system"><FaBox /></span>
              <div className="pill-content">
                <span className="pill-label">STOCK DISPONIBLE</span>
                <span className="pill-value h6 mb-0">{totals.productsCounted === 0 ? '---' : totals.tStock}</span>
              </div>
            </div>
          </Col>
          <Col xs={6} md={3}>
            <div className="info-pill-new w-100 h-100">
              <span className="pill-icon pill-icon-sober"><FaShoppingCart /></span>
              <div className="pill-content">
                <span className="pill-label">PREVENTA HOY</span>
                <span className="pill-value h6 mb-0">{totals.tPreventa}</span>
              </div>
            </div>
          </Col>
          <Col xs={6} md={3}>
            <div className="info-pill-new w-100 h-100">
              <span className="pill-icon pill-icon-sober"><FaCalendarAlt /></span>
              <div className="pill-content">
                <span className="pill-label">FECHA INVENTARIO</span>
                <Form.Control 
                  type="date" 
                  value={selectedDate} 
                  onChange={(e) => setSelectedDate(e.target.value)} 
                  className="pill-date-input-v2"
                />
              </div>
            </div>
          </Col>
        </Row>

        {totals.productsCounted === 0 && (
          <Alert variant="warning" className="py-2 px-3 border-0 shadow-sm mb-3 mx-1 d-flex align-items-center">
            <FaExclamationTriangle className="me-2" />
            <small className="fw-bold">Conteo de almacén pendiente para {selectedDate}.</small>
          </Alert>
        )}

        {/* Tabla con Altura Adaptable */}
        <div className="flex-grow-1 overflow-auto custom-scrollbar border rounded shadow-sm bg-card-custom mx-1">
          <GenericTable 
            data={dashboardData} 
            columns={columns} 
            variant={localStorage.getItem('theme') === 'dark' ? 'dark' : ''} 
          />
        </div>
      </div>

      <style>{`
        .admin-layout-container { max-height: calc(100vh - 70px); }
        .bg-card-custom { background-color: var(--theme-background-primary); }
        .mono-font { font-family: SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }
        
        /* Estilo de pills heredado de AlmacenPage para consistencia */
        .info-pill-new { display: flex; align-items: center; background-color: var(--theme-background-secondary); border: 1px solid var(--theme-border-default); overflow: hidden; border-radius: 4px; }
        .pill-icon { padding: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.1rem; }
        .pill-icon-sober { background-color: #000; color: rgba(255,255,255,0.7); border-right: 1px solid var(--theme-border-default); }
        .pill-icon-sober.highlight-system { color: var(--color-red-primary); }
        
        .pill-content { padding: 4px 12px; display: flex; flex-direction: column; justify-content: center; }
        .pill-label { font-size: 0.6rem; font-weight: 800; opacity: 0.6; text-uppercase: uppercase; }
        .pill-value { color: var(--theme-text-primary); font-family: 'Inter', sans-serif; }

        /* Estilo específico para el input de fecha en Dashboard */
        .pill-date-input-v2 { 
          background: transparent !important; 
          border: none !important; 
          color: var(--theme-text-primary) !important; 
          font-weight: 700 !important; 
          font-size: 0.85rem !important; 
          padding: 0 !important; 
          height: auto !important; 
          cursor: pointer;
          font-family: 'Inter', sans-serif;
        }
        .pill-date-input-v2::-webkit-calendar-picker-indicator {
          filter: invert(1) brightness(100%);
          cursor: pointer;
        }

        /* Mejora visual de la tabla */
        .table thead th { 
          background-color: var(--theme-background-secondary); 
          font-size: 0.65rem; 
          letter-spacing: 0.05rem; 
          border-bottom: 2px solid var(--theme-border-default);
          color: var(--theme-text-primary);
          padding: 10px 15px;
        }
        .table tbody td { 
          vertical-align: middle; 
          padding: 10px 15px;
          border-bottom: 1px solid var(--theme-border-default);
        }
      `}</style>
    </div>
  );
};

export default Dashboard;

