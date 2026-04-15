import type { FC } from 'react';
import { useState, useEffect, Fragment } from 'react';
import { Row, Col, Button, Form, ProgressBar, Alert, Container } from 'react-bootstrap';
import { FaCloudUploadAlt, FaFileExcel, FaHistory, FaExclamationTriangle, FaUser, FaDownload, FaCheckCircle, FaSpinner, FaShoppingCart, FaChartLine, FaGlassMartiniAlt, FaBox, FaDatabase, FaInfoCircle } from 'react-icons/fa';
import * as XLSX from 'xlsx';
import { db, rtdb } from '../api/firebase';
import { ref, set, onValue } from 'firebase/database';
import { collection, getDocs } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import GlobalSpinner from '../components/GlobalSpinner';
import { SPINNER_VARIANTS } from '../constants';
import toast from 'react-hot-toast';

const MAESTRO_COLUMNS = ['Loc', 'Codigo', 'Cliente', 'Dirección', 'Loc. Com.', 'Mesa Com', 'Ruta com', 'Ruta', 'Segmento', 'SEG.DIAS', 'SEM. PREV'];
const DEMANDA_COLUMNS = ['Entrega', 'Hora', 'Referencia de cliente', 'Fecha documento', 'Clase', 'Documento', 'Posición', 'Solicitante', 'Material', 'Nombre material', 'Cantidad', 'Medida', 'Valor', 'Moneda', 'Status', 'Motivo de rechazo', 'Bloqueo de factura'];

