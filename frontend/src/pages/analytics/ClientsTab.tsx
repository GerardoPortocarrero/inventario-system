import type { FC } from 'react';
import { memo, useState, useMemo } from 'react';
import { Row, Col, Badge, Table, Button } from 'react-bootstrap';
import { FaUsers, FaSort, FaSortUp, FaSortDown } from 'react-icons/fa';
import SearchInput from '../../components/SearchInput';

interface ClientsTabProps {
  clientSearch: string;
  setClientSearch: (v: string) => void;
  clientSort: any;
  handleSort: (k: string, set: any) => void;
  setClientSort: any;
  finalRfmResults: any[];
  SortHeader: any;
}

const ROWS_PER_PAGE = 50;

const ClientsTab: FC<ClientsTabProps> = memo(({ 
  clientSearch, setClientSearch, clientSort, handleSort, setClientSort, finalRfmResults, SortHeader 
}) => {
  const [visibleRows, setVisibleRows] = useState(ROWS_PER_PAGE);

  // Resetear scroll al buscar
  useMemo(() => {
    setVisibleRows(ROWS_PER_PAGE);
  }, [clientSearch, clientSort]);

  const displayedResults = finalRfmResults.slice(0, visibleRows);
  const hasMore = visibleRows < finalRfmResults.length;

  return (
    <div className="d-flex flex-column h-100">
      <div className="d-flex justify-content-between align-items-center mb-4 flex-shrink-0">
        <div className="d-flex align-items-center gap-2">
          <h5 className="fw-black mb-0 text-uppercase"><FaUsers className="text-danger" /> Maestro de Clientes</h5>
        </div>
        <Badge bg="secondary" className="border border-secondary px-3 py-2 fw-black">TOTAL: {finalRfmResults.length} REGISTROS</Badge>
      </div>

      <div className="admin-border-industrial d-flex flex-column flex-grow-1 overflow-hidden" style={{ backgroundColor: 'var(--theme-background-secondary)' }}>
        <div className="p-3 border-bottom border-secondary border-opacity-10 flex-shrink-0">
          <SearchInput 
            searchTerm={clientSearch} 
            onSearchChange={setClientSearch} 
            placeholder="BUSCAR CLIENTE POR NOMBRE O ID (MÍN. 3 CARACTERES)..." 
            className="mb-0" 
          />
        </div>
        
        <div className="flex-grow-1 overflow-auto custom-scrollbar">
          <Table responsive hover className="mb-0 industrial-table-v2">
            <thead className="sticky-top" style={{ backgroundColor: 'var(--theme-background-tertiary)', zIndex: 10 }}>
              <tr>
                <SortHeader label="CLIENTE" sortKey="clientName" currentSort={clientSort} onSort={(k: string) => handleSort(k, setClientSort)} />
                <SortHeader label="V. MONETARIO ($)" sortKey="monetary" currentSort={clientSort} onSort={(k: string) => handleSort(k, setClientSort)} align="end" />
                <SortHeader label="VOLUMEN (CF)" sortKey="cf" currentSort={clientSort} onSort={(k: string) => handleSort(k, setClientSort)} align="end" />
                <SortHeader label="VOLUMEN (CU)" sortKey="cu" currentSort={clientSort} onSort={(k: string) => handleSort(k, setClientSort)} align="end" />
              </tr>
            </thead>
            <tbody>
              {displayedResults.map((r) => (
                <tr key={r.clientId}>
                  <td className="ps-4">
                    <div className="d-flex flex-column">
                      <span className="fw-black text-uppercase" style={{ fontSize: '0.85rem' }}>{r.clientName}</span>
                      <span className="text-secondary" style={{ fontSize: '0.65rem' }}>ID: {r.clientId}</span>
                    </div>
                  </td>
                  <td className="text-end align-middle fw-black text-info">${r.monetary.toLocaleString()}</td>
                  <td className="text-end align-middle fw-black text-success">{r.cf.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
                  <td className="text-end align-middle fw-black text-warning pe-4">{r.cu.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
                </tr>
              ))}
            </tbody>
          </Table>
          
          {hasMore && (
            <div className="p-4 text-center border-top border-secondary border-opacity-10">
              <Button 
                variant="outline-danger" 
                className="fw-black btn-sm px-5" 
                onClick={() => setVisibleRows(prev => prev + ROWS_PER_PAGE)}
              >
                CARGAR MÁS CLIENTES
              </Button>
            </div>
          )}
          
          {finalRfmResults.length === 0 && (
            <div className="p-5 text-center text-secondary fw-bold italic">
              No se encontraron resultados para la búsqueda
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export default ClientsTab;
