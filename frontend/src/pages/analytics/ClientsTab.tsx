import type { FC } from 'react';
import { memo } from 'react';
import { Row, Col, Badge, Table, OverlayTrigger } from 'react-bootstrap';
import { FaInfoCircle } from 'react-icons/fa';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import SearchInput from '../../components/SearchInput';

interface ClientsTabProps {
  rfmResults: any[];
  segmentCounts: any[];
  segmentColors: Record<string, string>;
  segmentIcons: Record<string, any>;
  clientSearch: string;
  setClientSearch: (v: string) => void;
  clientSort: any;
  handleSort: (k: string, set: any) => void;
  setClientSort: any;
  finalRfmResults: any[];
  rfmPopover: any;
  chartTooltipStyle: any;
  axisStyle: any;
  SortHeader: any;
}

const ClientsTab: FC<ClientsTabProps> = memo(({ 
  rfmResults, segmentCounts, segmentColors, segmentIcons, clientSearch, setClientSearch, 
  clientSort, handleSort, setClientSort, finalRfmResults, rfmPopover, chartTooltipStyle, axisStyle, SortHeader 
}) => {
  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div className="d-flex align-items-center gap-2">
          <h5 className="fw-black mb-0 text-uppercase">Clasificación RFM y Segmentación</h5>
          <OverlayTrigger trigger="click" placement="right" overlay={rfmPopover} rootClose>
            <button className="btn btn-link p-0 text-info" style={{ lineHeight: 1 }}><FaInfoCircle size={18} /></button>
          </OverlayTrigger>
        </div>
        <Badge bg="secondary" className="border border-secondary px-3 py-2 fw-black">TOTAL: {rfmResults.length} CLIENTES</Badge>
      </div>
      <Row className="g-3 mb-4">
        <Col xs={12} lg={8}>
          <div className="admin-border-industrial p-3 d-flex flex-column" style={{ backgroundColor: 'var(--theme-background-secondary)', height: '400px' }}>
            <h6 className="fw-black text-uppercase small mb-4 flex-shrink-0">Distribución del Valor por Segmento</h6>
            <div className="flex-grow-1">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={segmentCounts} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--theme-border-default)" opacity={0.3} />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" {...axisStyle} width={100} />
                  <Tooltip {...chartTooltipStyle} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} isAnimationActive={false}>
                    {segmentCounts.map((entry, index) => <Cell key={index} fill={segmentColors[entry.name]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Col>
        <Col xs={12} lg={4}>
          <div className="admin-border-industrial p-3 d-flex flex-column" style={{ backgroundColor: 'var(--theme-background-secondary)', height: '400px' }}>
            <h6 className="fw-black text-uppercase small mb-3 flex-shrink-0">Resumen de Cartera</h6>
            <div className="flex-grow-1 d-flex flex-column gap-2 overflow-auto custom-scrollbar pe-1">
              {segmentCounts.map(s => (
                <div key={s.name} className="d-flex justify-content-between align-items-center p-2 border border-secondary border-opacity-10 flex-shrink-0" style={{ backgroundColor: 'var(--theme-background-tertiary)' }}>
                  <div className="d-flex align-items-center gap-2">{segmentIcons[s.name]}<span className="fw-black text-uppercase" style={{ fontSize: '0.65rem' }}>{s.name}</span></div>
                  <span className="fw-black fs-5" style={{ color: segmentColors[s.name] }}>{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </Col>
      </Row>
      <div className="admin-border-industrial" style={{ backgroundColor: 'var(--theme-background-secondary)' }}>
        <div className="p-3 border-bottom border-secondary border-opacity-10">
          <SearchInput searchTerm={clientSearch} onSearchChange={setClientSearch} placeholder="BUSCAR CLIENTE POR NOMBRE O ID..." className="mb-0" />
        </div>
        <Table responsive hover className="mb-0 industrial-table-v2">
          <thead className="sticky-top" style={{ backgroundColor: 'var(--theme-background-tertiary)', zIndex: 10 }}>
            <tr>
              <SortHeader label="CLIENTE" sortKey="clientName" currentSort={clientSort} onSort={(k: string) => handleSort(k, setClientSort)} />
              <SortHeader label="SEGMENTO" sortKey="segment" currentSort={clientSort} onSort={(k: string) => handleSort(k, setClientSort)} align="center" />
              <SortHeader label="RECENCIA" sortKey="recency" currentSort={clientSort} onSort={(k: string) => handleSort(k, setClientSort)} align="center" />
              <SortHeader label="V. MONETARIO ($)" sortKey="monetary" currentSort={clientSort} onSort={(k: string) => handleSort(k, setClientSort)} align="end" />
              <SortHeader label="VOLUMEN (CF)" sortKey="cf" currentSort={clientSort} onSort={(k: string) => handleSort(k, setClientSort)} align="end" />
              <SortHeader label="VOLUMEN (CU)" sortKey="cu" currentSort={clientSort} onSort={(k: string) => handleSort(k, setClientSort)} align="end" />
            </tr>
          </thead>
          <tbody>
            {finalRfmResults.map((r) => (
              <tr key={r.clientId}>
                <td className="ps-4"><div className="d-flex flex-column"><span className="fw-black text-uppercase" style={{ fontSize: '0.85rem' }}>{r.clientName}</span><span className="text-secondary" style={{ fontSize: '0.65rem' }}>ID: {r.clientId}</span></div></td>
                <td className="text-center align-middle"><div className="d-flex align-items-center justify-content-center gap-2">{segmentIcons[r.segment]}<span className="fw-black text-uppercase" style={{ fontSize: '0.7rem', color: segmentColors[r.segment] }}>{r.segment}</span></div></td>
                <td className="text-center align-middle fw-black">{r.recency} <small className="text-secondary">días</small></td>
                <td className="text-end align-middle fw-black text-info">${r.monetary.toLocaleString()}</td>
                <td className="text-end align-middle fw-black text-success">{r.cf.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
                <td className="text-end align-middle fw-black text-warning pe-4">{r.cu.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    </>
  );
});

export default ClientsTab;
