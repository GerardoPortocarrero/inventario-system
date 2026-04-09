import type { FC } from 'react';
import { useState, useEffect, useMemo } from 'react';
import { Row, Col, Form } from 'react-bootstrap';
import { db } from '../api/firebase';
import { collection, onSnapshot, doc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { SPINNER_VARIANTS } from '../constants';
import GlobalSpinner from '../components/GlobalSpinner';
import { FaGlassMartiniAlt, FaCalendarAlt, FaWarehouse } from 'react-icons/fa';
import SearchInput from '../components/SearchInput';
import { matchSearchTerms } from '../utils/searchUtils';

interface Product {
  id: string;
  nombre: string;
  sap: string;
  unidades: number;
  tipoBebidaId: string;
  precio: number;
  stockDisponible?: number;
}

interface InventoryEntry {
  almacen: number;
  consignacion: number;
}

const StockPage: FC = () => {
  const { userSedeId } = useAuth();
  const { beverageTypes, loadingMasterData } = useData();
  
  const [products, setProducts] = useState<Product[]>([]);
  const [dailyInventory, setDailyInventory] = useState<Record<string, InventoryEntry>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBeverageType, setSelectedBeverageType] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    const unsubProducts = onSnapshot(collection(db, 'productos'), (s) => {
      setProducts(s.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
    });
    return () => unsubProducts();
  }, []);

  useEffect(() => {
    if (!userSedeId) return;
    setLoading(true);
    const unsubInventory = onSnapshot(doc(db, 'inventario_diario', `${userSedeId}_${selectedDate}`), (s) => {
      setDailyInventory(s.exists() ? s.data().productos || {} : {});
      setLoading(false);
    }, () => setLoading(false));
    return () => unsubInventory();
  }, [userSedeId, selectedDate]);

  const processedData = useMemo(() => {
    return products.map(p => {
      const inv = dailyInventory[p.id] || { almacen: 0, consignacion: 0 };
      const stockDisponible = (inv.almacen || 0) + (inv.consignacion || 0);
      return { ...p, stockDisponible };
    });
  }, [products, dailyInventory]);

  const filteredProducts = useMemo(() => {
    return processedData.filter(p => {
      const hasStock = (p.stockDisponible || 0) > 0;
      const matchesType = selectedBeverageType === '' || p.tipoBebidaId === selectedBeverageType;
      if (!hasStock || !matchesType) return false;
      return matchSearchTerms(p, searchTerm, ['nombre', 'sap']);
    }).sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [processedData, searchTerm, selectedBeverageType]);

  const formatQty = (totalUnits: number, unitsPerBox: number) => {
    const boxes = Math.floor(totalUnits / unitsPerBox);
    const units = totalUnits % unitsPerBox;
    return `${boxes}-${units}`;
  };

  if (loadingMasterData) return <GlobalSpinner variant={SPINNER_VARIANTS.OVERLAY} />;

  return (
    <div className="admin-layout-container flex-column overflow-hidden">
      <div className="admin-section-table d-flex flex-column h-100 overflow-hidden">
        
        <Row className="g-2 mb-3 px-1">
          <Col xs={12} md={4}>
            <div className="info-pill-new w-100">
              <span className="pill-icon pill-icon-sober highlight-system"><FaWarehouse /></span>
              <div className="pill-content">
                <span className="pill-label">ESTADO DE STOCK</span>
                <span className="pill-value h6 mb-0">CONSULTA EN TIEMPO REAL</span>
              </div>
            </div>
          </Col>
          <Col xs={6} md={4}>
            <div className="info-pill-new w-100">
              <span className="pill-icon pill-icon-sober"><FaCalendarAlt /></span>
              <div className="pill-content">
                <span className="pill-label">FECHA CONSULTA</span>
                <Form.Control type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="pill-date-input-v2" />
              </div>
            </div>
          </Col>
          <Col xs={6} md={4}>
            <div className="info-pill-new w-100">
              <span className="pill-icon pill-icon-sober"><FaGlassMartiniAlt /></span>
              <div className="pill-content w-100">
                <span className="pill-label">TIPO BEBIDA</span>
                <Form.Select value={selectedBeverageType} onChange={(e) => setSelectedBeverageType(e.target.value)} className="pill-select-v2">
                  <option value="">TODOS</option>
                  {beverageTypes.map(t => <option key={t.id} value={t.id}>{t.nombre.toUpperCase()}</option>)}
                </Form.Select>
              </div>
            </div>
          </Col>
        </Row>

        <div className="flex-grow-1 overflow-auto pe-1 custom-scrollbar">
          {loading ? (
            <GlobalSpinner variant={SPINNER_VARIANTS.IN_PAGE} />
          ) : (
            <>
              <div className="mb-3 px-1">
                <SearchInput searchTerm={searchTerm} onSearchChange={setSearchTerm} placeholder="Buscar por nombre o SAP..." />
              </div>
              
              <Row className="g-3 m-0">
                {beverageTypes.map(type => {
                  const typeProducts = filteredProducts.filter(p => p.tipoBebidaId === type.id);
                  if (typeProducts.length === 0) return null;
                  return (
                    <Col key={type.id} xs={12} md={6} lg={4} className="p-1">
                      <div className="dash-top-card">
                        <div className="dash-top-header text-uppercase">
                          <FaGlassMartiniAlt className="me-2" /> {type.nombre}
                        </div>
                        {typeProducts.map((p, idx) => (
                          <div key={p.id} className="dash-top-item">
                            <span className="dash-top-idx">{idx + 1}</span>
                            <div className="dash-top-info">
                              <div className="dash-top-name">{p.nombre}</div>
                              <div className="dash-top-sap">{p.sap}</div>
                            </div>
                            <div className={`dash-top-val ${(p.stockDisponible || 0) <= 0 ? 'text-danger' : 'text-success'}`}>
                              {formatQty(p.stockDisponible || 0, p.unidades)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </Col>
                  );
                })}
              </Row>
            </>
          )}
        </div>
      </div>

      <style>{`
        .info-pill-new { display: flex; align-items: center; background-color: var(--theme-background-secondary); border: 1px solid var(--theme-border-default); overflow: hidden; border-radius: 4px; height: 100%; }
        .pill-icon-sober { background-color: var(--theme-icon-bg); color: var(--theme-icon-color); padding: 12px; border-right: 1px solid var(--theme-border-default); height: 100%; display: flex; align-items: center; }
        .pill-icon-sober.highlight-system { color: var(--color-red-primary); }
        .pill-content { padding: 4px 12px; display: flex; flex-direction: column; justify-content: center; }
        .pill-label { font-size: 0.55rem; font-weight: 800; opacity: 0.6; text-uppercase: uppercase; color: var(--theme-text-primary); }
        .pill-value { color: var(--theme-text-primary); font-family: 'Inter', sans-serif; font-weight: bold; }
        .pill-date-input-v2 { 
          background: transparent !important; border: none !important; color: var(--theme-text-primary) !important; 
          font-weight: 700 !important; font-size: 0.85rem !important; padding: 0 !important; height: auto !important; cursor: pointer;
          width: 100% !important;
        }
        .pill-date-input-v2::-webkit-calendar-picker-indicator { 
          filter: invert(var(--theme-calendar-invert, 1)); 
          cursor: pointer;
          transform: scale(1.5);
          margin-left: 10px;
        }
        .pill-select-v2 { background: transparent !important; border: none !important; color: var(--theme-text-primary) !important; font-weight: 700; font-size: 0.75rem !important; cursor: pointer; text-transform: uppercase; padding: 0 !important; width: 100% !important; }
        .dash-top-card { background: var(--theme-background-secondary); border: 1px solid var(--theme-border-default); height: 100%; }
        .dash-top-header { padding: 12px; background: var(--theme-icon-bg); font-size: 0.7rem; font-weight: 900; border-bottom: 1px solid var(--theme-border-default); color: var(--theme-text-secondary); display: flex; align-items: center; }
        .dash-top-item { display: flex; align-items: center; padding: 10px 15px; border-bottom: 1px solid var(--theme-table-border-color); }
        .dash-top-idx { width: 25px; font-weight: 900; color: var(--color-red-primary); font-size: 0.75rem; }
        .dash-top-info { flex: 1; min-width: 0; }
        .dash-top-name { font-size: 0.75rem; font-weight: bold; color: var(--theme-text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .dash-top-sap { font-size: 0.6rem; color: var(--theme-text-secondary); }
        .dash-top-val { font-weight: 900; font-size: 0.85rem; }
      `}</style>
    </div>
  );
};

export default StockPage;
