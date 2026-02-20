# 7. Modelo de Datos (NoSQL - Firestore)

Este documento describe la estructura de la base de datos NoSQL en Firestore, adaptada a partir del modelo conceptual para optimizar el rendimiento y la escalabilidad, y ahora incluyendo el concepto de `sedes`.

La estructura se basará en las siguientes colecciones principales:

### Colección: `sedes`
*   **Propósito:** Define las diferentes ubicaciones o sucursales de la empresa.
*   **Estructura del Documento:** Cada documento representa una sede, usando el `ID_Sede` como identificador del documento.
    ```json
    {
      "nombre": "Sede Central",
    }
    ```

### Colección: `productos`
*   **Propósito:** Mantiene el catálogo global de productos disponibles en la empresa.
*   **Estructura del Documento:** Cada documento representa un producto, usando el `ID_Producto` como identificador del documento.
    ```json
    {
      "nombre": "Coca-Cola 3 Litros",
      "sap": "102030",
      "basis": "Base-01",
      "comercial": "Com-01",
      "contaaya": "Cont-01",
      "mililitros": 3000,
      "unidades": 6,
      "precio": 7.50,
      "creadoEn": "2024-02-06T10:00:00Z"
    }
    ```

### Colección: `unidadesDeStock`
*   **Propósito:** Representa cada unidad física contable en el inventario (un palet, una caja, etc.) de una sede específica. Su conjunto y estado definen las cantidades de `ALMACEN`, `CONSIGNACION`, etc.
*   **Estructura del Documento:** Cada documento es una unidad física.
    ```json
    {
      "sedeId": "ID_de_la_sede_a_la_que_pertenece_la_unidad",
      "productoId": "ID_del_producto_en_la_coleccion_productos", // Este producto ya incluye sedeId
      "padreId": "ID_de_otra_unidadDeStock_si_esta_contenida", // ej. una caja dentro de un palet
      "tipo": "CAJA_FISICA", // PALET, CAMA, CAJA_FISICA, PRODUCTO_UNITARIO
      "estadoFisico": "EN_ALMACEN", // EN_CONSIGNACION, EN_ALMACEN, EN_TRANSITO, EN_RECHAZO
      "cantidad": 12, // Para PRODUCTO_UNITARIO, la cantidad de unidades
      "actualizadoEn": "2024-02-06T10:00:00Z"
    }
    ```
    *Nota: Las cantidades totales de `ALMACEN` y `CONSIGNACION` se calculan agregando los datos de esta colección, filtradas por `sedeId`.*

### Colección: `ordenes`
*   **Propósito:** Almacena todas las órdenes de pedido generadas por los preventistas, vinculadas a una sede específica.
*   **Estructura del Documento:** Cada documento es una orden.
    ```json
    {
      "sedeId": "ID_de_la_sede_del_preventista_que_creo_la_orden",
      "preventistaId": "ID_del_usuario_preventista",
      "cliente": "Nombre o ID del cliente",
      "fechaCreacion": "2024-02-06T11:30:00Z",
      "estadoOrden": "PENDIENTE", // PENDIENTE, DESPACHADA, COMPLETADA
      "total": 150.00,
      // Los detalles se anidan para lecturas rápidas
      "detalles": [
        {
          "productoId": "ID_del_producto", // Este ID de producto ya contiene el sedeId
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
*   **Propósito:** Almacena la información de los usuarios y su rol, vinculados a una sede específica.
*   **Estructura del Documento:** El ID del documento será el UID de Firebase Auth.
    ```json
    {
      "sedeId": "ID_de_la_sede_a_la_que_pertenece_el_usuario",
      "nombre": "Juan Pérez",
      "email": "juan.perez@ejemplo.com",
      "rolId": "preventista", // Referencia al ID del documento en la colección 'roles'
      "activo": true
    }
    ```

### Colección: `roles`
*   **Propósito:** Define los roles disponibles en el sistema y sus propiedades. Permite una gestión centralizada de los permisos.
*   **Estructura del Documento:** El ID del documento es el identificador único del rol (ej. "admin", "preventista").
    ```json
    {
      "nombre": "Preventista",
    }
    ```
