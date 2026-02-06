# 5. Pila de Tecnología

Este documento especifica el conjunto de tecnologías elegidas para la implementación del sistema. La selección se basa en los requisitos funcionales y no funcionales.

*   **Plataforma General:** **Suite de Google Firebase**
    *   Se utilizará el ecosistema de Firebase como la plataforma principal para el backend y la infraestructura, aprovechando su naturaleza gestionada y escalable.

*   **Base de Datos:** **Firestore**
    *   La base de datos principal será Firestore, una base de datos de documentos **NoSQL**. Se elige por su rendimiento en tiempo real, escalabilidad y su integración nativa con el resto de la suite.

*   **Lógica de Backend:** **Firebase Cloud Functions**
    *   Toda la lógica de negocio, como el cálculo del `STOCK` o la generación de reportes, se implementará como funciones serverless. Esto permite un modelo de pago por uso y escalado automático.

*   **Autenticación:** **Firebase Authentication**
    *   Gestionará el registro, inicio de sesión y la seguridad de los usuarios y sus roles.

*   **Capa de Presentación (Frontend):** **React**
    *   Se utilizará la librería React para construir una interfaz de usuario moderna y reactiva.

*   **Empaquetador y Entorno de Desarrollo:** **Vite**
    *   Vite se usará por su alta velocidad en el desarrollo y por su eficiente proceso de empaquetado para producción.

*   **Framework de UI:** **Bootstrap**
    *   Se usará Bootstrap para el diseño y los componentes de la interfaz, asegurando una apariencia limpia, profesional y un desarrollo rápido de vistas responsive.
