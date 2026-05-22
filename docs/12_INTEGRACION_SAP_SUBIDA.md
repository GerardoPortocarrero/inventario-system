# 12. Integración SAP: Automatización de Subida de Inventario

Este documento describe la estrategia y los requisitos técnicos para automatizar la subida de los datos de inventario físico (conteo del almacenero) desde el sistema hacia SAP.

## 1. Objetivo
Eliminar la digitación manual de los conteos diarios en SAP, reduciendo errores humanos y asegurando que el stock contable (SAP) coincida exactamente con la propiedad física real reportada en la App.

## 2. Flujo de Información
El proceso sigue un modelo de "Carga Masiva" basado en los reportes generados por el Dashboard:

1.  **Origen:** El Almacenero completa el conteo en el **Controlador**.
2.  **Consolidación:** En el **Dashboard**, se genera un **REPORTE CSV** de tipo **"INVENTARIO (A+C)"**. Este reporte suma el stock en piso más lo que está en consignación.
3.  **Procesamiento:** El "Bridge" (conector local) lee este CSV y mapea los códigos SAP y las cantidades.
4.  **Ejecución:** Mediante la **API de SAP GUI Scripting**, un script "digita" automáticamente estos valores en la transacción correspondiente de SAP.

## 3. Arquitectura del Conector (Bridge)
Debido a restricciones de seguridad de los navegadores, la integración requiere un componente intermedio:

*   **Interfaz Web:** Botón de acción para disparar o preparar la data.
*   **Base de Datos (RTDB):** Nodo de comandos que sincroniza la orden.
*   **Bridge Local (Node.js):** Programa que corre en la PC con SAP y ejecuta el `exec` para controlar el GUI de SAP.
*   **SAP GUI Scripting:** Interfaz COM que permite la interacción con los campos de SAP.

## 4. Requisitos Técnicos en SAP
Para que la automatización sea exitosa, deben habilitarse los siguientes permisos:
*   **Servidor (RZ11):** Parámetro `sapgui/user_scripting` = `TRUE`.
*   **Cliente:** Opciones de SAP GUI > Accesibilidad y Scripting > "Habilitar Scripting" (Activo).
*   **Sesión:** Se recomienda trabajar sobre una **sesión ya iniciada** para evitar bloqueos por MFA (Multi-Factor Authentication).

## 5. Definiciones Pendientes (Cuestionario de Capacitación)
Para construir el script final, se requiere la siguiente información técnica que será obtenida en la capacitación:

| Concepto | Descripción | Ejemplo |
| :--- | :--- | :--- |
| **Código de Transacción** | T-Code exacto para subir el inventario físico. | `MI04`, `MI10`, `MI31` |
| **Niveles Organizativos** | Código de **Centro** (Plant) y **Almacén** (SLoc) en SAP. | Centro: 1000 / Alm: 0001 |
| **Unidad de Medida** | ¿SAP recibe la carga en Unidades o en Cajas? | Unidades (UN) / Cajas (CJ) |
| **Campos de Cabecera** | ¿Se requiere número de documento de inventario previo? | Sí (MI04) / No (MI10) |
| **Tratamiento de Errores** | ¿Qué hacer si un material está bloqueado en SAP? | Saltar y reportar en Log. |

## 6. Ejemplo de Lógica del Script (Pseudo-código)
```vbscript
' Conexión con sesión activa de SAP
Set session = connection.Children(0)

' Bucle sobre los datos del Reporte CSV del Dashboard
For Each fila In Reporte_Inventario
    ' Ingresar Código SAP del Material
    session.findById(".../ctxtISEG-MATNR").text = fila.CodigoSAP
    ' Ingresar Cantidad Física Real (Almacén + Consignación)
    session.findById(".../txtISEG-ERFMG").text = fila.CantidadTotal
    ' Procesar y continuar a la siguiente fila
    session.findById("wnd[0]").sendVKey 0
Next

' Guardar cambios y finalizar
session.findById("wnd[0]/tbar[0]/btn[11]").press
```
