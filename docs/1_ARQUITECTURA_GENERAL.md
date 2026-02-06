# 1. Arquitectura General

Este documento describe la arquitectura conceptual de alto nivel del sistema de inventario.

## Arquitectura de Tres Capas

El sistema seguirá un patrón de arquitectura de tres capas, un estándar probado para aplicaciones robustas y escalables:

*   **Capa de Presentación:**
    *   **Definición:** Es la interfaz con la que interactúan los usuarios.
    *   **Implementación:** Se construirá como una aplicación de una sola página (SPA) utilizando **React**, **Vite** y **Bootstrap**. Se desplegará en **Firebase Hosting**.

*   **Capa de Lógica de Negocio (Backend):**
    *   **Definición:** Es el cerebro del sistema que centraliza todas las reglas de negocio y la seguridad. Actúa como el único intermediario entre la presentación y los datos.
    *   **Implementación:** Se implementará utilizando **Firebase Cloud Functions**, un entorno sin servidor (serverless) que permite ejecutar código en respuesta a eventos.

*   **Capa de Datos (Base de Datos):**
    *   **Definición:** El sistema de almacenamiento persistente para todos los datos de la aplicación.
    *   **Implementación:** Se utilizará **Firestore**, la base de datos NoSQL de Firebase, que proporciona flexibilidad y rendimiento en tiempo real.
