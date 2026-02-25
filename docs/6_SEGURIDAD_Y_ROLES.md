# 6. Seguridad y Roles

Este documento define los roles de usuario del sistema y los permisos asociados a cada uno, sentando las bases para el control de acceso.

Se definen los siguientes roles:

### Administrador
*   **Descripción:** Rol con control total sobre el sistema. Es responsable de la configuración inicial y el mantenimiento de los datos maestros.
*   **Permisos:**
    *   **CRUD completo (Crear, Leer, Actualizar, Borrar)** sobre el catálogo de **Productos**.
    *   **CRUD completo** sobre los **Usuarios** y su asignación de roles.
    *   Puede realizar todas las acciones de los demás roles.
    *   Tiene acceso a todas las vistas y reportes.

### Supervisor
*   **Descripción:** Rol de monitoreo y toma de decisiones. Supervisa la carga diaria y el rendimiento de ventas.
*   **Permisos:**
    *   **Visualizar el Dashboard**: Monitorear en tiempo real el `Tránsito`, el `Stock` disponible y el estado del conteo diario.
    *   **Leer** todas las `Órdenes de Pedido` de todos los `Preventistas`.
    *   Acceder a dashboards y vistas que muestren el rendimiento de ventas.
    *   **No puede** crear, modificar o eliminar ninguna entidad (productos, usuarios, órdenes, etc.).

### Preventista
*   **Descripción:** Rol operacional de ventas. Su enfoque es crear y dar seguimiento a sus propias órdenes.
*   **Permisos:**
    *   **Crear** nuevas `Órdenes de Pedido` para sus clientes.
    *   **Leer y Actualizar** únicamente sus propias `Órdenes de Pedido` (mientras el estado lo permita).
    *   **Leer** el catálogo de `Productos`.
    *   **Leer** el `STOCK` disponible (calculado tras el conteo del almacenero).
    *   **No puede** ver o modificar las órdenes de otros preventistas.

### Almacenero
*   **Descripción:** Rol de operaciones físicas en el almacén. Su responsabilidad principal es alimentar el sistema con los datos reales del inventario físico mediante el "Controlador".
*   **Permisos:**
    *   **Acceso al "Controlador"**: Registro diario de `Conteo Almacén`, `Consignación` y `Rechazo`.
    *   **Gestión de Inventario**: Modificar las cantidades físicas para habilitar el cálculo automático de Tránsito y Stock.
    *   **No puede** crear o ver órdenes de pedido de los preventistas.
