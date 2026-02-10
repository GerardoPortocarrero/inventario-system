# 9. Interfaces de Usuario

Este documento describe las interfaces principales del sistema, detallando las vistas y componentes clave para cada rol. Se incorpora también la guía de estilo para asegurar una coherencia visual.

---

### 1. Interfaz del `Preventista`

Esta es la interfaz principal de ventas, diseñada para ser rápida y eficiente.

*   **Pantalla Principal (Dashboard de Venta):**
    *   **Lista de Productos (`ProductList`):**
        *   Muestra una lista clara con todos los productos de la colección `stock`.
        *   Cada item muestra: `nombre`, `sku`, `precio` y la **cantidad disponible** (`cantidad`).
        *   **Buscador (`SearchBar`):** Una barra de búsqueda prominente en la parte superior para filtrar la lista de productos en tiempo real por nombre o SKU.
        *   **Funcionalidad:** Cada producto tendrá una opción para añadirlo al carrito (ej. un botón o un input de cantidad).
    *   **Carrito de Orden (`OrderCart`):**
        *   Un panel lateral o una sección fija en la pantalla que muestra los productos seleccionados para la orden.
        *   Cada producto en el carrito muestra: `nombre`, `cantidad a pedir` (editable), y el subtotal por producto.
        *   Muestra el total de la orden.
        *   **Botón "Realizar Pedido":** Al hacer clic, ejecuta la transacción de Firestore para crear la orden y descontar el stock.
    *   **Mis Órdenes Recientes (`RecentOrders`):**
        *   Una sección o pestaña secundaria que muestra un resumen de las últimas 5-10 `ordenes` del `Preventista`, incluyendo su estado. Lee de la colección `ordenes` filtrando por `preventistaId`.

---

### 2. Interfaz del `Almacenero`

Esta interfaz está diseñada para la gestión funcional y eficiente del inventario físico.

*   **Pantalla Principal (Gestión de Almacén):**
    *   **Lista de Inventario Físico (`PhysicalInventoryList`):**
        *   Una tabla que muestra los productos y sus cantidades en la colección `almacen`.
        *   Incluye funcionalidad de búsqueda/filtrado.
        *   Cada item de producto tiene botones de acción para "Ajustar Entrada" o "Registrar Salida".
    *   **Acciones de Inventario (Formularios Modales o Páginas Separadas):**
        *   **Formulario de Entrada de Mercancía (`GoodsReceiptForm`):**
            *   Para registrar `CONSIGNACION` o `RECHAZO`.
            *   Campos para: `producto` (selector), `cantidad` que entra.
            *   **Acción:** Ejecuta una transacción para **aumentar** la cantidad en `almacen` y `stock`.
        *   **Formulario de Salida por Tránsito (`DispatchForm`):**
            *   Para registrar la carga de camiones.
            *   Campos para: `producto` (selector), `cantidad` que sale.
            *   **Acción:** Ejecuta una escritura para **disminuir** la cantidad solo en `almacen`. El sistema derivará el valor de `TRANSITO` para reporte.

---

### 3. Interfaz del `Supervisor`

Esta interfaz es de solo lectura, enfocada en la monitorización y los reportes.

*   **Pantalla Principal (Dashboard de Supervisión):**
    *   **Métricas Clave (`KeyMetrics`):**
        *   Tarjetas con información agregada en tiempo real: Total de órdenes hoy, volumen de ventas, productos más vendidos.
    *   **Lista de Todas las Órdenes (`AllOrdersList`):**
        *   Una tabla o lista que muestra todas las `ordenes` en tiempo real, de todos los `Preventistas`.
        *   Incluye filtros por `Preventista`, rango de fechas y estado de la orden.
        *   Permite ver el detalle de cada orden.
    *   **Vista de Stock Actual (`CurrentStockView`):**
        *   Una vista de solo lectura de la colección `stock`, similar a la del `Preventista` pero sin acciones de venta.

---

### 4. Interfaz del `Administrador`

Esta interfaz proporciona control total sobre el sistema, incluyendo la gestión de usuarios y el catálogo de productos.

