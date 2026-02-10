# 11. Plan de Implementación Detallado

Este documento describe el plan incremental para la implementación del sistema, enfocándose en la construcción del frontend de React. Sigue los principios arquitectónicos de `10_ARQUITECTURA_REACT.md` y las descripciones de interfaz de `9_INTERFACES_DE_USUARIO.md`, y se alinea con la documentación general del proyecto.

---

### Fase 1: Configuración del Proyecto y Base de Firebase

1.  **Andamiaje del Proyecto Frontend (`frontend`):**
    *   **Acción:** Crear el directorio principal del proyecto y scaffoldear una aplicación de React usando Vite.
    *   **Comandos:** `npm create vite@latest frontend -- --template react` (el usuario ejecutará el comando y elegirá las opciones).
    *   **Alineación Documental:** `10_ARQUITECTURA_REACT.md` (Estructura de Carpetas), `8_PAUTAS_DE_IMPLEMENTACION.md` (Entorno de Desarrollo).

2.  **Estructura Inicial de Carpetas y Configuración de Calidad de Código:**
    *   **Acción:** Organizar el directorio `src` de la aplicación `frontend` según la estructura recomendada (`api`, `components`, `pages`, `context`, etc.). Configurar ESLint y Prettier.
    *   **Comandos:** Creación manual de directorios. Instalación de dependencias de ESLint/Prettier y configuración (comandos `npm install` específicos).
    *   **Alineación Documental:** `10_ARQUITECTURA_REACT.md` (Estructura de Carpetas), `8_PAUTAS_DE_IMPLEMENTACION.md` (Estándares de Código).

3.  **Configuración e Inicialización de Firebase (en el cliente):**
    *   **Acción:** Instalar el SDK de Firebase para JavaScript y crear el módulo de configuración de Firebase.
    *   **Comandos:** `npm install firebase` (en la carpeta `frontend`). Guía para crear `frontend/src/api/firebase.js` con el código de inicialización.
    *   **Alineación Documental:** `5_PILA_DE_TECNOLOGIA.md` (Firebase como plataforma), `10_ARQUITECTURA_REACT.md` (Separación de Responsabilidades).

---

### Fase 2: Autenticación y Layout Básico

4.  **Global Authentication Context & Basic UI Layout:**
    *   **Acción:** Implementar `AuthContext` para gestionar el estado global del usuario autenticado y crear los componentes de layout principales (`Header`, `Sidebar`).
    *   **Comandos:** Guía para crear `frontend/src/context/AuthContext.jsx` y los componentes de layout en `frontend/src/components/layout/`.
    *   **Alineación Documental:** `10_ARQUITECTURA_REACT.md` (Estado Global, Composición de Componentes), `9_INTERFACES_DE_USUARIO.md` (Layout y Estructura).

5.  **Autenticación UI & Lógica (`LoginPage`):**
    *   **Acción:** Desarrollar el componente `LoginPage` y su lógica de interacción con Firebase Authentication.
    *   **Comandos:** Guía para crear `frontend/src/pages/LoginPage.jsx` y el código para el formulario y la función de inicio de sesión.
    *   **Alineación Documental:** `9_INTERFACES_DE_USUARIO.md` (Interfaces), `10_ARQUITECTURA_REACT.md` (Flujo de Datos Unidireccional).

---

### Fase 3: Funcionalidad Central del `Preventista`

6.  **Panel del `Preventista` - Listado de Productos (colección `stock`):**
    *   **Acción:** Crear el `PreventistaDashboard`, encargándose de obtener y mostrar productos de la colección `stock`.
    *   **Comandos:** Guía para crear `frontend/src/pages/PreventistaDashboard.jsx` y componentes auxiliares como `ProductCard.jsx`. Código para la lógica de lectura de Firestore (`useEffect`).
    *   **Alineación Documental:** `9_INTERFACES_DE_USUARIO.md` (Interfaz del Preventista), `2_LOGICA_DE_NEGOCIO.md`, `7_MODELO_DE_DATOS_NOSQL.md` (Stock como colección), `10_ARQUITECTURA_REACT.md` (Manejo de Efectos Secundarios).

7.  **Creación de Órdenes del `Preventista` - Carrito y Transacción de Firestore:**
    *   **Acción:** Implementar la funcionalidad completa del carrito de compras y la lógica de la **transacción atómica de Firestore** para crear la `orden` y descontar el `stock`.
    *   **Comandos:** Guía para crear componentes de carrito y el módulo `frontend/src/api/orders.js` con la función de transacción.
    *   **Alineación Documental:** `9_INTERFACES_DE_USUARIO.md` (Interfaz del Preventista - Carrito), `2_LOGICA_DE_NEGOCIO.md`, `7_MODELO_DE_DATOS_NOSQL.md` (Actualización de `stock` y `ordenes`), `10_ARQUITECTURA_REACT.md` (Separación de Responsabilidades, Transacciones).

---
Este plan cubre la implementación de la funcionalidad principal del `Preventista`. Una vez completado, se podrá proceder con las interfaces para los roles de `Almacenero`, `Supervisor` y `Administrador` de manera similar.
