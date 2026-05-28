/**
 * Web Worker para el procesamiento pesado de archivos Excel de Demanda.
 * Realiza la agregación por Cliente/Fecha y la conversión a CF/CU.
 */

import * as XLSX from 'xlsx';

self.onmessage = async (e: MessageEvent) => {
  const { file, maestroData } = e.data;

  try {
    // 1. Leer el archivo (ArrayBuffer)
    const workbook = XLSX.read(file, { type: 'array', cellDates: true });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet) as any[];

    // 2. Crear mapa del Maestro para búsqueda rápida
    // Asumimos que maestroData viene de RTDB como array de objetos
    const maestroMap = (maestroData || []).reduce((acc: any, item: any) => {
      acc[String(item.Codigo)] = item;
      return acc;
    }, {});

    // 3. Agregación Estratégica
    const dailyAggregates: Record<string, any> = {};

    let skippedRows = 0;

    rows.forEach((row: any, index: number) => {
      const solicitante = String(row.Solicitante || '').trim();
      if (!solicitante) { skippedRows++; return; }

      const fechaDoc = row['Fecha documento'];
      let dateObj: Date | null = null;
      let dateKey: string = '';

      if (fechaDoc instanceof Date) {
        dateObj = fechaDoc;
      } else if (typeof fechaDoc === 'string') {
        // Soporte para DD.MM.YYYY, DD/MM/YYYY, DD-MM-YYYY
        const parts = fechaDoc.split(/[\.\-\/]/);
        if (parts.length === 3) {
          // Detectar si es YYYY-MM-DD o DD-MM-YYYY
          if (parts[0].length === 4) { // YYYY-MM-DD
            dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
          } else { // DD-MM-YYYY
            dateObj = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
          }
        } else {
          dateObj = new Date(fechaDoc);
        }
      }

      if (!dateObj || isNaN(dateObj.getTime())) {
        skippedRows++;
        return;
      }

      dateKey = `${dateObj.getFullYear()}${String(dateObj.getMonth() + 1).padStart(2, '0')}${String(dateObj.getDate()).padStart(2, '0')}`;

      const docKey = `${solicitante}_${dateKey}`;
      const material = String(row.Material);
      const cantidad = parseFloat(row.Cantidad) || 0;
      const valor = parseFloat(row.Valor) || 0;

      // Obtener factores de conversión del Maestro
      const clienteMaestro = maestroMap[solicitante];
      // Nota: Si el factor no está en el cliente, podríamos necesitar una tabla de materiales,
      // pero según lo conversado, el Maestro tiene la info de transformación.
      const factorCF = parseFloat(clienteMaestro?.CF) || 0;
      const factorCU = parseFloat(clienteMaestro?.CU) || 0;

      const cf = cantidad * factorCF;
      const cu = cantidad * factorCU;

      if (!dailyAggregates[docKey]) {
        dailyAggregates[docKey] = {
          id: docKey,
          solicitante,
          nombreCliente: clienteMaestro?.Cliente || 'Desconocido',
          fecha: dateObj.getTime(), // Guardamos como timestamp para Firestore
          totalValor: 0,
          totalCF: 0,
          totalCU: 0,
          materiales: [],
          ruta: clienteMaestro?.Ruta || 'S/R',
          subCanal: clienteMaestro?.SubCanal || 'S/C'
        };
      }

      const agg = dailyAggregates[docKey];
      agg.totalValor += valor;
      agg.totalCF += cf;
      agg.totalCU += cu;
      
      // Añadir material al desglose de la visita
      agg.materiales.push({
        sku: material,
        descripcion: row['Nombre material'] || 'Sin descripción',
        cantidad,
        cf,
        cu,
        valor
      });
    });

    // 4. Enviar resultados
    const results = Object.values(dailyAggregates);
    self.postMessage({ success: true, results, totalRows: rows.length });

  } catch (error: any) {
    self.postMessage({ success: false, error: error.message });
  }
};
