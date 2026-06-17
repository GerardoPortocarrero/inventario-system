import type { FC } from 'react';
import { memo } from 'react';
import { Row, Col } from 'react-bootstrap';
import { FaBox, FaCrown, FaRoute } from 'react-icons/fa';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LineChart, Line } from 'recharts';

interface DashboardProps {
  metric: string;
  metricLabel: string;
  formatValue: (v: number) => string;
  statsPro: any;
  timelineStats: any[];
  dailyStats: any[];
  routePerformance: any[];
  sedes: any[];
  chartTooltipStyle: any;
  axisStyle: any;
  rfmResultsLength: number;
}

const DashboardTab: FC<DashboardProps> = memo(({ 
  metric, metricLabel, formatValue, statsPro, timelineStats, dailyStats, routePerformance, sedes, chartTooltipStyle, axisStyle, rfmResultsLength 
}) => {
  return (
    <div className="d-flex flex-column gap-3">
      <Row className="g-3">
        <Col xs={12} md={4}>
          <div className="p-3 border border-secondary border-opacity-10 h-100" style={{ backgroundColor: 'var(--theme-background-secondary)' }}>
            <div className="d-flex justify-content-between align-items-start">
              <div>
                <div className="text-secondary fw-bold text-uppercase mb-1" style={{ fontSize: '0.55rem' }}>Analizando {metricLabel}</div>
                <div className="fw-black fs-3">{formatValue(rfmResultsLength)}</div>
              </div>
              <FaBox className="text-warning opacity-25 fs-4" />
            </div>
          </div>
        </Col>
        <Col xs={12} md={4}>
          <div className="p-3 border border-info border-opacity-25 h-100" style={{ backgroundColor: 'var(--theme-background-secondary)' }}>
            <div className="d-flex justify-content-between align-items-start">
              <div>
                <div className="text-info fw-bold text-uppercase mb-1" style={{ fontSize: '0.55rem' }}>Producto Estrella</div>
                <div className="fw-black fs-5 text-truncate" style={{ maxWidth: '200px' }}>{statsPro.starProduct}</div>
                <div className="text-info fw-bold" style={{ fontSize: '0.65rem' }}>{formatValue(statsPro.starProductValue)} ACUMULADO</div>
              </div>
              <FaCrown className="text-info opacity-25 fs-4" />
            </div>
          </div>
        </Col>
        <Col xs={12} md={4}>
          <div className="p-3 border border-danger border-opacity-25 h-100" style={{ backgroundColor: 'var(--theme-background-secondary)' }}>
            <div className="d-flex justify-content-between align-items-start">
              <div>
                <div className="text-danger fw-bold text-uppercase mb-1" style={{ fontSize: '0.55rem' }}>Ruta Líder</div>
                <div className="fw-black fs-3 text-danger">{statsPro.starRoute}</div>
                <div className="text-secondary fw-bold" style={{ fontSize: '0.6rem' }}>{formatValue(statsPro.starRouteValue)} EN {metric.toUpperCase()}</div>
              </div>
              <FaRoute className="text-danger opacity-25 fs-4" />
            </div>
          </div>
        </Col>
      </Row>
      
      <div className="p-3 border border-secondary border-opacity-10" style={{ height: '350px', backgroundColor: 'var(--theme-background-secondary)' }}>
        <h6 className="fw-black text-uppercase small mb-4">Evolución Histórica ({metricLabel})</h6>
        <ResponsiveContainer width="100%" height="90%">
          <LineChart data={timelineStats}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--theme-border-default)" opacity={0.3} />
            <XAxis dataKey="date" {...axisStyle} />
            <YAxis {...axisStyle} />
            <Tooltip {...chartTooltipStyle} formatter={(value: any) => [formatValue(value), metricLabel]} />
            <Line type="monotone" dataKey="value" stroke="var(--color-red-primary)" strokeWidth={3} dot={{ fill: 'var(--color-red-primary)', r: 4 }} activeDot={{ r: 6 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="p-3 border border-secondary border-opacity-10" style={{ height: '350px', backgroundColor: 'var(--theme-background-secondary)' }}>
        <h6 className="fw-black text-uppercase small mb-4">Tendencia por Día ({metricLabel})</h6>
        <ResponsiveContainer width="100%" height="90%">
          <BarChart data={dailyStats}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--theme-border-default)" opacity={0.3} />
            <XAxis dataKey="name" {...axisStyle} />
            <YAxis {...axisStyle} />
            <Tooltip {...chartTooltipStyle} formatter={(value: any) => [formatValue(value), metricLabel]} />
            <Bar dataKey="value" fill="var(--color-red-primary)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <Row className="g-3">
        <Col xs={12} lg={7}>
          <div className="p-3 border border-secondary border-opacity-10" style={{ height: '450px', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--theme-background-secondary)' }}>
            <h6 className="fw-black text-uppercase small mb-4 flex-shrink-0">Ranking de Rutas</h6>
            <div className="custom-scrollbar flex-grow-1" style={{ overflowY: 'auto', overflowX: 'hidden' }}>
              <div style={{ height: `${Math.max(routePerformance.length * 40, 400)}px`, width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={routePerformance} layout="vertical" margin={{ left: 0, right: 30, top: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--theme-border-default)" opacity={0.3} />
                    <XAxis type="number" hide />
                    <YAxis dataKey="ruta" type="category" {...axisStyle} width={80} />
                    <Tooltip {...chartTooltipStyle} formatter={(val: any) => [formatValue(val), metricLabel]} />
                    <Bar dataKey="currentValue" fill="var(--color-red-primary)" radius={[0, 4, 4, 0]} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </Col>
        <Col xs={12} lg={5}>
          <div className="p-3 border border-secondary border-opacity-10" style={{ height: '450px', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--theme-background-secondary)' }}>
            <h6 className="fw-black text-uppercase small mb-4 flex-shrink-0">Desempeño por Sede</h6>
            <div className="flex-grow-1">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart 
                  data={statsPro.sedePerformance.map((s: any) => ({
                    ...s,
                    displaySede: sedes.find(sd => sd.codigo === s.sede)?.nombre || s.sede
                  }))} 
                  layout="vertical" 
                  margin={{ left: 5, right: 40, top: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--theme-border-default)" opacity={0.3} />
                  <XAxis type="number" hide />
                  <YAxis dataKey="displaySede" type="category" {...axisStyle} width={90} tickFormatter={(val) => val.length > 12 ? `${val.substring(0, 10)}...` : val} />
                  <Tooltip {...chartTooltipStyle} formatter={(val: any) => [formatValue(val), metricLabel]} />
                  <Bar dataKey="value" fill="var(--color-red-primary)" radius={[0, 4, 4, 0]} barSize={25} isAnimationActive={false}>
                    {statsPro.sedePerformance.map((_entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={index === 0 ? 'var(--color-red-primary)' : 'rgba(244, 0, 9, 0.6)'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Col>
      </Row>
    </div>
  );
});

export default DashboardTab;
