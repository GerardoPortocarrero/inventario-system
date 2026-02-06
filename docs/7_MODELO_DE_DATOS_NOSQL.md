# 7. Modelo de Datos (NoSQL - Firestore)

Este documento describe la estructura de la base de datos NoSQL en Firestore, adaptada a partir del modelo conceptual para optimizar el rendimiento y la escalabilidad.

La estructura se basará en las siguientes colecciones principales:

### Colección: `productos`
*   **Propósito:** Mantiene el catálogo maestro de todos los productos que la empresa maneja.
*   **Estructura del Documento:** Cada documento representa un producto, usando el `ID_Producto` como identificador del documento.
    ```json
    {
      "sku": "CC3L-001",
      "nombre": "Coca-Cola 3 Litros",
      "descripcion": "Bebida gaseosa retornable.",
      "precio": 7.50,
      "creadoEn": "2024-02-06T10:00:00Z"
    }
    ```

### Colección: `unidadesDeStock`
*   **Propósito:** Representa cada unidad física contable en el inventario (un palet, una caja, etc.). Su conjunto y estado definen las cantidades de `ALMACEN`, `CONSIGNACION`, etc.
*   **Estructura del Documento:** Cada documento es una unidad física.
    ```json
    {
      "productoId": "ID_del_producto_en_la_coleccion_productos",
      "padreId": "ID_de_otra_unidadDeStock_si_esta_contenida", // ej. una caja dentro de un palet
      "tipo": "CAJA_FISICA", // PALET, CAMA, CAJA_FISICA, PRODUCTO_UNITARIO
      "estadoFisico": "EN_ALMACEN", // EN_CONSIGNACION, EN_ALMACEN, EN_TRANSITO, EN_RECHAZO
      "cantidad": 12, // Para PRODUCTO_UNITARIO, la cantidad de unidades
      "actualizadoEn": "2024-02-06T10:00:00Z"
    }
    ```
    *Nota: Las cantidades totales de `ALMACEN` y `CONSIGNACION` se calculan agregando los datos de esta colección.*

### Colección: `ordenes`
*   **Propósito:** Almacena todas las órdenes de pedido generadas por los preventistas. La suma de los productos en las órdenes `PENDIENTES` constituye la cantidad `PREVENTA`.
*   **Estructura del Documento:** Cada documento es una orden.
    ```json
    {
      "preventistaId": "ID_del_usuario_preventista",
      "cliente": "Nombre o ID del cliente",
      "fechaCreacion": "2024-02-06T11:30:00Z",
      "estadoOrden": "PENDIENTE", // PENDIENTE, DESPACHADA, COMPLETADA
      "total": 150.00,
      // Los detalles se anidan para lecturas rápidas
      "detalles": [
        {
          "productoId": "ID_del_producto",
          "nombreProducto": "Coca-Cola 3 Litros",
          "cantidad": 10,
          "tipoUnidad": "CAJA_FISICA"
        },
        {
          "productoId": "ID_de_otro_producto",
          "nombreProducto": "Inca-Kola 2.5 Litros",
          "cantidad": 5,
          "tipoUnidad": "CAJA_FISICA"
        }
      ]
    }
    ```

### Colección: `usuarios`
*   **Propósito:** Almacena la información de los usuarios y sus roles. Se vinculará con Firebase Authentication.
*   **Estructura del Documento:** El ID del documento será el UID de Firebase Auth.
    ```json
    {
      "nombre": "Juan Pérez",
      "email": "juan.perez@ejemplo.com",
      "rol": "Preventista", // Administrador, Supervisor, Preventista, Almacenero
      "activo": true
    }
    ```
