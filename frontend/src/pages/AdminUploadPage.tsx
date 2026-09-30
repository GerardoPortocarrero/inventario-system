import type { FC } from 'react';
import { useState, useEffect, Fragment } from 'react';
import { Row, Col, Button, Form, ProgressBar, Alert, Container, Spinner } from 'react-bootstrap';
import { FaCloudUploadAlt, FaFileExcel, FaHistory, FaExclamationTriangle, FaUser, FaDownload, FaCheckCircle, FaSpinner, FaShoppingCart, FaChartLine, FaGlassMartiniAlt, FaBox, FaInfoCircle, FaDatabase, FaTrash, FaUsers } from 'react-icons/fa';
import * as XLSX from 'xlsx';
import { db, rtdb } from '../api/firebase';
import { ref, set, onValue } from 'firebase/database';
import { collection, getDocs, writeBatch, doc, Timestamp, query, where } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import GlobalSpinner from '../components/GlobalSpinner';
import { SPINNER_VARIANTS } from '../constants';
import toast from 'react-hot-toast';

const MAESTRO_COLUMNS = ['Loc', 'Codigo', 'Cliente', 'Dirección', 'Loc. Com.', 'Mesa Com', 'Ruta com', 'Ruta', 'Segmento', 'SEG.DIAS', 'SEM. PREV', 'SubCanal'];
const DEMANDA_COLUMNS = ['Entrega', 'Hora', 'Referencia de cliente', 'Fecha documento', 'Clase', 'Documento', 'Posición', 'Solicitante', 'Material', 'Nombre material', 'Cantidad', 'Medida', 'Valor', 'Moneda', 'Status', 'Motivo de rechazo', 'Bloqueo de factura'];

const REPORT_CARDS = [
  { id: 'volumen', label: 'Volumen', variant: 'success', icon: <FaShoppingCart /> },
  { id: 'eficiencia', label: 'Eficiencia', variant: 'primary', icon: <FaChartLine /> },
  { id: 'bebidas', label: 'Bebidas', variant: 'info', icon: <FaGlassMartiniAlt /> },
  { id: 'duplicados', label: 'Duplicados', variant: 'warning', icon: <FaBox /> },
  { id: 'cobertura', label: 'Cobertura', variant: 'danger', icon: <FaUsers /> }
] as const;

const emptyProgress = () => ({ volumen: 0, eficiencia: 0, bebidas: 0, duplicados: 0, cobertura: 0 });

