import type { FC } from 'react';
import { memo, Fragment, useState, useEffect, useMemo, useRef } from 'react';
import { Badge, Table, Button, Form, Modal, Spinner } from 'react-bootstrap';
import { FaMapMarkerAlt, FaChevronRight, FaCheck, FaTimes, FaFilter, FaChevronUp, FaCamera } from 'react-icons/fa';
import useMediaQuery from '../../hooks/useMediaQuery';
import html2canvas from 'html2canvas';

interface CoberturaTabProps {
  marcas: any[];
  beverageTypes: any[];
  products: any[];
  selectedMarcasCobertura: string[];
  setSelectedMarcasCobertura: React.Dispatch<React.SetStateAction<string[]>>;
  selectedProductosCobertura: string[];
  setSelectedProductosCobertura: React.Dispatch<React.SetStateAction<string[]>>;
  matrixCoberturaData: { mesas: string[]; data: any };
  expandedCoberturaMesas: Record<string, boolean>;
  setExpandedCoberturaMesas: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
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
  marcas, beverageTypes, products, selectedMarcasCobertura, setSelectedMarcasCobertura,
  selectedProductosCobertura, setSelectedProductosCobertura,
  matrixCoberturaData, expandedCoberturaMesas, setExpandedCoberturaMesas,
  expandedCoberturaRutas, setExpandedCoberturaRutas,
  selectedDia, setSelectedDia, selectedSubCanal, setSelectedSubCanal,
  selectedTipoCobertura, setSelectedTipoCobertura, availableSubCanales
}) => {
  const isMobile = useMediaQuery('(max-width: 991px)');
  const [filtersExpanded, setFiltersExpanded] = useState(!isMobile);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [tempDia, setTempDia] = useState(selectedDia);
  const [tempSubCanal, setTempSubCanal] = useState(selectedSubCanal);
  const [tempTipoBebida, setTempTipoBebida] = useState(selectedTipoCobertura);
  const [tempMarcas, setTempMarcas] = useState<string[]>(selectedMarcasCobertura);
  const [tempProductos, setTempProductos] = useState<string[]>(selectedProductosCobertura);

  useEffect(() => {
    if (!isMobile) setFiltersExpanded(true);
  }, [isMobile]);

  useEffect(() => {
    if (showFilterModal) {
      setTempDia(selectedDia);
      setTempSubCanal(selectedSubCanal);
      const tipoValido = beverageTypes.some(t => t.id === selectedTipoCobertura)
        ? selectedTipoCobertura
        : (beverageTypes[0]?.id || '');
      setTempTipoBebida(tipoValido);
      setTempMarcas(selectedTipoCobertura
        ? selectedMarcasCobertura
        : marcas.filter(m => m.tipoBebidaId === tipoValido).map(m => m.id)
      );
      setTempProductos(selectedProductosCobertura);
    }
  }, [showFilterModal, selectedDia, selectedSubCanal, selectedTipoCobertura, selectedMarcasCobertura, selectedProductosCobertura, beverageTypes, marcas]);

  const handleTipoBebidaChange = (tipoId: string) => {
    setTempTipoBebida(tipoId);
    setTempMarcas(
      marcas.filter(m => m.tipoBebidaId === tipoId).map(m => m.id)
    );
    setTempProductos([]);
  };

  const handleToggleMarca = (marcaId: string) => {
    setTempMarcas(prev => {
      const next = prev.includes(marcaId)
        ? prev.filter(id => id !== marcaId)
        : [...prev, marcaId];
      setTempProductos([]);
      return next;
    });
  };

  const handleApply = () => {
    setSelectedDia(tempDia);
    setSelectedSubCanal(tempSubCanal);
    setSelectedTipoCobertura(tempTipoBebida);
    setSelectedMarcasCobertura(tempMarcas);
    setSelectedProductosCobertura(tempProductos);
    setShowFilterModal(false);
  };

  const handleCancel = () => {
    setShowFilterModal(false);
  };

  const handleExportImage = async () => {
    if (!matrixCoberturaData.mesas.length || !tableContainerRef.current) return;
    setIsCapturing(true);

    await new Promise(r => setTimeout(r, 50));

    try {
      const original = tableContainerRef.current;
      const clone = original.cloneNode(true) as HTMLElement;
      clone.style.position = 'fixed';
      clone.style.top = '-9999px';
      clone.style.left = '0px';
      clone.style.overflow = 'visible';
      clone.style.height = 'auto';
      clone.style.width = original.scrollWidth + 'px';
      clone.style.maxHeight = 'none';

      clone.querySelectorAll('.sticky-column, thead').forEach(el => {
        (el as HTMLElement).style.position = 'static';
        (el as HTMLElement).style.zIndex = 'auto';
      });
      clone.querySelectorAll('.sticky-column').forEach(el => {
        (el as HTMLElement).style.boxShadow = 'none';
      });

      const bgColor = getComputedStyle(document.documentElement).getPropertyValue('--theme-background-secondary').trim() || '#1a1a1a';
      clone.style.backgroundColor = bgColor;
      document.body.appendChild(clone);

      await new Promise(r => setTimeout(r, 150));

      const canvas = await html2canvas(clone, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: bgColor,
        logging: false,
      });

      document.body.removeChild(clone);

      canvas.toBlob(async (blob) => {
        if (blob) {
          try {
            await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
          } catch (err) {
            const dataUrl = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.href = dataUrl;
            link.download = `cobertura_${new Date().toISOString().split('T')[0]}.png`;
            link.click();
          }
        }
      }, 'image/png', 1.0);
    } catch (err) {
      console.error(err);
    } finally {
      setIsCapturing(false);
    }
  };

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
    selectedTipoCobertura && 1,
    selectedProductosCobertura.length > 0 && 1
  ].filter(Boolean).length;

  const filteredMarcas = marcas.filter(m => m.tipoBebidaId === tempTipoBebida);

  const filteredProductos = useMemo(() => {
    if (tempMarcas.length === 0) return [];
    return products.filter(p => tempMarcas.includes(p.marcaId));
  }, [products, tempMarcas]);

  const selectedTipoNombre = beverageTypes.find(t => t.id === selectedTipoCobertura)?.nombre?.toUpperCase() || 'TIPO';

  return (
    <div className="d-flex flex-column h-100">
      {/* BARRA DE FILTROS: colapsable en mobile */}
      {isMobile && !filtersExpanded ? (
        <div className="flex-shrink-0 d-flex align-items-center mb-2" style={{ borderLeft: '4px solid var(--color-red-primary)' }}>
          <Button
            variant="outline-danger"
            className="d-flex align-items-center gap-2 fw-black w-100"
            style={{ fontSize: '0.75rem', borderRadius: '2px', minHeight: '32px' }}
            onClick={() => setFiltersExpanded(true)}
          >
            <FaFilter size={12} />
            FILTROS
            {activeFilterCount > 0 && (
              <Badge bg="danger" className="ms-1" style={{ fontSize: '0.6rem' }}>{activeFilterCount}</Badge>
            )}
          </Button>
        </div>
      ) : (
      <div className="admin-border-industrial p-2 p-md-3 flex-shrink-0 mb-2 mb-md-3" style={{ backgroundColor: 'var(--theme-background-secondary)', borderLeft: '4px solid var(--color-red-primary)' }}>
        {isMobile ? (
          <div className="d-flex flex-column gap-2">
            <div className="d-flex align-items-center gap-2">
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

              {selectedMarcasCobertura.length > 0 && (
                <Button
                  variant="outline-success"
                  className="d-flex align-items-center gap-2 fw-black px-3 py-2"
                  style={{ fontSize: '0.75rem', borderRadius: '2px' }}
                  onClick={handleExportImage}
                  disabled={isCapturing}
                >
                  {isCapturing ? (
                    <Spinner size="sm" animation="border" />
                  ) : (
                    <FaCamera size={12} />
                  )}
                  {isCapturing ? 'COPIANDO...' : 'COPIAR'}
                </Button>
              )}

              <Button variant="link" className="text-secondary p-0 ms-auto text-decoration-none" onClick={() => setFiltersExpanded(false)}>
                <FaChevronUp size={14} />
              </Button>
            </div>

            {(selectedDia !== 'ALL' || selectedSubCanal !== 'ALL' || selectedTipoCobertura || selectedProductosCobertura.length > 0) && (
              <div className="d-flex align-items-center gap-2 flex-wrap">
                {selectedDia !== 'ALL' && (
                  <Badge bg="danger" className="fw-black text-uppercase px-2 py-1" style={{ fontSize: '0.65rem' }}>
                    {selectedDia}
                  </Badge>
                )}
                {selectedSubCanal !== 'ALL' && (
                  <Badge bg="danger" className="fw-black text-uppercase px-2 py-1" style={{ fontSize: '0.65rem' }}>
                    {selectedSubCanal}
                  </Badge>
                )}
                {selectedTipoCobertura && (
                  <Badge bg="danger" className="fw-black text-uppercase px-2 py-1" style={{ fontSize: '0.65rem' }}>
                    {selectedTipoNombre}
                  </Badge>
                )}
                {selectedProductosCobertura.length > 0 && (
                  <Badge bg="warning" text="dark" className="fw-black text-uppercase px-2 py-1" style={{ fontSize: '0.65rem' }}>
                    {selectedProductosCobertura.length} PRODUCTO{selectedProductosCobertura.length > 1 ? 'S' : ''}
                  </Badge>
                )}
                <Button variant="link" className="text-danger p-0 ms-1 text-decoration-none d-flex align-items-center" onClick={() => { setSelectedDia('ALL'); setSelectedSubCanal('ALL'); setSelectedTipoCobertura(''); setSelectedMarcasCobertura([]); setSelectedProductosCobertura([]); }}>
                  <FaTimes size={10} />
                </Button>
              </div>
            )}
          </div>
        ) : (
        <div className="d-flex align-items-center gap-2 gap-md-3 flex-wrap">
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

          {selectedMarcasCobertura.length > 0 && (
            <Button
              variant="outline-success"
              className="d-flex align-items-center gap-2 fw-black px-3 py-2"
              style={{ fontSize: '0.75rem', borderRadius: '2px' }}
              onClick={handleExportImage}
              disabled={isCapturing}
            >
              {isCapturing ? (
                <Spinner size="sm" animation="border" />
              ) : (
                <FaCamera size={12} />
              )}
              {isCapturing ? 'COPIANDO...' : 'COPIAR'}
            </Button>
          )}

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
            {selectedTipoCobertura && (
              <Badge bg="danger" className="fw-black text-uppercase px-3 py-2" style={{ fontSize: '0.65rem', borderRadius: '2px' }}>
                {selectedTipoNombre}
              </Badge>
            )}
            {selectedProductosCobertura.length > 0 && (
              <Badge bg="warning" text="dark" className="fw-black text-uppercase px-3 py-2" style={{ fontSize: '0.65rem', borderRadius: '2px' }}>
                {selectedProductosCobertura.length} PRODUCTO{selectedProductosCobertura.length > 1 ? 'S' : ''}
              </Badge>
            )}
            {activeFilterCount > 0 && (
              <Button variant="link" className="text-secondary small fw-black p-0 ms-2 text-decoration-none" onClick={() => { setSelectedDia('ALL'); setSelectedSubCanal('ALL'); setSelectedTipoCobertura(''); setSelectedMarcasCobertura([]); setSelectedProductosCobertura([]); }} style={{ fontSize: '0.65rem' }}>LIMPIAR</Button>
            )}
          </div>
        </div>
        )}
      </div>
      )}

      {selectedMarcasCobertura.length > 0 && typeColumnHeaders.length > 0 ? (
        isMobile ? (
          <div ref={tableContainerRef} className="flex-grow-1 overflow-auto custom-scrollbar d-flex flex-column gap-1 p-2" style={{ backgroundColor: 'var(--theme-background-secondary)' }}>
            {matrixCoberturaData.mesas.map(mesaId => {
              const mesaData = matrixCoberturaData.data[mesaId];
              const isMesaExpanded = expandedCoberturaMesas[mesaId];
              const tipo = typeColumnHeaders[0];
              const vals = tipo.brandIds.reduce((acc: { cf: number; cu: number }, bId: string) => {
                const b = mesaData.total[bId];
                if (b) { acc.cf += b.cf || 0; acc.cu += b.cu || 0; }
                return acc;
              }, { cf: 0, cu: 0 });
              const hasData = vals.cf > 0 || vals.cu > 0;
              const rutasArr = Object.entries(mesaData.rutas || {}) as [string, any][];

              return (
                <div key={mesaId} style={{ border: '1px solid var(--theme-border-default)', backgroundColor: isMesaExpanded ? 'rgba(244, 0, 9, 0.05)' : 'var(--theme-background-primary)' }}>
                  {/* MESA HEADER */}
                  <div
                    className="d-flex align-items-center justify-content-between p-3"
                    style={{ cursor: 'pointer' }}
                    onClick={() => setExpandedCoberturaMesas(prev => ({ ...prev, [mesaId]: !prev[mesaId] }))}
                  >
                    <div className="d-flex align-items-center gap-2">
                      <FaChevronRight size={12} style={{ transform: isMesaExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', color: 'var(--theme-text-primary)' }} />
                      <span className="fw-black text-uppercase" style={{ fontSize: '1rem', letterSpacing: '1px', color: 'var(--theme-text-primary)' }}>{mesaId}</span>
                    </div>
                    <span className="text-secondary fw-bold" style={{ fontSize: '0.65rem' }}>{rutasArr.length} RUTAS / {mesaData.totalClientesMesa} CLIENTES</span>
                  </div>

                  <div style={{ borderTop: '1px solid var(--theme-table-border-color)', padding: '10px 12px' }}>
                    <div className="d-flex justify-content-between align-items-center">
                      <div>
                        <span className={hasData ? 'text-success' : 'text-secondary opacity-25'} style={{ fontSize: '0.85rem' }}>{vals.cf.toLocaleString(undefined, { maximumFractionDigits: 1 })}</span>
                        <span className="mx-1 text-secondary opacity-50" style={{ fontSize: '0.75rem' }}>/</span>
                        <span className={hasData ? 'text-warning' : 'text-secondary opacity-25'} style={{ fontSize: '0.85rem' }}>{vals.cu.toLocaleString(undefined, { maximumFractionDigits: 1 })}</span>
                      </div>
                    </div>
                  </div>

                  {/* RUTAS dentro de la mesa */}
                  {isMesaExpanded && rutasArr.map(([rutaId, rutaData]) => {
                    const rutaExpanded = expandedCoberturaRutas[`${mesaId}-${rutaId}`];
                    const rVals = tipo.brandIds.reduce((acc: { cf: number; cu: number }, bId: string) => {
                      const b = rutaData.total[bId];
                      if (b) { acc.cf += b.cf || 0; acc.cu += b.cu || 0; }
                      return acc;
                    }, { cf: 0, cu: 0 });
                    const rHasData = rVals.cf > 0 || rVals.cu > 0;
                    const cliConVenta = rutaData.cliConVentaPorTipo?.[tipo.tipoId] || 0;
                    const total = rutaData.totalClientesRuta;
                    const pct = total > 0 ? ((cliConVenta / total) * 100).toFixed(1) : '0';

                    return (
                      <div key={`${mesaId}-${rutaId}`} style={{ borderTop: '2px solid var(--theme-border-default)', padding: '10px 12px', backgroundColor: rutaExpanded ? 'rgba(244, 0, 9, 0.03)' : 'var(--theme-background-primary)' }}>
                        <div
                          className="d-flex align-items-center justify-content-between"
                          style={{ cursor: 'pointer' }}
                          onClick={() => setExpandedCoberturaRutas(prev => ({ ...prev, [`${mesaId}-${rutaId}`]: !prev[`${mesaId}-${rutaId}`] }))}
                        >
                          <div className="d-flex align-items-center gap-2">
                            <FaChevronRight size={10} style={{ transform: rutaExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', color: 'var(--color-red-primary)' }} />
                            <span className="fw-black text-uppercase" style={{ fontSize: '0.8rem', color: 'var(--color-red-primary)' }}>{rutaId}</span>
                          </div>
                          <span className="text-secondary fw-bold" style={{ fontSize: '0.6rem' }}>{total} CLI</span>
                        </div>
                        <div className="d-flex justify-content-between align-items-center mt-1">
                          <span className="fw-black text-uppercase" style={{ fontSize: '0.65rem', color: 'var(--theme-text-secondary)' }}>{tipo.typeName}</span>
                          <div className={rHasData ? '' : 'opacity-25'}>
                            <span className={rHasData ? 'text-success' : 'text-secondary opacity-25'} style={{ fontSize: '0.8rem' }}>{rVals.cf.toLocaleString(undefined, { maximumFractionDigits: 1 })}</span>
                            <span className="mx-1 text-secondary opacity-50" style={{ fontSize: '0.7rem' }}>/</span>
                            <span className={rHasData ? 'text-warning' : 'text-secondary opacity-25'} style={{ fontSize: '0.8rem' }}>{rVals.cu.toLocaleString(undefined, { maximumFractionDigits: 1 })}</span>
                            <span className="text-secondary ms-2" style={{ fontSize: '0.6rem' }}>{cliConVenta}/{total} ({pct}%)</span>
                          </div>
                        </div>

                        {rutaExpanded && (
                          <div style={{ borderTop: '1px solid var(--theme-table-border-color)', marginTop: '8px' }}>
                            {Object.entries(rutaData.clientes)
                              .sort((a: any, b: any) => a[1].nombre.localeCompare(b[1].nombre))
                              .map(([clientId, client]: [string, any]) => {
                                const cVals = tipo.brandIds.reduce((acc: { cf: number; cu: number }, bId: string) => {
                                  const b = client.marcas[bId];
                                  if (b) { acc.cf += b.cf || 0; acc.cu += b.cu || 0; }
                                  return acc;
                                }, { cf: 0, cu: 0 });
                                const cHasData = cVals.cf > 0 || cVals.cu > 0;
                                return (
                                  <div key={`${mesaId}-${rutaId}-${clientId}`} style={{ borderTop: '1px solid var(--theme-table-border-color)', padding: '10px 12px', backgroundColor: 'var(--theme-background-primary)' }}>
                                    <div className="d-flex justify-content-between align-items-center mb-1">
                                      <span className="fw-black text-uppercase" style={{ fontSize: '0.8rem', color: 'var(--theme-text-primary)' }}>{client.nombre}</span>
                                      <span className="text-secondary fw-bold" style={{ fontSize: '0.6rem' }}>ID: {clientId}</span>
                                    </div>
                                    <div className="d-flex align-items-center justify-content-between">
                                      <div className="d-flex align-items-center gap-1">
                                        <span style={{ fontSize: '0.65rem', color: 'var(--theme-text-secondary)' }}>CF:</span>
                                        <span className={cHasData ? 'text-success' : 'text-secondary opacity-25'} style={{ fontSize: '0.75rem' }}>{cVals.cf.toLocaleString(undefined, { maximumFractionDigits: 1 })}</span>
                                        <span className="text-secondary opacity-50 mx-1" style={{ fontSize: '0.65rem' }}>/</span>
                                        <span style={{ fontSize: '0.65rem', color: 'var(--theme-text-secondary)' }}>CU:</span>
                                        <span className={cHasData ? 'text-warning' : 'text-secondary opacity-25'} style={{ fontSize: '0.75rem' }}>{cVals.cu.toLocaleString(undefined, { maximumFractionDigits: 1 })}</span>
                                      </div>
                                      <div>
                                        {cHasData ? (
                                          <FaCheck className="text-success" size={14} />
                                        ) : (
                                          <FaTimes className="text-danger" size={12} />
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        ) : (
          <div ref={tableContainerRef} className="admin-border-industrial flex-grow-1 overflow-auto custom-scrollbar position-relative" style={{ backgroundColor: 'var(--theme-background-secondary)' }}>
          <Table hover className="mb-0 industrial-table-v2 matrix-table" style={{ borderCollapse: 'separate', borderSpacing: 0, minWidth: 'max-content' }}>
            <thead style={{ backgroundColor: 'var(--theme-background-tertiary)' }} className="sticky-top">
              <tr>
                <th rowSpan={2} className="align-middle text-center ps-4 sticky-column" style={{ width: '180px', minWidth: '180px', fontSize: '0.65rem', backgroundColor: 'var(--theme-background-tertiary)', zIndex: 11 }}>ID MESA</th>
                {typeColumnHeaders.map(({ tipoId, typeName, brandIds }) => (
                  <th key={tipoId} colSpan={2} className="text-center text-uppercase fw-black text-white py-2 brand-header-cell brand-separator" style={{ fontSize: '0.7rem', letterSpacing: '1px', backgroundColor: 'var(--color-red-primary)' }}>
                    {typeName} <span className="text-white-50" style={{ fontSize: '0.55rem', opacity: 0.7 }}>({brandIds.length})</span>
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
              {matrixCoberturaData.mesas.map(mesaId => {
                const mesaData = matrixCoberturaData.data[mesaId];
                const isMesaExpanded = expandedCoberturaMesas[mesaId];
                const rutasEntries = Object.entries(mesaData.rutas || {}) as [string, any][];

                return (
                  <Fragment key={mesaId}>
                    {/* FILA MESA */}
                    <tr
                      onClick={() => setExpandedCoberturaMesas(prev => ({ ...prev, [mesaId]: !prev[mesaId] }))}
                      style={{ cursor: 'pointer' }}
                      className={isMesaExpanded ? 'bg-danger bg-opacity-10' : ''}
                    >
                      <td className="text-center align-middle py-3 sticky-column" style={{ backgroundColor: isMesaExpanded ? 'rgba(244, 0, 9, 0.12)' : 'var(--theme-background-secondary)', zIndex: 10 }}>
                        <div className="d-flex align-items-center justify-content-center gap-2">
                          <div className={`chevron-icon ${isMesaExpanded ? 'active' : ''}`} style={{ transition: 'transform 0.1s' }}>
                            <FaChevronRight size={12} style={{ transform: isMesaExpanded ? 'rotate(90deg)' : 'none', color: 'var(--theme-text-primary)' }} />
                          </div>
                          <span className="fw-black fs-5 text-uppercase" style={{ letterSpacing: '1px', color: 'var(--theme-text-primary)' }}>
                            {mesaId}
                          </span>
                        </div>
                      </td>
                      {typeColumnHeaders.map(({ tipoId, brandIds }) => {
                        const vals = brandIds.reduce((acc: { cf: number; cu: number }, bId: string) => {
                          const b = mesaData.total[bId];
                          if (b) { acc.cf += b.cf || 0; acc.cu += b.cu || 0; }
                          return acc;
                        }, { cf: 0, cu: 0 });
                        const cliConVentaMesa = Object.values(mesaData.rutas || {}).reduce((sum: number, r: any) => sum + (r.cliConVentaPorTipo?.[tipoId] || 0), 0);
                        const hasData = vals.cf > 0 || vals.cu > 0;
                        return (
                          <Fragment key={`${mesaId}-${tipoId}`}>
                            <td className="text-center align-middle fw-black" style={{ fontSize: '1rem', backgroundColor: hasData ? 'rgba(244, 0, 9, 0.03)' : 'transparent' }}>
                              <span className={hasData ? 'text-success' : 'text-secondary opacity-25'}>{vals.cf.toLocaleString(undefined, { maximumFractionDigits: 1 })}</span>
                              <span className="mx-2 text-secondary opacity-50">/</span>
                              <span className={hasData ? 'text-warning' : 'text-secondary opacity-25'}>{vals.cu.toLocaleString(undefined, { maximumFractionDigits: 1 })}</span>
                            </td>
                            <td className="text-center align-middle fw-black brand-separator" style={{ fontSize: '1rem', backgroundColor: hasData ? 'rgba(244, 0, 9, 0.03)' : 'transparent' }}>
                              <span className={hasData ? 'text-info' : 'text-secondary opacity-25'}>
                                {cliConVentaMesa} <span className="text-secondary opacity-50 mx-1">/</span> {mesaData.totalClientesMesa}
                                <span className="text-secondary ms-1" style={{ fontSize: '0.7rem' }}>
                                  ({mesaData.totalClientesMesa > 0 ? ((cliConVentaMesa / mesaData.totalClientesMesa) * 100).toFixed(1) : 0}%)
                                </span>
                              </span>
                            </td>
                          </Fragment>
                        );
                      })}
                    </tr>

                    {/* FILAS RUTAS dentro de la mesa */}
                    {isMesaExpanded && rutasEntries.map(([rutaId, rutaData]) => {
                      const rutaKey = `${mesaId}-${rutaId}`;
                      const isRutaExpanded = expandedCoberturaRutas[rutaKey];

                      return (
                        <Fragment key={rutaKey}>
                          <tr
                            onClick={() => setExpandedCoberturaRutas(prev => ({ ...prev, [rutaKey]: !prev[rutaKey] }))}
                            style={{ cursor: 'pointer' }}
                          >
                            <td className="py-2 sticky-column" style={{ paddingLeft: '32px', backgroundColor: 'var(--theme-background-primary)', zIndex: 10 }}>
                              <div className="d-flex align-items-center gap-2">
                                <FaChevronRight size={10} style={{ transform: isRutaExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.1s', color: 'var(--color-red-primary)' }} />
                                <span className="fw-black text-danger" style={{ fontSize: '0.75rem', letterSpacing: '0.5px' }}>RUTA {rutaId}</span>
                                <span className="text-secondary ms-auto" style={{ fontSize: '0.6rem' }}>{rutaData.totalClientesRuta} CLI</span>
                              </div>
                            </td>
                            {typeColumnHeaders.map(({ tipoId, brandIds }) => {
                              const vals = brandIds.reduce((acc: { cf: number; cu: number }, bId: string) => {
                                const b = rutaData.total[bId];
                                if (b) { acc.cf += b.cf || 0; acc.cu += b.cu || 0; }
                                return acc;
                              }, { cf: 0, cu: 0 });
                              const cliConVenta = rutaData.cliConVentaPorTipo?.[tipoId] || 0;
                              const total = rutaData.totalClientesRuta;
                              const hasData = vals.cf > 0 || vals.cu > 0;
                              return (
                                <Fragment key={`${rutaKey}-${tipoId}`}>
                                  <td className="text-center align-middle fw-black" style={{ fontSize: '0.9rem', backgroundColor: 'var(--theme-background-primary)' }}>
                                    <span className={hasData ? 'text-success' : 'text-secondary opacity-25'}>{vals.cf.toLocaleString(undefined, { maximumFractionDigits: 1 })}</span>
                                    <span className="mx-2 text-secondary opacity-25">/</span>
                                    <span className={hasData ? 'text-warning' : 'text-secondary opacity-25'}>{vals.cu.toLocaleString(undefined, { maximumFractionDigits: 1 })}</span>
                                  </td>
                                  <td className="text-center align-middle fw-black brand-separator" style={{ fontSize: '0.8rem', backgroundColor: 'var(--theme-background-primary)' }}>
                                    <span className={hasData ? 'text-info' : 'text-secondary opacity-25'}>
                                      {cliConVenta}/{total} ({total > 0 ? ((cliConVenta / total) * 100).toFixed(1) : 0}%)
                                    </span>
                                  </td>
                                </Fragment>
                              );
                            })}
                          </tr>

                          {/* FILAS CLIENTES */}
                          {isRutaExpanded && Object.entries(rutaData.clientes)
                            .sort((a: any, b: any) => a[1].nombre.localeCompare(b[1].nombre))
                            .map(([clientId, client]: [string, any]) => {
                              return (
                                <tr key={`${rutaKey}-${clientId}`}>
                                  <td className="ps-4 py-2 sticky-column" style={{ backgroundColor: 'var(--theme-background-primary)', zIndex: 10 }}>
                                    <div className="d-flex flex-column">
                                      <div className="d-flex justify-content-between align-items-center mb-1">
                                        <span className="fw-black text-danger" style={{ fontSize: '0.65rem', opacity: 0.9 }}>RUTA: {rutaId}</span>
                                        <span className="text-secondary fw-bold" style={{ fontSize: '0.6rem' }}>ID: {clientId}</span>
                                      </div>
                                      <span className="fw-black text-uppercase" style={{ fontSize: '0.9rem', color: 'var(--theme-text-primary)', letterSpacing: '0.5px', lineHeight: '1.1' }}>
                                        {client.nombre}
                                      </span>
                                    </div>
                                  </td>
                                  {typeColumnHeaders.map(({ tipoId, brandIds }) => {
                                    const vals = brandIds.reduce((acc: { cf: number; cu: number }, bId: string) => {
                                      const b = client.marcas[bId];
                                      if (b) { acc.cf += b.cf || 0; acc.cu += b.cu || 0; }
                                      return acc;
                                    }, { cf: 0, cu: 0 });
                                    const hasData = vals.cf > 0 || vals.cu > 0;
                                    return (
                                      <Fragment key={`${rutaKey}-${clientId}-${tipoId}`}>
                                        <td className="text-center align-middle fw-black" style={{ fontSize: '0.95rem', backgroundColor: hasData ? 'rgba(244, 0, 9, 0.08)' : 'transparent', transition: 'background-color 0.2s' }}>
                                          <span className={hasData ? 'text-success' : 'text-secondary opacity-25'}>{vals.cf.toLocaleString(undefined, { maximumFractionDigits: 1 })}</span>
                                          <span className="mx-2 text-secondary opacity-25">/</span>
                                          <span className={hasData ? 'text-warning' : 'text-secondary opacity-25'}>{vals.cu.toLocaleString(undefined, { maximumFractionDigits: 1 })}</span>
                                        </td>
                                        <td className="text-center align-middle brand-separator" style={{ fontSize: '0.95rem', backgroundColor: hasData ? 'rgba(244, 0, 9, 0.08)' : 'transparent' }}>
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
                            })}
                        </Fragment>
                      );
                    })}
                  </Fragment>
                );
              })}
            </tbody>
          </Table>
        </div>
        )
      ) : (
        <div className="flex-grow-1 d-flex flex-column align-items-center justify-content-center p-5" style={{ backgroundColor: 'var(--theme-background-secondary)', border: '1px solid var(--theme-border-default)' }}>
          <div className="p-4 rounded-circle mb-4" style={{ backgroundColor: 'var(--theme-background-tertiary)' }}>
            <FaMapMarkerAlt className="text-danger opacity-50" size={64} />
          </div>
          <h4 className="text-secondary fw-black text-uppercase mb-3" style={{ letterSpacing: '2px' }}>Matriz de Cobertura</h4>
          <p className="text-muted small fw-bold text-center" style={{ maxWidth: '400px', lineHeight: '1.6' }}>
            Seleccione un tipo de bebida en el panel superior para activar el comparativo transaccional por mesas. 
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
                {beverageTypes.map(t => (
                  <option key={t.id} value={t.id}>{t.nombre.toUpperCase()}</option>
                ))}
              </Form.Select>
            </div>

            {/* MARCAS */}
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
                    onClick={() => { setTempMarcas(filteredMarcas.map(m => m.id)); setTempProductos([]); }}
                  >
                    TODO
                  </Button>
                  <Button 
                    variant="link" 
                    className="text-danger fw-black p-0 text-decoration-none"
                    style={{ fontSize: '0.65rem' }}
                    onClick={() => { setTempMarcas([]); setTempProductos([]); }}
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

            {/* PRODUCTOS */}
            {tempMarcas.length > 0 && (
              <div>
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <label className="text-danger fw-black text-uppercase mb-0" style={{ fontSize: '0.7rem', letterSpacing: '1px' }}>
                    PRODUCTOS <span className="text-secondary">({tempProductos.length > 0 ? `${tempProductos.length} seleccionados` : 'todos'})</span>
                  </label>
                  <div className="d-flex gap-2">
                    <Button 
                      variant="link" 
                      className="text-success fw-black p-0 text-decoration-none"
                      style={{ fontSize: '0.65rem' }}
                      onClick={() => setTempProductos(filteredProductos.map(p => String(p.sap).trim()))}
                    >
                      TODO
                    </Button>
                    <Button 
                      variant="link" 
                      className="text-danger fw-black p-0 text-decoration-none"
                      style={{ fontSize: '0.65rem' }}
                      onClick={() => setTempProductos([])}
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
                    maxHeight: '180px',
                    overflowY: 'auto'
                  }}
                >
                  {filteredProductos.length === 0 ? (
                    <span className="text-secondary fw-bold small">No hay productos disponibles</span>
                  ) : (
                    filteredProductos
                      .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''))
                      .map(p => (
                        <Form.Check 
                          key={String(p.sap).trim()}
                          type="checkbox"
                          id={`prod-${p.sap}`}
                          label={p.nombre?.toUpperCase() || String(p.sap)}
                          checked={tempProductos.includes(String(p.sap).trim())}
                          onChange={() => {
                            const sap = String(p.sap).trim();
                            setTempProductos(prev => prev.includes(sap) ? prev.filter(s => s !== sap) : [...prev, sap]);
                          }}
                          className="fw-black"
                          style={{ fontSize: '0.75rem', minWidth: '160px' }}
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
            disabled={!tempTipoBebida}
            className="fw-black px-4"
            style={{ fontSize: '0.75rem', borderRadius: '2px' }}
          >
            APLICAR
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
});

export default CoberturaTab;