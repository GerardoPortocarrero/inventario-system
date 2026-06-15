import type { FC } from 'react';
import { useState, useEffect, useMemo, Fragment } from 'react';
import { Row, Col, Tab, Nav, Badge, Table, OverlayTrigger, Popover, Form, Button } from 'react-bootstrap';
import { FaChartLine, FaUsers, FaRoute, FaBox, FaHistory, FaCrown, FaExclamationTriangle, FaStar, FaBed, FaUserCheck, FaArrowUp, FaInfoCircle, FaMapMarkerAlt, FaSort, FaSortUp, FaSortDown, FaChevronRight, FaFilter } from 'react-icons/fa';
import { SPINNER_VARIANTS } from '../constants';
import GlobalSpinner from '../components/GlobalSpinner';
import SearchInput from '../components/SearchInput';
import useMediaQuery from '../hooks/useMediaQuery';
import { db, rtdb } from '../api/firebase';
import { useData } from '../context/DataContext';
import { ref, onValue } from 'firebase/database';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LineChart, Line } from 'recharts';
import DatePicker, { registerLocale } from 'react-datepicker';
import { es } from 'date-fns/locale/es';
import "react-datepicker/dist/react-datepicker.css";

registerLocale('es', es);

const AnalyticsProPage: FC = () => {
  const { sedes, marcas } = useData();
  const isMobile = useMediaQuery('(max-width: 991px)');
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [demandaData, setDemandaData] = useState<any[]>([]);
  const [maestroData, setMaestroData] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);

  // --- FILTROS GLOBALES ---
  const [metric, setMetric] = useState<'valor' | 'cf' | 'cu'>('valor');
  const [selectedSede, setSelectedSede] = useState<string>('ALL');
  const [selectedRoute, setSelectedRoute] = useState<string>('ALL');
  const [selectedMarcasCobertura, setSelectedMarcasCobertura] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  // --- BUSQUEDA Y ORDENAMIENTO POR PESTAÑA ---
  const [clientSearch, setClientSearch] = useState('');
  const [clientSort, setClientSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null);
  
  const [productSearch, setProductSearch] = useState('');
  const [productSort, setProductSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null);

  const [expandedCoberturaRutas, setExpandedCoberturaRutas] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setLoading(true);
    let masterLoaded = false;
    let firestoreLoaded = false;
    let productsLoaded = false;

    const checkLoading = () => {
      if (masterLoaded && firestoreLoaded && productsLoaded) setLoading(false);
    };

    const demandaQuery = query(collection(db, 'demanda_historica'), orderBy('fecha', 'desc'));
    const unsubDemanda = onSnapshot(demandaQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        ...doc.data(),
        fechaObj: (doc.data() as any).fecha?.toDate()
      }));
      setDemandaData(data);
      firestoreLoaded = true;
      checkLoading();
    }, (error) => {
      console.error("Error loading demanda:", error);
      firestoreLoaded = true;
      checkLoading();
    });

    const unsubProducts = onSnapshot(collection(db, 'productos'), (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      productsLoaded = true;
      checkLoading();
    }, (error) => {
      console.error("Error loading productos:", error);
      productsLoaded = true;
      checkLoading();
    });

    const maestroRef = ref(rtdb, 'maestro/data');
    const unsubMaestro = onValue(maestroRef, (snapshot) => {
      if (snapshot.exists()) setMaestroData(snapshot.val() || []);
      masterLoaded = true;
      checkLoading();
    }, (error) => {
      console.error("Error loading maestro:", error);
      masterLoaded = true;
      checkLoading();
    });

    return () => { unsubDemanda(); unsubMaestro(); unsubProducts(); };
  }, []);

  // --- FILTRADO JERÁRQUICO ---
  const sedeFilteredData = useMemo(() => {
    if (selectedSede === 'ALL') return demandaData;
    return demandaData.filter(d => String(d.sede).trim() === String(selectedSede).trim());
  }, [demandaData, selectedSede]);

  const availableRoutes = useMemo(() => {
    const routes = new Set<string>();
    sedeFilteredData.forEach(d => { if (d.ruta) routes.add(String(d.ruta)); });
    return Array.from(routes).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [sedeFilteredData]);

  // Si la sede cambia, resetear ruta si no existe en la nueva sede
  useEffect(() => {
    if (selectedRoute !== 'ALL' && !availableRoutes.includes(selectedRoute)) {
      setSelectedRoute('ALL');
    }
  }, [selectedSede, availableRoutes]);

  const dateFilteredData = useMemo(() => {
    const start = new Date(dateRange.start);
    const end = new Date(dateRange.end);
    end.setHours(23, 59, 59);
    return sedeFilteredData.filter(d => d.fechaObj >= start && d.fechaObj <= end);
  }, [sedeFilteredData, dateRange]);

  const filteredData = useMemo(() => {
    if (selectedRoute === 'ALL') return dateFilteredData;
    return dateFilteredData.filter(d => String(d.ruta) === selectedRoute);
  }, [dateFilteredData, selectedRoute]);

  // Mapeo de Maestro para acceso rápido
  const maestroMap = useMemo(() => {
    const map: Record<string, any> = {};
    maestroData.forEach(m => {
      const id = String(m.Codigo || m.CODIGO || '').trim();
      if (id) map[id] = m;
    });
    return map;
  }, [maestroData]);

  // --- MÉTRICAS CENTRALIZADAS ---
  const rfmResults = useMemo(() => {
    if (filteredData.length === 0) return [];
    const clientMap: Record<string, any> = {};
    const now = new Date();
    const dayNamesShort = ['DO', 'LU', 'MA', 'MI', 'JU', 'VI', 'SA'];

    // 1. Agrupar datos de ventas reales
    filteredData.forEach(d => {
      const solId = String(d.solicitante).trim();
      if (!clientMap[solId]) {
        clientMap[solId] = { 
          clientId: solId, 
          clientName: d.nombreCliente, 
          lastDate: d.fechaObj, 
          frequency: 0, 
          monetary: 0, 
          cf: 0, 
          cu: 0,
          purchaseDates: new Set<string>()
        };
      }
      clientMap[solId].frequency += 1;
      clientMap[solId].monetary += d.totalValor || 0;
      clientMap[solId].cf += d.totalCF || 0;
      clientMap[solId].cu += d.totalCU || 0;
      clientMap[solId].purchaseDates.add(d.fechaObj.toISOString().split('T')[0]);
      if (d.fechaObj > clientMap[solId].lastDate) clientMap[solId].lastDate = d.fechaObj;
    });

    // 2. Calcular Rango de Fechas para validación de SEG.DIAS
    const start = new Date(dateRange.start + 'T00:00:00');
    const end = new Date(dateRange.end + 'T00:00:00');
    const daysInRange: { date: string, dayName: string }[] = [];
    let curr = new Date(start);
    while (curr <= end) {
      daysInRange.push({ 
        date: curr.toISOString().split('T')[0], 
        dayName: dayNamesShort[curr.getDay()] 
      });
      curr.setDate(curr.getDate() + 1);
    }

    // Cálculo de promedios para segmentación inteligente
    const allMetrics = Object.values(clientMap).map((c: any) => metric === 'valor' ? c.monetary : metric === 'cf' ? c.cf : c.cu);
    const avgVolume = allMetrics.length > 0 ? allMetrics.reduce((a, b) => a + b, 0) / allMetrics.length : 0;
    const avgFrequency = Object.values(clientMap).length > 0 ? Object.values(clientMap).reduce((a: any, b: any) => a + b.frequency, 0) / Object.values(clientMap).length : 0;

    // 3. Evaluar cada cliente contra su programación operativa y métricas de volumen/frecuencia
    const results = Object.values(clientMap).map((c: any) => {
      const maestro = maestroMap[c.clientId];
      const segDias = String(maestro?.['SEG.DIAS'] || maestro?.seg_dias || '').toUpperCase();
      const scheduledDays = segDias.split(',').map(s => s.trim()).filter(Boolean);
      
      let missedVisits = 0;
      let totalScheduledInRange = 0;

      if (scheduledDays.length > 0) {
        daysInRange.forEach(d => {
          if (scheduledDays.includes(d.dayName)) {
            totalScheduledInRange++;
            if (!c.purchaseDates.has(d.date)) {
              missedVisits++;
            }
          }
        });
      }

      const recency = Math.floor((now.getTime() - c.lastDate.getTime()) / (1000 * 60 * 60 * 24));
      const volume = metric === 'valor' ? c.monetary : metric === 'cf' ? c.cf : c.cu;
      const hitRate = totalScheduledInRange > 0 ? (totalScheduledInRange - missedVisits) / totalScheduledInRange : 1;

      // LÓGICA ESTRICTA (4 SEGMENTOS)
      let segment = 'Fiel'; // Fallback por defecto

      if (recency > 30) {
        segment = 'Hibernando';
      } else if (hitRate <= 0.5 || (c.frequency < avgFrequency && volume < avgVolume * 0.5)) {
        segment = 'Poco Frecuente';
      } else if (c.frequency >= avgFrequency && volume >= avgVolume) {
        segment = 'Campeón';
      } else if (volume >= avgVolume * 1.5) {
        // "Si tiene mucho volumen y poca frecuencia ponlo en campeon"
        segment = 'Campeón';
      } else {
        segment = 'Fiel';
      }

      return {
        ...c,
        recency,
        currentMetricValue: volume,
        missedVisits,
        totalScheduledInRange,
        segDias,
        segment
      };
    });

    return results.sort((a, b) => b.currentMetricValue - a.currentMetricValue);
  }, [filteredData, metric, dateRange, maestroMap]);

  const dailyStats = useMemo(() => {
    if (filteredData.length === 0) return [];
    const daysMap: Record<string, any> = { 'LUNES': { total: 0, count: 0 }, 'MARTES': { total: 0, count: 0 }, 'MIÉRCOLES': { total: 0, count: 0 }, 'JUEVES': { total: 0, count: 0 }, 'VIERNES': { total: 0, count: 0 }, 'SÁBADO': { total: 0, count: 0 }, 'DOMINGO': { total: 0, count: 0 } };
    const dayNames = ['DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'];
    filteredData.forEach(d => { if (d.fechaObj) { 
      const dayName = dayNames[d.fechaObj.getDay()]; 
      const val = metric === 'valor' ? d.totalValor : metric === 'cf' ? d.totalCF : d.totalCU;
      daysMap[dayName].total += val || 0; 
      daysMap[dayName].count += 1; 
    } });
    return Object.entries(daysMap).map(([name, data]: any) => ({ name, value: data.total, count: data.count }));
  }, [filteredData, metric]);

  const timelineStats = useMemo(() => {
    const start = new Date(dateRange.start + 'T00:00:00');
    const end = new Date(dateRange.end + 'T00:00:00');
    
    const timeMap: Record<string, number> = {};
    filteredData.forEach(d => {
      if (d.fechaObj) {
        const dateKey = d.fechaObj.toISOString().split('T')[0];
        const val = metric === 'valor' ? d.totalValor : metric === 'cf' ? d.totalCF : d.totalCU;
        timeMap[dateKey] = (timeMap[dateKey] || 0) + val;
      }
    });

    const result = [];
    const current = new Date(start);
    while (current <= end) {
      const dateKey = current.toISOString().split('T')[0];
      result.push({ 
        date: dateKey.split('-').slice(1).reverse().join('/'), // DD/MM
        value: timeMap[dateKey] || 0 
      });
      current.setDate(current.getDate() + 1);
    }
    return result;
  }, [filteredData, metric, dateRange]);

  const productPerformance = useMemo(() => {
    if (filteredData.length === 0) return [];
    const prodMap: Record<string, any> = {};
    filteredData.forEach(d => { 
      (d.materiales || []).forEach((m: any) => { 
        if (!prodMap[m.sku]) { 
          prodMap[m.sku] = { sap: m.sku, name: m.descripcion, valor: 0, cf: 0, cu: 0, count: 0 }; 
        } 
        prodMap[m.sku].valor += m.valor || 0; 
        prodMap[m.sku].cf += m.cf || 0; 
        prodMap[m.sku].cu += m.cu || 0; 
        prodMap[m.sku].count += 1; 
      }); 
    });
    return Object.values(prodMap).map((p: any) => ({
      ...p,
      currentValue: metric === 'valor' ? p.valor : metric === 'cf' ? p.cf : p.cu
    })).sort((a: any, b: any) => b.currentValue - a.currentValue);
  }, [filteredData, metric]);

  const routePerformance = useMemo(() => {
    if (dateFilteredData.length === 0) return [];
    const routeMap: Record<string, any> = {};
    
    // Agrupar datos por ruta y cliente
    dateFilteredData.forEach(d => {
      const rId = d.ruta || 'S/R';
      const cId = String(d.solicitante).trim();
      
      if (!routeMap[rId]) {
        routeMap[rId] = { ruta: rId, monetary: 0, cf: 0, cu: 0, count: 0, clientsMap: {} };
      }
      
      routeMap[rId].monetary += d.totalValor || 0;
      routeMap[rId].cf += d.totalCF || 0;
      routeMap[rId].cu += d.totalCU || 0;
      routeMap[rId].count += 1;
      
      if (!routeMap[rId].clientsMap[cId]) {
        routeMap[rId].clientsMap[cId] = { id: cId, name: d.nombreCliente, valor: 0, cf: 0, cu: 0, count: 0 };
      }
      routeMap[rId].clientsMap[cId].valor += d.totalValor || 0;
      routeMap[rId].clientsMap[cId].cf += d.totalCF || 0;
      routeMap[rId].clientsMap[cId].cu += d.totalCU || 0;
      routeMap[rId].clientsMap[cId].count += 1;
    });

    return Object.values(routeMap).map((r: any) => ({
      ...r,
      clientCount: Object.keys(r.clientsMap).length,
      clients: Object.values(r.clientsMap).sort((a: any, b: any) => b.valor - a.valor),
      currentValue: metric === 'valor' ? r.monetary : metric === 'cf' ? r.cf : r.cu
    })).sort((a: any, b: any) => b.currentValue - a.currentValue);
  }, [dateFilteredData, metric]);

  const statsPro = useMemo(() => {
    const topProd = productPerformance.length > 0 ? productPerformance[0] : { name: '---', currentValue: 0 };
    const topRoute = routePerformance.length > 0 ? routePerformance[0] : { ruta: '---', currentValue: 0 };
    const riskCount = rfmResults.filter(r => r.segment === 'Poco Frecuente' || r.segment === 'Hibernando').length;

    // Cálculo de Desempeño por Sede para el Resumen
    const sedePerformanceMap: Record<string, number> = {};
    dateFilteredData.forEach(d => {
      const sId = String(d.sede).trim();
      const val = metric === 'valor' ? d.totalValor : metric === 'cf' ? d.totalCF : d.totalCU;
      sedePerformanceMap[sId] = (sedePerformanceMap[sId] || 0) + (val || 0);
    });

    const sedePerformance = Object.entries(sedePerformanceMap)
      .map(([sede, value]) => ({ sede, value }))
      .sort((a, b) => b.value - a.value);
    
    return {
      starProduct: topProd.name,
      starProductValue: topProd.currentValue,
      starRoute: topRoute.ruta,
      starRouteValue: topRoute.currentValue,
      atRisk: riskCount,
      sedePerformance
    };
  }, [productPerformance, routePerformance, rfmResults, dateFilteredData, metric]);

  const segmentCounts = useMemo(() => {
    const counts: Record<string, number> = { 'Campeón': 0, 'Fiel': 0, 'Poco Frecuente': 0, 'Hibernando': 0, 'Potencial': 0 };
    rfmResults.forEach(r => { if (counts[r.segment] !== undefined) counts[r.segment]++; });
    return Object.entries(counts)
      .filter(([name]) => name !== 'Potencial' || counts[name] > 0)
      .map(([name, value]) => ({ name, value }));
  }, [rfmResults]);

  // --- LOGICA DE BUSQUEDA Y ORDENAMIENTO FINAL ---
  const finalRfmResults = useMemo(() => {
    let data = [...rfmResults];
    if (clientSearch) {
      const term = clientSearch.toLowerCase();
      data = data.filter(r => r.clientName.toLowerCase().includes(term) || r.clientId.toLowerCase().includes(term));
    }
    if (clientSort) {
      data.sort((a, b) => {
        const valA = a[clientSort.key as keyof typeof a];
        const valB = b[clientSort.key as keyof typeof b];
        if (typeof valA === 'string') return clientSort.dir === 'asc' ? valA.localeCompare(valB as string) : (valB as string).localeCompare(valA);
        return clientSort.dir === 'asc' ? ((valA as number) || 0) - ((valB as number) || 0) : ((valB as number) || 0) - ((valA as number) || 0);
      });
    }
    return data;
  }, [rfmResults, clientSearch, clientSort]);

  const finalProductPerformance = useMemo(() => {
    let data = [...productPerformance];
    if (productSearch) {
      const term = productSearch.toLowerCase();
      data = data.filter(p => p.name.toLowerCase().includes(term) || p.sap.toLowerCase().includes(term));
    }
    if (productSort) {
      data.sort((a, b) => {
        const valA = a[productSort.key as keyof typeof a];
        const valB = b[productSort.key as keyof typeof b];
        if (typeof valA === 'string') return productSort.dir === 'asc' ? valA.localeCompare(valB as string) : (valB as string).localeCompare(valA);
        return productSort.dir === 'asc' ? ((valA as number) || 0) - ((valB as number) || 0) : ((valB as number) || 0) - ((valA as number) || 0);
      });
    }
    return data;
  }, [productPerformance, productSearch, productSort]);

  const matrixCoberturaData = useMemo(() => {
    if (selectedMarcasCobertura.length === 0) return { rutas: [], data: {} };

    const productsMap = products.reduce((acc, p) => {
      acc[String(p.sap).trim()] = p;
      return acc;
    }, {} as Record<string, any>);

    const matrix: Record<string, {
      total: Record<string, { cf: number; cu: number; cliConVenta: number }>,
      totalClientesRuta: number,
      clientes: Record<string, {
        nombre: string,
        marcas: Record<string, { cf: number; cu: number }>
      }>
    }> = {};
    
    const routeSet = new Set<string>();

    // 1. Inicializar matriz con TODOS los clientes del maestro para la sede seleccionada
    const targetSedeCodigo = selectedSede === 'ALL' ? null : String(selectedSede).trim();
    
    maestroData.forEach(m => {
      const locCode = String(m.Loc || m.LOC || '').trim();
      if (targetSedeCodigo && locCode !== targetSedeCodigo) return;
      
      const rutaId = String(m['Ruta com'] || m['RUTA COM'] || m.Ruta || 'S/R').trim();
      routeSet.add(rutaId);
      const clientId = String(m.Codigo || m.CODIGO || '').trim();
      const clientName = String(m.Cliente || m.CLIENTE || 'Sin Nombre').trim();

      if (!matrix[rutaId]) {
        matrix[rutaId] = { total: {}, totalClientesRuta: 0, clientes: {} };
      }
      if (!matrix[rutaId].clientes[clientId]) {
        matrix[rutaId].totalClientesRuta += 1;
        matrix[rutaId].clientes[clientId] = {
          nombre: clientName,
          marcas: {}
        };
        // Pre-llenar marcas seleccionadas con 0
        selectedMarcasCobertura.forEach(mId => {
          matrix[rutaId].clientes[clientId].marcas[mId] = { cf: 0, cu: 0 };
          if (!matrix[rutaId].total[mId]) matrix[rutaId].total[mId] = { cf: 0, cu: 0, cliConVenta: 0 };
        });
      }
    });

    // 2. Llenar con datos transaccionales (filteredData)
    filteredData.forEach(d => {
      const rutaId = String(d.ruta || 'S/R').trim();
      const clientId = String(d.solicitante).trim();
      
      if (!matrix[rutaId]) {
        matrix[rutaId] = { total: {}, totalClientesRuta: 0, clientes: {} };
        routeSet.add(rutaId);
      }
      if (!matrix[rutaId].clientes[clientId]) {
        matrix[rutaId].totalClientesRuta += 1;
        matrix[rutaId].clientes[clientId] = {
          nombre: d.nombreCliente || 'Cliente Desconocido',
          marcas: {}
        };
        selectedMarcasCobertura.forEach(mId => {
          matrix[rutaId].clientes[clientId].marcas[mId] = { cf: 0, cu: 0 };
        });
      }

      (d.materiales || []).forEach((m: any) => {
        const product = productsMap[String(m.sku).trim()];
        if (product && selectedMarcasCobertura.includes(product.marcaId)) {
          const mId = product.marcaId;
          
          if (!matrix[rutaId].clientes[clientId].marcas[mId]) {
            matrix[rutaId].clientes[clientId].marcas[mId] = { cf: 0, cu: 0 };
          }
          
          // Solo sumamos si no tenía venta previa de esta marca (para el conteo de clientes)
          const hadSale = matrix[rutaId].clientes[clientId].marcas[mId].cf > 0 || matrix[rutaId].clientes[clientId].marcas[mId].cu > 0;
          
          matrix[rutaId].clientes[clientId].marcas[mId].cf += m.cf || 0;
          matrix[rutaId].clientes[clientId].marcas[mId].cu += m.cu || 0;

          if (!matrix[rutaId].total[mId]) {
            matrix[rutaId].total[mId] = { cf: 0, cu: 0, cliConVenta: 0 };
          }
          matrix[rutaId].total[mId].cf += m.cf || 0;
          matrix[rutaId].total[mId].cu += m.cu || 0;

          if (!hadSale && (m.cf > 0 || m.cu > 0)) {
            matrix[rutaId].total[mId].cliConVenta += 1;
          }
        }
      });
    });

    const sortedRoutes = Array.from(routeSet).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    return { rutas: sortedRoutes, data: matrix };
  }, [filteredData, products, selectedMarcasCobertura, maestroData, selectedSede]);

  const handleSort = (key: string, set: any) => {
    set((prev: any) => ({
      key,
      dir: prev?.key === key && prev?.dir === 'asc' ? 'desc' : 'asc'
    }));
  };

  const SortHeader = ({ label, sortKey, currentSort, onSort, align = 'start' }: any) => {
    const isSorted = currentSort?.key === sortKey;
    return (
      <th 
        className={`text-${align} align-middle cursor-pointer user-select-none`} 
        onClick={() => onSort(sortKey)}
        style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}
      >
        <div className={`d-flex align-items-center justify-content-${align === 'center' ? 'center' : align === 'end' ? 'end' : 'start'} gap-2`}>
          {label}
          {isSorted ? (currentSort.dir === 'asc' ? <FaSortUp className="text-danger" /> : <FaSortDown className="text-danger" />) : <FaSort className="opacity-25" />}
        </div>
      </th>
    );
  };

  const metricLabel = metric === 'valor' ? 'Valor ($)' : metric === 'cf' ? 'Cajas Físicas (CF)' : 'Cajas Unitarias (CU)';
  const formatValue = (val: number) => metric === 'valor' ? `$${val.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : val.toLocaleString(undefined, { maximumFractionDigits: 1 });

  const chartTooltipStyle = {
    contentStyle: { backgroundColor: 'var(--theme-background-secondary)', border: '1px solid var(--theme-border-default)', borderRadius: '0px', color: 'var(--theme-text-primary)', fontSize: '0.75rem', fontWeight: 'bold' },
    itemStyle: { color: 'var(--theme-text-primary)' },
    labelStyle: { color: 'var(--color-red-primary)', fontWeight: 'black', marginBottom: '4px' }
  };

  const axisStyle = { stroke: 'var(--theme-text-secondary)', fontSize: 10, fontWeight: 'bold' };

  const segmentColors: Record<string, string> = { 'Campeón': 'var(--rfm-campeon)', 'Fiel': 'var(--rfm-fiel)', 'Nueva Promesa': 'var(--rfm-nueva-promesa)', 'Potencial': 'var(--rfm-potencial)', 'Poco Frecuente': 'var(--rfm-en-riesgo)', 'Hibernando': 'var(--rfm-hibernando)' };
  const segmentIcons: Record<string, any> = { 'Campeón': <FaCrown style={{ color: 'var(--rfm-campeon)' }} />, 'Fiel': <FaStar style={{ color: 'var(--rfm-fiel)' }} />, 'Nueva Promesa': <FaArrowUp style={{ color: 'var(--rfm-nueva-promesa)' }} />, 'Potencial': <FaUserCheck style={{ color: 'var(--rfm-potencial)' }} />, 'Poco Frecuente': <FaExclamationTriangle style={{ color: 'var(--rfm-en-riesgo)' }} />, 'Hibernando': <FaBed style={{ color: 'var(--rfm-hibernando)' }} /> };

  const rfmPopover = (
    <Popover id="rfm-popover" style={{ backgroundColor: 'var(--theme-background-secondary)', border: '1px solid var(--theme-border-default)', color: 'var(--theme-text-primary)', maxWidth: '400px' }}>
      <Popover.Header as="h3" style={{ backgroundColor: 'var(--theme-icon-bg)', color: 'var(--color-red-primary)', borderBottom: '1px solid var(--theme-border-default)', fontWeight: 900, fontSize: '0.8rem' }}>GLOSARIO DE SEGMENTACIÓN RFM</Popover.Header>
      <Popover.Body style={{ fontSize: '0.75rem', color: 'var(--theme-text-primary)' }}>
        <div className="mb-2"><strong style={{ color: 'var(--rfm-campeon)' }}>CAMPEÓN:</strong> Clientes constantes con alta frecuencia y gran volumen reciente.</div>
        <div className="mb-2"><strong style={{ color: 'var(--rfm-fiel)' }}>FIEL:</strong> Clientes que compran regularmente pero con menor volumen.</div>
        <div className="mb-2"><strong style={{ color: 'var(--rfm-en-riesgo)' }}>POCO FRECUENTE:</strong> Clientes con baja consistencia en sus pedidos programados.</div>
        <div><strong style={{ color: 'var(--rfm-hibernando)' }}>HIBERNANDO:</strong> Clientes que llevan más de 30 días sin realizar pedidos.</div>
      </Popover.Body>
    </Popover>
  );

  if (loading) return <GlobalSpinner variant={SPINNER_VARIANTS.IN_PAGE} />;

  return (
    <div className="admin-layout-container flex-column gap-2 gap-md-3">
      <div className="admin-section-table flex-shrink-0" style={{ flex: 'none', height: 'auto', padding: '1rem 1.25rem', borderLeft: '4px solid var(--color-red-primary)' }}>
        <div className={`d-flex ${isMobile ? 'flex-column gap-2' : 'align-items-center justify-content-between'} g-3`}>
          <div className="d-flex flex-column">
            <h3 className="fw-black mb-0 d-flex align-items-center gap-2" style={{ fontSize: '1.2rem' }}>
              <FaChartLine className="text-danger" style={{ fontSize: '1.2rem' }} /> ANALÍTICA PRO
            </h3>
          </div>
          <div className={`d-flex align-items-center gap-2 ${isMobile ? 'flex-wrap' : 'justify-content-end'}`}>
            <div className="d-flex align-items-center p-1 border border-secondary border-opacity-25" style={{ borderRadius: '4px', backgroundColor: 'var(--theme-background-secondary)', height: '32px' }}>
              <FaMapMarkerAlt className="text-danger ms-2" size={12} />
              <Form.Select value={selectedSede} onChange={(e) => setSelectedSede(e.target.value)} className="bg-transparent border-0 small fw-bold px-2 py-0" style={{ outline: 'none', fontSize: '0.75rem', width: 'auto', minWidth: '85px', cursor: 'pointer', color: 'var(--theme-text-primary)' }}>
                <option value="ALL" style={{ backgroundColor: 'var(--theme-background-secondary)', color: 'var(--theme-text-primary)' }}>GLOBAL</option>
                {sedes.map(s => <option key={s.id} value={s.codigo} style={{ backgroundColor: 'var(--theme-background-secondary)', color: 'var(--theme-text-primary)' }}>{s.nombre.toUpperCase()}</option>)}
              </Form.Select>
            </div>

            <div className="d-flex align-items-center p-1 border border-secondary border-opacity-25" style={{ borderRadius: '4px', backgroundColor: 'var(--theme-background-secondary)', height: '32px' }}>
              <FaRoute className="text-danger ms-2" size={12} />
              <Form.Select 
                value={selectedRoute} 
                onChange={(e) => setSelectedRoute(e.target.value)} 
                className="bg-transparent border-0 small fw-bold px-2 py-0" 
                style={{ outline: 'none', fontSize: '0.75rem', width: 'auto', minWidth: '80px', cursor: 'pointer', color: 'var(--theme-text-primary)' }}
              >
                <option value="ALL" style={{ backgroundColor: 'var(--theme-background-secondary)', color: 'var(--theme-text-primary)' }}>RUTAS</option>
                {availableRoutes.map(r => (
                  <option key={r} value={r} style={{ backgroundColor: 'var(--theme-background-secondary)', color: 'var(--theme-text-primary)' }}>RUTA {r}</option>
                ))}
              </Form.Select>
            </div>
            
            <div className="d-flex align-items-center p-1 border border-secondary border-opacity-25" style={{ borderRadius: '4px', backgroundColor: 'var(--theme-background-secondary)', height: '32px' }}>
              <DatePicker
                selected={new Date(dateRange.start + 'T00:00:00')}
                onChange={(date: Date | null) => date && setDateRange(prev => ({ ...prev, start: date.toISOString().split('T')[0] }))}
                dateFormat="dd/MM/yyyy"
                locale="es"
                className="date-picker-industrial"
              />
              <DatePicker
                selected={new Date(dateRange.end + 'T00:00:00')}
                onChange={(date: Date | null) => date && setDateRange(prev => ({ ...prev, end: date.toISOString().split('T')[0] }))}
                dateFormat="dd/MM/yyyy"
                locale="es"
                className="date-picker-industrial"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="admin-section-table flex-grow-1 p-0 overflow-hidden">
        <Tab.Container id="analytics-tabs" activeKey={activeTab} onSelect={(k) => setActiveTab(k as string)}>
          <div className="d-flex flex-column h-100">
            {isMobile ? (
              <div className="px-3 pt-3 flex-shrink-0">
                <div className="info-pill-new w-100">
                  <span className="pill-icon-sober text-danger p-1"><FaFilter className="pill-main-icon"/></span>
                  <div className="pill-content flex-grow-1">
                    <Form.Select 
                      value={activeTab} 
                      onChange={(e) => setActiveTab(e.target.value)} 
                      className="pill-select-v2 w-100"
                    >
                      <option value="dashboard">RESUMEN</option>
                      <option value="clientes">CLIENTES (RFM)</option>
                      <option value="cobertura">COBERTURA</option>
                      <option value="productos">PRODUCTOS</option>
                    </Form.Select>
                  </div>
                </div>
              </div>
            ) : (
              <Nav variant="tabs" className="custom-tabs-industrial px-2 pt-2 flex-shrink-0 border-bottom-0">
                <Nav.Item><Nav.Link eventKey="dashboard" className="d-flex align-items-center gap-2"><FaHistory className="d-none d-md-inline" /> RESUMEN</Nav.Link></Nav.Item>
                <Nav.Item><Nav.Link eventKey="clientes" className="d-flex align-items-center gap-2"><FaUsers className="d-none d-md-inline" /> CLIENTES (RFM)</Nav.Link></Nav.Item>
                <Nav.Item><Nav.Link eventKey="cobertura" className="d-flex align-items-center gap-2"><FaMapMarkerAlt className="d-none d-md-inline" /> COBERTURA</Nav.Link></Nav.Item>
                <Nav.Item><Nav.Link eventKey="productos" className="d-flex align-items-center gap-2"><FaBox className="d-none d-md-inline" /> PRODUCTOS</Nav.Link></Nav.Item>
              </Nav>
            )}

            <Tab.Content className="flex-grow-1 overflow-hidden position-relative">
              <Tab.Pane eventKey="dashboard" className="h-100 overflow-auto custom-scrollbar p-3">
                <div className="d-flex flex-column gap-3">
                  
                  {/* SELECTOR DE MÉTRICA EXCLUSIVO PARA DASHBOARD */}
                  <div className="d-flex justify-content-between align-items-center p-3 border-start border-danger border-4" style={{ backgroundColor: 'var(--theme-background-secondary)' }}>
                    <div>
                      <h6 className="fw-black mb-0 text-uppercase" style={{ letterSpacing: '0.5px' }}>Dimensión del Análisis</h6>
                      <span className="text-secondary small fw-bold">Seleccione la unidad de medida para los gráficos</span>
                    </div>
                    <div className="d-flex p-1 border border-secondary border-opacity-25 shadow-sm" style={{ borderRadius: '4px', backgroundColor: 'var(--theme-background-tertiary)' }}>
                      {([['valor', '$'], ['cf', 'CF'], ['cu', 'CU']] as const).map(([m, label]) => (
                        <button 
                          key={m} 
                          onClick={() => setMetric(m)} 
                          className={`btn btn-sm px-4 fw-black ${metric === m ? 'btn-danger shadow-sm' : 'btn-link text-secondary text-decoration-none'}`} 
                          style={{ fontSize: '0.75rem', borderRadius: '2px', transition: 'all 0.2s' }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <Row className="g-3">
                    <Col xs={12} md={4}><div className="p-3 border border-secondary border-opacity-10 h-100" style={{ backgroundColor: 'var(--theme-background-secondary)' }}><div className="d-flex justify-content-between align-items-start"><div><div className="text-secondary fw-bold text-uppercase mb-1" style={{ fontSize: '0.55rem' }}>Analizando {metricLabel}</div><div className="fw-black fs-3">{formatValue(rfmResults.reduce((acc, r) => acc + (metric === 'valor' ? r.monetary : metric === 'cf' ? r.cf : r.cu), 0))}</div></div><FaBox className="text-warning opacity-25 fs-4" /></div></div></Col>
                    <Col xs={12} md={4}><div className="p-3 border border-info border-opacity-25 h-100" style={{ backgroundColor: 'var(--theme-background-secondary)' }}><div className="d-flex justify-content-between align-items-start"><div><div className="text-info fw-bold text-uppercase mb-1" style={{ fontSize: '0.55rem' }}>Producto Estrella</div><div className="fw-black fs-5 text-truncate" style={{ maxWidth: '200px' }}>{statsPro.starProduct}</div><div className="text-info fw-bold" style={{ fontSize: '0.65rem' }}>{formatValue(statsPro.starProductValue)} ACUMULADO</div></div><FaCrown className="text-info opacity-25 fs-4" /></div></div></Col>
                    <Col xs={12} md={4}><div className="p-3 border border-danger border-opacity-25 h-100" style={{ backgroundColor: 'var(--theme-background-secondary)' }}><div className="d-flex justify-content-between align-items-start"><div><div className="text-danger fw-bold text-uppercase mb-1" style={{ fontSize: '0.55rem' }}>Ruta Líder (Preventista)</div><div className="fw-black fs-3 text-danger">{statsPro.starRoute}</div><div className="text-secondary fw-bold" style={{ fontSize: '0.6rem' }}>{formatValue(statsPro.starRouteValue)} EN {metric.toUpperCase()}</div></div><FaRoute className="text-danger opacity-25 fs-4" /></div></div></Col>
                  </Row>
                  
                  <div className="p-3 border border-secondary border-opacity-10" style={{ height: '350px', backgroundColor: 'var(--theme-background-secondary)' }}>
                    <h6 className="fw-black text-uppercase small mb-4">Evolución Histórica de Demanda ({metricLabel})</h6>
                    <ResponsiveContainer width="100%" height="90%">
                      <LineChart data={timelineStats}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="date" {...axisStyle} />
                        <YAxis {...axisStyle} />
                        <Tooltip {...chartTooltipStyle} formatter={(value: any) => [formatValue(value), metricLabel]} />
                        <Line type="monotone" dataKey="value" stroke="var(--color-red-primary)" strokeWidth={3} dot={{ fill: 'var(--color-red-primary)', r: 4 }} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="p-3 border border-secondary border-opacity-10" style={{ height: '350px', backgroundColor: 'var(--theme-background-secondary)' }}>
                    <h6 className="fw-black text-uppercase small mb-4">Tendencia Acumulada por Días de la Semana ({metricLabel})</h6>
                    <ResponsiveContainer width="100%" height="90%">
                      <BarChart data={dailyStats}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="name" {...axisStyle} />
                        <YAxis {...axisStyle} />
                        <Tooltip {...chartTooltipStyle} formatter={(value: any) => [formatValue(value), metricLabel]} />
                        <Bar dataKey="value" fill="var(--color-red-primary)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <Row className="g-3">
                    <Col xs={12} lg={7}>
                      <div className="p-3 border border-secondary border-opacity-10" style={{ height: '450px', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--theme-background-secondary)' }}>
                        <h6 className="fw-black text-uppercase small mb-4 flex-shrink-0">Ranking Completo de Rutas (Preventistas)</h6>
                        <div className="custom-scrollbar flex-grow-1" style={{ overflowY: 'auto', overflowX: 'hidden' }}>
                          <div style={{ height: `${Math.max(routePerformance.length * 40, 400)}px`, width: '100%' }}>
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={routePerformance} layout="vertical" margin={{ left: 0, right: 30, top: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.05)" />
                                <XAxis type="number" hide />
                                <YAxis dataKey="ruta" type="category" {...axisStyle} width={80} tickFormatter={(val) => `${val}`} />
                                <Tooltip {...chartTooltipStyle} formatter={(val: any) => [formatValue(val), metricLabel]} />
                                <Bar dataKey="currentValue" fill="var(--color-red-primary)" radius={[0, 4, 4, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      </div>
                    </Col>
                    <Col xs={12} lg={5}>
                      <div className="p-3 border border-secondary border-opacity-10" style={{ height: '450px', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--theme-background-secondary)' }}>
                        <h6 className="fw-black text-uppercase small mb-4 flex-shrink-0">Desempeño por Sede ({metric.toUpperCase()})</h6>
                        <div className="flex-grow-1">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart 
                              data={statsPro.sedePerformance.map(s => ({
                                ...s,
                                displaySede: sedes.find(sd => sd.codigo === s.sede)?.nombre || s.sede
                              }))} 
                              layout="vertical" 
                              margin={{ left: 5, right: 40, top: 0, bottom: 0 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.05)" />
                              <XAxis type="number" hide />
                              <YAxis 
                                dataKey="displaySede" 
                                type="category" 
                                {...axisStyle} 
                                width={90}
                                tickFormatter={(val) => val.length > 12 ? `${val.substring(0, 10)}...` : val}
                              />
                              <Tooltip 
                                {...chartTooltipStyle} 
                                formatter={(val: any) => [formatValue(val), metricLabel]}
                                labelStyle={{ color: 'var(--color-red-primary)', fontWeight: 'black', textTransform: 'uppercase' }}
                              />
                              <Bar 
                                dataKey="value" 
                                fill="var(--color-red-primary)" 
                                radius={[0, 4, 4, 0]} 
                                barSize={25}
                              >
                                {statsPro.sedePerformance.map((_entry, index) => (
                                  <Cell key={`cell-${index}`} fill={index === 0 ? 'var(--color-red-primary)' : 'rgba(244, 0, 9, 0.6)'} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                        {statsPro.sedePerformance.length === 0 && (
                          <div className="position-absolute top-50 start-50 translate-middle text-secondary small italic">
                            No hay datos de sedes
                          </div>
                        )}
                      </div>
                    </Col>
                  </Row>
                </div>
              </Tab.Pane>

              <Tab.Pane eventKey="clientes" className="h-100 overflow-auto custom-scrollbar p-3">
                <div className="d-flex justify-content-between align-items-center mb-4">
                  <div className="d-flex align-items-center gap-2"><h5 className="fw-black mb-0 text-uppercase">Clasificación RFM y Segmentación</h5><OverlayTrigger trigger="click" placement="right" overlay={rfmPopover} rootClose><button className="btn btn-link p-0 text-info" style={{ lineHeight: 1 }}><FaInfoCircle size={18} /></button></OverlayTrigger></div>
                  <Badge bg="secondary" className="border border-secondary px-3 py-2 fw-black">TOTAL: {rfmResults.length} CLIENTES</Badge>
                </div>
                <Row className="g-3 mb-4">
                  <Col xs={12} lg={8}><div className="admin-border-industrial p-3 d-flex flex-column" style={{ backgroundColor: 'var(--theme-background-secondary)', height: '400px' }}><h6 className="fw-black text-uppercase small mb-4 flex-shrink-0">Distribución del Valor por Segmento</h6><div className="flex-grow-1"><ResponsiveContainer width="100%" height="100%"><BarChart data={segmentCounts} layout="vertical"><CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.05)" /><XAxis type="number" hide /><YAxis dataKey="name" type="category" {...axisStyle} width={100} /><Tooltip {...chartTooltipStyle} /><Bar dataKey="value" radius={[0, 4, 4, 0]}>{segmentCounts.map((entry, index) => <Cell key={index} fill={segmentColors[entry.name]} />)}</Bar></BarChart></ResponsiveContainer></div></div></Col>
                  <Col xs={12} lg={4}><div className="admin-border-industrial p-3 d-flex flex-column" style={{ backgroundColor: 'var(--theme-background-secondary)', height: '400px' }}><h6 className="fw-black text-uppercase small mb-3 flex-shrink-0">Resumen de Cartera</h6><div className="flex-grow-1 d-flex flex-column gap-2 overflow-auto custom-scrollbar pe-1">{segmentCounts.map(s => (<div key={s.name} className="d-flex justify-content-between align-items-center p-2 border border-secondary border-opacity-10 flex-shrink-0" style={{ backgroundColor: 'var(--theme-background-tertiary)' }}><div className="d-flex align-items-center gap-2">{segmentIcons[s.name]}<span className="fw-black text-uppercase" style={{ fontSize: '0.65rem' }}>{s.name}</span></div><span className="fw-black fs-5" style={{ color: segmentColors[s.name] }}>{s.value}</span></div>))}</div></div></Col>
                </Row>
                <div className="admin-border-industrial" style={{ backgroundColor: 'var(--theme-background-secondary)' }}>
                  <div className="p-3 border-bottom border-secondary border-opacity-10"><SearchInput searchTerm={clientSearch} onSearchChange={setClientSearch} placeholder="BUSCAR CLIENTE POR NOMBRE O ID..." className="mb-0" /></div>
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
                    <tbody>{finalRfmResults.map((r) => (<tr key={r.clientId}><td className="ps-4"><div className="d-flex flex-column"><span className="fw-black text-uppercase" style={{ fontSize: '0.85rem' }}>{r.clientName}</span><span className="text-secondary" style={{ fontSize: '0.65rem' }}>ID: {r.clientId}</span></div></td><td className="text-center align-middle"><div className="d-flex align-items-center justify-content-center gap-2">{segmentIcons[r.segment]}<span className="fw-black text-uppercase" style={{ fontSize: '0.7rem', color: segmentColors[r.segment] }}>{r.segment}</span></div></td><td className="text-center align-middle fw-black">{r.recency} <small className="text-secondary">días</small></td><td className="text-end align-middle fw-black text-info">${r.monetary.toLocaleString()}</td><td className="text-end align-middle fw-black text-success">{r.cf.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td><td className="text-end align-middle fw-black text-warning pe-4">{r.cu.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td></tr>))}</tbody>
                  </Table>
                </div>
              </Tab.Pane>

              <Tab.Pane eventKey="cobertura" className="h-100 overflow-auto custom-scrollbar p-3">
                <div className="d-flex flex-column gap-3 h-100">
                  <div className="admin-border-industrial p-3 flex-shrink-0" style={{ backgroundColor: 'var(--theme-background-secondary)', borderLeft: '4px solid var(--color-red-primary)' }}>
                    <div className="d-flex align-items-center gap-3 flex-wrap">
                      <div className="d-flex align-items-center gap-2 p-2 border border-secondary border-opacity-25" style={{ borderRadius: '4px', backgroundColor: 'var(--theme-background-tertiary)', minWidth: '220px' }}>
                        <FaStar className="text-warning ms-2" size={14} />
                        <Form.Select 
                          value="" 
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val && !selectedMarcasCobertura.includes(val)) {
                              setSelectedMarcasCobertura(prev => [...prev, val]);
                            }
                          }} 
                          className="bg-transparent border-0 small fw-black px-2 py-0 shadow-none text-uppercase" 
                          style={{ outline: 'none', fontSize: '0.8rem', cursor: 'pointer', color: 'var(--theme-text-primary)' }}
                        >
                          <option value="" style={{ backgroundColor: 'var(--theme-background-tertiary)' }}>+ AGREGAR MARCA</option>
                          {marcas
                            .filter(m => !selectedMarcasCobertura.includes(m.id))
                            .sort((a,b) => a.nombre.localeCompare(b.nombre))
                            .map(m => (
                              <option key={m.id} value={m.id} style={{ backgroundColor: 'var(--theme-background-tertiary)' }}>{m.nombre.toUpperCase()}</option>
                            ))
                          }
                        </Form.Select>
                      </div>

                      {selectedMarcasCobertura.length > 0 && (
                        <div className="d-flex flex-wrap gap-2">
                          {selectedMarcasCobertura.map(marcaId => {
                            const marca = marcas.find(m => m.id === marcaId);
                            return (
                              <Badge key={marcaId} bg="danger" className="d-flex align-items-center gap-2 px-3 py-2 fw-black text-uppercase border-0" style={{ fontSize: '0.65rem', borderRadius: '2px' }}>
                                {marca?.nombre || 'MARCA'}
                                <span style={{ cursor: 'pointer', opacity: 0.7 }} onClick={() => setSelectedMarcasCobertura(prev => prev.filter(id => id !== marcaId))}>✕</span>
                              </Badge>
                            );
                          })}
                          <Button variant="link" className="text-secondary small fw-black p-0 ms-2 text-decoration-none" onClick={() => setSelectedMarcasCobertura([])} style={{ fontSize: '0.65rem' }}>LIMPIAR</Button>
                        </div>
                      )}
                    </div>
                  </div>

                  {selectedMarcasCobertura.length > 0 ? (
                    <div className="admin-border-industrial overflow-auto flex-grow-1" style={{ backgroundColor: 'var(--theme-background-secondary)' }}>
                      <Table responsive hover bordered className="mb-0 industrial-table-v2 matrix-table h-100">
                        <thead style={{ backgroundColor: 'var(--theme-background-tertiary)' }} className="sticky-top">
                          <tr>
                            <th rowSpan={2} className="align-middle text-center ps-4" style={{ width: '120px', fontSize: '0.65rem', backgroundColor: 'var(--theme-background-tertiary)' }}>ID RUTA</th>
                            {selectedMarcasCobertura.map(mId => {
                              const marca = marcas.find(m => m.id === mId);
                              return (
                                <th key={mId} colSpan={2} className="text-center text-uppercase fw-black bg-danger text-white py-2" style={{ fontSize: '0.7rem', letterSpacing: '1px' }}>
                                  {marca?.nombre || 'MARCA'}
                                </th>
                              );
                            })}
                          </tr>
                          <tr style={{ backgroundColor: 'var(--theme-background-tertiary)' }}>
                            {selectedMarcasCobertura.map(mId => (
                              <Fragment key={`sub-${mId}`}>
                                <th className="text-center bg-dark text-white small fw-black py-1" style={{ fontSize: '0.55rem', borderRight: '1px solid rgba(255,255,255,0.05)', backgroundColor: '#000' }}>CF / CU</th>
                                <th className="text-center bg-dark text-white small fw-black py-1" style={{ fontSize: '0.55rem', backgroundColor: '#000' }}>CLI</th>
                              </Fragment>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {matrixCoberturaData.rutas.map(rutaId => {
                            const routeData = matrixCoberturaData.data[rutaId];
                            return (
                              <Fragment key={rutaId}>
                                <tr 
                                  onClick={() => setExpandedCoberturaRutas(prev => ({ ...prev, [rutaId]: !prev[rutaId] }))}
                                  style={{ cursor: 'pointer' }}
                                  className={expandedCoberturaRutas[rutaId] ? 'bg-danger bg-opacity-10' : ''}
                                >
                                  <td className="text-center align-middle py-2">
                                    <div className="d-flex align-items-center justify-content-center gap-2">
                                      <div className={`chevron-icon ${expandedCoberturaRutas[rutaId] ? 'active' : ''}`} style={{ transition: 'transform 0.1s' }}>
                                        <FaChevronRight size={10} style={{ transform: expandedCoberturaRutas[rutaId] ? 'rotate(90deg)' : 'none' }} />
                                      </div>
                                      <span className="fw-black fs-6 text-uppercase" style={{ letterSpacing: '0.5px', color: 'var(--theme-text-primary)', fontSize: '0.8rem' }}>
                                        {rutaId}
                                      </span>
                                    </div>
                                  </td>
                                  {selectedMarcasCobertura.map(mId => {
                                    const vals = routeData?.total[mId] || { cf: 0, cu: 0, cliConVenta: 0 };
                                    const hasData = vals.cf > 0 || vals.cu > 0;
                                    return (
                                      <Fragment key={`${rutaId}-${mId}`}>
                                        <td className={`text-center align-middle fw-black ${hasData ? '' : 'text-secondary opacity-25'}`} style={{ fontSize: '0.75rem' }}>
                                          <span className="text-success">{vals.cf.toLocaleString(undefined, { maximumFractionDigits: 1 })}</span>
                                          <span className="mx-1 text-secondary opacity-50">/</span>
                                          <span className="text-warning">{vals.cu.toLocaleString(undefined, { maximumFractionDigits: 1 })}</span>
                                        </td>
                                        <td className={`text-center align-middle fw-black ${hasData ? 'text-info' : 'text-secondary opacity-25'}`} style={{ fontSize: '0.75rem' }}>
                                          {vals.cliConVenta} <span className="text-secondary opacity-50 mx-1">/</span> {routeData.totalClientesRuta}
                                        </td>
                                      </Fragment>
                                    );
                                  })}
                                </tr>
                                {expandedCoberturaRutas[rutaId] && (
                                  Object.entries(routeData.clientes)
                                    .sort((a, b) => a[1].nombre.localeCompare(b[1].nombre))
                                    .map(([clientId, client]) => {
                                      const hasAnySale = selectedMarcasCobertura.some(mId => 
                                        (client.marcas[mId]?.cf || 0) > 0 || (client.marcas[mId]?.cu || 0) > 0
                                      );

                                      return (
                                        <tr 
                                          key={`${rutaId}-${clientId}`} 
                                          style={{ 
                                            backgroundColor: hasAnySale ? 'rgba(0,0,0,0.15)' : 'rgba(244, 0, 9, 0.03)' 
                                          }}
                                        >
                                          <td className={`ps-4 py-1 border-start ${hasAnySale ? 'border-danger' : 'border-warning'} border-4`}>
                                            <div className="d-flex flex-column">
                                              <span 
                                                className="fw-bold text-uppercase" 
                                                style={{ 
                                                  fontSize: '0.7rem', 
                                                  color: hasAnySale ? 'var(--theme-text-primary)' : 'rgba(255,255,255,0.4)' 
                                                }}
                                              >
                                                {client.nombre}
                                              </span>
                                              <span className="text-secondary" style={{ fontSize: '0.55rem' }}>ID: {clientId}</span>
                                            </div>
                                          </td>
                                          {selectedMarcasCobertura.map(mId => {
                                            const vals = client.marcas[mId] || { cf: 0, cu: 0 };
                                            const hasData = vals.cf > 0 || vals.cu > 0;
                                            return (
                                              <Fragment key={`${rutaId}-${clientId}-${mId}`}>
                                                <td className={`text-center align-middle fw-bold ${hasData ? '' : 'text-danger opacity-50'}`} style={{ fontSize: '0.75rem' }}>
                                                  <span className={hasData ? 'text-success' : ''}>{vals.cf > 0 ? vals.cf.toLocaleString(undefined, { maximumFractionDigits: 1 }) : '0'}</span>
                                                  <span className="mx-1 text-secondary opacity-50">/</span>
                                                  <span className={hasData ? 'text-warning' : ''}>{vals.cu > 0 ? vals.cu.toLocaleString(undefined, { maximumFractionDigits: 1 }) : '0'}</span>
                                                </td>
                                                <td className="text-center align-middle" style={{ fontSize: '0.75rem' }}>
                                                  {hasData ? <FaUserCheck className="text-info" size={12} /> : <span className="text-danger opacity-50">0</span>}
                                                </td>
                                              </Fragment>
                                            );
                                          })}
                                        </tr>
                                      );
                                    })
                                )}
                              </Fragment>
                            );
                          })}
                        </tbody>
                        <tfoot className="sticky-bottom" style={{ backgroundColor: 'var(--theme-background-tertiary)', zIndex: 5 }}>
                          <tr className="border-top-2 border-danger">
                            <td className="text-center fw-black text-uppercase small py-3" style={{ backgroundColor: 'var(--theme-background-tertiary)' }}>Total General</td>
                            {selectedMarcasCobertura.map(mId => {
                              let tCf = 0; let tCu = 0;
                              matrixCoberturaData.rutas.forEach(rId => {
                                const v = matrixCoberturaData.data[rId]?.total[mId];
                                if (v) { tCf += v.cf; tCu += v.cu; }
                              });
                              return (
                                <Fragment key={`foot-${mId}`}>
                                  <td className="text-center fw-black text-success fs-6" style={{ backgroundColor: 'var(--theme-background-tertiary)' }}>{tCf.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
                                  <td className="text-center fw-black text-warning fs-6" style={{ backgroundColor: 'var(--theme-background-tertiary)' }}>{tCu.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
                                </Fragment>
                              );
                            })}
                          </tr>
                        </tfoot>
                      </Table>
                    </div>
                  ) : (
                    <div className="flex-grow-1 d-flex flex-column align-items-center justify-content-center p-5" style={{ backgroundColor: 'var(--theme-background-secondary)', border: '1px solid var(--theme-border-default)', borderRadius: '4px' }}>
                      <div className="p-4 rounded-circle mb-4" style={{ backgroundColor: 'var(--theme-background-tertiary)' }}>
                        <FaMapMarkerAlt className="text-danger opacity-50" size={64} />
                      </div>
                      <h4 className="text-secondary fw-black text-uppercase mb-3" style={{ letterSpacing: '2px' }}>Matriz de Cobertura</h4>
                      <p className="text-muted small fw-bold text-center" style={{ maxWidth: '400px', lineHeight: '1.6' }}>
                        Seleccione las marcas en el panel superior para activar el comparativo transaccional por rutas. 
                        El sistema generará automáticamente un desglose volumétrico de alta precisión.
                      </p>
                    </div>
                  )}
                </div>
              </Tab.Pane>

              <Tab.Pane eventKey="productos" className="h-100 overflow-auto custom-scrollbar p-3">
                <div className="admin-border-industrial" style={{ backgroundColor: 'var(--theme-background-secondary)' }}>
                  <div className="p-3 border-bottom border-secondary border-opacity-10"><SearchInput searchTerm={productSearch} onSearchChange={setProductSearch} placeholder="BUSCAR PRODUCTO POR NOMBRE O SAP..." className="mb-0" /></div>
                  <Table responsive hover className="mb-0 industrial-table-v2">
                    <thead className="sticky-top" style={{ backgroundColor: 'var(--theme-background-tertiary)', zIndex: 10 }}>
                      <tr>
                        <SortHeader label="PRODUCTO" sortKey="name" currentSort={productSort} onSort={(k: string) => handleSort(k, setProductSort)} />
                        <SortHeader label="TOTAL VALOR ($)" sortKey="valor" currentSort={productSort} onSort={(k: string) => handleSort(k, setProductSort)} align="end" />
                        <SortHeader label="TOTAL CF" sortKey="cf" currentSort={productSort} onSort={(k: string) => handleSort(k, setProductSort)} align="end" />
                        <SortHeader label="TOTAL CU" sortKey="cu" currentSort={productSort} onSort={(k: string) => handleSort(k, setProductSort)} align="end" />
                      </tr>
                    </thead>
                    <tbody>{finalProductPerformance.map((p) => (<tr key={p.sap}><td className="ps-4"><div className="d-flex flex-column"><span className="fw-black text-uppercase" style={{ fontSize: '0.75rem' }}>{p.name}</span><span className="text-secondary" style={{ fontSize: '0.6rem' }}>SAP: {p.sap}</span></div></td><td className="text-end align-middle fw-black">${p.valor.toLocaleString()}</td><td className="text-end align-middle fw-black text-success">{p.cf.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td><td className="text-end align-middle fw-black text-warning pe-4">{p.cu.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td></tr>))}</tbody>
                  </Table>
                </div>
              </Tab.Pane>
            </Tab.Content>
          </div>
        </Tab.Container>
      </div>

      <style>{`
        .fw-black { font-weight: 900 !important; }
        .info-pill-new { display: flex; align-items: center; background-color: var(--theme-background-secondary); border: 1px solid var(--theme-border-default); border-radius: 0; height: 38px; position: relative; }
        .pill-icon-sober { background-color: var(--theme-icon-bg); color: var(--theme-icon-color); height: 100%; display: flex; align-items: center; border-right: 1px solid var(--theme-border-default); min-width: 32px; justify-content: center; z-index: 2; }
        .pill-main-icon { font-size: 14px; }
        .pill-content { padding: 0 10px; display: flex; flex-direction: column; justify-content: center; min-width: 0; flex-grow: 1; position: relative; z-index: 1; }
        .pill-select-v2 { background: transparent !important; border: none !important; color: var(--theme-text-primary) !important; font-weight: 600; font-size: 0.85rem; padding: 0 !important; margin-top: -2px; box-shadow: none !important; appearance: none; }
        
        .custom-tabs-industrial .nav-link { color: var(--theme-text-secondary); border: none; border-bottom: 3px solid transparent; font-weight: 800; text-transform: uppercase; font-size: 0.75rem; padding: 10px 20px; border-radius: 0; transition: all 0.2s ease; letter-spacing: 0.5px; }
        .custom-tabs-industrial .nav-link:hover { color: var(--theme-text-primary); background: rgba(244, 0, 9, 0.05); }
        .custom-tabs-industrial .nav-link.active { color: var(--color-red-primary) !important; background: transparent !important; border-bottom-color: var(--color-red-primary) !important; }
        .industrial-table-v2 { background-color: transparent !important; }
        .industrial-table-v2 thead th { background-color: var(--theme-background-tertiary) !important; color: var(--theme-text-secondary); font-weight: 900; font-size: 0.65rem; text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px solid var(--theme-border-default); padding: 15px 10px; }
        .industrial-table-v2 tbody tr { border-bottom: 1px solid rgba(255,255,255,0.05); transition: background 0.2s ease; }
        .industrial-table-v2 tbody tr:hover { background-color: rgba(244, 0, 9, 0.05) !important; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0,0,0,0.1); }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: var(--color-red-primary); }
        .date-picker-industrial { background: transparent; border: none; font-weight: 900; font-size: 0.75rem; color: var(--theme-text-primary); text-align: center; width: 100px; outline: none; }
        .react-datepicker { background-color: var(--theme-background-secondary) !important; border: 1px solid var(--theme-border-default) !important; font-family: inherit !important; }
        .react-datepicker__header { background-color: var(--theme-background-tertiary) !important; border-bottom: 1px solid var(--theme-border-default) !important; }
        .react-datepicker__current-month, .react-datepicker__day-name { color: var(--theme-text-primary) !important; font-weight: 900 !important; text-transform: uppercase; }
        .react-datepicker__day { color: var(--theme-text-secondary) !important; font-weight: 700 !important; }
        .react-datepicker__day:hover { background-color: var(--color-red-primary) !important; color: white !important; }
        .react-datepicker__day--selected { background-color: var(--color-red-primary) !important; color: white !important; }
        .react-datepicker__day--keyboard-selected { background-color: rgba(244, 0, 9, 0.2) !important; }
        .matrix-table { border: 1px solid var(--theme-border-default) !important; }
        .matrix-table th, .matrix-table td { border: 1px solid rgba(255,255,255,0.05) !important; }
      `}</style>
    </div>
  );
};

export default AnalyticsProPage;