const AdminUploadPage: FC = () => {
  const { userName, userEmail } = useAuth();
  const { sedes, beverageTypes } = useData();

  const [isUploading, setIsUploading] = useState(false);
  const [uploadingType, setUploadingType] = useState<'maestro' | 'demanda' | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [lastUploads, setLastUploads] = useState<Record<string, any>>({});
  const [metadataLoadingStatus, setMetadataLoadingStatus] = useState<Record<string, boolean>>({ maestro: true, demanda: true });

  const [processingReports, setProcessingReports] = useState(false);
  const [reportProgress, setReportProgress] = useState<Record<string, number>>(emptyProgress());
  const [reportErrors, setReportErrors] = useState<Record<string, string>>({});
  const [reportesLast, setReportesLast] = useState<Record<string, { lastUpdated: string; processedBy: string } | null>>({});

  const [isUploadingHistorica, setIsUploadingHistorica] = useState(false);
  const [historicaProgress, setHistoricaProgress] = useState(0);
  const [historicaMsg, setHistoricaMsg] = useState<string | null>(null);

  const [deleteDate, setDeleteDate] = useState('');
  const [isDeletingDay, setIsDeletingDay] = useState(false);

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

  useEffect(() => {
    const unsubs = REPORT_CARDS.map(rep => {
      const r = ref(rtdb, `reportes/${rep.id}/metadata`);
      return onValue(r, (snapshot) => {
        setReportesLast(prev => ({ ...prev, [rep.id]: snapshot.exists() ? snapshot.val() : null }));
      });
    });
    return () => unsubs.forEach(unsub => unsub());
  }, []);

  const deleteDayHistorica = async () => {
    if (!deleteDate) return;
    if (!window.confirm(`¿Está seguro de borrar todos los registros del día ${deleteDate}? Esta acción no se puede deshacer.`)) return;

    setIsDeletingDay(true);
    try {
      const [year, month, day] = deleteDate.split('-').map(Number);
      const start = new Date(year, month - 1, day, 0, 0, 0, 0);
      const end = new Date(year, month - 1, day, 23, 59, 59, 999);

      const demandaColl = collection(db, 'demanda_historica');
      const q = query(
        demandaColl, 
        where('fecha', '>=', Timestamp.fromDate(start)), 
        where('fecha', '<=', Timestamp.fromDate(end))
      );
      const snap = await getDocs(q);

      if (snap.empty) {
        toast.error(`No se encontraron registros para el día ${deleteDate}.`);
        setIsDeletingDay(false);
        return;
      }

      const batchSize = 500;
      const docs = snap.docs;
      for (let i = 0; i < docs.length; i += batchSize) {
        const batch = writeBatch(db);
        docs.slice(i, i + batchSize).forEach(d => batch.delete(d.ref));
        await batch.commit();
      }

      toast.success(`¡Limpieza completada! Se eliminaron ${docs.length} registros del día ${deleteDate}.`);
    } catch (err: any) {
      console.error('Error al borrar día:', err);
      toast.error(`Error al borrar: ${err.message}`);
    } finally {
      setIsDeletingDay(false);
    }
  };

  const processHistorica = async (file: File) => {
    if (!file) return;
    setIsUploadingHistorica(true);
    setHistoricaProgress(0);
    setHistoricaMsg('Obteniendo Maestro para conversiones...');

    try {
      const [maestroSnap, prodSnap] = await Promise.all([
        new Promise<any[]>((res) => onValue(ref(rtdb, 'maestro/data'), (s) => res(s.exists() ? s.val() : []), { onlyOnce: true })),
        getDocs(collection(db, 'productos'))
      ]);
      
      const productsData = prodSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      const envaseTypeId = beverageTypes.find(t => t.nombre.toLowerCase().includes('envase'))?.id || '___NONE___';

      setHistoricaMsg('Iniciando Web Worker (Cálculo de Volumen CF/CU)...');
      
      const worker = new Worker(new URL('../utils/dataProcessor.worker.ts', import.meta.url), { type: 'module' });
      const fileArrayBuffer = await file.arrayBuffer();
      worker.postMessage({ 
        file: fileArrayBuffer, 
        maestroData: maestroSnap,
        productsData: productsData,
        envaseTypeId: envaseTypeId
      });

      worker.onmessage = async (e) => {
        const { success, results, error, metrics } = e.data;

        if (!success) {
          toast.error(`Error en procesamiento: ${error}`);
          setIsUploadingHistorica(false);
          worker.terminate();
          return;
        }

        try {
          const m = metrics || { totalRows: '?', matchedProducts: '?' };
          setHistoricaMsg(`Sincronizando ${results.length} visitas (${m.matchedProducts} productos vinculados)...`);

          const batchSize = 500;
          const demandaColl = collection(db, 'demanda_historica');

          for (let i = 0; i < results.length; i += batchSize) {
            const batch = writeBatch(db);
            const chunk = results.slice(i, i + batchSize);

            chunk.forEach((item: any) => {
              const docRef = doc(demandaColl, item.id);
              batch.set(docRef, {
                ...item,
                fecha: Timestamp.fromMillis(item.fecha),
                updatedAt: Timestamp.now()
              });
            });

            await batch.commit();
            const currentProgress = Math.min(Math.round(((i + chunk.length) / results.length) * 100), 100);
            setHistoricaProgress(currentProgress);
          }

          toast.success(`¡Analítica Pro actualizada! ${results.length} visitas, ${m.totalRows} filas procesadas.`);
          setIsUploadingHistorica(false);
          setHistoricaMsg(null);
        } catch (syncErr: any) {
          console.error('Error sincronizando con Firestore:', syncErr);
          toast.error(`Error de base de datos: ${syncErr.message}`);
          setIsUploadingHistorica(false);
        } finally {
          worker.terminate();
        }
      };

    } catch (err: any) {
      toast.error(err.message);
      setIsUploadingHistorica(false);
    }
  };

  const downloadTemplate = (type: 'maestro' | 'demanda') => {
    const columns = type === 'maestro' ? MAESTRO_COLUMNS : DEMANDA_COLUMNS;
    const ws = XLSX.utils.aoa_to_sheet([columns]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Plantilla ${type}`);
    XLSX.writeFile(wb, `Plantilla_${type.charAt(0).toUpperCase() + type.slice(1)}_Inventario.xlsx`);
    toast.success(`Plantilla descargada`);
  };

  const sanitizeKey = (key: string) => key.replace(/[\.\$#\[\]\/]/g, '').trim();

  const resetUpload = () => {
    setIsUploading(false);
    setUploadingType(null);
    setUploadProgress(0);
  };

  const processMaestroFile = (file: File) => {
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
        await set(ref(rtdb, 'maestro'), { 
          metadata: { updatedAt: new Date().toLocaleString(), rowCount: sanitizedData.length, userName: userName || userEmail }, 
          data: sanitizedData 
        });
        setUploadProgress(100);
        toast.success('MAESTRO sincronizado');
      } catch (err: any) {
        toast.error(err.message);
      } finally {
        setTimeout(resetUpload, 1200);
      }
    };
    reader.readAsBinaryString(file);
  };

  const processDemandaFile = async (file: File) => {
    try {
      setProcessingReports(true);
      setReportErrors({});
      setReportProgress(emptyProgress());

      setUploadProgress(20);
      const [maestroData, prodSnap] = await Promise.all([
        new Promise<any[]>((res) => onValue(ref(rtdb, 'maestro/data'), (s) => res(s.exists() ? s.val() : []), { onlyOnce: true })),
        getDocs(collection(db, 'productos'))
      ]);
      const productsData = prodSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setUploadProgress(40);

      const fileArrayBuffer = await file.arrayBuffer();
      const worker = new Worker(new URL('../utils/demandaProcessor.worker.ts', import.meta.url), { type: 'module' });

      const finish = () => {
        worker.terminate();
        resetUpload();
        setTimeout(() => {
          setProcessingReports(false);
          setReportProgress(emptyProgress());
        }, 2500);
      };

      worker.onmessage = async (e) => {
        const msg = e.data;

        if (msg.type === 'progress') {
          setReportProgress(prev => ({ ...prev, [msg.report]: msg.pct }));
          return;
        }

        if (!msg.success) {
          toast.error(`Error en procesamiento: ${msg.error}`);
          setProcessingReports(false);
          finish();
          return;
        }

        if (msg.sanitizedData.length === 0) {
          toast.error('Archivo vacío');
          setProcessingReports(false);
          finish();
          return;
        }

        try {
          setUploadProgress(60);
          await set(ref(rtdb, 'demanda'), {
            metadata: { updatedAt: new Date().toLocaleString(), rowCount: msg.sanitizedData.length, userName: userName || userEmail },
            data: msg.sanitizedData
          });
          setUploadProgress(100);
          toast.success('DEMANDA sincronizada');

          const metadata = { lastUpdated: new Date().toLocaleString(), processedBy: userName || userEmail };
          const failed: string[] = [];

          for (const rep of REPORT_CARDS) {
            setReportProgress(prev => ({ ...prev, [rep.id]: 98 }));
            try {
              await set(ref(rtdb, `reportes/${rep.id}`), { data: msg.reports[rep.id] || [], metadata });
              setReportProgress(prev => ({ ...prev, [rep.id]: 100 }));
            } catch (err: any) {
              failed.push(rep.label);
              setReportErrors(prev => ({ ...prev, [rep.id]: err?.message || 'Error al guardar' }));
            }
          }

          if (failed.length > 0) toast.error(`No se pudieron guardar: ${failed.join(', ')}`);
        } catch (err: any) {
          toast.error(err.message);
        } finally {
          finish();
        }
      };

      worker.onerror = (err) => {
        toast.error(`Fallo del procesador: ${err.message}`);
        setProcessingReports(false);
        worker.terminate();
        resetUpload();
      };

      worker.postMessage({ file: fileArrayBuffer, maestroData, productsData, sedes, beverageTypes });
    } catch (err: any) {
      toast.error(err.message);
      setProcessingReports(false);
      resetUpload();
    }
  };

  const processFile = (file: File, type: 'maestro' | 'demanda') => {
    if (!file) return;
    setIsUploading(true);
    setUploadingType(type);
    setUploadProgress(10);

    if (type === 'demanda') {
      processDemandaFile(file);
    } else {
      processMaestroFile(file);
    }
  };

  const renderUploadCard = (type: 'maestro' | 'demanda') => {
    const isMaestro = type === 'maestro';
    return (
      <Col key={type} xs={12} xl={isMaestro ? 5 : 7} className="px-0 m-0">
        <div className="p-3 p-md-4 h-100 admin-border-industrial d-flex flex-column" style={{ backgroundColor: 'var(--theme-background-secondary)' }}>
          <div className="d-flex align-items-center mb-3">
            <div className="p-3 me-3 d-flex align-items-center justify-content-center" style={{ backgroundColor: 'var(--theme-icon-bg)', border: '1px solid var(--theme-border-default)' }}>
              <FaFileExcel className={`text-${isMaestro ? 'danger' : 'primary'} fs-3`} />
            </div>
            <div className="flex-grow-1 min-width-0">
              <h6 className="mb-0 fw-black text-uppercase text-truncate" style={{ letterSpacing: '1px' }}>{type}</h6>
              <small className="text-secondary fw-bold text-truncate d-block" style={{ fontSize: '0.6rem' }}>SISTEMA DE REEMPLAZO TOTAL</small>
            </div>
            <Button
              variant="link"
              className="p-0 text-secondary flex-shrink-0"
              title={`Descargar plantilla de ${type}`}
              aria-label={`Descargar plantilla de ${type}`}
              onClick={() => downloadTemplate(type)}
            >
              <FaDownload size={16} />
            </Button>
          </div>

          <p className="mb-4 text-secondary" style={{ fontSize: '0.8rem' }}>
            {isMaestro ? 'Cargue el catálogo maestro de clientes y rutas.' : 'Actualice la demanda diaria para sincronizar cuotas.'}
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
            <Form.Label htmlFor={`upload-${type}`} className={`btn btn-outline-${isMaestro ? 'danger' : 'primary'} w-100 py-2 fw-black text-uppercase`} style={{ fontSize: '0.75rem' }}>
              <FaCloudUploadAlt className="me-2 fs-5" /> Sincronizar {type}
            </Form.Label>
            <Form.Control id={`upload-${type}`} type="file" accept=".xlsx, .xls, .csv" hidden onChange={(e: any) => processFile(e.target.files?.[0], type)} disabled={isUploading} />
          </Form.Group>

          {isUploading && uploadingType === type && (
            <div className="mt-3 p-3" style={{ backgroundColor: 'var(--theme-background-tertiary)', border: '1px solid var(--theme-border-default)' }}>
              <div className="d-flex justify-content-between mb-2 small fw-black text-uppercase">
                <span className="text-secondary">Sincronización Cruda</span>
                <span className={isMaestro ? 'text-danger' : 'text-primary'}>{uploadProgress}%</span>
              </div>
              <ProgressBar now={uploadProgress} variant={isMaestro ? 'danger' : 'primary'} style={{ height: '4px' }} />
            </div>
          )}

          {!isMaestro && (
            <div className="mt-4">
              <div className="d-flex align-items-center gap-2 mb-3">
                <FaSpinner className={`${processingReports ? 'spinner-animation' : ''} text-danger`} size={16} />
                <h6 className="mb-0 fw-black text-uppercase" style={{ fontSize: '0.75rem', letterSpacing: '1px' }}>Reportes de Demanda</h6>
              </div>
              <Row className="g-2 g-md-3">
                {REPORT_CARDS.map(rep => {
                  const pct = reportProgress[rep.id] || 0;
                  const err = reportErrors[rep.id];
                  const last = reportesLast[rep.id];
                  return (
                    <Col key={rep.id} xs={12} md={6}>
                      <div className="p-2 h-100" style={{ backgroundColor: 'var(--theme-background-tertiary)', border: '1px solid var(--theme-border-default)' }}>
                        <div className="d-flex align-items-center gap-2 mb-1">
                          <span className={`text-${rep.variant} flex-shrink-0`}>{rep.icon}</span>
                          <span className="flex-grow-1 text-uppercase fw-black text-truncate" style={{ fontSize: '0.55rem', letterSpacing: '0.5px' }}>{rep.label}</span>
                          {err ? (
                            <span className="fw-black text-danger flex-shrink-0" style={{ fontSize: '0.55rem' }} title={err}>ERROR</span>
                          ) : processingReports ? (
                            <span className={`fw-black text-${rep.variant} flex-shrink-0`} style={{ fontSize: '0.55rem' }}>{pct === 100 ? 'LISTO' : `${pct}%`}</span>
                          ) : last?.lastUpdated ? (
                            <span className="fw-black text-secondary flex-shrink-0 text-truncate" style={{ fontSize: '0.5rem' }} title={`Procesado por: ${last.processedBy || 'N/A'}`}>ÚLT. {last.lastUpdated}</span>
                          ) : (
                            <span className="fw-black text-secondary flex-shrink-0" style={{ fontSize: '0.5rem' }}>EN ESPERA</span>
                          )}
                        </div>
                        <ProgressBar now={pct} variant={rep.variant} style={{ height: '3px', opacity: processingReports ? 1 : 0.4 }} />
                      </div>
                    </Col>
                  );
                })}
              </Row>
            </div>
          )}
        </div>
      </Col>
    );
  };

  return (
    <Fragment>
      <Container fluid className="p-0">
        <div className="admin-layout-container">
          <div className="admin-section-table">
            <div className="flex-grow-1 overflow-auto custom-scrollbar p-2 p-md-3">
              <Alert variant="warning" className="d-flex align-items-center mb-4 border-0 mx-0 accent-border-left-danger" style={{ backgroundColor: 'rgba(244, 0, 9, 0.1)', color: 'var(--theme-text-primary)' }}>
                <FaExclamationTriangle className="me-3 fs-4 flex-shrink-0 text-danger" />
                <div style={{ fontSize: '0.85rem' }}>
                  <strong>Atención:</strong> Al subir un nuevo archivo, el sistema <strong>reemplazará completamente</strong> la información existente y regenerará los reportes.
                </div>
              </Alert>

              <Row className="g-3 g-md-4 m-0 w-100 mb-4">
                {renderUploadCard('maestro')}
                {renderUploadCard('demanda')}
              </Row>

              <div className="admin-border-industrial accent-border-left-warning p-4 mb-4" style={{ backgroundColor: 'var(--theme-background-secondary)' }}>
                <div className="d-flex align-items-center mb-3">
                  <div className="p-3 me-3 d-flex align-items-center justify-content-center" style={{ backgroundColor: 'rgba(255, 193, 7, 0.1)', border: '1px solid #ffc107' }}>
                    <FaDatabase className="text-warning fs-3" />
                  </div>
                  <div className="flex-grow-1">
                    <h6 className="mb-0 fw-black text-uppercase" style={{ letterSpacing: '1px' }}>Carga Histórica: Analítica Pro</h6>
                    <small className="text-warning fw-bold" style={{ fontSize: '0.6rem', textTransform: 'uppercase' }}>Sistema Acumulativo e Inteligente (Firestore)</small>
                  </div>
                </div>

                <p className="mb-4 text-secondary" style={{ fontSize: '0.8rem' }}>
                  A diferencia de la carga diaria, este proceso <strong>agrega</strong> la información al historial existente. 
                  Calcula automáticamente CF/CU y agrupa por cliente/día para análisis de tendencias de largo plazo.
                </p>

                <Row className="g-3">
                  <Col xs={12} md={8}>
                    {isUploadingHistorica ? (
                      <div className="p-3 border h-100" style={{ backgroundColor: 'var(--theme-background-tertiary)', borderColor: 'var(--theme-border-default)' }}>
                        <div className="d-flex justify-content-between mb-2 small fw-black text-uppercase">
                          <span className="text-secondary">{historicaMsg || 'Procesando...'}</span>
                          <span className="text-warning">{historicaProgress}%</span>
                        </div>
                        <ProgressBar now={historicaProgress} variant="warning" style={{ height: '4px' }} />
                      </div>
                    ) : (
                      <Form.Group className="h-100">
                        <Form.Label htmlFor="upload-historica" className="btn btn-outline-warning w-100 h-100 d-flex align-items-center justify-content-center py-3 fw-black text-uppercase" style={{ fontSize: '0.8rem' }}>
                          <FaCloudUploadAlt className="me-2 fs-5" /> Iniciar Carga Histórica Inteligente
                        </Form.Label>
                        <Form.Control id="upload-historica" type="file" accept=".xlsx, .xls, .csv" hidden onChange={(e: any) => processHistorica(e.target.files?.[0])} disabled={isUploadingHistorica} />
                      </Form.Group>
                    )}
                  </Col>
                  <Col xs={12} md={4}>
                    <div className="p-3 border h-100" style={{ backgroundColor: 'var(--theme-background-tertiary)', borderColor: 'var(--theme-border-default)' }}>
                      <label className="small fw-black text-uppercase text-secondary mb-2" style={{ fontSize: '0.6rem' }}>Mantenimiento de Datos</label>
                      <div className="d-flex gap-2">
                        <Form.Control
                          type="date"
                          value={deleteDate}
                          onChange={(e) => setDeleteDate(e.target.value)}
                          className="bg-transparent border-secondary border-opacity-25"
                          style={{ fontSize: '0.75rem', color: 'var(--theme-text-primary)' }}
                          aria-label="Fecha de registros a eliminar"
                          disabled={isDeletingDay}
                        />
                        <Button
                          variant="danger"
                          size="sm"
                          className="fw-black text-uppercase px-3"
                          style={{ fontSize: '0.7rem' }}
                          onClick={deleteDayHistorica}
                          title="Eliminar todos los registros del día seleccionado"
                          aria-label="Eliminar todos los registros del día seleccionado"
                          disabled={isDeletingDay || !deleteDate}
                        >
                          {isDeletingDay ? <Spinner size="sm" animation="border" /> : <FaTrash />}
                        </Button>
                      </div>
                    </div>
                  </Col>
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
        .accent-border-left-danger { border-left: 4px solid var(--color-red-primary) !important; }
        .accent-border-left-warning { border-left: 4px solid #ffc107 !important; }
      `}</style>
    </Fragment>
  );
};

export default AdminUploadPage;
