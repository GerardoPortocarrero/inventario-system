# 4. Requisitos No Funcionales (RNF)

Este documento describe las características y restricciones del sistema, definiendo "cómo debe ser" en términos de rendimiento, calidad y operación.

*   **Rendimiento:**
    *   Las consultas de `STOCK` y la creación de órdenes de pedido deben ser en **tiempo real**.
    *   Se asume que la latencia principal será la de la conexión a internet del cliente, por lo que el backend debe procesar las solicitudes de la forma más rápida posible.

*   **Escalabilidad:**
    *   El sistema debe estar diseñado para soportar la carga de trabajo inicial y permitir un crecimiento futuro.
    *   **Carga inicial estimada:**
        *   ~40 usuarios `Preventistas` concurrentes.
        *   100+ productos distintos en el catálogo.
        *   ~2000 órdenes de pedido diarias.

*   **Disponibilidad:**
    *   El sistema debe estar operativo **24/7**. Se planificarán mantenimientos, si son necesarios, en horarios de bajo impacto.

*   **Conectividad:**
    *   El sistema requiere una conexión a internet activa para todas sus funciones.
    *   **No se requiere un modo offline**.

*   **Usabilidad:**
    *   La interfaz del frontend debe ser ligera, rápida y fácil de usar, especialmente para los roles operativos como `Preventista` y `Almacenero`.
