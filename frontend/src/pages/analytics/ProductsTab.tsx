import type { FC } from 'react';
import { memo } from 'react';
import { Table } from 'react-bootstrap';
import SearchInput from '../../components/SearchInput';

interface ProductsTabProps {
  productSearch: string;
  setProductSearch: (v: string) => void;
  productSort: any;
  handleSort: (k: string, set: any) => void;
  setProductSort: any;
  finalProductPerformance: any[];
  SortHeader: any;
}

const ProductsTab: FC<ProductsTabProps> = memo(({ 
  productSearch, setProductSearch, productSort, handleSort, setProductSort, finalProductPerformance, SortHeader 
}) => {
  return (
    <div className="admin-border-industrial" style={{ backgroundColor: 'var(--theme-background-secondary)' }}>
      <div className="p-3 border-bottom border-secondary border-opacity-10">
        <SearchInput searchTerm={productSearch} onSearchChange={setProductSearch} placeholder="BUSCAR PRODUCTO POR NOMBRE O SAP..." className="mb-0" />
      </div>
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
          {finalProductPerformance.map((p) => (
            <tr key={p.sap}>
              <td className="ps-4"><div className="d-flex flex-column"><span className="fw-black text-uppercase" style={{ fontSize: '0.75rem' }}>{p.name}</span><span className="text-secondary" style={{ fontSize: '0.6rem' }}>SAP: {p.sap}</span></div></td>
              <td className="text-end align-middle fw-black">${p.valor.toLocaleString()}</td>
              <td className="text-end align-middle fw-black text-success">{p.cf.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
              <td className="text-end align-middle fw-black text-warning pe-4">{p.cu.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
});

export default ProductsTab;
