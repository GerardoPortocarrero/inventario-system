import type { FC } from 'react';
import { memo, Fragment } from 'react';
import { Badge, Table, Button, Form } from 'react-bootstrap';
import { FaStar, FaMapMarkerAlt, FaChevronRight, FaUserCheck } from 'react-icons/fa';

interface CoberturaTabProps {
  marcas: any[];
  selectedMarcasCobertura: string[];
  setSelectedMarcasCobertura: React.Dispatch<React.SetStateAction<string[]>>;
  matrixCoberturaData: { rutas: string[]; data: any };
  expandedCoberturaRutas: Record<string, boolean>;
  setExpandedCoberturaRutas: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}

const CoberturaTab: FC<CoberturaTabProps> = memo(({ 
  marcas, selectedMarcasCobertura, setSelectedMarcasCobertura, 
  matrixCoberturaData, expandedCoberturaRutas, setExpandedCoberturaRutas 
}) => {
  return (
    <div className="d-flex flex-column gap-3 h-100">
      <div className="admin-border-industrial p-3 flex-shrink-0" style={{ backgroundColor: 'var(--theme-background-secondary)', borderLeft: '4px solid var(--color-red-primary)' }}>
        <div className="d-flex align-items-center gap-3 flex-wrap">
          <div className="d-flex align-items-center gap-2 p-2 border border-secondary border-opacity-25" style={{ borderRadius: '4px', backgroundColor: 'var(--theme-background-tertiary)', minWidth: '220px' }}>
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
        <div className="admin-border-industrial overflow-auto flex-grow-1" style={{ backgroundColor: 'var(--theme-background-secondary)' }}>
          <Table responsive hover bordered className="mb-0 industrial-table-v2 matrix-table h-100">
            <thead style={{ backgroundColor: 'var(--theme-background-tertiary)' }} className="sticky-top">
              <tr>
                <th rowSpan={2} className="align-middle text-center ps-4" style={{ width: '120px', fontSize: '0.65rem', backgroundColor: 'var(--theme-background-tertiary)' }}>ID RUTA</th>
                {selectedMarcasCobertura.map(mId => {
                  const marca = marcas.find(m => m.id === mId);
                  return (
                    <th key={mId} colSpan={2} className="text-center text-uppercase fw-black bg-danger text-white py-2" style={{ fontSize: '0.7rem', letterSpacing: '1px' }}>
                      {marca?.nombre || 'MARCA'}
                    </th>
                  );
                })}
              </tr>
              <tr style={{ backgroundColor: 'var(--theme-background-tertiary)' }}>
                {selectedMarcasCobertura.map(mId => (
                  <Fragment key={`sub-${mId}`}>
                    <th className="text-center small fw-black py-1" style={{ fontSize: '0.55rem', borderRight: '1px solid var(--theme-border-default)', backgroundColor: 'var(--theme-background-tertiary)', color: 'var(--theme-text-secondary)' }}>CF / CU</th>
                    <th className="text-center small fw-black py-1" style={{ fontSize: '0.55rem', backgroundColor: 'var(--theme-background-tertiary)', color: 'var(--theme-text-secondary)' }}>CLI</th>
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
                      <td className="text-center align-middle py-2">
                        <div className="d-flex align-items-center justify-content-center gap-2">
                          <div className={`chevron-icon ${expandedCoberturaRutas[rutaId] ? 'active' : ''}`} style={{ transition: 'transform 0.1s' }}>
                            <FaChevronRight size={10} style={{ transform: expandedCoberturaRutas[rutaId] ? 'rotate(90deg)' : 'none', color: 'var(--theme-text-primary)' }} />
                          </div>
                          <span className="fw-black fs-6 text-uppercase" style={{ letterSpacing: '0.5px', color: 'var(--theme-text-primary)', fontSize: '0.8rem' }}>
                            {rutaId}
                          </span>
                        </div>
                      </td>
                      {selectedMarcasCobertura.map(mId => {
                        const vals = routeData?.total[mId] || { cf: 0, cu: 0, cliConVenta: 0 };
                        const hasData = vals.cf > 0 || vals.cu > 0;
                        return (
                          <Fragment key={`${rutaId}-${mId}`}>
                            <td className={`text-center align-middle fw-black ${hasData ? '' : 'text-secondary opacity-25'}`} style={{ fontSize: '0.75rem', color: hasData ? 'var(--theme-text-primary)' : '' }}>
                              <span className="text-success">{vals.cf.toLocaleString(undefined, { maximumFractionDigits: 1 })}</span>
                              <span className="mx-1 text-secondary opacity-50">/</span>
                              <span className="text-warning">{vals.cu.toLocaleString(undefined, { maximumFractionDigits: 1 })}</span>
                            </td>
                            <td className={`text-center align-middle fw-black ${hasData ? 'text-info' : 'text-secondary opacity-25'}`} style={{ fontSize: '0.75rem' }}>
                              {vals.cliConVenta} <span className="text-secondary opacity-50 mx-1">/</span> {routeData.totalClientesRuta}
                            </td>
                          </Fragment>
                        );
                      })}
                    </tr>
                    {expandedCoberturaRutas[rutaId] && (
                      Object.entries(routeData.clientes)
                        .sort((a: any, b: any) => a[1].nombre.localeCompare(b[1].nombre))
                        .map(([clientId, client]: [string, any]) => {
                          const hasAnySale = selectedMarcasCobertura.some(mId => 
                            (client.marcas[mId]?.cf || 0) > 0 || (client.marcas[mId]?.cu || 0) > 0
                          );

                          return (
                            <tr 
                              key={`${rutaId}-${clientId}`} 
                              style={{ 
                                backgroundColor: hasAnySale ? 'var(--theme-background-secondary)' : 'transparent' 
                              }}
                            >
                              <td className={`ps-4 py-1 border-start ${hasAnySale ? 'border-danger' : 'border-warning'} border-4`}>
                                <div className="d-flex flex-column">
                                  <span 
                                    className="fw-bold text-uppercase" 
                                    style={{ 
                                      fontSize: '0.7rem', 
                                      color: hasAnySale ? 'var(--theme-text-primary)' : 'var(--theme-text-secondary)' 
                                    }}
                                  >
                                    {client.nombre}
                                  </span>
                                  <span className="text-secondary" style={{ fontSize: '0.55rem' }}>ID: {clientId}</span>
                                </div>
                              </td>
                              {selectedMarcasCobertura.map(mId => {
                                const vals = client.marcas[mId] || { cf: 0, cu: 0 };
                                const hasData = vals.cf > 0 || vals.cu > 0;
                                return (
                                  <Fragment key={`${rutaId}-${clientId}-${mId}`}>
                                    <td className={`text-center align-middle fw-bold ${hasData ? '' : 'text-danger opacity-50'}`} style={{ fontSize: '0.75rem' }}>
                                      <span className={hasData ? 'text-success' : ''}>{vals.cf > 0 ? vals.cf.toLocaleString(undefined, { maximumFractionDigits: 1 }) : '0'}</span>
                                      <span className="mx-1 text-secondary opacity-50">/</span>
                                      <span className={hasData ? 'text-warning' : ''}>{vals.cu > 0 ? vals.cu.toLocaleString(undefined, { maximumFractionDigits: 1 }) : '0'}</span>
                                    </td>
                                    <td className="text-center align-middle" style={{ fontSize: '0.75rem' }}>
                                      {hasData ? <FaUserCheck className="text-info" size={12} /> : <span className="text-danger opacity-50">0</span>}
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
            <tfoot className="sticky-bottom" style={{ backgroundColor: 'var(--theme-background-tertiary)', zIndex: 5 }}>
              <tr className="border-top-2 border-danger">
                <td className="text-center fw-black text-uppercase small py-3" style={{ backgroundColor: 'var(--theme-background-tertiary)' }}>Total General</td>
                {selectedMarcasCobertura.map(mId => {
                  let tCf = 0; let tCu = 0;
                  matrixCoberturaData.rutas.forEach(rId => {
                    const v = matrixCoberturaData.data[rId]?.total[mId];
                    if (v) { tCf += v.cf; tCu += v.cu; }
                  });
                  return (
                    <Fragment key={`foot-${mId}`}>
                      <td className="text-center fw-black text-success fs-6" style={{ backgroundColor: 'var(--theme-background-tertiary)' }}>{tCf.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
                      <td className="text-center fw-black text-warning fs-6" style={{ backgroundColor: 'var(--theme-background-tertiary)' }}>{tCu.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
                    </Fragment>
                  );
                })}
              </tr>
            </tfoot>
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
    </div>
  );
});

export default CoberturaTab;
