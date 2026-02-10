# Arquitectura y Diseño del Sistema de Inventario (Versión 2.0)

*Última actualización: martes, 10 de febrero de 2026*

## 1. Introducción
Este documento formaliza el diseño conceptual y arquitectónico del Sistema de Inventario, reflejando la lógica de negocio y la pila tecnológica definitivas.

## 2. Lógica de Negocio y Cantidades Clave
El sistema opera con un modelo denormalizado para optimizar el rendimiento de las operaciones de venta.

*   **`ALMACEN` (Colección):** Representa el inventario físico real. Solo se modifica por movimientos físicos gestionados por el `Almacenero`.
*   **`STOCK` (Colección):** Representa el inventario virtual para la venta. Es la fuente de verdad para los `Preventistas`.
*   **Ciclo de Vida:**
    1.  **Entrada de Mercancía (Consignación/Rechazo):** Un `Almacenero` procesa la entrada, y la cantidad se suma tanto a `ALMACEN` como a `STOCK`.
    2.  **Venta:** Un `Preventista` crea una `orden`, y la cantidad se descuenta de `STOCK`.
    3.  **Salida a Distribución (Tránsito):** El `Almacenero` actualiza `ALMACEN` tras la carga. `TRANSITO` se deriva de la diferencia en `ALMACEN` antes y después de esta acción.

## 3. Requisitos Funcionales (RF)
*   **RF-1: Movimientos Físicos:** Registrar movimientos que afectan la colección `almacen`.
*   **RF-4: Visualización de STOCK:** Mostrar a los preventistas el `STOCK` leyendo directamente de la colección `stock`.
*   **RF-5: Órdenes de Pedido:** La creación de una orden descuenta de forma transaccional las cantidades de la colección `stock`.
*   **RF-6: Registro de Tránsito:** Provee interfaz para que el `Almacenero` actualice `ALMACEN` y el sistema derive `TRANSITO`.

## 4. Requisitos No Funcionales (RNF)
*   **Rendimiento:** Las consultas de `STOCK` y la creación de órdenes de pedido deben ser en **tiempo real**. Con el modelo denormalizado, esto se logra con lecturas directas a la colección `stock`.
*   **Escalabilidad:** El sistema debe estar diseñado para soportar la carga de trabajo inicial y permitir un crecimiento futuro.
    *   **Carga inicial estimada:**
        *   ~40 usuarios `Preventistas` concurrentes.
        *   100+ productos distintos en el catálogo.
        *   ~2000 órdenes de pedido diarias.
*   **Disponibilidad:** El sistema debe estar operativo **24/7**. Se planificarán mantenimientos, si son necesarios, en horarios de bajo impacto.
*   **Conectividad:** El sistema requiere una conexión a internet activa para todas sus funciones. **No se requiere un modo offline**.
*   **Usabilidad:** La interfaz del frontend debe ser ligera, rápida y fácil de usar.

## 5. Pila de Tecnología
*   **Plataforma General:** **Suite de Firebase**.
*   **Base de Datos y Backend de Datos:** **Firestore (NoSQL)**.
*   **Seguridad:** **Reglas de Seguridad de Firestore** y **Firebase Authentication**.
*   **Lógica de Negocio y Frontend:** **React** con **Vite**.
    *(Nota: No se utilizan Cloud Functions. La lógica de negocio reside en el cliente y en las Reglas de Seguridad de Firestore).*

## 6. Seguridad y Roles
*   **`Preventista`**: Puede crear `ordenes` y actualizar (descontar) `stock`. No puede ver `ordenes` de otros.
*   **`Almacenero`**: Puede modificar `almacen` y `stock` para reflejar movimientos físicos.

## 7. Modelo de Datos (NoSQL - Firestore)
*   **`productos`:** Catálogo maestro.
*   **`stock`:** Inventario virtual para la venta.
*   **`almacen`:** Inventario físico.
*   **`ordenes`:** Registros de ventas.
*   **`usuarios`:** Roles y datos de usuario.
