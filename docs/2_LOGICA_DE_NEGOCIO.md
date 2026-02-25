# 2. Lógica de Negocio y Cantidades Clave

Este documento define la lógica central del sistema y las fórmulas utilizadas para calcular sus cantidades principales basándose en la operación diaria del almacén.

## Medidas Base (Ingresadas en el "Controlador")

Estas tres medidas son registradas diariamente por el Almacenero:

*   **`CONTEO ALMACÉN`**: Representa el conteo físico real de productos dentro de las instalaciones en el momento actual. Es la base de toda la información del sistema.
*   **`CONSIGNACIÓN`**: Representa los productos que han llegado a la sede pero aún no han sido descargados o ingresados formalmente al almacén físico.
*   **`RECHAZO`**: Productos que regresaron de la distribución (no entregados) y deben reintegrarse al inventario.

---

## Cantidades Calculadas

El sistema genera automáticamente las siguientes métricas basadas en los datos del día actual y el anterior. **Importante:** Si el Almacenero no ha registrado el `CONTEO ALMACÉN` del día, estos cálculos permanecerán en estado "Pendiente" o "En cálculo".

### 1. TRANSITO (Productos en Distribución)
Representa la cantidad física de productos que han salido del almacén para ser repartidos. Se calcula de forma atómica por producto.

*   **Fórmula:**
    `TRANSITO = Total Almacén Ayer - Conteo Almacén Hoy`
*   **Donde `Total Almacén Ayer` es:**
    `(Conteo Almacén + Consignación + Rechazo)` registrados en la jornada anterior.
*   **Interpretación:** La diferencia física entre lo que había al cierre de ayer y lo que se cuenta hoy es lo que está "en la calle".

### 2. STOCK (Disponible para Venta)
Es el valor que ven los preventistas en tiempo real para saber qué pueden vender.

*   **Fórmula:**
    `STOCK = (Conteo Almacén Hoy + Consignación Hoy + Rechazo Hoy) - Preventa Hoy`
*   **Donde `Preventa Hoy` es:**
    La suma de todos los productos en órdenes de pedido creadas hoy que aún están pendientes.
*   **Interpretación:** Es la suma de toda la propiedad física de la sede (lo que hay, lo que llegó y lo que volvió) menos lo que ya se comprometió a vender.

---

## Dependencia Operativa
El sistema sigue un flujo estrictamente físico:
1.  **Sin conteo no hay datos:** No se calcula Stock ni Tránsito si no hay un registro de `CONTEO ALMACÉN` para la fecha actual.
2.  **Actualización Dinámica:** A medida que el Almacenero actualiza las medidas en el "Controlador", el Tránsito y el Stock se recalculan automáticamente en el Dashboard y la vista de Preventistas.
