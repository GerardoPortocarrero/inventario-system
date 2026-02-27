import React from 'react';
import { Table, Card, Row, Col } from 'react-bootstrap';
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
  isLoading?: boolean;
}

const GenericTable = <T extends { id: string }>({
  data,
  columns,
  variant,
  noRecordsMessage = UI_TEXTS.NO_RECORDS_FOUND,
  isLoading = false
}: GenericTableProps<T>) => {
  const isMobile = useMediaQuery('(max-width: 768px)');

  if (isLoading) {
    return (
      <div className="d-flex justify-content-center align-items-center p-5" style={{ minHeight: '300px' }}>
        <div className="spinner-border text-danger" role="status">
          <span className="visually-hidden">Cargando...</span>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="text-center p-5 text-secondary fw-bold" style={{ minHeight: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
            className="mb-3" // Clases base, el borde se gestiona en CSS.
          >
            {/* Contenedor explícito para la información */}
            <div className="card-information-container p-3"> {/* Padding aplicado aquí */}
              {columns
                .filter(column => column.header !== UI_TEXTS.TABLE_HEADER_ACTIONS)
                .map((column, idx) => (
                  <Row key={idx} className="mb-2 align-items-center">
                    <Col xs="auto" className="text-secondary fw-bold" style={{ fontSize: '0.8rem' }}> 
                      {column.header}:
                    </Col>
                    <Col xs className="fw-bold text-wrap text-end" style={{ color: 'var(--theme-text-primary)', fontSize: '0.9rem' }}>
                      {column.render
                        ? column.render(item)
                        : (column.accessorKey
                            ? (item[column.accessorKey] as React.ReactNode)
                            : null
                          )
                      }
                    </Col>
                  </Row>
                ))}
            </div>

            {/* Contenedor explícito para los botones de acción */}
            {columns.find(column => column.header === UI_TEXTS.TABLE_HEADER_ACTIONS) && (
              <>
                {/* Separador de línea fina */}
                <div
                  style={{ height: '1px', backgroundColor: 'var(--theme-border-default)' }}
                ></div>
                <div 
                  className="card-actions-container pt-2 pb-2 d-flex justify-content-end gap-2 px-2"
                >
                  {columns.find(column => column.header === UI_TEXTS.TABLE_HEADER_ACTIONS)?.render?.(item)}
                </div>
              </>
            )}
          </Card>
        ))}
      </div>
    );
  }

  // Vista de Escritorio (Tabla) - Sin scrollbar interno
  return (
    <div>
      <Table responsive hover className="mb-0">
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