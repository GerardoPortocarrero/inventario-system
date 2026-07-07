import type { FC } from 'react';
import { memo, Fragment, useState, useEffect, useMemo } from 'react';
import { Badge, Table, Button, Form, Modal } from 'react-bootstrap';
import { FaMapMarkerAlt, FaChevronRight, FaCheck, FaTimes, FaFilter } from 'react-icons/fa';

interface CoberturaTabProps {
  marcas: any[];
  beverageTypes: any[];
  selectedMarcasCobertura: string[];
  setSelectedMarcasCobertura: React.Dispatch<React.SetStateAction<string[]>>;
  matrixCoberturaData: { rutas: string[]; data: any };
  expandedCoberturaRutas: Record<string, boolean>;
  setExpandedCoberturaRutas: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  selectedDia: string;
  setSelectedDia: (dia: string) => void;
  selectedSubCanal: string;
  setSelectedSubCanal: (sc: string) => void;
  selectedTipoCobertura: string;
  setSelectedTipoCobertura: (tipo: string) => void;
  availableSubCanales: string[];
}

const CoberturaTab: FC<CoberturaTabProps> = memo(({ 
  marcas, beverageTypes, selectedMarcasCobertura, setSelectedMarcasCobertura, 
  matrixCoberturaData, expandedCoberturaRutas, setExpandedCoberturaRutas,
  selectedDia, setSelectedDia, selectedSubCanal, setSelectedSubCanal,
  selectedTipoCobertura, setSelectedTipoCobertura, availableSubCanales
}) => {
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [tempDia, setTempDia] = useState(selectedDia);
  const [tempSubCanal, setTempSubCanal] = useState(selectedSubCanal);
  const [tempTipoBebida, setTempTipoBebida] = useState(selectedTipoCobertura);
  const [tempMarcas, setTempMarcas] = useState<string[]>(selectedMarcasCobertura);

  useEffect(() => {
    if (showFilterModal) {
      setTempDia(selectedDia);
      setTempSubCanal(selectedSubCanal);
      setTempTipoBebida(selectedTipoCobertura);
      setTempMarcas(selectedMarcasCobertura);
    }
  }, [showFilterModal, selectedDia, selectedSubCanal, selectedTipoCobertura, selectedMarcasCobertura]);

  const handleTipoBebidaChange = (tipoId: string) => {
    setTempTipoBebida(tipoId);
    if (tipoId === 'ALL') {
      setTempMarcas(marcas.map(m => m.id));
    } else {
      setTempMarcas(
        marcas.filter(m => m.tipoBebidaId === tipoId).map(m => m.id)
      );
    }
  };

  const handleToggleMarca = (marcaId: string) => {
    setTempMarcas(prev =>
      prev.includes(marcaId)
        ? prev.filter(id => id !== marcaId)
        : [...prev, marcaId]
    );
  };

  const handleApply = () => {
    setSelectedDia(tempDia);
    setSelectedSubCanal(tempSubCanal);
    setSelectedTipoCobertura(tempTipoBebida);
    setSelectedMarcasCobertura(tempMarcas);
    setShowFilterModal(false);
  };

  const handleCancel = () => {
    setShowFilterModal(false);
  };

  // Agrupar marcas seleccionadas por tipo de bebida
  const brandGroups = useMemo(() => {
    const groups = new Map<string, string[]>();
    selectedMarcasCobertura.forEach(mId => {
      const marca = marcas.find(m => m.id === mId);
      if (!marca) return;
      const tipoId = marca.tipoBebidaId || '__none__';
      if (!groups.has(tipoId)) groups.set(tipoId, []);
      groups.get(tipoId)!.push(mId);
    });
    return groups;
  }, [selectedMarcasCobertura, marcas]);

  const typeColumnHeaders = useMemo(() => {
    return Array.from(brandGroups.entries()).map(([tipoId, brandIds]) => {
      const typeName = beverageTypes.find(t => t.id === tipoId)?.nombre || tipoId;
      return { tipoId, typeName, brandIds };
    });
  }, [brandGroups, beverageTypes]);

  const activeFilterCount = [
    selectedDia !== 'ALL' && 1,
    selectedSubCanal !== 'ALL' && 1,
    selectedTipoCobertura !== 'ALL' && 1
  ].filter(Boolean).length;

  const filteredMarcas = tempTipoBebida === 'ALL'
    ? marcas
    : marcas.filter(m => m.tipoBebidaId === tempTipoBebida);

  const selectedTipoNombre = selectedTipoCobertura === 'ALL'
    ? 'TODOS LOS TIPOS'
    : (beverageTypes.find(t => t.id === selectedTipoCobertura)?.nombre?.toUpperCase() || 'TIPO');

  return (
    <div className="d-flex flex-column gap-3 h-100">
      <div className="admin-border-industrial p-3 flex-shrink-0" style={{ backgroundColor: 'var(--theme-background-secondary)', borderLeft: '4px solid var(--color-red-primary)' }}>
        <div className="d-flex align-items-center gap-3 flex-wrap">
          <Button
            variant="outline-danger"
            className="d-flex align-items-center gap-2 fw-black px-3 py-2"
            style={{ fontSize: '0.75rem', borderRadius: '2px' }}
            onClick={() => setShowFilterModal(true)}
          >
            <FaFilter size={12} />
            FILTROS
            {activeFilterCount > 0 && (
              <Badge bg="danger" className="ms-1" style={{ fontSize: '0.6rem' }}>{activeFilterCount}</Badge>
            )}
          </Button>

          <div className="d-flex align-items-center gap-2 flex-wrap">
            {selectedDia !== 'ALL' && (
              <Badge bg="dark" className="fw-black text-uppercase px-3 py-2" style={{ fontSize: '0.65rem', borderRadius: '2px' }}>
                DÍA: {selectedDia}
              </Badge>
            )}
            {selectedSubCanal !== 'ALL' && (
              <Badge bg="dark" className="fw-black text-uppercase px-3 py-2" style={{ fontSize: '0.65rem', borderRadius: '2px' }}>
                CANAL: {selectedSubCanal}
              </Badge>
            )}
            {selectedTipoCobertura !== 'ALL' && (
              <Badge bg="danger" className="fw-black text-uppercase px-3 py-2" style={{ fontSize: '0.65rem', borderRadius: '2px' }}>
                {selectedTipoNombre}
              </Badge>
            )}
            {selectedMarcasCobertura.length > 0 && (
              <Button variant="link" className="text-secondary small fw-black p-0 ms-2 text-decoration-none" onClick={() => { setSelectedMarcasCobertura([]); setSelectedTipoCobertura('ALL'); }} style={{ fontSize: '0.65rem' }}>LIMPIAR</Button>
            )}
          </div>
        </div>
      </div>

      {selectedMarcasCobertura.length > 0 && typeColumnHeaders.length > 0 ? (
        <div className="admin-border-industrial flex-grow-1 overflow-auto custom-scrollbar position-relative" style={{ backgroundColor: 'var(--theme-background-secondary)' }}>
          <Table hover className="mb-0 industrial-table-v2 matrix-table" style={{ borderCollapse: 'separate', borderSpacing: 0, minWidth: 'max-content' }}>
            <thead style={{ backgroundColor: 'var(--theme-background-tertiary)' }} className="sticky-top">
              <tr>
                <th rowSpan={2} className="align-middle text-center ps-4 sticky-column" style={{ width: '180px', minWidth: '180px', fontSize: '0.65rem', backgroundColor: 'var(--theme-background-tertiary)', zIndex: 11 }}>ID RUTA</th>
                {typeColumnHeaders.map(({ tipoId, typeName, brandIds }) => (
                  <th key={tipoId} colSpan={2} className="text-center text-uppercase fw-black text-white py-2 brand-header-cell brand-separator" style={{ fontSize: '0.7rem', letterSpacing: '1px', backgroundColor: 'var(--color-red-primary)' }}>
                    {typeName}
                    <span className="d-block text-white-50" style={{ fontSize: '0.5rem', opacity: 0.7 }}>{brandIds.length} marcas</span>
                  </th>
                ))}
              </tr>
              <tr style={{ backgroundColor: 'var(--theme-background-tertiary)' }}>
                {typeColumnHeaders.map(({ tipoId }) => (
                  <Fragment key={`sub-${tipoId}`}>
                    <th className="text-center small fw-black py-1" style={{ fontSize: '0.55rem', backgroundColor: 'var(--theme-background-tertiary)', color: 'var(--theme-text-secondary)' }}>CF / CU</th>
                    <th className="text-center small fw-black py-1 brand-separator" style={{ fontSize: '0.55rem', backgroundColor: 'var(--theme-background-tertiary)', color: 'var(--theme-text-secondary)' }}>CLI</th>
                  </Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrixCoberturaData.rutas.map(rutaId => {
                const routeData = matrixCoberturaData.data[rutaId];
                return (
                  <Fragment key={rutaId}>
                    <tr 
                      onClick={() => setExpandedCoberturaRutas(prev => ({ ...prev, [rutaId]: !prev[rutaId] }))}
                      style={{ cursor: 'pointer' }}
                      className={expandedCoberturaRutas[rutaId] ? 'bg-danger bg-opacity-10' : ''}
                    >
                      <td className="text-center align-middle py-3 sticky-column" style={{ backgroundColor: expandedCoberturaRutas[rutaId] ? 'rgba(244, 0, 9, 0.12)' : 'var(--theme-background-secondary)', zIndex: 10 }}>
                        <div className="d-flex align-items-center justify-content-center gap-2">
                          <div className={`chevron-icon ${expandedCoberturaRutas[rutaId] ? 'active' : ''}`} style={{ transition: 'transform 0.1s' }}>
                            <FaChevronRight size={12} style={{ transform: expandedCoberturaRutas[rutaId] ? 'rotate(90deg)' : 'none', color: 'var(--theme-text-primary)' }} />
                          </div>
                          <span className="fw-black fs-5 text-uppercase" style={{ letterSpacing: '1px', color: 'var(--theme-text-primary)' }}>
                            {rutaId}
                          </span>
                        </div>
                      </td>
                      {typeColumnHeaders.map(({ tipoId, brandIds }) => {
                        const vals = brandIds.reduce((acc, bId) => {
                          const b = routeData?.total[bId];
                          if (b) {
                            acc.cf += b.cf || 0;
                            acc.cu += b.cu || 0;
                            acc.cliConVenta += b.cliConVenta || 0;
                          }
                          return acc;
                        }, { cf: 0, cu: 0, cliConVenta: 0 });
                        const hasData = vals.cf > 0 || vals.cu > 0;
                        return (
                          <Fragment key={`${rutaId}-${tipoId}`}>
                            <td className={`text-center align-middle fw-black`} style={{ fontSize: '1rem', backgroundColor: hasData ? 'rgba(244, 0, 9, 0.03)' : 'transparent' }}>
                              <span className={hasData ? 'text-success' : 'text-secondary opacity-25'}>{vals.cf.toLocaleString(undefined, { maximumFractionDigits: 1 })}</span>
                              <span className="mx-2 text-secondary opacity-50">/</span>
                              <span className={hasData ? 'text-warning' : 'text-secondary opacity-25'}>{vals.cu.toLocaleString(undefined, { maximumFractionDigits: 1 })}</span>
                            </td>
                            <td className={`text-center align-middle fw-black brand-separator`} style={{ fontSize: '1rem', backgroundColor: hasData ? 'rgba(244, 0, 9, 0.03)' : 'transparent' }}>
                              <span className={hasData ? 'text-info' : 'text-secondary opacity-25'}>
                                {vals.cliConVenta} <span className="text-secondary opacity-50 mx-1">/</span> {routeData.totalClientesRuta}
                              </span>
                            </td>
                          </Fragment>
                        );
                      })}
                    </tr>
                    {expandedCoberturaRutas[rutaId] && (
                      Object.entries(routeData.clientes)
                        .sort((a: any, b: any) => a[1].nombre.localeCompare(b[1].nombre))
                        .map(([clientId, client]: [string, any]) => {
                          return (
                            <tr key={`${rutaId}-${clientId}`}>
                              <td className="ps-4 py-2 sticky-column" style={{ backgroundColor: 'var(--theme-background-primary)', zIndex: 10 }}>
                                <div className="d-flex flex-column">
                                  <div className="d-flex justify-content-between align-items-center mb-1">
                                    <span className="fw-black text-danger" style={{ fontSize: '0.65rem', opacity: 0.9 }}>RUTA: {rutaId}</span>
                                    <span className="text-secondary fw-bold" style={{ fontSize: '0.6rem' }}>ID: {clientId}</span>
                                  </div>
                                  <span 
                                    className="fw-black text-uppercase" 
                                    style={{ 
                                      fontSize: '0.9rem', 
                                      color: 'var(--theme-text-primary)',
                                      letterSpacing: '0.5px',
                                      lineHeight: '1.1'
                                    }}
                                  >
                                    {client.nombre}
                                  </span>
                                </div>
                              </td>
                              {typeColumnHeaders.map(({ tipoId, brandIds }) => {
                                const vals = brandIds.reduce((acc, bId) => {
                                  const b = client.marcas[bId];
                                  if (b) {
                                    acc.cf += b.cf || 0;
                                    acc.cu += b.cu || 0;
                                  }
                                  return acc;
                                }, { cf: 0, cu: 0 });
                                const hasData = vals.cf > 0 || vals.cu > 0;
                                
                                return (
                                  <Fragment key={`${rutaId}-${clientId}-${tipoId}`}>
                                    <td 
                                      className={`text-center align-middle fw-black`} 
                                      style={{ 
                                        fontSize: '0.95rem',
                                        backgroundColor: hasData ? 'rgba(244, 0, 9, 0.08)' : 'transparent',
                                        transition: 'background-color 0.2s'
                                      }}
                                    >
                                      <span className={hasData ? 'text-success' : 'text-secondary opacity-25'}>
                                        {vals.cf.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                                      </span>
                                      <span className="mx-2 text-secondary opacity-25">/</span>
                                      <span className={hasData ? 'text-warning' : 'text-secondary opacity-25'}>
                                        {vals.cu.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                                      </span>
                                    </td>
                                    <td 
                                      className="text-center align-middle brand-separator" 
                                      style={{ 
                                        fontSize: '0.95rem', 
                                        backgroundColor: hasData ? 'rgba(244, 0, 9, 0.08)' : 'transparent'
                                      }}
                                    >
                                      <div className={hasData ? '' : 'opacity-25'}>
                                        {hasData ? (
                                          <FaCheck className="text-success" size={18} />
                                        ) : (
                                          <FaTimes className="text-danger" size={16} />
                                        )}
                                      </div>
                                    </td>
                                  </Fragment>
                                );
                              })}
                            </tr>
                          );
                        })
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </Table>
        </div>
      ) : (
        <div className="flex-grow-1 d-flex flex-column align-items-center justify-content-center p-5" style={{ backgroundColor: 'var(--theme-background-secondary)', border: '1px solid var(--theme-border-default)', borderRadius: '4px' }}>
          <div className="p-4 rounded-circle mb-4" style={{ backgroundColor: 'var(--theme-background-tertiary)' }}>
            <FaMapMarkerAlt className="text-danger opacity-50" size={64} />
          </div>
          <h4 className="text-secondary fw-black text-uppercase mb-3" style={{ letterSpacing: '2px' }}>Matriz de Cobertura</h4>
          <p className="text-muted small fw-bold text-center" style={{ maxWidth: '400px', lineHeight: '1.6' }}>
            Seleccione un tipo de bebida en el panel superior para activar el comparativo transaccional por rutas. 
            El sistema agregará automáticamente todas las marcas del tipo seleccionado.
          </p>
        </div>
      )}

      {/* FILTER MODAL */}
      <Modal show={showFilterModal} onHide={handleCancel} centered backdrop="static">
        <Modal.Header closeButton style={{ backgroundColor: 'var(--theme-background-secondary)', borderBottom: '1px solid var(--theme-border-default)' }}>
          <Modal.Title className="fw-black text-uppercase" style={{ fontSize: '0.9rem', letterSpacing: '1px' }}>
            <FaFilter className="me-2 text-danger" size={14} />
            Filtros de Cobertura
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ backgroundColor: 'var(--theme-background-primary)' }}>
          <div className="d-flex flex-column gap-4">
            <div>
              <label className="text-danger fw-black text-uppercase mb-2" style={{ fontSize: '0.7rem', letterSpacing: '1px' }}>DÍA</label>
              <Form.Select 
                value={tempDia} 
                onChange={(e) => setTempDia(e.target.value)} 
                className="fw-black text-uppercase"
                style={{ fontSize: '0.8rem' }}
              >
                <option value="ALL">TODOS</option>
                {['LU', 'MA', 'MI', 'JU', 'VI', 'SA', 'DO'].map(d => <option key={d} value={d}>{d}</option>)}
              </Form.Select>
            </div>

            <div>
              <label className="text-danger fw-black text-uppercase mb-2" style={{ fontSize: '0.7rem', letterSpacing: '1px' }}>CANAL</label>
              <Form.Select 
                value={tempSubCanal} 
                onChange={(e) => setTempSubCanal(e.target.value)} 
                className="fw-black text-uppercase"
                style={{ fontSize: '0.8rem' }}
              >
                <option value="ALL">TODOS</option>
                {availableSubCanales.map(sc => <option key={sc} value={sc}>{sc}</option>)}
              </Form.Select>
            </div>

            <div>
              <label className="text-danger fw-black text-uppercase mb-2" style={{ fontSize: '0.7rem', letterSpacing: '1px' }}>TIPO DE BEBIDA</label>
              <Form.Select 
                value={tempTipoBebida} 
                onChange={(e) => handleTipoBebidaChange(e.target.value)} 
                className="fw-black text-uppercase"
                style={{ fontSize: '0.8rem' }}
              >
                <option value="ALL">TODOS</option>
                {beverageTypes.map(t => (
                  <option key={t.id} value={t.id}>{t.nombre.toUpperCase()}</option>
                ))}
              </Form.Select>
            </div>

            {/* MARCAS: solo se muestran cuando hay un tipo específico seleccionado */}
            {tempTipoBebida !== 'ALL' && (
            <div>
              <div className="d-flex align-items-center justify-content-between mb-2">
                <label className="text-danger fw-black text-uppercase mb-0" style={{ fontSize: '0.7rem', letterSpacing: '1px' }}>
                  MARCAS <span className="text-secondary">({tempMarcas.length} seleccionadas)</span>
                </label>
                <div className="d-flex gap-2">
                  <Button 
                    variant="link" 
                    className="text-success fw-black p-0 text-decoration-none"
                    style={{ fontSize: '0.65rem' }}
                    onClick={() => setTempMarcas(filteredMarcas.map(m => m.id))}
                  >
                    TODO
                  </Button>
                  <Button 
                    variant="link" 
                    className="text-danger fw-black p-0 text-decoration-none"
                    style={{ fontSize: '0.65rem' }}
                    onClick={() => setTempMarcas([])}
                  >
                    LIMPIAR
                  </Button>
                </div>
              </div>
              <div 
                className="d-flex flex-wrap gap-2 p-3" 
                style={{ 
                  backgroundColor: 'var(--theme-background-secondary)', 
                  border: '1px solid var(--theme-border-default)', 
                  borderRadius: '4px',
                  maxHeight: '180px',
                  overflowY: 'auto'
                }}
              >
                {filteredMarcas.length === 0 ? (
                  <span className="text-secondary fw-bold small">No hay marcas disponibles</span>
                ) : (
                  filteredMarcas
                    .sort((a, b) => a.nombre.localeCompare(b.nombre))
                    .map(m => (
                      <Form.Check 
                        key={m.id}
                        type="checkbox"
                        id={`marca-${m.id}`}
                        label={m.nombre.toUpperCase()}
                        checked={tempMarcas.includes(m.id)}
                        onChange={() => handleToggleMarca(m.id)}
                        className="fw-black text-uppercase"
                        style={{ fontSize: '0.75rem', minWidth: '140px' }}
                      />
                    ))
                )}
              </div>
            </div>
            )}
          </div>
        </Modal.Body>
        <Modal.Footer style={{ backgroundColor: 'var(--theme-background-secondary)', borderTop: '1px solid var(--theme-border-default)' }}>
          <Button 
            variant="secondary" 
            onClick={handleCancel}
            className="fw-black px-4"
            style={{ fontSize: '0.75rem', borderRadius: '2px' }}
          >
            CANCELAR
          </Button>
          <Button 
            variant="danger" 
            onClick={handleApply}
            className="fw-black px-4"
            style={{ fontSize: '0.75rem', borderRadius: '2px' }}
          >
            APLICAR
          </Button>
        </Modal.Footer>
      </Modal>

      <style>{`
        .sticky-column {
          position: sticky !important;
          left: 0;
          box-shadow: 6px 0 10px rgba(0,0,0,0.2);
          z-index: 10;
          border-right: 1px solid var(--theme-table-border-color) !important;
        }
        .matrix-table {
          border-collapse: separate !important;
        }
        .matrix-table thead th {
          border-bottom: 1px solid var(--theme-border-default) !important;
        }
        .matrix-table tbody td {
          border-bottom: 1px solid var(--theme-table-border-color) !important;
        }
        .matrix-table thead th.brand-separator {
          border-right: 1px solid var(--theme-border-default) !important;
        }
        .matrix-table tbody td.brand-separator {
          border-right: 1px solid var(--theme-table-border-color) !important;
        }
        .matrix-table tbody td.sticky-column {
          border-right: 1px solid var(--theme-table-border-color) !important;
        }
        .admin-border-industrial {
          overflow-x: auto !important;
          overflow-y: auto !important;
        }
      `}</style>
    </div>
  );
});

export default CoberturaTab;