*   **Panel de Administración:**
    *   **Navegación:** Enlaces a las vistas de los otros roles (Supervisor, Preventista, Almacenero) para supervisión y operación.
    *   **Gestión de Usuarios (`UserManagement`):**
        *   Una tabla con todos los usuarios de la colección `usuarios`.
        *   Columnas: `nombre`, `email`, `rol`, `activo`.
        *   Acciones: Crear nuevo usuario (con asignación de rol), editar rol de usuario, activar/desactivar usuario.
    *   **Gestión de Catálogo de Productos (`ProductManagement`):**
        *   Una tabla con todos los productos de la colección `productos`.
        *   Columnas: `sku`, `nombre`, `descripcion`, `precio`.
        *   Acciones: Crear nuevo producto, editar información de producto existente.

---

### 5. Guía de Principios de Estilo y Diseño

*(Contenido extraído de `DISEÑO Y ESTILOS.txt`)*

Este documento detalla los principios de diseño, la paleta de colores, la tipografía y los patrones de componentes utilizados en la aplicación.

---

### 1. Filosofía General y Conceptos Clave

La identidad visual se basa en un enfoque **minimalista, plano y moderno**, con las siguientes características:

- **Estética Plana (Flat Design):** No se utilizan sombras (`box-shadow`) ni degradados. Todos los elementos de la interfaz son planos.
- **Bordes Afilados:** Absolutamente todos los componentes, incluyendo botones, tarjetas (cards), modales e inputs, tienen un `border-radius: 0`. Esto crea una apariencia nítida y geométrica.
- **Alto Contraste y Legibilidad:** Se utiliza un tema oscuro por defecto que favorece la legibilidad en entornos de poca luz (típico para guardias o personal de seguridad). Existe un tema claro opcional.
- **Enfoque en la Función:** El diseño es funcional y evita distracciones. Los elementos interactivos se destacan claramente mediante cambios de color al pasar el cursor (hover) o al estar activos.

---

### 2. Frameworks y Dependencias Clave

- **React:** La base de la aplicación.
- **React-Bootstrap & Bootstrap 5:** Se utiliza como librería de componentes base (botones, grid, modales, etc.). Sin embargo, sus estilos por defecto son fuertemente modificados. **Importante:** Al replicar, se debe incluir Bootstrap 5 y luego aplicar una capa de personalización CSS para anular los estilos predeterminados (especialmente `border-radius` y `box-shadow`).
- **React-Icons:** Para toda la iconografía de la aplicación (menús, acciones, etc.). Se usa principalmente el set de `Fa` (Font Awesome).

---

### 3. Paleta de Colores

La paleta se define mediante variables CSS para facilitar el mantenimiento y el sistema de temas (oscuro/claro).

#### Colores Base (Core)
- **Rojo Primario (Acento):** `#F40009` (usado para links, botones primarios, estados activos, y destaques importantes).
- **Rojo Oscuro (Hover):** `#c00007` (usado para el estado hover del rojo primario).
- **Azul Primario (Status):** `#007bff` (usado para indicar estados, como "en ruta").
- **Gris Claro:** `#adb5bd`
- **Gris Medio:** `#6c757d`
- **Blanco:** `#FFFFFF`
- **Negro:** `#000000`

#### Colores Semánticos por Tema

**Tema Oscuro (Por Defecto)**
- **Fondo Principal:** `#111111`
- **Fondo Secundario/Alternativo:** `#1a1a1a` (para hover en tablas, fondos de inputs).
- **Texto Primario:** `var(--color-white)`
- **Texto Secundario:** `#a0a0a0` (para labels, placeholders, texto menos importante).
- **Bordes:** `#333333`
- **Fondo de Tarjetas/Modales:** `#212529` o `var(--theme-background-default)`

**Tema Claro**
- **Fondo Principal:** `#f8f9fa`
- **Fondo Secundario/Alternativo:** `#e9ecef`
- **Texto Primario:** `#212529`
- **Texto Secundario:** `var(--color-gray-medium)`
- **Bordes:** `#dee2e6`
- **Fondo de Tarjetas/Modales:** `var(--color-white)`

---

### 4. Tipografía

- **Familia de Fuentes:** `system-ui` y `sans-serif` como fallback general. La pila completa es `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`. Es una fuente de sistema estándar, limpia y legible.
- **Peso de Fuente Base:** `400` (normal).
- **Altura de Línea Base:** `1.5`.
- **Títulos (h1, h2, etc.):** Usan el color de texto primario del tema.
- **Links:** Usan el color rojo primario (`--theme-primary`).

