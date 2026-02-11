## Pautas de Implementación

Para garantizar la calidad, mantenibilidad y escalabilidad del código, se establecen los siguientes aspectos como obligatorios.

- ### Cero Cadenas de Texto Quemadas (Hardcoded Strings)
  - Todo texto visible al usuario, identificadores o cadenas de texto repetitivas no deben estar escritas directamente en el código de los componentes o la lógica.
  - Dicha información deberá centralizarse y exportarse desde un archivo de constantes (ej: `src/constants.ts`).

- ### Diseño Atómico de Componentes
  - La construcción de la interfaz se basará en la metodología de Diseño Atómico. Se priorizará la creación de componentes pequeños y reutilizables (átomos), que se compondrán para formar componentes más complejos (moléculas, organismos).
  - Este enfoque mejora la reutilización de código, facilita las pruebas y acelera el desarrollo a largo plazo.

- ### Estándares de Nomenclatura (TypeScript/React)
  - Se seguirán los estándares de la comunidad de TypeScript y React para nombrar los diferentes elementos del código.
    - **Variables y Funciones:** `camelCase` (ej: `nombreUsuario`, `calcularTotal`).
    - **Constantes Inmutables:** `UPPER_CASE_SNAKE_CASE` (ej: `TIEMPO_MAXIMO`).
    - **Interfaces, Tipos (Types) y Clases:** `PascalCase` (ej: `interface OpcionesUsuario`, `type EstadoCarga`).
    - **Componentes de React:** `PascalCase` y archivos `.tsx` (ej: `<BotonPrincipal />` en `BotonPrincipal.tsx`).
    - **Archivos de Lógica/Servicios:** `kebab-case.ts` (ej: `servicio-api.ts`).