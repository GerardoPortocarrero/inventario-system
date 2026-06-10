/**
 * Web Worker PRO: Motor de Agregación y Cálculo Volumétrico
 * Soporta limpieza de SAP IDs, normalización de medidas y fallbacks de seguridad.
 */
import * as XLSX from 'xlsx';

self.onmessage = async (e: MessageEvent) => {
  const { file, maestroData, productsData } = e.data;

  try {
    const workbook = XLSX.read(file, { type: 'array', cellDates: true });
    const rawRows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]) as any[];

    if (rawRows.length === 0) {
      self.postMessage({ success: true, results: [] });
      return;
    }

    // --- MOTOR DE MAPEO ULTRA-ROBUSTO ---
    const firstRow = rawRows[0];
    const keys = Object.keys(firstRow);
    const deepClean = (s: string) => String(s || '').replace(/[\.\$#\[\]\/\s\-_]/g, '').trim().toUpperCase();

    const findKey = (possibilities: string[]) => {
      const cleanPossibilities = possibilities.map(deepClean);
      let match = keys.find(k => cleanPossibilities.includes(deepClean(k)));
      if (match) return match;
      return keys.find(k => {
        const ck = deepClean(k);
        return cleanPossibilities.some(p => ck.includes(p) || p.includes(ck));
      });
    };

    const colMap = {
      solicitante: findKey(['Solicitante', 'Cliente', 'Solic', 'CodCli']),
      material: findKey(['Material', 'Articulo', 'SKU', 'CodMat', 'Prod']),
      cantidad: findKey(['Cantidad', 'Cant', 'Qty', 'Ventas', 'Volumen']), 
      valor: findKey(['Valor', 'Monto', 'Importe', 'Neto', 'Precio']),
      medida: findKey(['Medida', 'UM', 'Unidad', 'Unit']),
      status: findKey(['Status', 'Estado', 'Est']),
      fecha: findKey(['FechaDocumento', 'FechaDoc', 'Fecha', 'Date']),
      nombreMaterial: findKey(['NombreMaterial', 'TextoBreve', 'Descripcion', 'Desc'])
    };

    // --- MAPAS DE REFERENCIA (Soporta Array u Objeto) ---
    const cleanId = (id: any) => String(id || '').trim().replace(/^0+/, '');
    
    const toArray = (data: any) => Array.isArray(data) ? data : Object.values(data || {});

    const maestroMap = toArray(maestroData).reduce((acc: any, item: any) => {
      if (item && item.Codigo) acc[cleanId(item.Codigo)] = item;
      return acc;
    }, {});

    const productsMap = toArray(productsData).reduce((acc: any, item: any) => {
      if (item && item.sap) acc[cleanId(item.sap)] = item;
      return acc;
    }, {});

    const UNIT_CASE_ML = 5677.92; 
    const dailyAggregates: Record<string, any> = {};
    let matchedProducts = 0;
    let totalProcessedRows = 0;

    // --- PROCESAMIENTO ---
    rawRows.forEach((row: any) => {
      totalProcessedRows++;
      
      const solicitanteId = cleanId(colMap.solicitante ? row[colMap.solicitante] : '');
      if (!solicitanteId) return;

      const fechaRaw = colMap.fecha ? row[colMap.fecha] : null;
      let dateObj: Date | null = null;
      if (fechaRaw instanceof Date) dateObj = fechaRaw;
      else if (typeof fechaRaw === 'string') {
        const parts = fechaRaw.split(/[\.\-\/]/);
        if (parts.length === 3) {
          dateObj = parts[0].length === 4 
            ? new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])) 
            : new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        } else dateObj = new Date(fechaRaw);
      }
      if (!dateObj || isNaN(dateObj.getTime())) return;

      const dateKey = `${dateObj.getFullYear()}${String(dateObj.getMonth() + 1).padStart(2, '0')}${String(dateObj.getDate()).padStart(2, '0')}`;
      const docKey = `${solicitanteId}_${dateKey}`;
      
      const parseSapNum = (val: any) => {
        if (typeof val === 'number') return val;
        if (!val) return 0;
        let str = String(val).trim().toUpperCase().replace(/[A-Z\s]+$/, '');
        const lastComma = str.lastIndexOf(',');
        const lastDot = str.lastIndexOf('.');
        if (lastComma > lastDot) return parseFloat(str.replace(/\./g, '').replace(',', '.')) || 0;
        else if (lastDot > lastComma) {
          const parts = str.split('.');
          if (parts.length === 2 && parts[1].length === 3 && lastComma === -1) return parseFloat(str.replace(/\./g, '')) || 0;
          return parseFloat(str.replace(/,/g, '')) || 0;
        }
        return parseFloat(str.replace(',', '.')) || 0;
      };

      const cantidad = parseSapNum(colMap.cantidad ? row[colMap.cantidad] : 0);
      const valor = parseSapNum(colMap.valor ? row[colMap.valor] : 0);
      const medida = String((colMap.medida ? row[colMap.medida] : '') || '').toUpperCase();
      const matId = cleanId(colMap.material ? row[colMap.material] : '');

      const prod = productsMap[matId];
      const client = maestroMap[solicitanteId];
      if (prod) matchedProducts++;

      const unitsPerCase = prod ? (parseFloat(prod.unidades) || 1) : 1;
      const mlPerUnit = prod ? (parseFloat(prod.mililitros) || 0) : 0;
      
      const isCase = (medida === 'CAJ' || medida === 'CJ' || medida === 'CS' || medida === 'CASE' || medida.includes('CJ'));

      // 1. Unidades Base (para cálculos consistentes)
      const totalUnits = isCase ? (cantidad * unitsPerCase) : cantidad;

      // 2. CF (Caja Física): SOLO si el producto tiene volumen (líquido)
      // Esto filtra envases/auxiliares que SAP reporta en líneas aparte.
      let cf = 0;
      if (mlPerUnit > 0) {
        cf = isCase ? cantidad : (cantidad / unitsPerCase);
      }

      // 3. CU (Caja Unitaria): Volumen total / Estándar 5677.92
      const cu = (totalUnits * mlPerUnit) / UNIT_CASE_ML;

      // --- AGREGACIÓN ---
      if (!dailyAggregates[docKey]) {
        dailyAggregates[docKey] = {
          id: docKey,
          solicitante: solicitanteId,
          nombreCliente: client?.Cliente || (colMap.solicitante ? row[colMap.solicitante] : 'Cliente Desconocido'),
          fecha: dateObj.getTime(),
          totalValor: 0, totalCF: 0, totalCU: 0,
          materiales: [],
          sede: client?.Loc || 'OTRO',
          ruta: client?.['Ruta com'] || client?.Ruta || 'S/R',
          subCanal: client?.SubCanal || 'S/C'
        };
      }

      const agg = dailyAggregates[docKey];
      agg.totalValor += valor;
      agg.totalCF += cf;
      agg.totalCU += cu;
      
      const existingMat = agg.materiales.find((m: any) => m.sku === matId);
      if (existingMat) {
        existingMat.cantidad += cantidad;
        existingMat.cf += cf;
        existingMat.cu += cu;
        existingMat.valor += valor;
      } else {
        agg.materiales.push({
          sku: matId,
          descripcion: (colMap.nombreMaterial ? row[colMap.nombreMaterial] : '') || 'Sin nombre',
          cantidad, cf, cu, valor
        });
      }
    });

    self.postMessage({ 
      success: true, 
      results: Object.values(dailyAggregates),
      metrics: { totalRows: totalProcessedRows, matchedProducts }
    });

  } catch (error: any) {
    self.postMessage({ success: false, error: error.message });
  }
};
