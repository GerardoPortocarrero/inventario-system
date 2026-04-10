import type { FC } from 'react';
import { useState } from 'react';
import { Row, Col, Card, Button, Form, ProgressBar, Alert } from 'react-bootstrap';
import { FaCloudUploadAlt, FaFileExcel, FaDatabase, FaHistory, FaExclamationTriangle } from 'react-icons/fa';
import * as XLSX from 'xlsx';
import { rtdb } from '../api/firebase';
import { ref, set, serverTimestamp } from 'firebase/database';
import toast from 'react-hot-toast';

const AdminUploadPage: FC = () => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [lastUploads, setLastUploads] = useState<{maestro?: any, demanda?: any}>({});

  const processFile = (file: File, type: 'maestro' | 'demanda') => {
    setIsUploading(true);
    setUploadProgress(10);
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet);

        setUploadProgress(50);

        if (jsonData.length === 0) {
          throw new Error('El archivo está vacío');
        }

        // Subida a Realtime Database (Reemplazo total)
        await set(ref(rtdb, type), {
          data: jsonData,
          updatedAt: serverTimestamp(),
          rowCount: jsonData.length
        });

        setUploadProgress(100);
        toast.success(`${type.toUpperCase()} actualizado con éxito (${jsonData.length} filas)`);
        
        setLastUploads(prev => ({
          ...prev,
          [type]: { date: new Date().toLocaleString(), count: jsonData.length }
        }));

      } catch (error: any) {
        console.error(error);
        toast.error(`Error: ${error.message}`);
      } finally {
        setTimeout(() => {
          setIsUploading(false);
          setUploadProgress(0);
        }, 1000);
      }
    };

    reader.onerror = () => {
      toast.error('Error al leer el archivo');
      setIsUploading(false);
    };

    reader.readAsBinaryString(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'maestro' | 'demanda') => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file, type);
    }
  };

  return (
    <div className="admin-layout-container flex-column">
      <div className="mb-4">
        <h4 className="fw-bold"><FaDatabase className="me-2 text-danger" /> Gestión de Datos Maestros</h4>
        <p className="text-secondary small">Carga masiva de información mediante archivos Excel o CSV.</p>
      </div>

      <Alert variant="warning" className="d-flex align-items-center">
        <FaExclamationTriangle className="me-3 fs-4" />
        <div>
          <strong>Atención:</strong> Al subir un nuevo archivo, el sistema <strong>reemplazará completamente</strong> la información existente en la colección seleccionada.
        </div>
      </Alert>

      {isUploading && (
        <div className="mb-4">
          <label className="small fw-bold mb-1">PROCESANDO INFORMACIÓN...</label>
          <ProgressBar animated now={uploadProgress} variant="danger" label={`${uploadProgress}%`} />
        </div>
      )}

      <Row className="g-4">
        {/* Sección MAESTRO */}
        <Col xs={12} lg={6}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body className="p-4 d-flex flex-column">
              <div className="d-flex align-items-center mb-3">
                <div className="bg-danger-subtle p-3 rounded-3 me-3">
                  <FaFileExcel className="text-danger fs-3" />
                </div>
                <div>
                  <h6 className="mb-0 fw-bold">Actualizar MAESTRO</h6>
                  <small className="text-secondary">~7k filas | 35 columnas</small>
                </div>
              </div>
              
              <p className="small text-muted flex-grow-1">
                Utilice esta sección para cargar el catálogo principal de productos, precios y datos logísticos base.
              </p>

              <div className="mt-auto">
                {lastUploads.maestro && (
                  <div className="mb-3 p-2 bg-light rounded small">
                    <FaHistory className="me-1" /> Última carga: {lastUploads.maestro.date} ({lastUploads.maestro.count} filas)
                  </div>
                )}
                <Form.Group controlId="uploadMaestro">
                  <Form.Label className="btn btn-outline-danger w-100 d-flex align-items-center justify-content-center py-2 cursor-pointer">
                    <FaCloudUploadAlt className="me-2" /> Seleccionar Archivo Maestro
                  </Form.Label>
                  <Form.Control 
                    type="file" 
                    accept=".xlsx, .xls, .csv" 
                    hidden 
                    onChange={(e: any) => handleFileChange(e, 'maestro')}
                    disabled={isUploading}
                  />
                </Form.Group>
              </div>
            </Card.Body>
          </Card>
        </Col>

        {/* Sección DEMANDA */}
        <Col xs={12} lg={6}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body className="p-4 d-flex flex-column">
              <div className="d-flex align-items-center mb-3">
                <div className="bg-primary-subtle p-3 rounded-3 me-3">
                  <FaFileExcel className="text-primary fs-3" />
                </div>
                <div>
                  <h6 className="mb-0 fw-bold">Actualizar DEMANDA</h6>
                  <small className="text-secondary">~16k filas | 10 columnas</small>
                </div>
              </div>

              <p className="small text-muted flex-grow-1">
                Utilice esta sección para actualizar las metas y requerimientos diarios. Esta operación se realiza hasta 4 veces al día.
              </p>

              <div className="mt-auto">
                {lastUploads.demanda && (
                  <div className="mb-3 p-2 bg-light rounded small">
                    <FaHistory className="me-1" /> Última carga: {lastUploads.demanda.date} ({lastUploads.demanda.count} filas)
                  </div>
                )}
                <Form.Group controlId="uploadDemanda">
                  <Form.Label className="btn btn-outline-primary w-100 d-flex align-items-center justify-content-center py-2 cursor-pointer">
                    <FaCloudUploadAlt className="me-2" /> Seleccionar Archivo Demanda
                  </Form.Label>
                  <Form.Control 
                    type="file" 
                    accept=".xlsx, .xls, .csv" 
                    hidden 
                    onChange={(e: any) => handleFileChange(e, 'demanda')}
                    disabled={isUploading}
                  />
                </Form.Group>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default AdminUploadPage;
