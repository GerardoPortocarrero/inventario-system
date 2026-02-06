# Arquitectura y Diseño del Sistema de Inventario (Versión 1.0)

*Última actualización: 2024-02-06*

## 1. Introducción
Este documento formaliza el diseño conceptual y arquitectónico del Sistema de Inventario. El objetivo es establecer una base sólida y compartida para la implementación, reflejando todos los requisitos y decisiones tomadas.

## 2. Lógica de Negocio y Cantidades Clave
El sistema opera con base en cantidades físicas y calculadas. La lógica definitiva es:

*   **`ALMACEN`**: Conteo físico de productos en el almacén. Se modifica solo por movimientos físicos (recepción de `CONSIGNACION` y `RECHAZO`, y salida para `TRANSITO`).
*   **`CONSIGNACION`**: Productos en tráileres que han llegado pero no han sido descargados al `ALMACEN`.
*   **`PREVENTA`**: Suma de todos los productos en órdenes de pedido pendientes.
*   **`TRANSITO` (Calculado)**: Productos en distribución, calculados por la diferencia de conteos del `ALMACEN` antes y después de cargar los camiones.
*   **`STOCK` (Calculado)**: El valor para preventistas. Se calcula en tiempo real con la fórmula:
    **`STOCK = ALMACEN + CONSIGNACION - PREVENTA`**

## 3. Requisitos Funcionales (RF)
*   **RF-1: Movimientos Físicos:** Registrar movimientos que afectan `ALMACEN` (`CONSIGNACION`, `RECHAZO`, `TRANSITO`).
*   **RF-2: Jerarquía de Stock:** Agrupar `productos unitarios`, `cajas`, `camas` y `palets`.
*   **RF-3: Gestión de Consignación:** Registrar productos en estado de `CONSIGNACION`.
*   **RF-4: Cálculo de STOCK:** Calcular y mostrar el `STOCK` a preventistas con la fórmula oficial.
*   **RF-5: Órdenes de Pedido:** Permitir a los preventistas crear órdenes de pedido.
*   **RF-6: Cálculo de Tránsito:** Permitir el cálculo de `TRANSITO` por reconciliación de conteos.
*   **RF-7: Trazabilidad por Códigos:** Asociar códigos (QR/Barras) a unidades de stock.
*   **RF-8: Exportación de Datos:** Generar archivos para sistemas externos.

## 4. Requisitos No Funcionales (RNF)
*   **Rendimiento:** Las consultas deben ser en tiempo real, asumiendo que la latencia principal es la conexión a internet del cliente.
*   **Escalabilidad:** El sistema debe soportar inicialmente:
    *   ~40 `Preventistas` activos.
    *   100+ productos distintos.
    *   ~2000 órdenes de pedido diarias (50 por preventista).
*   **Disponibilidad:** El sistema debe operar 24/7.
*   **Conectividad:** No se requiere modo offline. El sistema depende de una conexión a internet activa.

## 5. Pila de Tecnología
*   **Plataforma General:** **Suite de Firebase**.
*   **Base de Datos:** **Firestore (NoSQL)**.
*   **Lógica de Backend:** **Firebase Cloud Functions**.
*   **Autenticación:** **Firebase Authentication**.
*   **Capa de Presentación (Frontend):** **React** con **Vite** como empaquetador.
*   **UI Framework:** **Bootstrap**.

## 6. Seguridad y Roles
Se definen los siguientes roles de usuario:
*   **`Administrador`**: Control total del sistema. CRUD (Crear, Leer, Actualizar, Borrar) sobre configuraciones, usuarios y catálogo de productos.
*   **`Supervisor`**: Rol de solo lectura para monitorear el rendimiento. Puede ver el avance (órdenes de pedido, etc.) de todos los `Preventistas`. No puede modificar nada.
*   **`Preventista`**: Rol operacional. Su función principal es crear y gestionar sus propias órdenes de pedido. Solo puede ver su propia información.
*   **`Almacenero`**: Rol de operaciones físicas. Es el único, junto al Administrador, que puede modificar las cantidades del `ALMACEN` físico (ej. recibir `CONSIGNACION`, `RECHAZO`, y ejecutar la reconciliación de `TRANSITO`).

## 7. Modelo de Datos (NoSQL - Firestore)
El modelo relacional se adapta a una estructura NoSQL optimizada para Firestore:

*   **Colección: `productos`**
    *   Documento por cada producto (`ID_Producto`).
    *   Campos: `sku`, `nombre`, `descripcion`, etc.

*   **Colección: `unidadesDeStock`**
    *   Documento por cada unidad física (`ID_Unidad`).
    *   Campos: `productoId`, `padreId` (para jerarquía), `tipo`, `estadoFisico` (`EN_ALMACEN`, etc.), `cantidadActual`.
    *   Esta colección representará el `ALMACEN`, `CONSIGNACION`, etc.

*   **Colección: `ordenes`**
    *   Documento por cada orden de pedido (`ID_Orden`).
    *   Campos: `preventistaId`, `fechaCreacion`, `estadoOrden`.
    *   **Subcolección `detalles`**: Dentro de cada orden, una subcolección con los productos y cantidades de esa orden. Este anidamiento es una práctica común y eficiente en NoSQL.

*   **Colección: `usuarios`**
    *   Documento por cada usuario (`ID_Usuario`).
    *   Campos: `nombre`, `email`, y muy importante, `rol` (`Administrador`, `Supervisor`, etc.).