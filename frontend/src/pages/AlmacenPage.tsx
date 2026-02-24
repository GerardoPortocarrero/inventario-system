import type { FC } from 'react';
import { useState, useEffect, useMemo } from 'react';
import { Container, Table, Form, Button, Alert, Row, Col, Badge, Card } from 'react-bootstrap';
import { db } from '../api/firebase';
import { collection, onSnapshot, query, where, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { UI_TEXTS, SPINNER_VARIANTS } from '../constants';
import GlobalSpinner from '../components/GlobalSpinner';
import SearchInput from '../components/SearchInput';
import GenericFilter from '../components/GenericFilter';
import useMediaQuery from '../hooks/useMediaQuery';
import { FaSave, FaBox, FaTruckLoading, FaUndo, FaCheckCircle } from 'react-icons/fa';

interface Product {
  id: string;
  nombre: string;
  sap: string;
  tipoBebidaId: string;
}

interface InventoryEntry {
  almacen: number;
  consignacion: number;
  rechazo: number;
  ultimaActualizacion?: any;
}

const AlmacenPage: FC = () => {
  const { userSedeId, userName } = useAuth();
  const { beverageTypes, sedes, loadingMasterData } = useData();
  const isDarkMode = localStorage.getItem('theme') === 'dark' || localStorage.getItem('theme') === null;
  const isMobile = useMediaQuery('(max-width: 768px)');

  const [products, setProducts] = useState<Product[]>([]);
  const [inventory, setInventory] = useState<Record<string, InventoryEntry>>({});
  const [draftInventory, setDraftInventory] = useState<Record<string, InventoryEntry>>({});
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'danger', text: string } | null>(null);

  // Obtener el nombre de la sede actual
  const currentSedeName = useMemo(() => {
    return sedes.find(s => s.id === userSedeId)?.nombre || userSedeId;
  }, [sedes, userSedeId]);

  useEffect(() => {
    if (!userSedeId) return;

    const unsubProducts = onSnapshot(collection(db, 'productos'), (s) => {
      setProducts(s.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
    });

    const qInventory = query(collection(db, 'inventario'), where('sedeId', '==', userSedeId));
    const unsubInventory = onSnapshot(qInventory, (s) => {
      const invMap: Record<string, InventoryEntry> = {};
      s.docs.forEach(d => {
        const data = d.data();
        invMap[data.productoId] = {
          almacen: data.almacen || 0,
          consignacion: data.consignacion || 0,
          rechazo: data.rechazo || 0,
          ultimaActualizacion: data.ultimaActualizacion
        };
      });
      setInventory(invMap);
      setDraftInventory(prev => {
        const newDraft = { ...prev };
        Object.keys(invMap).forEach(prodId => {
          if (!newDraft[prodId]) {
            newDraft[prodId] = { ...invMap[prodId] };
          }
        });
        return newDraft;
      });
      setLoading(false);
    });

    return () => {
      unsubProducts();
      unsubInventory();
    };
  }, [userSedeId]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           (p.sap && p.sap.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesType = !selectedType || p.tipoBebidaId === selectedType;
      return matchesSearch && matchesType;
    });
  }, [products, searchTerm, selectedType]);

  const handleInputChange = (productId: string, field: keyof InventoryEntry, value: string) => {
    const numValue = value === '' ? 0 : Math.max(0, parseInt(value));
    setDraftInventory(prev => ({
      ...prev,
      [productId]: {
        ...(prev[productId] || { almacen: 0, consignacion: 0, rechazo: 0 }),
        [field]: numValue
      }
    }));
  };

  const handleSave = async () => {
    if (!userSedeId) return;
    setIsSaving(true);
    setMessage(null);

    try {
      const promises = Object.entries(draftInventory).map(([productId, data]) => {
        const docId = `${userSedeId}_${productId}`;
        return setDoc(doc(db, 'inventario', docId), {
          ...data,
          productoId,
          sedeId: userSedeId,
          ultimaActualizacion: serverTimestamp(),
          actualizadoPor: userName
        }, { merge: true });
      });

      await Promise.all(promises);
      setMessage({ type: 'success', text: UI_TEXTS.INVENTORY_UPDATED_SUCCESS });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error(error);
      setMessage({ type: 'danger', text: UI_TEXTS.ERROR_INVENTORY_UPDATE });
    } finally {
      setIsSaving(false);
    }
  };

  if (loading || loadingMasterData) return <GlobalSpinner variant={SPINNER_VARIANTS.OVERLAY} />;

  const getProductTypeLabel = (typeId: string) => beverageTypes.find(t => t.id === typeId)?.nombre || '';

  return (
    <Container fluid className="pb-5">
      {/* Header Corregido */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center mb-4 gap-3">
        <div>
          <h2 className="mb-1 fw-bold">{UI_TEXTS.INVENTORY_CONTROL}</h2>
          <div className="d-flex align-items-center gap-2">
            <Badge bg="primary" className="px-3 py-2">
              <span className="opacity-75 me-1">Sede:</span> {currentSedeName}
            </Badge>
            <Badge bg="dark" className="px-3 py-2">
              <span className="opacity-75 me-1">Usuario:</span> {userName}
            </Badge>
          </div>
        </div>
        <Button 
          variant="success" 
          size="lg"
          onClick={handleSave} 
          disabled={isSaving}
          className="shadow-sm d-flex align-items-center gap-2 px-4"
        >
          {isSaving ? UI_TEXTS.LOADING : <><FaSave /> {UI_TEXTS.SAVE_INVENTORY}</>}
        </Button>
      </div>

      {message && (
        <Alert variant={message.type} className="shadow-sm border-0 mb-4 animate__animated animate__fadeIn">
          {message.type === 'success' ? <FaCheckCircle className="me-2" /> : null}
          {message.text}
        </Alert>
      )}

      {/* Buscador y Filtros */}
      <Card className="border-0 shadow-sm mb-4">
        <Card.Body className="p-3">
          <Row className="g-3">
            <Col md={8}>
              <SearchInput 
                searchTerm={searchTerm} 
                onSearchChange={setSearchTerm} 
                placeholder={UI_TEXTS.PLACEHOLDER_SEARCH_PRODUCTS} 
                className="mb-0"
              />
            </Col>
            <Col md={4}>
              <GenericFilter
                prefix="Categoría"
                value={selectedType}
                onChange={setSelectedType}
                options={beverageTypes.map(t => ({ value: t.id, label: t.nombre }))}
                className="mb-0"
              />
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Vista de Escritorio (Tabla) */}
      {!isMobile && (
        <Card className="border-0 shadow-sm overflow-hidden">
          <Table hover responsive variant={isDarkMode ? 'dark' : 'light'} className="mb-0">
            <thead className="bg-primary text-white border-0">
              <tr>
                <th className="py-3 ps-4">{UI_TEXTS.TABLE_HEADER_NAME}</th>
                <th className="py-3 text-center">{UI_TEXTS.TABLE_HEADER_ALMACEN}</th>
                <th className="py-3 text-center">{UI_TEXTS.TABLE_HEADER_CONSIGNACION}</th>
                <th className="py-3 text-center">{UI_TEXTS.TABLE_HEADER_RECHAZO}</th>
                <th className="py-3 text-center pe-4">{UI_TEXTS.LAST_UPDATE}</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map(product => {
                const item = draftInventory[product.id] || { almacen: 0, consignacion: 0, rechazo: 0 };
                const originalItem = inventory[product.id];
                const hasChanged = originalItem && (
                  item.almacen !== originalItem.almacen || 
                  item.consignacion !== originalItem.consignacion || 
                  item.rechazo !== originalItem.rechazo
                );

                return (
                  <tr key={product.id} className={hasChanged ? 'table-warning-light' : ''}>
                    <td className="ps-4 py-3">
                      <div className="fw-bold text-primary">{product.nombre}</div>
                      <div className="d-flex gap-2 align-items-center">
                        <small className="text-muted">SAP: {product.sap}</small>
                        <Badge bg="secondary" pill style={{ fontSize: '0.65rem' }}>{getProductTypeLabel(product.tipoBebidaId)}</Badge>
                      </div>
                    </td>
                    <td className="py-3">
                      <Form.Control 
                        type="number" 
                        className="mx-auto text-center fw-bold border-2"
                        style={{ width: '100px' }}
                        value={item.almacen}
                        onChange={(e) => handleInputChange(product.id, 'almacen', e.target.value)}
                      />
                    </td>
                    <td className="py-3">
                      <Form.Control 
                        type="number" 
                        className="mx-auto text-center fw-bold border-2"
                        style={{ width: '100px' }}
                        value={item.consignacion}
                        onChange={(e) => handleInputChange(product.id, 'consignacion', e.target.value)}
                      />
                    </td>
                    <td className="py-3">
                      <Form.Control 
                        type="number" 
                        className="mx-auto text-center fw-bold border-2"
                        style={{ width: '100px' }}
                        value={item.rechazo}
                        onChange={(e) => handleInputChange(product.id, 'rechazo', e.target.value)}
                      />
                    </td>
                    <td className="text-center py-3 pe-4 text-muted">
                      <small>
                        {originalItem?.ultimaActualizacion 
                          ? new Date(originalItem.ultimaActualizacion.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
                          : '-'}
                      </small>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Card>
      )}

      {/* Vista Móvil (Cards) */}
      {isMobile && (
        <div className="d-flex flex-column gap-3">
          {filteredProducts.map(product => {
            const item = draftInventory[product.id] || { almacen: 0, consignacion: 0, rechazo: 0 };
            return (
              <Card key={product.id} className="border-0 shadow-sm overflow-hidden">
                <div className="bg-primary-subtle p-2 px-3 border-bottom d-flex justify-content-between align-items-center">
                  <span className="fw-bold text-primary">{product.nombre}</span>
                  <Badge bg="secondary">{product.sap}</Badge>
                </div>
                <Card.Body className="p-3">
                  <Row className="g-2">
                    <Col xs={4}>
                      <div className="text-center">
                        <small className="text-muted d-block mb-1"><FaBox className="me-1" /> Almacén</small>
                        <Form.Control 
                          type="number" 
                          size="sm"
                          className="text-center fw-bold"
                          value={item.almacen}
                          onChange={(e) => handleInputChange(product.id, 'almacen', e.target.value)}
                        />
                      </div>
                    </Col>
                    <Col xs={4}>
                      <div className="text-center">
                        <small className="text-muted d-block mb-1"><FaTruckLoading className="me-1" /> Consig.</small>
                        <Form.Control 
                          type="number" 
                          size="sm"
                          className="text-center fw-bold"
                          value={item.consignacion}
                          onChange={(e) => handleInputChange(product.id, 'consignacion', e.target.value)}
                        />
                      </div>
                    </Col>
                    <Col xs={4}>
                      <div className="text-center">
                        <small className="text-muted d-block mb-1"><FaUndo className="me-1" /> Rechazo</small>
                        <Form.Control 
                          type="number" 
                          size="sm"
                          className="text-center fw-bold"
                          value={item.rechazo}
                          onChange={(e) => handleInputChange(product.id, 'rechazo', e.target.value)}
                        />
                      </div>
                    </Col>
                  </Row>
                </Card.Body>
              </Card>
            );
          })}
        </div>
      )}

      {filteredProducts.length === 0 && (
        <div className="text-center py-5">
          <p className="text-muted">{UI_TEXTS.NO_RECORDS_FOUND}</p>
        </div>
      )}
    </Container>
  );
};

export default AlmacenPage;
