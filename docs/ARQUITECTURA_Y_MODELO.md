# Arquitectura y Modelo de Datos del Sistema de Inventario

*Última actualización: 2024-02-06*

## 1. Introducción
Este documento formaliza el diseño conceptual del Sistema de Inventario, basado en los requerimientos y aclaraciones proporcionadas. El objetivo es establecer una base sólida y compartida antes de la implementación.

## 2. Arquitectura Conceptual
Se mantiene la arquitectura de tres capas:
- **Capa de Presentación:** Interfaces web y/o móvil para los distintos roles.
- **Capa de Lógica de Negocio:** Intermediario que centraliza todas las reglas y es el único componente con acceso a la 'Capa de Datos'.
- **Capa de Datos:** El sistema de persistencia de datos.

## 3. Definiciones de Cantidades Principales (Lógica del Negocio)
El sistema opera con base en varias cantidades, algunas físicas y otras calculadas en tiempo real. Esta es la lógica definitiva:

*   **`ALMACEN`**: Representa el conteo físico de productos dentro de las instalaciones del almacén. Es una cantidad que solo se modifica por movimientos físicos:
    *   **Aumenta** con la recepción de `CONSIGNACION`.
    *   **Aumenta** con la recepción de `RECHAZO` que vuelve de distribución.
    *   **Disminuye** cuando se cargan los camiones para `TRANSITO`.

*   **`CONSIGNACION`**: Representa los productos que han llegado en un tráiler pero aún no han sido descargados e ingresados al `ALMACEN`.

*   **`PREVENTA` (Órdenes de Pedido)**: Representa la suma de todos los productos en órdenes de pedido creadas por los preventistas que aún están pendientes. Esta cantidad se usa para el cálculo del `STOCK` y **no afecta al `ALMACEN` físico**.

*   **`TRANSITO` (Calculado por Reconciliación)**: Representa los productos que están fuera del almacén para distribución. Se calcula en un momento específico (ej. en la madrugada) mediante la fórmula:
    `TRANSITO = (Conteo de ALMACEN antes de cargar camiones) - (Conteo de ALMACEN después de cargar camiones)`

*   **`STOCK` (Calculado en Tiempo Real)**: Este es el valor que ven los preventistas para saber qué pueden vender. Es un valor **calculado**, no una copia. Su fórmula, que se recalcula constantemente, es:
    **`STOCK = ALMACEN + CONSIGNACION - PREVENTA`**

## 4. Jerarquía del Stock Físico
La estructura física del inventario es estrictamente jerárquica:
`PALET` > `CAMA` > `CAJA FISICA` > `PRODUCTO UNITARIO`

## 5. Modelo de Datos Refinado (Conceptual)
Las entidades principales para soportar esta lógica son:

#### Entidad: `Producto`
- `ID_Producto`, `SKU`, `Nombre`, `Descripción`

#### Entidad: `UnidadDeStock`
- Representa una unidad física.
- `ID_Unidad`, `ID_Producto`, `ID_Padre`
- `Tipo` (Enum: `PALET`, `CAMA`, `CAJA_FISICA`, `PRODUCTO_UNITARIO`)
- `EstadoFisico` (Enum: `EN_CONSIGNACION`, `EN_ALMACEN`, `EN_TRANSITO`, `EN_RECHAZO`)

#### Entidad: `OrdenDePedido`
- `ID_Orden`, `ID_Usuario`, `Fecha_Creacion`, `Estado_Orden`

#### Entidad: `DetalleOrden`
- `ID_Detalle`, `ID_Orden`, `ID_Producto`, `Cantidad`

## 6. Requisitos Funcionales (Versión Final)

*   **RF-1: Registro de Movimientos Físicos:** El sistema debe permitir registrar los movimientos físicos que afectan al `ALMACEN`: recepción de `CONSIGNACION`, recepción de `RECHAZO` y carga para `TRANSITO`.
*   **RF-2: Jerarquía de Stock:** El sistema debe permitir agrupar `productos unitarios` en `cajas fisicas`, `camas` y `palets`.
*   **RF-3: Gestión de Consignación:** El sistema debe poder registrar los productos que se encuentran en estado de `CONSIGNACION`.
*   **RF-4: Cálculo de STOCK para Preventa:** El sistema debe calcular y mostrar a los preventistas el `STOCK` disponible en tiempo real usando la fórmula: `STOCK = ALMACEN + CONSIGNACION - PREVENTA`.
*   **RF-5: Creación de Órdenes de Pedido (Preventa):** Los preventistas deben poder crear órdenes de pedido, que se usarán para el cálculo de `PREVENTA`.
*   **RF-6: Cálculo de Tránsito por Reconciliación:** El sistema debe proveer una interfaz o proceso para registrar los conteos del `ALMACEN` antes y después de la carga, para así calcular el `TRANSITO`.
*   **RF-7: Trazabilidad por Códigos:** El sistema debe poder asociar un código (QR/Barras) a las unidades de stock.
*   **RF-8: Exportación de Datos:** El sistema debe ofrecer una función para descargar datos para sistemas externos.
