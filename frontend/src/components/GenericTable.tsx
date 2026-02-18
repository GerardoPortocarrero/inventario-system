import React from 'react';
import { Table, Card, Row, Col, Button } from 'react-bootstrap';
import { UI_TEXTS } from '../constants';
import useMediaQuery from '../hooks/useMediaQuery';
import './GenericTable.css'; // Importar los estilos para la tarjeta

// Define la interfaz para la configuración de una columna
export interface Column<T> {
  header: string;
  accessorKey?: keyof T;
  render?: (item: T) => React.ReactNode;
}

// Define la interfaz para las props de GenericTable
interface GenericTableProps<T> {
  data: T[];
  columns: Column<T>[];
  variant?: 'dark' | 'light' | '';
  noRecordsMessage?: string;
}

const GenericTable = <T extends { id: string }>({
  data,
  columns,
  variant,
  noRecordsMessage = UI_TEXTS.NO_RECORDS_FOUND
}: GenericTableProps<T>) => {
  const isMobile = useMediaQuery('(max-width: 768px)');

  if (data.length === 0) {
    return (
      <div className="text-center p-4">
        {noRecordsMessage}
      </div>
    );
  }

  // Vista Móvil (Tarjetas) - Diseño adaptativo y encapsulado
  if (isMobile) {
    return (
      <div id="generic-table-mobile-view" className="generic-table-wrapper">
        {data.map((item) => (
          <Card 
            key={item.id} 
            className="mb-3" // Clases base, el borde y padding se gestionan en CSS
            bg={variant} 
            text={variant === 'dark' ? 'white' : 'dark'}
          >
            {columns.map((column, idx) => (
              <React.Fragment key={idx}>
                {column.header === UI_TEXTS.TABLE_HEADER_ACTIONS && <hr className="mt-2 mb-2" />} {/* Separador visual */}
                <Row className="mb-2 align-items-center">
                  {/* Columna para la etiqueta (auto-ajustable) con mejor contraste y negrita */}
                  {column.header !== UI_TEXTS.TABLE_HEADER_ACTIONS && ( // Ocultar etiqueta "Acciones"
                    <Col xs="auto" className="text-secondary fw-bold"> 
                      {column.header}:
                    </Col>
                  )}
                  {/* Columna para el valor (ocupa el resto del espacio) */}
                  <Col xs={column.header === UI_TEXTS.TABLE_HEADER_ACTIONS ? 12 : true} className="fw-bold text-wrap text-end">
                    {column.header === UI_TEXTS.TABLE_HEADER_ACTIONS ? (
                      // Renderizar botones de texto para la vista responsive
                      <>
                        <Button variant="primary" size="sm" className="me-2">
                          Editar
                        </Button>
                        <Button variant="danger" size="sm">
                          Eliminar
                        </Button>
                      </>
                    ) : (
                      // Renderizar el contenido normal de la columna
                      column.render
                        ? column.render(item)
                        : (column.accessorKey
                            ? (item[column.accessorKey] as React.ReactNode)
                            : null
                          )
                    )}
                  </Col>
                </Row>
              </React.Fragment>
            ))}
          </Card>
        ))}
      </div>
    );
  }

  // Vista de Escritorio (Tabla) - Sin scrollbar interno
  return (
    <div>
      <Table responsive variant={variant}>
        <thead>
          <tr>
            {columns.map((column, idx) => (
              <th key={idx}>{column.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr key={item.id}>
              {columns.map((column, idx) => (
                <td key={idx}>
                  {column.render
                    ? column.render(item)
                    : (column.accessorKey
                        ? (item[column.accessorKey] as React.ReactNode)
                        : null
                      )
                  }
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
};

export default GenericTable;