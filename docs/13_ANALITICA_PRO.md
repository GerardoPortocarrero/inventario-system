# 13. Módulo de Analítica Pro (Inteligencia de Mercado)

Este documento describe la especificación técnica y funcional del nuevo módulo de **Analítica Pro**, una sección independiente diseñada para el análisis histórico y acumulativo de la demanda.

## 1. Objetivo General
Proporcionar una herramienta de auditoría y clasificación de activos que permita identificar patrones de compra, clientes de alto valor y rendimiento de productos mediante la acumulación diaria de datos.

## 2. Pilares Analíticos (KPIs)

El módulo se centra en siete análisis fundamentales:

### 2.1 Clasificación de Clientes (Volumen y RFM)
- **Métrica:** Ranking de clientes por total acumulado (CF/CU).
- **Segmentación RFM (Recencia, Frecuencia, Valor):** Clasificación automática en Campeones, En Riesgo, Nuevas Promesas e Hibernando.
- **Propósito:** Identificar quiénes son los activos más valiosos y a quiénes se corre el riesgo de perder.

### 2.2 Análisis de Fidelidad y Frecuencia
- **Métrica:** Conteo de pedidos únicos y cálculo de días promedio entre compras.
- **Propósito:** Establecer el ciclo de compra estándar por cliente para detectar anomalías.

### 2.3 Análisis de Afinidad (Market Basket)
- **Métrica:** Identificación de productos que se compran juntos con mayor frecuencia.
- **Propósito:** Crear sugerencias de venta cruzada y optimizar combos comerciales.

### 2.4 Ciclo Semanal y Estacionalidad
- **Métrica:** Agrupación de ventas por día (`SEG.DIAS`) y análisis de tendencias históricas.
- **Propósito:** Predecir picos de demanda basados en el comportamiento histórico y factores externos.

### 2.5 Análisis de "Huecos" de Portafolio (Gap Analysis)
- **Métrica:** Detección de productos exitosos en una ruta que no se venden en otras con perfil similar.
- **Propósito:** Expandir el portafolio en clientes existentes.

### 2.6 Segmentación de Mercado (`SubCanal`)
- **Métrica:** Distribución de volumen por canal de venta.
- **Propósito:** Entender qué sectores del mercado impulsan el negocio.

### 2.7 Rendimiento de Catálogo (Top & Bottom)
- **Métrica:** Identificación de productos estrella y productos sin rotación.
- **Propósito:** Optimizar el catálogo y el espacio logístico.

### 2.8 Contraste Estratégico y Crecimiento
- **Métrica:** Comparativa A vs B (Mes actual vs Mes anterior, Año vs Año).
- **Indicadores:** Delta de Crecimiento (%) y Tendencias de largo plazo.

## 3. Estrategia de Datos y Persistencia

**Analítica Pro** es un sistema acumulativo e inteligente:
- **Exclusión de Rechazos:** El sistema solo procesa pedidos finalizados y efectivos.
- **Deduplicación SAP:** Validación por ID de Documento para asegurar integridad histórica.
- **Firestore Engine:** Persistencia en `historial_pedidos` y `perfiles_analiticos`.

## 4. Interfaz de Usuario (UI)

El módulo es 100% autónomo y accesible desde el menú principal:
- **Navegación:** Sistema de pestañas (Tabs) para separar los análisis (Clientes, Rutas, Productos).
- **Visualización:** Tablas interactivas de alto rendimiento y gráficos comparativos.
- **Gestión:** Área de carga de archivos dedicada exclusivamente a este módulo.

---
*Documento creado el 27 de mayo de 2026.*
