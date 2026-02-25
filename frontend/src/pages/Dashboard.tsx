import type { FC } from 'react';
import { useState, useEffect, useMemo } from 'react';
import { Container, Row, Col, Card, Badge, Alert, Spinner } from 'react-bootstrap';
import { db } from '../api/firebase';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { FaTruck, FaBox, FaShoppingCart, FaExclamationTriangle, FaWarehouse } from 'react-icons/fa';
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

  // Fechas para las consultas
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const yesterdayStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  }, []);

  useEffect(() => {
    if (!userSedeId) return;

    setLoading(true);

    // 1. Escuchar Productos
    const unsubProducts = onSnapshot(collection(db, 'productos'), (s) => {
      setProducts(s.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
    });

    // 2. Escuchar Inventario de Hoy
    const unsubToday = onSnapshot(doc(db, 'inventario_diario', `${userSedeId}_${todayStr}`), (s) => {
      if (s.exists()) {
        setTodayInventory(s.data().productos || {});
      } else {
        setTodayInventory({});
      }
    });

    // 3. Escuchar Inventario de Ayer
    const unsubYesterday = onSnapshot(doc(db, 'inventario_diario', `${userSedeId}_${yesterdayStr}`), (s) => {
      if (s.exists()) {
        setYesterdayInventory(s.data().productos || {});
      } else {
        setYesterdayInventory({});
      }
    });

    // 4. Escuchar Órdenes de Hoy para calcular Preventa
    // Nota: El campo fechaCreacion en Firestore debe estar en formato YYYY-MM-DD para esta consulta simple
    const q = query(
      collection(db, 'ordenes'),
      where('sedeId', '==', userSedeId),
      where('fechaCreacion', '>=', todayStr)
    );
    const unsubOrders = onSnapshot(q, (s) => {
      const preventaMap: Record<string, number> = {};
      s.docs.forEach(d => {
        const order = d.data() as Order;
        order.detalles.forEach(item => {
          preventaMap[item.productoId] = (preventaMap[item.productoId] || 0) + item.cantidad;
        });
      });
      setTodayPreventa(preventaMap);
      setLoading(false);
    });

    return () => {
      unsubProducts();
      unsubToday();
      unsubYesterday();
      unsubOrders();
    };
  }, [userSedeId, todayStr, yesterdayStr]);

  const dashboardData = useMemo(() => {
    return products.map(p => {
      const hoy = todayInventory[p.id];
      const ayer = yesterdayInventory[p.id];
      const preventa = todayPreventa[p.id] || 0;

      const totalAyer = ayer ? (ayer.almacen + ayer.consignacion + ayer.rechazo) : 0;
      
      const hasTodayCount = todayInventory.hasOwnProperty(p.id);

      // TRANSITO = Total Almacén Ayer - Conteo Almacén Hoy
      const transito = hasTodayCount ? (totalAyer - (hoy?.almacen || 0)) : null;
      
      // STOCK = (Conteo + Consignación + Rechazo) - Preventa
      const stock = hasTodayCount ? ((hoy?.almacen || 0) + (hoy?.consignacion || 0) + (hoy?.rechazo || 0) - preventa) : null;

      return {
        id: p.id,
        nombre: p.nombre,
        sap: p.sap,
        unidadesPerBox: p.unidades,
        almacen: hoy?.almacen ?? 0,
        consignacion: hoy?.consignacion ?? 0,
        rechazo: hoy?.rechazo ?? 0,
        preventa,
        transito: transito !== null ? Math.max(0, transito) : null, // Evitar negativos si hubo carga extra
        stock,
        hasTodayCount
      };
    });
  }, [products, todayInventory, yesterdayInventory, todayPreventa]);

  const totals = useMemo(() => {
    let tTransito = 0;
    let tStock = 0;
    let tPreventa = 0;
    let productsCounted = 0;

    dashboardData.forEach(d => {
      if (d.hasTodayCount) {
        tTransito += d.transito || 0;
        tStock += d.stock || 0;
        productsCounted++;
      }
      tPreventa += d.preventa;
    });

    return { tTransito, tStock, tPreventa, productsCounted, totalProducts: products.length };
  }, [dashboardData, products.length]);

  if (loading) return <GlobalSpinner variant="overlay" />;

  const isCountingPending = totals.productsCounted === 0;

  const columns: Column<any>[] = [
    { header: 'Producto', render: (d) => (
      <div>
        <div className="fw-bold">{d.nombre}</div>
        <small className="text-muted">{d.sap}</small>
      </div>
    )},
    { header: 'Alm/Con/Rec', render: (d) => (
      <small className="text-secondary">
        {d.hasTodayCount ? `${d.almacen}/${d.consignacion}/${d.rechazo}` : '---'}
      </small>
    )},
    { header: 'Preventa', render: (d) => <Badge bg="info" className="fs-6">{d.preventa}</Badge> },
    { header: 'Tránsito', render: (d) => (
      d.hasTodayCount ? (
        <Badge bg={d.transito > 0 ? "warning" : "secondary"} className="fs-6 text-dark">
          {d.transito}
        </Badge>
      ) : <Badge bg="light" text="muted" className="border">---</Badge>
    )},
    { header: 'Stock Real', render: (d) => (
      d.hasTodayCount ? (
        <Badge bg={d.stock > 0 ? "success" : "danger"} className="fs-6">
          {d.stock}
        </Badge>
      ) : <Badge bg="light" text="muted" className="border">---</Badge>
    )}
  ];

  return (
    <Container fluid className="py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="mb-0 fw-bold">Panel de Control</h2>
        <Badge bg="dark" className="p-2 px-3 fs-6">
          <FaWarehouse className="me-2" /> {todayStr}
        </Badge>
      </div>

      {isCountingPending && (
        <Alert variant="warning" className="border-0 shadow-sm d-flex align-items-center mb-4">
          <FaExclamationTriangle className="me-3 fs-4" />
          <div>
            <Alert.Heading className="mb-1 h5 fw-bold">Conteo de Almacén Pendiente</Alert.Heading>
            <p className="mb-0 small">El almacenero todavía no ha realizado el conteo del día. El Stock y Tránsito se calcularán automáticamente tras el registro físico.</p>
          </div>
        </Alert>
      )}

      <Row className="mb-4 g-3">
        <Col xs={12} md={4}>
          <Card className="border-0 shadow-sm h-100 card-stat">
            <Card.Body className="d-flex align-items-center">
              <div className="rounded-circle-icon bg-warning bg-opacity-10 p-3 me-3 text-warning">
                <FaTruck size={24} />
              </div>
              <div>
                <div className="text-muted small fw-bold text-uppercase">Tránsito Total</div>
                <div className="h3 mb-0 fw-bold">{isCountingPending ? '---' : totals.tTransito}</div>
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col xs={12} md={4}>
          <Card className="border-0 shadow-sm h-100 card-stat">
            <Card.Body className="d-flex align-items-center">
              <div className="rounded-circle-icon bg-success bg-opacity-10 p-3 me-3 text-success">
                <FaBox size={24} />
              </div>
              <div>
                <div className="text-muted small fw-bold text-uppercase">Stock Disponible</div>
                <div className="h3 mb-0 fw-bold">{isCountingPending ? '---' : totals.tStock}</div>
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col xs={12} md={4}>
          <Card className="border-0 shadow-sm h-100 card-stat">
            <Card.Body className="d-flex align-items-center">
              <div className="rounded-circle-icon bg-info bg-opacity-10 p-3 me-3 text-info">
                <FaShoppingCart size={24} />
              </div>
              <div>
                <div className="text-muted small fw-bold text-uppercase">Preventa Hoy</div>
                <div className="h3 mb-0 fw-bold">{totals.tPreventa}</div>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Card className="border-0 shadow-sm overflow-hidden mb-4">
        <Card.Header className="bg-white py-3 border-0 d-flex justify-content-between align-items-center">
          <h5 className="mb-0 fw-bold">Indicadores por Producto</h5>
          <Badge bg="secondary" className="px-3">
            {totals.productsCounted} / {totals.totalProducts} Contados
          </Badge>
        </Card.Header>
        <Card.Body className="p-0">
          <GenericTable 
            data={dashboardData} 
            columns={columns} 
            variant={localStorage.getItem('theme') === 'dark' ? 'dark' : ''} 
          />
        </Card.Body>
      </Card>

      <style>{`
        .bg-opacity-10 { --bs-bg-opacity: 0.1; }
        .rounded-circle-icon { width: 56px; height: 56px; display: flex; align-items: center; justify-content: center; border-radius: 50%; }
        .card-stat { transition: transform 0.2s; }
        .card-stat:hover { transform: translateY(-3px); }
        .badge.fs-6 { font-size: 0.9rem !important; }
      `}</style>
    </Container>
  );
};

export default Dashboard;
