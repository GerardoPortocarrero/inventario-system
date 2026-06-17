import type { FC } from 'react';
import { memo, Fragment } from 'react';
import { Badge, Table, Button, Form } from 'react-bootstrap';
import { FaStar, FaMapMarkerAlt, FaChevronRight, FaCheck, FaTimes } from 'react-icons/fa';

interface CoberturaTabProps {
  marcas: any[];
  selectedMarcasCobertura: string[];
  setSelectedMarcasCobertura: React.Dispatch<React.SetStateAction<string[]>>;
  matrixCoberturaData: { rutas: string[]; data: any };
  expandedCoberturaRutas: Record<string, boolean>;
  setExpandedCoberturaRutas: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  selectedDia: string;
  setSelectedDia: (dia: string) => void;
  selectedSubCanal: string;
  setSelectedSubCanal: (sc: string) => void;
  availableSubCanales: string[];
}

const CoberturaTab: FC<CoberturaTabProps> = memo(({ 
  marcas, selectedMarcasCobertura, setSelectedMarcasCobertura, 
  matrixCoberturaData, expandedCoberturaRutas, setExpandedCoberturaRutas,
  selectedDia, setSelectedDia, selectedSubCanal, setSelectedSubCanal, availableSubCanales
}) => {
  return (
    <div className="d-flex flex-column gap-3 h-100">
      <div className="admin-border-industrial p-3 flex-shrink-0" style={{ backgroundColor: 'var(--theme-background-secondary)', borderLeft: '4px solid var(--color-red-primary)' }}>
        <div className="d-flex align-items-center gap-3 flex-wrap">
          {/* FILTRO DIA */}
          <div className="d-flex align-items-center gap-2 p-1" style={{ borderRadius: '4px', backgroundColor: 'var(--theme-background-tertiary)', minWidth: '130px' }}>
            <span className="text-danger ms-2 fw-black" style={{ fontSize: '0.7rem' }}>DÍA:</span>
            <Form.Select 
              value={selectedDia} 
              onChange={(e) => setSelectedDia(e.target.value)} 
              className="bg-transparent border-0 small fw-black px-2 py-0 shadow-none text-uppercase" 
              style={{ outline: 'none', fontSize: '0.75rem', cursor: 'pointer', color: 'var(--theme-text-primary)' }}
            >
              <option value="ALL">TODOS</option>
              {['LU', 'MA', 'MI', 'JU', 'VI', 'SA', 'DO'].map(d => <option key={d} value={d}>{d}</option>)}
            </Form.Select>
          </div>

          {/* FILTRO SUBCANAL */}
          <div className="d-flex align-items-center gap-2 p-1" style={{ borderRadius: '4px', backgroundColor: 'var(--theme-background-tertiary)', minWidth: '180px' }}>
            <span className="text-danger ms-2 fw-black" style={{ fontSize: '0.7rem' }}>CANAL:</span>
            <Form.Select 
              value={selectedSubCanal} 
              onChange={(e) => setSelectedSubCanal(e.target.value)} 
              className="bg-transparent border-0 small fw-black px-2 py-0 shadow-none text-uppercase" 
              style={{ outline: 'none', fontSize: '0.75rem', cursor: 'pointer', color: 'var(--theme-text-primary)' }}
            >
              <option value="ALL">TODOS</option>
              {availableSubCanales.map(sc => <option key={sc} value={sc}>{sc}</option>)}
            </Form.Select>
          </div>

          <div className="d-flex align-items-center gap-2 p-1" style={{ borderRadius: '4px', backgroundColor: 'var(--theme-background-tertiary)', minWidth: '220px' }}>
            <FaStar className="text-warning ms-2" size={14} />
            <Form.Select 
              value="" 
              onChange={(e) => {
                const val = e.target.value;
                if (val && !selectedMarcasCobertura.includes(val)) {
                  setSelectedMarcasCobertura(prev => [...prev, val]);
                }
              }} 
              className="bg-transparent border-0 small fw-black px-2 py-0 shadow-none text-uppercase" 
              style={{ outline: 'none', fontSize: '0.8rem', cursor: 'pointer', color: 'var(--theme-text-primary)' }}
            >
              <option value="" style={{ backgroundColor: 'var(--theme-background-tertiary)' }}>+ AGREGAR MARCA</option>
              {marcas
                .filter(m => !selectedMarcasCobertura.includes(m.id))
                .sort((a,b) => a.nombre.localeCompare(b.nombre))
                .map(m => (
                  <option key={m.id} value={m.id} style={{ backgroundColor: 'var(--theme-background-tertiary)' }}>{m.nombre.toUpperCase()}</option>
                ))
              }
            </Form.Select>
          </div>

          {selectedMarcasCobertura.length > 0 && (
            <div className="d-flex flex-wrap gap-2">
              {selectedMarcasCobertura.map(marcaId => {
                const marca = marcas.find(m => m.id === marcaId);
                return (
                  <Badge key={marcaId} bg="danger" className="d-flex align-items-center gap-2 px-3 py-2 fw-black text-uppercase border-0" style={{ fontSize: '0.65rem', borderRadius: '2px' }}>
                    {marca?.nombre || 'MARCA'}
                    <span style={{ cursor: 'pointer', opacity: 0.7 }} onClick={() => setSelectedMarcasCobertura(prev => prev.filter(id => id !== marcaId))}>✕</span>
                  </Badge>
                );
              })}
              <Button variant="link" className="text-secondary small fw-black p-0 ms-2 text-decoration-none" onClick={() => setSelectedMarcasCobertura([])} style={{ fontSize: '0.65rem' }}>LIMPIAR</Button>
            </div>
          )}
        </div>
      </div>

      {selectedMarcasCobertura.length > 0 ? (
        <div className="admin-border-industrial flex-grow-1 overflow-auto custom-scrollbar position-relative" style={{ backgroundColor: 'var(--theme-background-secondary)' }}>
          <Table hover className="mb-0 industrial-table-v2 matrix-table" style={{ borderCollapse: 'separate', borderSpacing: 0, minWidth: 'max-content' }}>
            <thead style={{ backgroundColor: 'var(--theme-background-tertiary)' }} className="sticky-top">
              <tr>
                <th rowSpan={2} className="align-middle text-center ps-4 sticky-column" style={{ width: '180px', minWidth: '180px', fontSize: '0.65rem', backgroundColor: 'var(--theme-background-tertiary)', zIndex: 11 }}>ID RUTA</th>
                {selectedMarcasCobertura.map(mId => {
                  const marca = marcas.find(m => m.id === mId);
                  return (
                    <th key={mId} colSpan={2} className="text-center text-uppercase fw-black text-white py-2 brand-header-cell brand-separator" style={{ fontSize: '0.7rem', letterSpacing: '1px', backgroundColor: 'var(--color-red-primary)' }}>
                      {marca?.nombre || 'MARCA'}
                    </th>
                  );
                })}
              </tr>
              <tr style={{ backgroundColor: 'var(--theme-background-tertiary)' }}>
                {selectedMarcasCobertura.map((mId) => {
                  return (
                    <Fragment key={`sub-${mId}`}>
                      <th className="text-center small fw-black py-1" style={{ fontSize: '0.55rem', backgroundColor: 'var(--theme-background-tertiary)', color: 'var(--theme-text-secondary)' }}>CF / CU</th>
                      <th className="text-center small fw-black py-1 brand-separator" style={{ fontSize: '0.55rem', backgroundColor: 'var(--theme-background-tertiary)', color: 'var(--theme-text-secondary)' }}>CLI</th>
                    </Fragment>
                  );
                })}
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
                      {selectedMarcasCobertura.map((mId) => {
                        const vals = routeData?.total[mId] || { cf: 0, cu: 0, cliConVenta: 0 };
                        const hasData = vals.cf > 0 || vals.cu > 0;
                        return (
                          <Fragment key={`${rutaId}-${mId}`}>
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
                              {selectedMarcasCobertura.map((mId) => {
                                const vals = client.marcas[mId] || { cf: 0, cu: 0 };
                                const hasData = vals.cf > 0 || vals.cu > 0;
                                
                                return (
                                  <Fragment key={`${rutaId}-${clientId}-${mId}`}>
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
            Seleccione las marcas en el panel superior para activar el comparativo transaccional por rutas. 
            El sistema generará automáticamente un desglose volumétrico de alta precisión.
          </p>
        </div>
      )}

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
        /* Bordes horizontales estándar */
        .matrix-table thead th {
          border-bottom: 1px solid var(--theme-border-default) !important;
        }
        .matrix-table tbody td {
          border-bottom: 1px solid var(--theme-table-border-color) !important;
        }
        /* Separadores verticales alineados al estilo de la plataforma */
        .matrix-table thead th.brand-separator {
          border-right: 1px solid var(--theme-border-default) !important;
        }
        .matrix-table tbody td.brand-separator {
          border-right: 1px solid var(--theme-table-border-color) !important;
        }
        .matrix-table tbody td.sticky-column {
          border-right: 1px solid var(--theme-table-border-color) !important;
        }
        
        /* Forzar visibilidad del scrollbar horizontal debajo de la cabecera */
        .admin-border-industrial {
          overflow-x: auto !important;
          overflow-y: auto !important;
        }
      `}</style>
    </div>
  );
});

export default CoberturaTab;
