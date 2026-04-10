# 3. Requisitos Funcionales (RF)

Este documento lista las capacidades y funciones que el sistema debe realizar.

*   **RF-1: Registro de Movimientos Físicos:** El sistema debe permitir registrar los movimientos físicos que afectan al `ALMACEN`: recepción de `CONSIGNACION` y conteo de `ALMACEN`.
*   **RF-2: Gestión de Sedes:** El sistema debe permitir la segmentación de datos y usuarios por sedes físicas independientes.
*   **RF-3: Consulta de Stock en Tiempo Real:** El sistema debe mostrar a los preventistas el `STOCK` disponible (Almacén + Consignación) actualizado al instante.
*   **RF-4: Categorización y Ordenamiento:** El sistema debe permitir visualizar el stock agrupado por tipo de bebida y ofrecer criterios de ordenamiento por nombre y cantidad.
*   **RF-5: Cálculo de Tránsito:** El sistema debe calcular automáticamente el `TRANSITO` comparando el cierre del día anterior con el conteo actual.
*   **RF-6: Gestión de Catálogo:** Los administradores deben poder gestionar el maestro de productos, incluyendo códigos SAP, Basis y precios.
*   **RF-7: Control de Acceso por Roles:** El sistema debe restringir las funciones de escritura según el rol del usuario (Preventistas son solo lectura).
*   **RF-8: Identificación por QR:** El sistema debe permitir la identificación de productos mediante el escaneo de códigos QR estáticos.
*   **RF-9: Generación de Fichas de Producto:** El sistema debe permitir exportar fichas visuales de productos con sus códigos y QR para señalética de almacén.
*   **RF-10: Soporte Multisede:** Los supervisores y administradores deben poder alternar entre sedes para visualizar estados de stock globales o específicos.