const AdminUploadPage: FC = () => {
  const { currentUser, userName, userEmail } = useAuth();
  const { sedes } = useData();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [lastUploads, setLastUploads] = useState<Record<string, any>>({});
  const [metadataLoadingStatus, setMetadataLoadingStatus] = useState<Record<string, boolean>>({ maestro: true, demanda: true });

  const [processingReports, setProcessingReports] = useState(false);
  const [reportProgress, setReportProgress] = useState<Record<string, number>>({ volumen: 0, eficiencia: 0, diageo: 0, acl: 0 });

  useEffect(() => {
    const types = ['maestro', 'demanda'];
    const unsubs = types.map(type => {
      const r = ref(rtdb, `${type}/metadata`);
      return onValue(r, (snapshot) => {
        setLastUploads(prev => ({ ...prev, [type]: snapshot.exists() ? snapshot.val() : null }));
        setMetadataLoadingStatus(prev => ({ ...prev, [type]: false }));
      });
    });
    return () => unsubs.forEach(unsub => unsub());
  }, []);

  const downloadTemplate = (type: 'maestro' | 'demanda') => {
    const columns = type === 'maestro' ? MAESTRO_COLUMNS : DEMANDA_COLUMNS;
    const ws = XLSX.utils.aoa_to_sheet([columns]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Plantilla ${type}`);
    XLSX.writeFile(wb, `Plantilla_${type.charAt(0).toUpperCase() + type.slice(1)}_Inventario.xlsx`);
    toast.success(`Plantilla descargada`);
  };

  const sanitizeKey = (key: string) => key.replace(/[\.\$#\[\]\/]/g, '').trim();

  const generateReportVolumen = async (demanda: any[], maestro: any[]) => {
    setReportProgress(prev => ({ ...prev, volumen: 10 }));
    const prodSnap = await getDocs(collection(db, 'productos'));
    const products = prodSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
    setReportProgress(prev => ({ ...prev, volumen: 30 }));
    const productMap = products.reduce((acc, p) => ({ ...acc, [p.sap]: p }), {} as Record<string, any>);
    const maestroMap = maestro.reduce((acc, m) => ({ ...acc, [String(m.Codigo)]: m }), {} as Record<string, any>);
    const UNIT_CASE_ML = 5677.92;
    const hier: Record<string, any> = {};

    setReportProgress(prev => ({ ...prev, volumen: 50 }));
    demanda.forEach(d => {
      const prod = productMap[String(d.Material)];
      const client = maestroMap[String(d.Solicitante)];
      if (!prod || !client) return;
      const loc = client.Loc || 'OTRO';
      const mesa = client['Mesa Com'] || client['MESA COM'] || 'SIN MESA';
      const ruta = client['Ruta com'] || client['RUTA COM'] || 'SIN RUTA';
      let totalUnits = d.Medida === 'CAJ' ? (Number(d.Cantidad) || 0) * (prod.unidades || 1) : (Number(d.Cantidad) || 0);
      const physicalBoxes = totalUnits / (prod.unidades || 1);
      const unitCases = (totalUnits * (prod.mililitros || 0)) / UNIT_CASE_ML;

      if (!hier[loc]) hier[loc] = { nombre: sedes.find(s => s.codigo === loc)?.nombre || loc, totalCF: 0, totalUC: 0, mesas: {} };
      if (!hier[loc].mesas[mesa]) hier[loc].mesas[mesa] = { totalCF: 0, totalUC: 0, rutas: {} };
      if (!hier[loc].mesas[mesa].rutas[ruta]) hier[loc].mesas[mesa].rutas[ruta] = { totalCF: 0, totalUC: 0, productos: {} };

      const r = hier[loc].mesas[mesa].rutas[ruta];
      r.totalCF += physicalBoxes; r.totalUC += unitCases;
      if (!r.productos[prod.sap]) r.productos[prod.sap] = { nombre: prod.nombre, cantU: 0, cantC: 0 };
      r.productos[prod.sap].cantU += totalUnits; r.productos[prod.sap].cantC += physicalBoxes;
      hier[loc].totalCF += physicalBoxes; hier[loc].totalUC += unitCases;
      hier[loc].mesas[mesa].totalCF += physicalBoxes; hier[loc].mesas[mesa].totalUC += unitCases;
    });

    setReportProgress(prev => ({ ...prev, volumen: 80 }));
    await set(ref(rtdb, 'reportes/volumen'), {
      data: Object.entries(hier).map(([id, data]) => ({ id, ...data })),
      metadata: { lastUpdated: new Date().toLocaleString(), processedBy: userName || userEmail }
    });
    setReportProgress({ volumen: 100, eficiencia: 100, diageo: 100, acl: 100 });
  };

  const processFile = (file: File, type: 'maestro' | 'demanda') => {
    setIsUploading(true); setUploadProgress(10);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const workbook = XLSX.read(e.target?.result, { type: 'binary' });
        const rawData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]) as any[];
        setUploadProgress(30);
        if (rawData.length === 0) throw new Error('Archivo vacío');
        const sanitizedData = rawData.map(row => {
          const newRow: any = {};
          Object.keys(row).forEach(k => newRow[sanitizeKey(k)] = row[k]);
          return newRow;
        });
        setUploadProgress(60);
        await set(ref(rtdb, type), { 
          metadata: { updatedAt: new Date().toLocaleString(), rowCount: sanitizedData.length, userName: userName || userEmail }, 
          data: sanitizedData 
        });
        setUploadProgress(100);
        toast.success(`${type.toUpperCase()} sincronizado`);

        if (type === 'demanda') {
          setProcessingReports(true);
          const maestroSnap = await new Promise<any[]>((res) => onValue(ref(rtdb, 'maestro/data'), (s) => res(s.exists() ? s.val() : []), { onlyOnce: true }));
          await generateReportVolumen(sanitizedData, maestroSnap);
          setTimeout(() => {
            setProcessingReports(false);
            setReportProgress({ volumen: 0, eficiencia: 0, diageo: 0, acl: 0 });
          }, 3000);
        }
      } catch (err: any) { toast.error(err.message); }
      finally { setTimeout(() => { setIsUploading(false); setUploadProgress(0); }, 1000); }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <Fragment>
      <Container fluid className="p-0">
        <div className="admin-layout-container">
          <div className="admin-section-table">
            <div className="flex-grow-1 overflow-auto custom-scrollbar p-2 p-md-3">
              <Alert variant="warning" className="d-flex align-items-center mb-4 border-0 mx-0" style={{ backgroundColor: 'rgba(244, 0, 9, 0.1)', color: 'var(--theme-text-primary)', borderLeft: '4px solid var(--color-red-primary) !important' }}>
                <FaExclamationTriangle className="me-3 fs-4 flex-shrink-0 text-danger" />
                <div style={{ fontSize: '0.85rem' }}>
                  <strong>Atención:</strong> Al subir un nuevo archivo, el sistema <strong>reemplazará completamente</strong> la información existente y regenerará los reportes.
                </div>
              </Alert>

              <Row className="g-3 g-md-4 m-0 w-100 mb-4">
                {['maestro', 'demanda'].map((type) => (
                  <Col key={type} xs={12} xl={6} className="px-0 m-0">
                    <div className="p-3 p-md-4 h-100 admin-border-industrial" style={{ backgroundColor: 'var(--theme-background-secondary)' }}>
                      <div className="d-flex align-items-center mb-3">
                        <div className={`p-3 me-3 d-flex align-items-center justify-content-center bg-dark`} style={{ border: `1px solid var(--theme-border-default)` }}>
                          <FaFileExcel className={`text-${type === 'maestro' ? 'danger' : 'primary'} fs-3`} />
                        </div>
                        <div className="flex-grow-1 min-width-0">
                          <h6 className="mb-0 fw-black text-uppercase text-truncate" style={{ letterSpacing: '1px' }}>{type}</h6>
                          <small className="text-secondary fw-bold text-truncate d-block" style={{ fontSize: '0.6rem' }}>SISTEMA DE REEMPLAZO TOTAL</small>
                        </div>
                        <Button variant="link" className="p-0 text-secondary" onClick={() => downloadTemplate(type as any)}>
                          <FaDownload size={16} />
                        </Button>
                      </div>
                      
                      <p className="mb-4 text-secondary" style={{ fontSize: '0.8rem' }}>
                        {type === 'maestro' ? 'Cargue el catálogo maestro de clientes y rutas.' : 'Actualice la demanda diaria para sincronizar cuotas.'}
                      </p>

                      <div className="p-3 mb-3" style={{ backgroundColor: 'var(--theme-background-tertiary)', border: '1px solid var(--theme-border-default)' }}>
                        <div className="d-flex align-items-center mb-2 small fw-black text-secondary" style={{ fontSize: '0.7rem' }}>
                          <FaHistory className="me-2" /> ÚLTIMA CARGA
                        </div>
                        {metadataLoadingStatus[type] ? <div className="py-2"><GlobalSpinner variant={SPINNER_VARIANTS.IN_PAGE} /></div> : lastUploads[type] ? (
                          <Row className="g-2">
                            <Col xs={12} sm={6}>
                              <div style={{ fontSize: '0.6rem', color: 'var(--theme-text-secondary)', textTransform: 'uppercase', fontWeight: 800 }}>Sincronización</div>
                              <div className="fw-black text-truncate" style={{ fontSize: '0.7rem', color: 'var(--theme-text-primary)' }}>{lastUploads[type].updatedAt}</div>
                            </Col>
                            <Col xs={12} sm={6}>
                              <div style={{ fontSize: '0.6rem', color: 'var(--theme-text-secondary)', textTransform: 'uppercase', fontWeight: 800 }}>Responsable</div>
                              <div className="fw-black d-flex align-items-center text-truncate" style={{ fontSize: '0.7rem', color: 'var(--theme-text-primary)' }}>
                                <FaUser className="me-1 flex-shrink-0" size={10} /> <span className="text-truncate">{lastUploads[type].userName}</span>
                              </div>
                            </Col>
                            <Col xs={12}>
                              <div className="mt-1 fw-black text-success d-flex align-items-center" style={{ fontSize: '0.65rem' }}>
                                <FaCheckCircle className="me-2 flex-shrink-0" /> {lastUploads[type].rowCount.toLocaleString()} REGISTROS ACTIVOS
                              </div>
                            </Col>
                          </Row>
                        ) : (
                          <div className="d-flex align-items-center justify-content-center h-100 text-secondary py-2" style={{ fontSize: '0.75rem', fontStyle: 'italic' }}>
                            <FaInfoCircle className="me-2" /> Sin registros
                          </div>
                        )}
                      </div>

                      <Form.Group>
                        <Form.Label htmlFor={`upload-${type}`} className={`btn btn-outline-${type === 'maestro' ? 'danger' : 'primary'} w-100 py-2 fw-black text-uppercase`} style={{ fontSize: '0.75rem' }}>
                          <FaCloudUploadAlt className="me-2 fs-5" /> Sincronizar {type}
                        </Form.Label>
                        <Form.Control id={`upload-${type}`} type="file" accept=".xlsx, .xls, .csv" hidden onChange={(e: any) => processFile(e.target.files?.[0], type as any)} disabled={isUploading} />
                      </Form.Group>
                    </div>
                  </Col>
                ))}
              </Row>

              <div className="admin-border-industrial p-4 mb-4" style={{ backgroundColor: 'var(--theme-background-secondary)' }}>
                <div className="d-flex align-items-center mb-4 gap-2">
                  <FaSpinner className={`${processingReports || isUploading ? 'spinner-animation' : ''} text-danger`} size={20} />
                  <label className="small fw-black text-uppercase m-0" style={{ color: 'var(--theme-text-primary)', letterSpacing: '1px' }}>Inteligencia Logística y Reportes</label>
                </div>
                {isUploading && (
                  <div className="mb-4 p-3 bg-dark border" style={{ borderColor: 'var(--theme-border-default)' }}>
                    <div className="d-flex justify-content-between mb-2 small fw-black text-uppercase">
                      <span className="text-secondary">Sincronización Cruda</span>
                      <span className="text-danger">{uploadProgress}%</span>
                    </div>
                    <ProgressBar now={uploadProgress} variant="danger" style={{ height: '4px' }} />
                  </div>
                )}
                <Row className="g-3">
                  {[
                    { id: 'volumen', label: 'Reporte de Volumen', variant: 'success', icon: <FaShoppingCart /> },
                    { id: 'eficiencia', label: 'Reporte de Eficiencia', variant: 'primary', icon: <FaChartLine /> },
                    { id: 'diageo', label: 'Reporte Diageo', variant: 'info', icon: <FaGlassMartiniAlt /> },
                    { id: 'acl', label: 'Reporte ACL', variant: 'warning', icon: <FaBox /> }
                  ].map(rep => (
                    <Col key={rep.id} xs={12} md={6} lg={3}>
                      <div className="p-3 h-100 admin-border-industrial" style={{ background: 'var(--theme-background-primary)' }}>
                        <div className="mb-2 d-flex justify-content-between align-items-center">
                          <div className="d-flex align-items-center gap-2">
                            <span className={`text-${rep.variant}`}>{rep.icon}</span>
                            <span style={{ fontSize: '0.65rem', fontWeight: 900 }} className="text-uppercase">{rep.label}</span>
                          </div>
                          <span style={{ fontSize: '0.7rem', fontWeight: 900 }} className={`text-${rep.variant}`}>{reportProgress[rep.id]}%</span>
                        </div>
                        {processingReports ? (
                          <>
                            <ProgressBar now={reportProgress[rep.id]} variant={rep.variant} style={{ height: '3px' }} />
                            <div className="mt-2 text-end">
                              <span className={`fw-black text-${rep.variant}`} style={{ fontSize: '0.55rem' }}>{reportProgress[rep.id] === 100 ? 'COMPLETADO' : 'PROCESANDO...'}</span>
                            </div>
                          </>
                        ) : (
                          <div className="d-flex flex-column align-items-center justify-content-center py-2">
                            <GlobalSpinner variant={SPINNER_VARIANTS.IN_PAGE} />
                            <small className="text-secondary fw-bold mt-1" style={{ fontSize: '0.5rem' }}>ESPERANDO DEMANDA</small>
                          </div>
                        )}
                      </div>
                    </Col>
                  ))}
                </Row>
              </div>
            </div>
          </div>
        </div>
      </Container>
      <style>{`
        .fw-black { font-weight: 900 !important; }
        .spinner-animation { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .admin-border-industrial { 
          border: 1px solid var(--theme-border-default) !important;
          transition: border-color 0.2s ease-in-out;
        }
        .admin-border-industrial:hover {
          border-color: var(--color-red-primary) !important;
        }
        .progress { background-color: var(--theme-background-tertiary) !important; border-radius: 0 !important; }
      `}</style>
    </Fragment>
  );
};

export default AdminUploadPage;
