import React from 'react';
import { Table } from 'react-bootstrap';

// Define la interfaz para la configuración de una columna
export interface Column<T> {
  header: string; // El texto del encabezado de la columna
  accessorKey?: keyof T; // La clave del dato en el objeto para acceso directo (opcional)
  // Función para renderizar el contenido de la celda, útil para botones o formatos especiales (opcional)
  render?: (item: T) => React.ReactNode;
}

// Define la interfaz para las props de GenericTable
interface GenericTableProps<T> {
  data: T[]; // Los datos a mostrar en la tabla
  columns: Column<T>[]; // Configuración de las columnas
  variant?: 'dark' | 'light' | ''; // Variante de tema para la tabla
  maxHeight?: string; // Altura máxima para hacer la tabla scrollable
  noRecordsMessage?: string; // Mensaje cuando no hay registros
}

const GenericTable = <T extends { id: string }>({
  data,
  columns,
  variant,
  maxHeight = '70vh', // Altura máxima por defecto para scroll
  noRecordsMessage = 'No hay registros para mostrar.'
}: GenericTableProps<T>) => { // Corrected: Removed the FC<GenericTableProps<T>> return type annotation
  return (
    <div style={{ maxHeight: maxHeight, overflowY: 'auto' }}>
      <Table responsive variant={variant}>
        <thead>
          <tr>
            {columns.map((column, idx) => (
              <th key={idx}>{column.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="text-center">
                {noRecordsMessage}
              </td>
            </tr>
          ) : (
            data.map((item) => (
              <tr key={item.id}> {/* Asume que cada item tiene una propiedad 'id' */}
                {columns.map((column, idx) => (
                  <td key={idx}>
                    {column.render // Si hay un renderizador custom, usarlo
                      ? column.render(item)
                      : (column.accessorKey // Si no, y hay accessorKey, usarlo para mostrar el valor
                          ? (item[column.accessorKey] as React.ReactNode)
                          : null // Si no hay render ni accessorKey, no mostrar nada (o podrías lanzar un error)
                        )
                    }
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </Table>
    </div>
  );
};

export default GenericTable;
