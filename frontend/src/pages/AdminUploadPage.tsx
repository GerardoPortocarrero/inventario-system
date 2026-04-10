import type { FC } from 'react';
import { useState, useEffect } from 'react';
import { Row, Col, Card, Button, Form, ProgressBar, Alert } from 'react-bootstrap';
import { FaCloudUploadAlt, FaFileExcel, FaDatabase, FaHistory, FaExclamationTriangle, FaUser, FaDownload, FaInfoCircle } from 'react-icons/fa';
import * as XLSX from 'xlsx';
import { rtdb } from '../api/firebase';
import { ref, set, onValue } from 'firebase/database';
import { useAuth } from '../context/AuthContext';
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
  'Fecha documento', 'Clase doc.ventas', 'Documento de ventas', 'Posición', 
  'Solicitante', 'Material', 'Descripción del material', 'Cantidad de pedido (Posición)', 
  'Un.medida venta', 'Valor neto (posición)', 'Moneda del documento', 'Status de entrega', 
  'Descripción del motivo de rechazo', 'Bloqueo de factura'
];

const AdminUploadPage: FC = () => {
  const { currentUser, userName, userEmail } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [lastUploads, setLastUploads] = useState<Record<string, any>>({});
  const [metadataLoadingStatus, setMetadataLoadingStatus] = useState<Record<string, boolean>>({
    maestro: true,
    demanda: true
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
      }, (error) => {
        console.error(`Error cargando metadatos de ${type}:`, error);
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
        const sheet = workbook.Sheets[sheetName];
        const rawData = XLSX.utils.sheet_to_json(sheet) as any[];

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
    <div className="admin-layout-container flex-column h-100 overflow-auto">
      <div className="admin-section-table d-flex flex-column h-100 w-100 p-2 p-md-3">
        <div className="w-100">
          <Alert variant="warning" className="d-flex align-items-center mb-4 border-0 shadow-sm mx-0" style={{ backgroundColor: 'rgba(255, 193, 7, 0.1)', color: '#856404', borderRadius: '4px' }}>
            <FaExclamationTriangle className="me-3 fs-4 flex-shrink-0" />
            <div style={{ fontSize: '0.85rem' }}>
              <strong>Atención:</strong> Al subir un nuevo archivo, el sistema <strong>reemplazará completamente</strong> la información existente. Asegúrese de que el formato sea el correcto.
            </div>
          </Alert>

          {isUploading && (
            <div className="mb-4 w-100">
              <label className="small fw-bold mb-1 text-uppercase" style={{ fontSize: '0.6rem', color: 'var(--theme-text-primary)' }}>Procesando información...</label>
              <ProgressBar animated now={uploadProgress} variant="danger" label={`${uploadProgress}%`} style={{ height: '10px', borderRadius: '10px' }} />
            </div>
          )}

          <Row className="g-3 g-md-4 m-0 w-100">
            {['maestro', 'demanda'].map((type) => (
              <Col key={type} xs={12} xl={6} className="px-0 px-md-2 mb-3">
                <Card className="dash-top-card border-0 shadow-sm h-100 w-100">
                  <Card.Body className="p-3 p-md-4 d-flex flex-column">
                    <div className="d-flex align-items-center mb-3">
                      <div className={`p-2 p-md-3 rounded-3 me-3 d-flex align-items-center justify-content-center bg-${type === 'maestro' ? 'danger' : 'primary'}-subtle`} style={{ width: '50px', height: '50px', minWidth: '50px' }}>
                        <FaFileExcel className={`text-${type === 'maestro' ? 'danger' : 'primary'} fs-3`} />
                      </div>
                      <div className="flex-grow-1 min-width-0">
                        <h6 className="mb-0 fw-bold text-uppercase text-truncate" style={{ letterSpacing: '0.5px', color: 'var(--theme-text-primary)', fontSize: '0.9rem' }}>{type}</h6>
                        <small className="fw-bold text-truncate d-block" style={{ fontSize: '0.6rem', color: 'var(--theme-text-secondary)' }}>
                          SISTEMA DE REEMPLAZO TOTAL
                        </small>
                      </div>
                      <Button variant="link" className={`text-${type === 'maestro' ? 'danger' : 'primary'} p-0 text-decoration-none ms-2`} onClick={() => downloadTemplate(type as any)} title="Descargar Plantilla">
                        <FaDownload size={16} />
                      </Button>
                    </div>
                    
                    <p className="mb-4" style={{ fontSize: '0.8rem', lineHeight: '1.5', color: 'var(--theme-text-primary)', opacity: 0.85 }}>
                      {type === 'maestro' 
                        ? 'Cargue el catálogo maestro de clientes y rutas. Este archivo es la base para la geolocalización y segmentación de la demanda.'
                        : 'Actualice los requerimientos operativos de demanda diaria para sincronizar las cuotas de la jornada actual.'
                      }
                    </p>

                    <div className="mt-auto w-100">
                      <div className="mb-3 p-2 p-md-3 border" style={{ backgroundColor: 'transparent', borderColor: 'var(--theme-border-default)', borderRadius: '0', minHeight: '90px' }}>
                        <div className="d-flex align-items-center mb-2 small fw-bold" style={{ color: 'var(--theme-text-primary)', fontSize: '0.7rem' }}>
                          <FaHistory className={`me-2 text-${type === 'maestro' ? 'danger' : 'primary'}`} /> HISTORIAL
                        </div>
                        
                        {metadataLoadingStatus[type] ? (
                          <div className="d-flex justify-content-center align-items-center py-2">
                            <GlobalSpinner variant={SPINNER_VARIANTS.IN_PAGE} />
                          </div>
                        ) : lastUploads[type] ? (
                          <Row className="g-2">
                            <Col xs={12} sm={6}>
                              <div style={{ fontSize: '0.6rem', color: 'var(--theme-text-secondary)', textTransform: 'uppercase', fontWeight: 700 }}>Sincronización</div>
                              <div className="fw-bold text-truncate" style={{ fontSize: '0.7rem', color: 'var(--theme-text-primary)' }}>{lastUploads[type].updatedAt}</div>
                            </Col>
                            <Col xs={12} sm={6}>
                              <div style={{ fontSize: '0.6rem', color: 'var(--theme-text-secondary)', textTransform: 'uppercase', fontWeight: 700 }}>Responsable</div>
                              <div className="fw-bold d-flex align-items-center text-truncate" style={{ fontSize: '0.7rem', color: 'var(--theme-text-primary)' }}>
                                <FaUser className="me-1 flex-shrink-0" size={10} /> <span className="text-truncate">{lastUploads[type].userName}</span>
                              </div>
                            </Col>
                            <Col xs={12}>
                              <div className="mt-1 fw-bold text-success d-flex align-items-center" style={{ fontSize: '0.65rem' }}>
                                <div className="dot-success me-2 flex-shrink-0"></div> {lastUploads[type].rowCount.toLocaleString()} FILAS PROCESADAS
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
                        <Form.Label className={`btn btn-outline-${type === 'maestro' ? 'danger' : 'primary'} w-100 d-flex align-items-center justify-content-center py-2 fw-bold text-uppercase`} style={{ fontSize: '0.75rem', letterSpacing: '0.5px' }}>
                          <FaCloudUploadAlt className="me-2 fs-5" /> Subir Archivo
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
        </div>
      </div>
      <style>{`
        .dot-success { width: 8px; height: 8px; background: #28a745; border-radius: 50%; box-shadow: 0 0 5px #28a745; }
      `}</style>
    </div>
  );
};

export default AdminUploadPage;
