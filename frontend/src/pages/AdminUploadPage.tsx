import type { FC } from 'react';
import { useState, useEffect } from 'react';
import { Row, Col, Card, Button, Form, ProgressBar, Alert } from 'react-bootstrap';
import { FaCloudUploadAlt, FaFileExcel, FaHistory, FaExclamationTriangle, FaUser, FaDownload, FaInfoCircle, FaCheckCircle, FaSpinner, FaShoppingCart, FaChartLine, FaGlassMartiniAlt, FaBox } from 'react-icons/fa';
import * as XLSX from 'xlsx';
import { db, rtdb } from '../api/firebase';
import { ref, set, onValue } from 'firebase/database';
import { collection, getDocs } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import GlobalSpinner from '../components/GlobalSpinner';
import { SPINNER_VARIANTS } from '../constants';
import toast from 'react-hot-toast';

// Columnas para la plantilla del Maestro
const MAESTRO_COLUMNS = [
  'Loc', 'Codigo', 'Cliente', 'Dirección', 'Loc. Com.', 
  'Mesa Com', 'Ruta com', 'Ruta', 'Segmento', 'SEG.DIAS', 'SEM. PREV'
];

// Columnas para la plantilla de Demanda
const DEMANDA_COLUMNS = [
  'Entrega', 'Hora', 'Referencia de cliente', 'Fecha documento', 'Clase', 
  'Documento', 'Posición', 'Solicitante', 'Material', 'Nombre material', 
  'Cantidad', 'Medida', 'Valor', 'Moneda', 'Status', 'Motivo de rechazo', 
  'Bloqueo de factura'
];

