import type { FC } from 'react';
import { memo, useState, useEffect } from 'react';
import { Table, Button } from 'react-bootstrap';
import SearchInput from '../../components/SearchInput';

interface ClientsTabProps {
  clientSearch: string;
  setClientSearch: (v: string) => void;
  clientSort: any;
  handleSort: (k: string, set: any) => void;
  setClientSort: any;
  finalRfmResults: any[];
  SortHeader: any;
  isMobile?: boolean;
}

const ROWS_PER_PAGE = 50;

const ClientsTab: FC<ClientsTabProps> = memo(({ 
  clientSearch, setClientSearch, clientSort, handleSort, setClientSort, finalRfmResults, SortHeader, isMobile = false 
}) => {
  const [visibleRows, setVisibleRows] = useState(ROWS_PER_PAGE);

  useEffect(() => {
    setVisibleRows(ROWS_PER_PAGE);
  }, [clientSearch, clientSort]);

  const displayedResults = finalRfmResults.slice(0, visibleRows);
  const hasMore = visibleRows < finalRfmResults.length;

  const SORT_KEYS = [
    { label: 'SEDE', key: 'sedeNombre' },
    { label: 'RUTA', key: 'ruta' },
    { label: 'CLIENTE', key: 'clientName' },
    { label: '$', key: 'monetary' },
    { label: 'CF', key: 'cf' },
    { label: 'CU', key: 'cu' },
  ];

  return (
    <div className="d-flex flex-column h-100">
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
          {isMobile ? (
            <>
              <div className="d-flex gap-1 p-2 flex-shrink-0 overflow-auto" style={{ borderBottom: '1px solid var(--theme-table-border-color)' }}>
                {SORT_KEYS.map(({ label, key }) => {
                  const active = clientSort?.key === key;
                  return (
                    <button
                      key={key}
                      className="btn btn-sm fw-black text-uppercase flex-shrink-0"
                      style={{
                        fontSize: '0.6rem',
                        padding: '4px 8px',
                        backgroundColor: active ? 'var(--color-red-primary)' : 'var(--theme-background-tertiary)',
                        color: active ? 'var(--color-white)' : 'var(--theme-text-secondary)',
                        border: '1px solid var(--theme-border-default)',
                      }}
                      onClick={() => handleSort(key, setClientSort)}
                    >
                      {label} {active && (clientSort.dir === 'asc' ? '▲' : '▼')}
                    </button>
                  );
                })}
              </div>

              <div className="d-flex flex-column gap-1 p-2">
                {displayedResults.map((r) => (
                  <div key={r.clientId} style={{ border: '1px solid var(--theme-border-default)', padding: '10px 12px', backgroundColor: 'var(--theme-background-primary)' }}>
                    <div className="d-flex justify-content-between align-items-start mb-1">
                      <span className="fw-black text-uppercase" style={{ fontSize: '0.8rem', color: 'var(--theme-text-primary)' }}>{r.clientName}</span>
                    </div>
                    <div className="mb-1" style={{ fontSize: '0.65rem', color: 'var(--theme-text-secondary)' }}>
                      ID: {r.clientId}
                    </div>
                    <div className="d-flex gap-2 mb-2" style={{ fontSize: '0.7rem', color: 'var(--theme-text-secondary)' }}>
                      <span>{r.sedeNombre}</span>
                      <span>·</span>
                      <span>RUTA {r.ruta}</span>
                    </div>
                    <div className="d-flex justify-content-between" style={{ borderTop: '1px solid var(--theme-table-border-color)', paddingTop: '8px' }}>
                      <div className="text-center">
                        <div style={{ fontSize: '0.55rem', color: 'var(--theme-text-secondary)', textTransform: 'uppercase' }}>$</div>
                        <div className="fw-black text-info" style={{ fontSize: '0.8rem' }}>${r.monetary.toLocaleString()}</div>
                      </div>
                      <div className="text-center">
                        <div style={{ fontSize: '0.55rem', color: 'var(--theme-text-secondary)', textTransform: 'uppercase' }}>CF</div>
                        <div className="fw-black text-success" style={{ fontSize: '0.8rem' }}>{r.cf.toLocaleString(undefined, { maximumFractionDigits: 1 })}</div>
                      </div>
                      <div className="text-center">
                        <div style={{ fontSize: '0.55rem', color: 'var(--theme-text-secondary)', textTransform: 'uppercase' }}>CU</div>
                        <div className="fw-black text-warning" style={{ fontSize: '0.8rem' }}>{r.cu.toLocaleString(undefined, { maximumFractionDigits: 1 })}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <Table responsive hover className="mb-0 industrial-table-v2">
              <thead className="sticky-top" style={{ backgroundColor: 'var(--theme-background-tertiary)', zIndex: 10 }}>
                <tr>
                  <SortHeader label="SEDE" sortKey="sedeNombre" currentSort={clientSort} onSort={(k: string) => handleSort(k, setClientSort)} />
                  <SortHeader label="RUTA" sortKey="ruta" currentSort={clientSort} onSort={(k: string) => handleSort(k, setClientSort)} />
                  <SortHeader label="CLIENTE" sortKey="clientName" currentSort={clientSort} onSort={(k: string) => handleSort(k, setClientSort)} />
                  <SortHeader label="V. MONETARIO ($)" sortKey="monetary" currentSort={clientSort} onSort={(k: string) => handleSort(k, setClientSort)} align="end" />
                  <SortHeader label="VOLUMEN (CF)" sortKey="cf" currentSort={clientSort} onSort={(k: string) => handleSort(k, setClientSort)} align="end" />
                  <SortHeader label="VOLUMEN (CU)" sortKey="cu" currentSort={clientSort} onSort={(k: string) => handleSort(k, setClientSort)} align="end" />
                </tr>
              </thead>
              <tbody>
                {displayedResults.map((r) => (
                  <tr key={r.clientId}>
                    <td className="align-middle fw-black text-uppercase" style={{ fontSize: '0.8rem' }}>{r.sedeNombre}</td>
                    <td className="align-middle fw-black text-uppercase" style={{ fontSize: '0.8rem' }}>{r.ruta}</td>
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
          )}
          
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
