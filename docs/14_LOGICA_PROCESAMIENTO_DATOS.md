# 14. Lógica de Procesamiento y Agregación (Analítica Pro)

Este documento detalla el algoritmo de transformación para la ingesta de datos históricos de demanda en Firestore.

## 1. El Concepto: "La Visita Diaria"
Para garantizar un rendimiento óptimo en análisis de rangos amplios (meses o años), la información no se guarda por "filas de material", sino por **"Visitas Consolidadas"**.

- **Clave de Agrupación:** `Solicitante` (Cliente) + `Fecha documento` (Día).
- **Resultado:** Un único documento por cliente/día que contiene el conjunto de materiales y totales de volumen.

## 2. Pipeline de Transformación
1. **Indexación del Maestro:** Se cargan los factores de conversión (CF/CU) y metadatos de clientes (Ruta, SubCanal).
2. **Agregación:**
   - Se agrupan los registros de SAP por Cliente y Fecha.
   - Se excluyen registros con `Status: C` (Rechazos).
3. **Cálculo de Volumen:**
   - Se multiplica la `Cantidad` de cada material por sus factores de conversión del Maestro.
   - Se generan totales: `totalCF` y `totalCU` por documento.
4. **Enriquecimiento:** Se añaden datos del Maestro (Ruta, Canal) para permitir filtros transversales.

## 3. Estructura en Firestore
- **Colección:** `demanda_historica`
- **ID Documento:** `${SOLICITANTE}_${YYYYMMDD}` (Garantiza deduplicación).

---
*Documento creado el 27 de mayo de 2026.*