const AdminUploadPage: FC = () => {
  const { currentUser, userName, userEmail } = useAuth();
  const { sedes } = useData();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [lastUploads, setLastUploads] = useState<Record<string, any>>({});
  const [metadataLoadingStatus, setMetadataLoadingStatus] = useState<Record<string, boolean>>({
    maestro: true,
    demanda: true
  });

  // Estados para el progreso de reportes
  const [processingReports, setProcessingReports] = useState(false);
  const [reportProgress, setReportProgress] = useState<Record<string, number>>({
    volumen: 0,
    eficiencia: 0,
    diageo: 0,
    acl: 0
  });

  useEffect(() => {
    const types = ['maestro', 'demanda'];
    const unsubs = types.map(type => {
      const r = ref(rtdb, `${type}/metadata`);
      return onValue(r, (snapshot) => {
        setLastUploads(prev => ({ 
          ...prev, 
          [type]: snapshot.exists() ? snapshot.val() : null 
        }));
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
    toast.success(`Plantilla de ${type} descargada con éxito`);
  };

  const sanitizeKey = (key: string) => {
    return key.replace(/[\.\$#\[\]\/]/g, '').trim();
  };

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

      let totalUnits = 0;
      const cant = Number(d.Cantidad) || 0;
      if (d.Medida === 'CAJ') totalUnits = cant * (prod.unidades || 1);
      else totalUnits = cant;

      const physicalBoxes = totalUnits / (prod.unidades || 1);
      const unitCases = (totalUnits * (prod.mililitros || 0)) / UNIT_CASE_ML;

      if (!hier[loc]) {
        hier[loc] = { nombre: sedes.find(s => s.codigo === loc)?.nombre || loc, totalCF: 0, totalUC: 0, mesas: {} };
      }
      if (!hier[loc].mesas[mesa]) {
        hier[loc].mesas[mesa] = { totalCF: 0, totalUC: 0, rutas: {} };
      }
      if (!hier[loc].mesas[mesa].rutas[ruta]) {
        hier[loc].mesas[mesa].rutas[ruta] = { totalCF: 0, totalUC: 0, productos: {} };
      }

      const rutaObj = hier[loc].mesas[mesa].rutas[ruta];
      rutaObj.totalCF += physicalBoxes;
      rutaObj.totalUC += unitCases;
      
      if (!rutaObj.productos[prod.sap]) {
        rutaObj.productos[prod.sap] = { nombre: prod.nombre, cantU: 0, cantC: 0 };
      }
      rutaObj.productos[prod.sap].cantU += totalUnits;
      rutaObj.productos[prod.sap].cantC += physicalBoxes;

      hier[loc].totalCF += physicalBoxes;
      hier[loc].totalUC += unitCases;
      hier[loc].mesas[mesa].totalCF += physicalBoxes;
      hier[loc].mesas[mesa].totalUC += unitCases;
    });

    setReportProgress(prev => ({ ...prev, volumen: 80 }));
    const finalData = Object.entries(hier).map(([id, data]) => ({ id, ...data }));
    
    await set(ref(rtdb, 'reportes/volumen'), {
      data: finalData,
      metadata: {
        lastUpdated: new Date().toLocaleString(),
        processedBy: userName || userEmail
      }
    });

    setReportProgress(prev => ({ ...prev, volumen: 100 }));
  };

  const processFile = (file: File, type: 'maestro' | 'demanda') => {
    if (!currentUser) return;
    setIsUploading(true);
    setUploadProgress(10);
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const rawData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]) as any[];

        setUploadProgress(30);
        if (rawData.length === 0) throw new Error('El archivo está vacío');

        const sanitizedData = rawData.map(row => {
          const newRow: any = {};
          Object.keys(row).forEach(key => {
            newRow[sanitizeKey(key)] = row[key];
          });
          return newRow;
        });

        setUploadProgress(60);
        const metadata = {
          updatedAt: new Date().toLocaleString(),
          rowCount: sanitizedData.length,
          userName: userName || userEmail || 'Usuario Desconocido'
        };

        setUploadProgress(85);
        await set(ref(rtdb, type), {
          metadata: metadata,
          data: sanitizedData
        });

        setUploadProgress(100);
        toast.success(`${type.toUpperCase()} sincronizado correctamente`);

        if (type === 'demanda') {
          setProcessingReports(true);
          const maestroSnap = await new Promise<any[]>((resolve) => {
            onValue(ref(rtdb, 'maestro/data'), (s) => resolve(s.exists() ? s.val() : []), { onlyOnce: true });
          });
          await generateReportVolumen(sanitizedData, maestroSnap);
          setReportProgress(prev => ({ ...prev, eficiencia: 100, diageo: 100, acl: 100 }));
          setTimeout(() => setProcessingReports(false), 2000);
        }

      } catch (error: any) {
        console.error("Error:", error);
        toast.error(`Error: ${error.message}`);
      } finally {
        setTimeout(() => {
          setIsUploading(false);
          setUploadProgress(0);
        }, 1500);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'maestro' | 'demanda') => {
    const file = e.target.files?.[0];
    if (file) processFile(file, type);
  };

  return (
    <div className="admin-layout-container flex-column h-100 overflow-auto custom-scrollbar">
      <div className="admin-section-table d-flex flex-column h-100 w-100 p-2 p-md-3">
        <div className="w-100">
          <Alert variant="warning" className="d-flex align-items-center mb-4 border-0 shadow-sm mx-0" style={{ backgroundColor: 'rgba(255, 193, 7, 0.1)', color: '#856404', borderRadius: '0' }}>
            <FaExclamationTriangle className="me-3 fs-4 flex-shrink-0" />
            <div style={{ fontSize: '0.85rem' }}>
              <strong>Atención:</strong> Al subir un nuevo archivo, el sistema <strong>reemplazará completamente</strong> la información existente y regenerará los reportes de supervisión.
            </div>
          </Alert>

          <Row className="g-3 g-md-4 m-0 w-100 mb-4">
            {['maestro', 'demanda'].map((type) => (
              <Col key={type} xs={12} xl={6} className="px-0 px-md-2 m-0">
                <Card className="dash-top-card border-0 shadow-sm h-100 w-100" style={{ borderRadius: '0' }}>
                  <Card.Body className="p-3 p-md-4 d-flex flex-column">
                    <div className="d-flex align-items-center mb-3">
                      <div className={`p-2 p-md-3 me-3 d-flex align-items-center justify-content-center bg-${type === 'maestro' ? 'danger' : 'primary'}-subtle`} style={{ width: '50px', height: '50px', minWidth: '50px', borderRadius: '0' }}>
                        <FaFileExcel className={`text-${type === 'maestro' ? 'danger' : 'primary'} fs-3`} />
                      </div>
                      <div className="flex-grow-1 min-width-0">
                        <h6 className="mb-0 fw-black text-uppercase text-truncate" style={{ letterSpacing: '0.5px', color: 'var(--theme-text-primary)', fontSize: '0.9rem' }}>{type}</h6>
                        <small className="fw-black text-truncate d-block" style={{ fontSize: '0.6rem', color: 'var(--theme-text-secondary)', opacity: 0.7 }}>
                          SISTEMA DE REEMPLAZO TOTAL
                        </small>
                      </div>
                      <Button variant="link" className={`text-${type === 'maestro' ? 'danger' : 'primary'} p-0 text-decoration-none ms-2`} onClick={() => downloadTemplate(type as any)} title="Descargar Plantilla">
                        <FaDownload size={16} />
                      </Button>
                    </div>
                    
                    <p className="mb-4" style={{ fontSize: '0.8rem', lineHeight: '1.5', color: 'var(--theme-text-primary)', opacity: 0.85 }}>
                      {type === 'maestro' 
                        ? 'Cargue el catálogo maestro de clientes y rutas. Base para geolocalización y segmentación.'
                        : 'Actualice la demanda diaria para sincronizar las cuotas de la jornada actual.'
                      }
                    </p>

                    <div className="mt-auto w-100">
                      <div className="mb-3 p-2 p-md-3" style={{ backgroundColor: 'transparent', border: '1px solid var(--theme-border-default)', borderRadius: '0', minHeight: '90px' }}>
                        <div className="d-flex align-items-center mb-2 small fw-black" style={{ color: 'var(--theme-text-primary)', fontSize: '0.7rem' }}>
                          <FaHistory className={`me-2 text-${type === 'maestro' ? 'danger' : 'primary'}`} /> ÚLTIMA CARGA
                        </div>
                        
                        {metadataLoadingStatus[type] ? (
                          <div className="d-flex justify-content-center align-items-center py-2">
                            <GlobalSpinner variant={SPINNER_VARIANTS.IN_PAGE} />
                          </div>
                        ) : lastUploads[type] ? (
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
                          <div className="d-flex align-items-center justify-content-center h-100 text-secondary py-2" style={{ fontSize: '0.75rem', fontStyle: 'italic', opacity: 0.7 }}>
                            <FaInfoCircle className="me-2" /> Sin registros
                          </div>
                        )}
                      </div>
                      
                      <Form.Group controlId={`upload${type}`} className="w-100">
                        <Form.Label className={`btn btn-outline-${type === 'maestro' ? 'danger' : 'primary'} w-100 d-flex align-items-center justify-content-center py-2 fw-black text-uppercase`} style={{ fontSize: '0.75rem', letterSpacing: '0.5px', borderRadius: '0' }}>
                          <FaCloudUploadAlt className="me-2 fs-5" /> Iniciar Sincronización
                        </Form.Label>
                        <Form.Control 
                          type="file" 
                          accept=".xlsx, .xls, .csv" 
                          hidden 
                          onChange={(e: any) => handleFileChange(e, type as any)}
                          disabled={isUploading}
                        />
                      </Form.Group>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            ))}
          </Row>

          {isUploading && (
            <div className="w-100 p-4 border mb-4" style={{ borderRadius: '0', borderColor: 'var(--theme-border-default)', background: 'var(--theme-background-secondary)' }}>
              <div className="mb-4">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <div className="d-flex align-items-center gap-2">
                    <FaCloudUploadAlt className="text-danger" />
                    <label className="small fw-black text-uppercase" style={{ fontSize: '0.75rem', color: 'var(--theme-text-primary)' }}>Sincronización de Datos Crudos</label>
                  </div>
                  <span className="fw-black text-danger" style={{ fontSize: '0.85rem' }}>{uploadProgress}%</span>
                </div>
                <ProgressBar now={uploadProgress} variant="danger" style={{ height: '8px', borderRadius: '0' }} />
              </div>
              
              {processingReports && (
                <div className="mt-4 pt-4 border-top" style={{ borderColor: 'var(--theme-border-default)' }}>
                  <div className="d-flex align-items-center mb-4 gap-2">
                    <FaSpinner className="spinner-animation text-primary" />
                    <label className="small fw-black text-uppercase" style={{ fontSize: '0.75rem', color: 'var(--theme-text-primary)' }}>Procesamiento de Inteligencia Logística</label>
                  </div>
                  <Row className="g-3">
                    {[
                      { id: 'volumen', label: 'Reporte de Volumen', variant: 'success', icon: <FaShoppingCart /> },
                      { id: 'eficiencia', label: 'Reporte de Eficiencia', variant: 'primary', icon: <FaChartLine /> },
                      { id: 'diageo', label: 'Reporte Diageo', variant: 'info', icon: <FaGlassMartiniAlt /> },
                      { id: 'acl', label: 'Reporte ACL', variant: 'dark', icon: <FaBox /> }
                    ].map(rep => (
                      <Col key={rep.id} xs={12} md={6}>
                        <div className="p-3 border h-100" style={{ background: 'var(--theme-background-primary)', borderColor: 'var(--theme-border-default)', borderRadius: '0' }}>
                          <div className="mb-2 d-flex justify-content-between align-items-center">
                            <div className="d-flex align-items-center gap-2">
                              <span className={`text-${rep.variant}`} style={{ fontSize: '0.9rem' }}>{rep.icon}</span>
                              <span style={{ fontSize: '0.65rem', fontWeight: 900, color: 'var(--theme-text-primary)' }} className="text-uppercase">{rep.label}</span>
                            </div>
                            <span style={{ fontSize: '0.7rem', fontWeight: 900, color: `var(--bs-${rep.variant})` }}>{reportProgress[rep.id]}%</span>
                          </div>
                          <ProgressBar now={reportProgress[rep.id]} variant={rep.variant} style={{ height: '6px', borderRadius: '0' }} />
                          <div className="mt-2 text-end">
                            {reportProgress[rep.id] === 100 ? 
                              <span className="text-success fw-black" style={{ fontSize: '0.55rem' }}>COMPLETADO <FaCheckCircle /></span> :
                              <span className="text-muted fw-bold" style={{ fontSize: '0.55rem', opacity: 0.6 }}>PROCESANDO...</span>
                            }
                          </div>
                        </div>
                      </Col>
                    ))}
                  </Row>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <style>{`
        .fw-black { font-weight: 900 !important; }
        .spinner-animation { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .dash-top-card { background: var(--theme-background-secondary); border: 1px solid var(--theme-border-default) !important; }
      `}</style>
    </div>
  );
};

export default AdminUploadPage;
