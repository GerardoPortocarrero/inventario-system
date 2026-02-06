# 2. Lógica de Negocio y Cantidades Clave

Este documento define la lógica central del sistema y las fórmulas utilizadas para calcular sus cantidades principales.

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
