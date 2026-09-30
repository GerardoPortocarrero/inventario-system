/**
 * Web Worker: Procesamiento completo del archivo DEMANDA.
 * Lee el Excel y calcula los 5 reportes (volumen, eficiencia, bebidas, duplicados, cobertura)
 * en un hilo separado para NO bloquear la interfaz.
 */
import * as XLSX from 'xlsx';

const UNIT_CASE_ML = 5677.92;
const cleanId = (id: any) => String(id || '').trim().replace(/^0+/, '');
const sanitizeKey = (key: string) => key.replace(/[\.\$#\[\]\/]/g, '').trim();

const parseSapNum = (val: any) => {
  if (typeof val === 'number') return val;
  const cleaned = String(val || '0').replace(/\./g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
};

const isCaseMedida = (medida: string) =>
  medida === 'CAJ' || medida === 'CJ' || medida === 'CS' || medida === 'CASE' || medida.includes('CJ');

const normDias = (val: string) => String(val || '')
  .toUpperCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .split(/[, -]/)
  .map(d => d.trim().substring(0, 2))
  .filter(d => d.length === 2);

const sedeNombreDe = (sedes: any[], codigo: string) =>
  (sedes || []).find(s => s.codigo === codigo)?.nombre || codigo;

self.onmessage = (e: MessageEvent) => {
  const { file, maestroData, productsData, sedes, beverageTypes } = e.data;

  try {
    const workbook = XLSX.read(file, { type: 'array' });
    const rawData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]) as any[];

    if (rawData.length === 0) {
      self.postMessage({ success: true, sanitizedData: [], reports: {}, metrics: { totalRows: 0 } });
      return;
    }

    const sanitizedData = rawData.map(row => {
      const newRow: any = {};
      Object.keys(row).forEach(k => newRow[sanitizeKey(k)] = row[k]);
      return newRow;
    });

    const maestro: any[] = Array.isArray(maestroData) ? maestroData : Object.values(maestroData || {});
    const products: any[] = Array.isArray(productsData) ? productsData : Object.values(productsData || {});

    const maestroMap = maestro.reduce((acc: any, m) => ({ ...acc, [cleanId(m.Codigo)]: m }), {} as Record<string, any>);
    const productMap = products.reduce((acc: any, p) => ({ ...acc, [cleanId(p.sap)]: p }), {} as Record<string, any>);

    // ---------- 1) REPORTE DE VOLUMEN ----------
    self.postMessage({ type: 'progress', report: 'volumen', pct: 20 });
    const vol: Record<string, any> = {};
    sanitizedData.forEach(d => {
      const prod = productMap[cleanId(d.Material)];
      const client = maestroMap[cleanId(d.Solicitante)];
      if (!prod || !client) return;

      const loc = client.Loc || 'OTRO';
      const mesa = client['Mesa Com'] || client['MESA COM'] || 'SIN MESA';
      const ruta = client['Ruta com'] || client['RUTA COM'] || 'SIN RUTA';

      const cantidad = parseSapNum(d.Cantidad);
      const medida = String(d.Medida || '').toUpperCase();
      const unitsPerCase = parseFloat(prod.unidades) || 1;
      const mlPerUnit = parseFloat(prod.mililitros) || 0;
      const isCase = isCaseMedida(medida);

      const totalUnits = isCase ? (cantidad * unitsPerCase) : cantidad;
      let physicalBoxes = 0;
      if (mlPerUnit > 0) physicalBoxes = isCase ? cantidad : (cantidad / unitsPerCase);
      const unitCases = (totalUnits * mlPerUnit) / UNIT_CASE_ML;

      if (!vol[loc]) vol[loc] = { nombre: sedeNombreDe(sedes, loc), totalCF: 0, totalUC: 0, mesas: {} };
      if (!vol[loc].mesas[mesa]) vol[loc].mesas[mesa] = { totalCF: 0, totalUC: 0, rutas: {} };
      if (!vol[loc].mesas[mesa].rutas[ruta]) vol[loc].mesas[mesa].rutas[ruta] = { totalCF: 0, totalUC: 0, productos: {} };

      const r = vol[loc].mesas[mesa].rutas[ruta];
      r.totalCF += physicalBoxes; r.totalUC += unitCases;
      if (!r.productos[prod.sap]) r.productos[prod.sap] = { nombre: prod.nombre, cantU: 0, cantC: 0 };
      r.productos[prod.sap].cantU += totalUnits; r.productos[prod.sap].cantC += physicalBoxes;
      vol[loc].totalCF += physicalBoxes; vol[loc].totalUC += unitCases;
      vol[loc].mesas[mesa].totalCF += physicalBoxes; vol[loc].mesas[mesa].totalUC += unitCases;
    });

    // ---------- 2) REPORTE DE EFICIENCIA ----------
    self.postMessage({ type: 'progress', report: 'eficiencia', pct: 40 });
    const efi: Record<string, any> = {};
    const demandaSet = new Set(sanitizedData.map(d => cleanId(d.Solicitante)));
    maestro.forEach(m => {
      const loc = m.Loc || 'OTRO';
      const mesa = m['Mesa Com'] || m['MESA COM'] || 'SIN MESA';
      const ruta = m['Ruta com'] || m['RUTA COM'] || 'SIN RUTA';
      const dias = normDias(m['SEGDIAS'] || m['SEG DIAS'] || m['SEG.DIAS'] || '');
      const sem = String(m['SEMPREV'] || m['SEM PREV'] || m['SEM. PREV'] || '1');

      if (!efi[loc]) efi[loc] = { nombre: sedeNombreDe(sedes, loc), id: loc, mesas: {} };
      if (!efi[loc].mesas[mesa]) efi[loc].mesas[mesa] = { rutas: {} };
      if (!efi[loc].mesas[mesa].rutas[ruta]) efi[loc].mesas[mesa].rutas[ruta] = { schedules: {} };

      const r = efi[loc].mesas[mesa].rutas[ruta];
      const isEfec = demandaSet.has(cleanId(m.Codigo));
      dias.forEach(dia => {
        const key = `${dia}_${sem}`;
        if (!r.schedules[key]) r.schedules[key] = { prog: 0, efec: 0 };
        r.schedules[key].prog += 1;
        if (isEfec) r.schedules[key].efec += 1;
      });
    });

    // ---------- 3) REPORTE DE BEBIDAS ----------
    self.postMessage({ type: 'progress', report: 'bebidas', pct: 60 });
    const beb: Record<string, any> = {};
    sanitizedData.forEach(d => {
      const prod = productMap[cleanId(d.Material)];
      const client = maestroMap[cleanId(d.Solicitante)];
      if (!prod || !client) return;

      const loc = client.Loc || 'OTRO';
      const tipoId = prod.tipoBebidaId || 'SIN_TIPO';
      const tipoNombre = (beverageTypes || []).find((t: any) => t.id === tipoId)?.nombre || 'OTROS';
      const rutaCom = client['Ruta com'] || client['RUTA COM'] || 'SIN RUTA';

      const cantidad = parseSapNum(d.Cantidad);
      const medida = String(d.Medida || '').toUpperCase();
      const unitsPerCase = parseFloat(prod.unidades) || 1;
      const mlPerUnit = parseFloat(prod.mililitros) || 0;
      const isCase = isCaseMedida(medida);

      const totalUnits = isCase ? (cantidad * unitsPerCase) : cantidad;
      let physicalBoxes = 0;
      if (mlPerUnit > 0) physicalBoxes = isCase ? cantidad : (cantidad / unitsPerCase);
      const unitCases = (totalUnits * mlPerUnit) / UNIT_CASE_ML;

      if (!beb[loc]) beb[loc] = { nombre: sedeNombreDe(sedes, loc), tipos: {} };
      if (!beb[loc].tipos[tipoId]) beb[loc].tipos[tipoId] = { nombre: String(tipoNombre).toUpperCase(), totalCF: 0, totalUC: 0, rutas: {} };
      if (!beb[loc].tipos[tipoId].rutas[rutaCom]) beb[loc].tipos[tipoId].rutas[rutaCom] = { totalCF: 0, totalUC: 0, productos: {} };

      const r = beb[loc].tipos[tipoId].rutas[rutaCom];
      r.totalCF += physicalBoxes; r.totalUC += unitCases;
      if (!r.productos[prod.sap]) r.productos[prod.sap] = { nombre: prod.nombre, cantU: 0, cantC: 0, uc: 0 };
      r.productos[prod.sap].cantU += totalUnits; r.productos[prod.sap].cantC += physicalBoxes; r.productos[prod.sap].uc += unitCases;
      beb[loc].tipos[tipoId].totalCF += physicalBoxes; beb[loc].tipos[tipoId].totalUC += unitCases;
    });

    // ---------- 4) REPORTE DE DUPLICADOS ----------
    self.postMessage({ type: 'progress', report: 'duplicados', pct: 80 });
    const dup: Record<string, any> = {};
    const orderGroups: Record<string, Record<string, any[]>> = {};
    sanitizedData.forEach(d => {
      const solId = cleanId(d.Solicitante);
      const docId = String(d.Documento);
      if (!orderGroups[solId]) orderGroups[solId] = {};
      if (!orderGroups[solId][docId]) orderGroups[solId][docId] = [];
      orderGroups[solId][docId].push(d);
    });

    Object.entries(orderGroups).forEach(([solId, docs]) => {
      const docIds = Object.keys(docs);
      if (docIds.length < 2) return;
      const duplicatePairs: any[] = [];

      const getSignature = (items: any[]) => items
        .map(it => `${cleanId(it.Material)}_${parseFloat(it.Cantidad)}_${String(it.Medida).toUpperCase()}`)
        .sort().join('|');

      for (let i = 0; i < docIds.length; i++) {
        for (let j = i + 1; j < docIds.length; j++) {
          const docA = docs[docIds[i]];
          const docB = docs[docIds[j]];
          if (docA.length !== docB.length) continue;
          if (getSignature(docA) === getSignature(docB)) {
            duplicatePairs.push({
              doc1: { id: docIds[i], hora: docA[0].Hora || '--:--', items: docA.map(it => ({ nombre: it['Nombre material'], sap: it.Material, cant: it.Cantidad, med: it.Medida })) },
              doc2: { id: docIds[j], hora: docB[0].Hora || '--:--', items: docB.map(it => ({ nombre: it['Nombre material'], sap: it.Material, cant: it.Cantidad, med: it.Medida })) }
            });
          }
        }
      }

      if (duplicatePairs.length > 0) {
        const client = maestroMap[solId];
        const loc = client?.Loc || 'OTRO';
        if (!dup[loc]) dup[loc] = { nombre: sedeNombreDe(sedes, loc), id: loc, clientes: {} };
        if (!dup[loc].clientes[solId]) dup[loc].clientes[solId] = { nombre: client?.Cliente || 'CLIENTE DESCONOCIDO', codigo: solId, duplas: [] };
        dup[loc].clientes[solId].duplas.push(...duplicatePairs);
      }
    });

    // ---------- 5) REPORTE DE COBERTURA ----------
    self.postMessage({ type: 'progress', report: 'cobertura', pct: 95 });
    const cob: Record<string, any> = {};
    sanitizedData.forEach(d => {
      const solId = cleanId(d.Solicitante);
      const client = maestroMap[solId];
      if (!client) return;

      const loc = client.Loc || 'OTRO';
      const mesa = client['Mesa Com'] || client['MESA COM'] || 'SIN MESA';
      const ruta = client['Ruta com'] || client['RUTA COM'] || 'SIN RUTA';
      const matId = cleanId(d.Material);
      const cantidad = parseSapNum(d.Cantidad);
      if (!matId || cantidad <= 0) return;

      if (!cob[loc]) cob[loc] = { id: loc, nombre: sedeNombreDe(sedes, loc), mesas: {} };
      if (!cob[loc].mesas[mesa]) cob[loc].mesas[mesa] = { rutas: {} };
      if (!cob[loc].mesas[mesa].rutas[ruta]) cob[loc].mesas[mesa].rutas[ruta] = { clientes: {} };

      const r = cob[loc].mesas[mesa].rutas[ruta];
      if (!r.clientes[solId]) {
        r.clientes[solId] = {
          nombre: client.Cliente || 'SIN NOMBRE',
          subCanal: String(client.SubCanal || 'S/C').trim(),
          dias: normDias(client['SEGDIAS'] || client['SEG DIAS'] || client['SEG.DIAS'] || ''),
          materiales: {}
        };
      }

      const medida = String(d.Medida || '').toUpperCase();
      const valor = parseSapNum(d.Valor);
      const key = `${matId}_${medida}`;
      if (!r.clientes[solId].materiales[key]) {
        r.clientes[solId].materiales[key] = { sku: matId, medida, descripcion: (d['Nombre material'] || String(d.Material)).trim() || 'SIN NOMBRE', cantidad: 0, valor: 0 };
      }
      r.clientes[solId].materiales[key].cantidad += cantidad;
      r.clientes[solId].materiales[key].valor += valor;
    });

    self.postMessage({
      success: true,
      sanitizedData,
      reports: {
        volumen: Object.entries(vol).map(([id, data]) => ({ id, ...data })),
        eficiencia: Object.entries(efi).map(([id, data]) => ({ id, ...data })),
        bebidas: Object.entries(beb).map(([id, data]) => ({ id, ...data })),
        duplicados: Object.entries(dup).map(([id, data]) => ({ id, ...data })),
        cobertura: Object.entries(cob).map(([id, data]) => ({ id, ...data }))
      },
      metrics: { totalRows: rawData.length }
    });
  } catch (error: any) {
    self.postMessage({ success: false, error: error?.message || 'Error desconocido en el procesamiento' });
  }
};
