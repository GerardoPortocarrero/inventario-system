import type { FC } from 'react';
import { memo, useState, useEffect } from 'react';
import { Table, Button } from 'react-bootstrap';
import SearchInput from '../../components/SearchInput';

interface ProductsTabProps {
  productSearch: string;
  setProductSearch: (v: string) => void;
  productSort: any;
  handleSort: (k: string, set: any) => void;
  setProductSort: any;
  finalProductPerformance: any[];
  SortHeader: any;
  isMobile?: boolean;
}

const ROWS_PER_PAGE = 50;

const ProductsTab: FC<ProductsTabProps> = memo(({ 
  productSearch, setProductSearch, productSort, handleSort, setProductSort, finalProductPerformance, SortHeader, isMobile = false 
}) => {
  const [visibleRows, setVisibleRows] = useState(ROWS_PER_PAGE);

  useEffect(() => {
    setVisibleRows(ROWS_PER_PAGE);
  }, [productSearch, productSort]);

  const displayedResults = finalProductPerformance.slice(0, visibleRows);
  const hasMore = visibleRows < finalProductPerformance.length;

  const SORT_KEYS = [
    { label: 'PRODUCTO', key: 'name' },
    { label: 'VALOR', key: 'valor' },
    { label: 'CF', key: 'cf' },
    { label: 'CU', key: 'cu' },
  ];

  return (
    <div className="d-flex flex-column h-100">

      <div className="admin-border-industrial d-flex flex-column flex-grow-1 overflow-hidden" style={{ backgroundColor: 'var(--theme-background-secondary)' }}>
        <div className="p-3 border-bottom border-secondary border-opacity-10 flex-shrink-0">
          <SearchInput 
            searchTerm={productSearch} 
            onSearchChange={setProductSearch} 
            placeholder="BUSCAR PRODUCTO POR NOMBRE O SAP (MÍN. 3 CARACTERES)..." 
            className="mb-0" 
          />
        </div>
        
        <div className="flex-grow-1 overflow-auto custom-scrollbar">
          {isMobile ? (
            <>
              <div className="d-flex gap-1 p-2 flex-shrink-0 overflow-auto" style={{ borderBottom: '1px solid var(--theme-table-border-color)' }}>
                {SORT_KEYS.map(({ label, key }) => {
                  const active = productSort?.key === key;
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
                      onClick={() => handleSort(key, setProductSort)}
                    >
                      {label} {active && (productSort.dir === 'asc' ? '▲' : '▼')}
                    </button>
                  );
                })}
              </div>

              <div className="d-flex flex-column gap-1 p-2">
                {displayedResults.map((p) => (
                  <div key={p.sap} style={{ border: '1px solid var(--theme-border-default)', padding: '10px 12px', backgroundColor: 'var(--theme-background-primary)' }}>
                    <div className="d-flex justify-content-between align-items-start mb-1">
                      <span className="fw-black text-uppercase" style={{ fontSize: '0.75rem', color: 'var(--theme-text-primary)' }}>{p.name}</span>
                    </div>
                    <div className="mb-2" style={{ fontSize: '0.6rem', color: 'var(--theme-text-secondary)' }}>
                      SAP: {p.sap}
                    </div>
                    <div className="d-flex justify-content-between" style={{ borderTop: '1px solid var(--theme-table-border-color)', paddingTop: '8px' }}>
                      <div className="text-center">
                        <div style={{ fontSize: '0.55rem', color: 'var(--theme-text-secondary)', textTransform: 'uppercase' }}>$</div>
                        <div className="fw-black text-info" style={{ fontSize: '0.8rem' }}>${p.valor.toLocaleString()}</div>
                      </div>
                      <div className="text-center">
                        <div style={{ fontSize: '0.55rem', color: 'var(--theme-text-secondary)', textTransform: 'uppercase' }}>CF</div>
                        <div className="fw-black text-success" style={{ fontSize: '0.8rem' }}>{p.cf.toLocaleString(undefined, { maximumFractionDigits: 1 })}</div>
                      </div>
                      <div className="text-center">
                        <div style={{ fontSize: '0.55rem', color: 'var(--theme-text-secondary)', textTransform: 'uppercase' }}>CU</div>
                        <div className="fw-black text-warning" style={{ fontSize: '0.8rem' }}>{p.cu.toLocaleString(undefined, { maximumFractionDigits: 1 })}</div>
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
                  <SortHeader label="PRODUCTO" sortKey="name" currentSort={productSort} onSort={(k: string) => handleSort(k, setProductSort)} />
                  <SortHeader label="TOTAL VALOR ($)" sortKey="valor" currentSort={productSort} onSort={(k: string) => handleSort(k, setProductSort)} align="end" />
                  <SortHeader label="TOTAL CF" sortKey="cf" currentSort={productSort} onSort={(k: string) => handleSort(k, setProductSort)} align="end" />
                  <SortHeader label="TOTAL CU" sortKey="cu" currentSort={productSort} onSort={(k: string) => handleSort(k, setProductSort)} align="end" />
                </tr>
              </thead>
              <tbody>
                {displayedResults.map((p) => (
                  <tr key={p.sap}>
                    <td className="ps-4">
                      <div className="d-flex flex-column">
                        <span className="fw-black text-uppercase" style={{ fontSize: '0.75rem' }}>{p.name}</span>
                        <span className="text-secondary" style={{ fontSize: '0.6rem' }}>SAP: {p.sap}</span>
                      </div>
                    </td>
                    <td className="text-end align-middle fw-black">${p.valor.toLocaleString()}</td>
                    <td className="text-end align-middle fw-black text-success">{p.cf.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
                    <td className="text-end align-middle fw-black text-warning pe-4">{p.cu.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
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
                CARGAR MÁS PRODUCTOS
              </Button>
            </div>
          )}
          
          {finalProductPerformance.length === 0 && (
            <div className="p-5 text-center text-secondary fw-bold italic">
              No se encontraron resultados para la búsqueda
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export default ProductsTab;
