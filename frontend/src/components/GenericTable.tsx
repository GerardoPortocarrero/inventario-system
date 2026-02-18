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
            className="mb-3" // Clases base, el borde se gestiona en CSS. El padding se gestiona en los contenedores internos.
            bg={variant} 
            text={variant === 'dark' ? 'white' : 'dark'}
          >
            {/* Contenedor explícito para la información */}
            <div className="card-information-container p-3"> {/* Padding aplicado aquí */}
              {columns
                .filter(column => column.header !== UI_TEXTS.TABLE_HEADER_ACTIONS)
                .map((column, idx) => (
                  <Row key={idx} className="mb-2 align-items-center">
                    <Col xs="auto" className="text-secondary fw-bold"> 
                      {column.header}:
                    </Col>
                    <Col xs className="fw-bold text-wrap text-end">
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
              <div className="card-actions-container border-top pt-2 pb-2 d-flex justify-content-end gap-2 px-2"> {/* Separador, padding y alineación */}
                <Button variant="primary" size="sm">
                  Editar
                </Button>
                <Button variant="danger" size="sm">
                  Eliminar
                </Button>
              </div>
            )}
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