# 7. Modelo de Datos (NoSQL - Firestore)

Este documento describe la estructura de la base de datos NoSQL en Firestore, optimizada para la consulta de inventario en tiempo real y segmentación por sedes.

La estructura se basa en las siguientes colecciones principales:

### Colección: `sedes`
*   **Propósito:** Define las diferentes ubicaciones o sucursales de la empresa.
*   ```json
    {
      "nombre": "Sede Central",
      "locacion": "Dirección...",
      "codigo": "SC-01"
    }
    ```

### Colección: `productos`
*   **Propósito:** Mantiene el catálogo global de productos.
*   ```json
    {
      "nombre": "Coca-Cola 3 Litros",
      "sap": "102030",
      "tipoBebidaId": "ID_tipo",
      "basis": "Base-01",
      "comercial": "Com-01",
      "contaaya": "Cont-01",
      "mililitros": 3000,
      "unidades": 6,
      "precio": 7.50,
      "creadoEn": "Timestamp"
    }
    ```

### Colección: `inventario_diario`
*   **Propósito:** Almacena el estado consolidado del inventario físico por sede y fecha. Es el documento central para el cálculo de Stock y Tránsito.
*   **ID del Documento:** `{ID_Sede}_{YYYY-MM-DD}`
*   ```json
    {
      "sedeId": "ID_de_la_sede",
      "fecha": "2024-02-06",
      "productos": {
        "ID_Producto_A": {
          "almacen": 100,      // Conteo físico real (unidades)
          "consignacion": 20    // Llegando a sede (unidades)
        }
      },
      "actualizadoPor": "Nombre del Usuario",
      "timestamp": "ServerTimestamp"
    }
    ```

### Colección: `usuarios`
*   **Propósito:** Almacena la información de los usuarios, su rol y sede asignada.
*   ```json
    {
      "sedeId": "ID_de_la_sede",
      "nombre": "Juan Pérez",
      "email": "juan.perez@ejemplo.com",
      "rolId": "preventista", // admin, supervisor, almacenero, preventista
      "activo": true
    }
    ```

### Colección: `roles`
*   **Propósito:** Define los niveles de acceso.
    *   `admin`: Gestión total.
    *   `supervisor`: Lectura total y reportes.
    *   `almacenero`: Edición de inventario físico en su sede.
    *   `preventista`: Solo lectura de stock en su sede.

### Colección: `tiposBebida`
*   **Propósito:** Categorización de productos (Gaseosas, Aguas, etc.).
