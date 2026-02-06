# 3. Requisitos Funcionales (RF)

Este documento lista las capacidades y funciones que el sistema debe realizar.

*   **RF-1: Registro de Movimientos Físicos:** El sistema debe permitir registrar los movimientos físicos que afectan al `ALMACEN`: recepción de `CONSIGNACION`, recepción de `RECHAZO` y carga para `TRANSITO`.
*   **RF-2: Jerarquía de Stock:** El sistema debe permitir agrupar `productos unitarios` en `cajas fisicas`, `camas` y `palets`.
*   **RF-3: Gestión de Consignación:** El sistema debe poder registrar los productos que se encuentran en estado de `CONSIGNACION`.
*   **RF-4: Cálculo de STOCK para Preventa:** El sistema debe calcular y mostrar a los preventistas el `STOCK` disponible en tiempo real usando la fórmula definida en la lógica de negocio.
*   **RF-5: Creación de Órdenes de Pedido (Preventa):** Los preventistas deben poder crear órdenes de pedido, que se usarán para el cálculo de `PREVENTA`.
*   **RF-6: Cálculo de Tránsito por Reconciliación:** El sistema debe proveer una interfaz o proceso para registrar los conteos del `ALMACEN` antes y después de la carga, para así calcular el `TRANSITO`.
*   **RF-7: Trazabilidad por Códigos:** El sistema debe poder asociar un código (QR/Barras) a las unidades de stock.
*   **RF-8: Exportación de Datos:** El sistema debe ofrecer una función para descargar datos para sistemas externos.
