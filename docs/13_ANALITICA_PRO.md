# 13. Módulo de Analítica Pro (Inteligencia de Mercado)

Este documento describe la especificación técnica y funcional del nuevo módulo de **Analítica Pro**, una sección independiente diseñada para el análisis histórico y acumulativo de la demanda.

## 1. Objetivo General
Proporcionar una herramienta de auditoría y clasificación de activos que permita identificar patrones de compra, clientes de alto valor y rendimiento de productos mediante la acumulación diaria de datos.

## 2. Pilares Analíticos (KPIs)

El módulo se centra en siete análisis fundamentales:

### 2.1 Clasificación de Clientes (Volumen)
- **Métrica:** Ranking de clientes por total acumulado de Cajas Físicas (CF) y Cajas Unidad (CU).
- **Propósito:** Identificar a los clientes que generan el mayor volumen de ventas.

### 2.2 Análisis de Fidelidad (Frecuencia)
- **Métrica:** Conteo de pedidos únicos realizados por cada cliente en el tiempo.
- **Propósito:** Diferenciar clientes constantes de compradores esporádicos.

### 2.3 El Cuadrante de Oro (V-F)
- **Métrica:** Cruce de Volumen (CF/CU) vs. Frecuencia.
- **Propósito:** Localizar a los clientes más valiosos (compran mucho y seguido).

### 2.4 Ciclo Semanal (`SEG.DIAS`)
- **Métrica:** Agrupación de ventas (CF/CU) por día de la semana según el segmento programado.
- **Propósito:** Identificar los días de mayor carga operativa y comercial.

### 2.5 Segmentación de Mercado (`SubCanal`)
- **Métrica:** Distribución de volumen por canal de venta (Bodegas, Mayoristas, etc.).
- **Propósito:** Entender qué sectores del mercado impulsan el negocio.

### 2.6 Rendimiento de Catálogo (Top 20)
- **Métrica:** Productos con mayor rotación en CF y CU.
- **Propósito:** Asegurar disponibilidad y optimizar logística de los productos "ganadores".

### 2.7 Análisis de "Cola Larga" (Bottom 20)
- **Métrica:** Productos con menor movimiento acumulado.
- **Propósito:** Detectar productos estancados o con necesidad de promociones.

## 3. Estrategia de Datos y Persistencia

A diferencia de otros reportes, **Analítica Pro** es **acumulativo**:

- **Motor de Ingesta:** Ubicado dentro del propio módulo. Procesa archivos con estructura "demanda".
- **Deduplicación:** Utiliza el ID de Documento SAP para asegurar que un mismo pedido no se sume dos veces si se procesa el mismo archivo.
- **Persistencia:** Los datos se almacenan en Firestore:
    - `historial_pedidos`: Registro granular de cada transacción (IDs, fechas, volúmenes).
    - `perfiles_analiticos`: Documentos resumen por cliente/producto con contadores actualizados automáticamente.

## 4. Interfaz de Usuario (UI)

El módulo es 100% autónomo y accesible desde el menú principal:
- **Navegación:** Sistema de pestañas (Tabs) para separar los análisis (Clientes, Rutas, Productos).
- **Visualización:** Tablas interactivas de alto rendimiento y gráficos comparativos.
- **Gestión:** Área de carga de archivos dedicada exclusivamente a este módulo.

---
*Documento creado el 27 de mayo de 2026.*