---

### 5. Layout y Estructura

- **Estructura Principal:** La aplicación utiliza un layout de `Sidebar` + `Área de Contenido`.
  - **Sidebar:** Es la navegación principal. En pantallas grandes (>768px) es fija y visible a la izquierda. En pantallas pequeñas, se oculta y se puede abrir con un botón de "hamburguesa".
  - **Área de Contenido:** Ocupa el resto del espacio. Contiene un `Header` superior y el contenido de la página.
- **Header:** Una barra delgada en la parte superior del área de contenido que contiene:
  - El logo de la empresa centrado.
  - Un botón para cambiar entre tema oscuro y claro (icono de sol/luna).
  - El botón para mostrar/ocultar el sidebar en móviles.
- **Espaciado:** Se utilizan los `gap` y `padding` de Bootstrap, pero de forma consistente. El espaciado es generalmente generoso para no sobrecargar la vista.

---

### 6. Componentes Principales (Estilo y Comportamiento)

**Botones (`<Button>`)**
- **Forma:** Cuadrados (sin `border-radius`).
- **Primario (`btn-primary`):** Fondo rojo (`--theme-primary`), texto blanco. En hover, el fondo se oscurece (`--theme-primary-dark`).
- **Secundario (`btn-secondary`):** Fondo gris claro/oscuro dependiendo del tema, texto del color principal del tema.
- **Outline (`btn-outline-primary`):** Borde rojo, fondo transparente, texto rojo. En hover, se invierten los colores (fondo rojo, texto blanco).
- **Sin Efectos 3D:** No tienen sombra ni al presionar ni en reposo.

**Formularios (`<Form.Control>`, `<Form.Select>`)**
- **Estilo:** Minimalista. No tienen bordes en los 4 lados.
- **Borde:** Solo tienen un `border-bottom` de 1px.
- **Interacción:** Al hacer `focus` sobre el input, el `border-bottom` cambia al color rojo primario, indicando claramente el campo activo.
- **Fondo:** El color de fondo es el `theme-input-bg`, que contrasta ligeramente con el fondo principal de la página.

**Tarjetas (`<Card>`) y Modales (`<Modal>`)**
- **Forma:** Cuadrados (sin `border-radius`).
- **Borde:** Un borde sutil (`--theme-border-default`) para definirlos.
- **Fondo:** Usan el color de fondo de modal/tarjeta del tema (`--theme-modal-bg`).

**Tablas (`<Table>`)**
- **Estilo:** Adaptado para el tema oscuro/claro de Bootstrap.
- **Hover:** Las filas cambian de color al pasar el cursor para indicar la selección.
- **Bordes:** Bordes sutiles entre filas.
- **Headers:** El texto de la cabecera es del color de texto secundario, para diferenciarlo del contenido.

---

### 7. Iconografía

- **Fuente:** `react-icons`.
- **Estilo:** Los iconos son de línea, sólidos y se usan para reforzar la acción de los botones y los ítems de navegación.
- **Color:** Por defecto, usan el color de texto secundario. Al pasar el cursor sobre su contenedor (un botón, un link), cambian al color primario del tema para dar feedback visual.
- **Uso Común:**
  - `FaBars`: Menú de hamburguesa.
  - `FaSun` / `FaMoon`: Toggle de tema.
  - Iconos específicos para cada sección en el `Sidebar` (ej. `FaHome`, `FaUsers`, etc.).
  - Iconos de acción en tablas (`FaEdit`, `FaTrash`).

---
**Resumen para Replicar:**

1.  Usa Bootstrap 5 como base.
2.  Crea un archivo CSS global (`custom.css` o similar).
3.  En ese archivo, define las variables CSS de la paleta de colores para un tema oscuro y uno claro.
4.  Añade el override global: `* { border-radius: 0 !important; box-shadow: none !important; }`.
5.  Personaliza los estilos de los componentes (botones, formularios, etc.) usando las variables CSS definidas.
6.  Implementa el layout de Sidebar + Content Area.
7.  Usa `react-icons` para la iconografía.
