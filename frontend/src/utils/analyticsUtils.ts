// src/utils/analyticsUtils.ts

export interface RFMResult {
  clientId: string;
  clientName: string;
  recency: number; // Days since last purchase
  frequency: number; // Count of unique orders
  monetary: number; // Total value
  rScore: number;
  fScore: number;
  mScore: number;
  totalScore: number;
  segment: 'Campeón' | 'En Riesgo' | 'Nueva Promesa' | 'Hibernando' | 'Fiel' | 'Potencial' | 'Necesita Atención';
}

export const calculateRFM = (demanda: any[], maestro: any[]): RFMResult[] => {
  const now = new Date();
  const clientData: Record<string, { 
    lastDate: Date; 
    orders: Set<string>; 
    totalValue: number;
    name: string;
  }> = {};

  const maestroMap = maestro.reduce((acc, m) => ({ ...acc, [String(m.Codigo)]: m.Cliente }), {} as Record<string, string>);

  demanda.forEach(d => {
    const clientId = String(d.Solicitante);
    const dateStr = d['Fecha documento'];
    const docId = String(d.Documento);
    const value = parseFloat(d.Valor) || 0;
    const status = String(d.Status).toUpperCase();

    // Only process effective orders (exclude rejections if Status is 'C' or similar, but docs say process effective ones)
    if (status === 'C') return;

    // Parse date (assuming DD.MM.YYYY or similar common format from SAP exports)
    // SAP often exports as DD.MM.YYYY
    const parts = dateStr.split('.');
    let date: Date;
    if (parts.length === 3) {
      date = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    } else {
      date = new Date(dateStr);
    }

    if (isNaN(date.getTime())) return;

    if (!clientData[clientId]) {
      clientData[clientId] = {
        lastDate: date,
        orders: new Set([docId]),
        totalValue: value,
        name: maestroMap[clientId] || 'Cliente Desconocido'
      };
    } else {
      if (date > clientData[clientId].lastDate) {
        clientData[clientId].lastDate = date;
      }
      clientData[clientId].orders.add(docId);
      clientData[clientId].totalValue += value;
    }
  });

  const results: RFMResult[] = Object.entries(clientData).map(([clientId, data]) => {
    const recency = Math.floor((now.getTime() - data.lastDate.getTime()) / (1000 * 60 * 60 * 24));
    const frequency = data.orders.size;
    const monetary = data.totalValue;

    return {
      clientId,
      clientName: data.name,
      recency,
      frequency,
      monetary,
      rScore: 0,
      fScore: 0,
      mScore: 0,
      totalScore: 0,
      segment: 'Hibernando'
    };
  });

  if (results.length === 0) return [];

  // Scoring logic (1-5 scale)
  // Sort by Recency (descending for scoring: lower days = higher score)
  results.sort((a, b) => a.recency - b.recency);
  const qSize = Math.ceil(results.length / 5);
  results.forEach((r, i) => {
    r.rScore = 5 - Math.floor(i / qSize);
    if (r.rScore < 1) r.rScore = 1;
  });

  // Sort by Frequency (ascending)
  results.sort((a, b) => a.frequency - b.frequency);
  results.forEach((r, i) => {
    r.fScore = Math.floor(i / qSize) + 1;
    if (r.fScore > 5) r.fScore = 5;
  });

  // Sort by Monetary (ascending)
  results.sort((a, b) => a.monetary - b.monetary);
  results.forEach((r, i) => {
    r.mScore = Math.floor(i / qSize) + 1;
    if (r.mScore > 5) r.mScore = 5;
  });

  // Calculate Total Score and Segment
  results.forEach(r => {
    r.totalScore = r.rScore + r.fScore + r.mScore;
    
    // Basic segmentation logic based on R and F
    if (r.rScore >= 4 && r.fScore >= 4) {
      r.segment = 'Campeón';
    } else if (r.rScore >= 4 && r.fScore <= 2) {
      r.segment = 'Nueva Promesa';
    } else if (r.rScore <= 2 && r.fScore >= 4) {
      r.segment = 'En Riesgo';
    } else if (r.rScore <= 2 && r.fScore <= 2) {
      r.segment = 'Hibernando';
    } else if (r.fScore >= 3) {
      r.segment = 'Fiel';
    } else {
      r.segment = 'Potencial';
    }
  });

  return results.sort((a, b) => b.monetary - a.monetary);
};

export const calculateDailyStats = (demanda: any[]) => {
  const daysMap: Record<string, { total: number; count: number }> = {
    'LUNES': { total: 0, count: 0 },
    'MARTES': { total: 0, count: 0 },
    'MIÉRCOLES': { total: 0, count: 0 },
    'JUEVES': { total: 0, count: 0 },
    'VIERNES': { total: 0, count: 0 },
    'SÁBADO': { total: 0, count: 0 },
    'DOMINGO': { total: 0, count: 0 }
  };

  const dayNames = ['DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'];

  demanda.forEach(d => {
    const status = String(d.Status).toUpperCase();
    if (status === 'C') return;

    const dateStr = d['Fecha documento'];
    const parts = dateStr.split('.');
    let date: Date;
    if (parts.length === 3) {
      date = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    } else {
      date = new Date(dateStr);
    }

    if (isNaN(date.getTime())) return;

    const dayName = dayNames[date.getDay()];
    const value = parseFloat(d.Valor) || 0;

    daysMap[dayName].total += value;
    daysMap[dayName].count += 1;
  });

  return Object.entries(daysMap).map(([name, data]) => ({
    name,
    total: data.total,
    count: data.count,
    avg: data.count > 0 ? data.total / data.count : 0
  }));
};

export const calculateProductPerformance = (demanda: any[]) => {
  const prodMap: Record<string, { name: string; total: number; count: number }> = {};

  demanda.forEach(d => {
    const status = String(d.Status).toUpperCase();
    if (status === 'C') return;

    const sap = String(d.Material);
    const name = d['Nombre material'] || 'Producto Desconocido';
    const value = parseFloat(d.Valor) || 0;

    if (!prodMap[sap]) {
      prodMap[sap] = { name, total: 0, count: 0 };
    }
    prodMap[sap].total += value;
    prodMap[sap].count += 1;
  });

  return Object.entries(prodMap).map(([sap, data]) => ({
    sap,
    name: data.name,
    total: data.total,
    count: data.count
  })).sort((a, b) => b.total - a.total);
};

export const calculateMonthlyComparison = (demanda: any[]) => {
  const monthlyMap: Record<string, number> = {};

  demanda.forEach(d => {
    const status = String(d.Status).toUpperCase();
    if (status === 'C') return;

    const dateStr = d['Fecha documento'];
    const parts = dateStr.split('.');
    let date: Date;
    if (parts.length === 3) {
      date = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    } else {
      date = new Date(dateStr);
    }

    if (isNaN(date.getTime())) return;

    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const value = parseFloat(d.Valor) || 0;

    monthlyMap[key] = (monthlyMap[key] || 0) + value;
  });

  const sortedMonths = Object.entries(monthlyMap).sort((a, b) => a[0].localeCompare(b[0]));
  
  return sortedMonths.map(([month, total], i) => {
    const prevTotal = i > 0 ? sortedMonths[i - 1][1] : 0;
    const delta = prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : 0;
    
    return {
      month,
      total,
      prevTotal,
      delta
    };
  });
};
