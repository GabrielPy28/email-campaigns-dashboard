# Manual de usuario

**Plataforma de gestión de campañas por correo electrónico**  
*(documento genérico: adapte el nombre comercial de su organización en la portada interna si lo desea)*

| Campo | Valor |
|--------|--------|
| Tipo de documento | Manual de usuario |
| Audiencia | Usuarios finales del panel web (nivel básico a intermedio) |
| Versión de la guía | 1.0 |
| Fecha | Marzo 2026 |

---

## Índice

1. [Cómo usar este manual](#1-cómo-usar-este-manual)
2. [Qué hace esta herramienta](#2-qué-hace-esta-herramienta)
3. [Antes de empezar](#3-antes-de-empezar)
4. [Acceso, sesión y navegación](#4-acceso-sesión-y-navegación)
5. [Campañas](#5-campañas)
6. [Plantillas](#6-plantillas)
7. [Senders (remitentes)](#7-senders-remitentes)
8. [Reportes](#8-reportes)
9. [Listas](#9-listas)
10. [Segmentación](#10-segmentación)
11. [Creadores](#11-creadores)
12. [Entorno de prueba y códigos QR](#12-entorno-de-prueba-y-códigos-qr)
13. [Baja de correo (página pública)](#13-baja-de-correo-página-pública)
14. [Seguridad](#14-seguridad)
15. [Protección de datos y cumplimiento normativo](#15-protección-de-datos-y-cumplimiento-normativo)
16. [Exención de responsabilidad](#16-exención-de-responsabilidad)
17. [Solución de problemas](#17-solución-de-problemas)
18. [Glosario](#18-glosario)
19. [Referencias y lectura recomendada](#19-referencias-y-lectura-recomendada)
20. [Material gráfico sugerido (capturas de pantalla)](#20-material-gráfico-sugerido-capturas-de-pantalla)

---

## 1. Cómo usar este manual

- **Si es su primer día:** lea las secciones 2, 3 y 4 y luego la sección del menú que vaya a usar (por ejemplo, Campañas).
- **Si busca un procedimiento concreto:** use el [Índice](#índice) y los pasos numerados dentro de cada sección.
- **Símbolos en el documento:**
  - **Importante:** información que debe leer antes de actuar.
  - **Advertencia de seguridad:** riesgos para datos, cuentas o cumplimiento legal.
  - **Nota:** aclaración útil pero no obligatoria.

---

## 2. Qué hace esta herramienta

En pocas palabras, la aplicación le permite:

1. **Guardar** datos de personas a las que puede enviar correos (listas y creadores).
2. **Diseñar** mensajes reutilizables (**plantillas**).
3. **Definir** desde qué dirección salen los correos (**senders**).
4. **Programar envíos masivos** (**campañas**) a una lista, a un grupo concreto o a una **segmentación**.
5. **Ver resultados:** aperturas, clics, dispositivos, comparativas con el proveedor de correo (cuando esté configurado), y **descargar informes** en Excel o CSV.

No necesita saber programación para usar el panel. Solo necesita permisos de acceso y seguir los pasos con cuidado.

---

## 3. Antes de empezar

### 3.1 Qué necesita

1. Un **navegador actualizado** (Chrome, Edge, Firefox o Safari recientes).
2. **Usuario y contraseña** (o método de acceso) que le haya dado el administrador de su organización.
3. **Dirección web (URL)** del panel; no la comparta públicamente.

### 3.2 Conceptos mínimos

| Término | Significado breve |
|---------|-------------------|
| **Campaña** | Un envío programado (o en curso) hacia un conjunto de destinatarios. |
| **Plantilla** | Diseño HTML del correo, con “huecos” que se rellenan con datos de cada persona. |
| **Sender** | Nombre y correo que el destinatario ve como remitente. |
| **Lista** | Grupo guardado de personas (creadores) para usar en campañas. |
| **Segmentación** | Reglas o filtros para elegir un subconjunto de audiencia. |

*(Más definiciones en el [Glosario](#18-glosario).)*

---

## 4. Acceso, sesión y navegación

### 4.1 Iniciar sesión

1. Abra la **URL** del sistema en el navegador.
2. Si no está dentro del panel, suele redirigirle a **Iniciar sesión** (`/login`).
3. Introduzca las credenciales que le hayan facilitado.
4. Pulse el botón para entrar (según el diseño de su pantalla).

**Advertencia de seguridad:** no guarde la contraseña en ordenadores compartidos. Cierre sesión al terminar.

### 4.2 Cerrar sesión

1. Busque la opción de **Salir** o **Cerrar sesión** (normalmente en el menú lateral o cabecera).
2. Confirme si el sistema se lo pide.

### 4.3 Menú principal del panel

Tras entrar verá un menú lateral agrupado, similar a este:

| Sección del menú | Qué encontrará |
|------------------|----------------|
| **Campañas** | Listado, análisis y exportación de resultados; crear campaña nueva. |
| **Plantillas** | Crear y editar plantillas de correo. |
| **Senders** | Remitentes autorizados. |
| **Reportes** | Vistas agregadas por campañas, senders, plantillas y destinatarios. |
| **Listas** | Grupos de creadores para envíos. |
| **Segmentación** | Segmentos reutilizables. |
| **Creadores** | Fichas de personas/contactos del sistema. |
| **Pruebas** | Entorno separado para practicar sin afectar datos “reales”. |
| **Códigos QR** | Códigos con enlace e imagen, y estadísticas de escaneos. |

La primera pantalla al entrar en el panel suele ser **Campañas**.

---

## 5. Campañas

### 5.1 Ver el listado de campañas

1. En el menú, pulse **Campañas**.
2. Verá una tabla con campañas, fechas, remitente, estado, etc.
3. Use **Filtros** si necesita acotar por fecha, asunto, plantilla, etc.

### 5.2 Descargar el listado de campañas (Excel)

1. Abra **Filtros** si desea limitar qué filas se exportan.
2. Pulse el botón del listado (p. ej. **Listado · Excel**).
3. El navegador descargará un archivo; ábralo con Excel o similar.

**Nota:** esto exporta el **listado** de campañas, no el detalle analítico de una sola campaña.

### 5.3 Analizar una campaña concreta

1. En la tabla inferior, **seleccione una campaña** (según el diseño de la pantalla: clic en fila o selector).
2. Espere a que carguen los indicadores (KPIs) y gráficos.
3. Revise:
   - destinatarios, aperturas únicas, eventos de apertura, clics;
   - gráfico por destinatario;
   - rendimiento del remitente (radar);
   - dispositivos;
   - comparativa interno vs proveedor (si hay datos);
   - clics por botón.

### 5.4 Descargar el informe completo o por sección

Cuando tenga una campaña seleccionada:

1. **Informe completo**
   - **Todo · Excel:** un libro con varias hojas (resumen, actividad, dispositivos, etc.).
   - **Todo · CSV (ZIP):** varios archivos CSV dentro de un ZIP (útil para quien prefiere CSV).
2. **Por gráfico o bloque:** en cada tarjeta use **Exportar → Excel** o **CSV** para bajar solo esa parte.

**Nota:** los CSV usan separador `;` y codificación pensada para Excel en español. Si la comparativa con el proveedor no está disponible, el archivo puede incluir una hoja o fila explicativa en lugar de fallar todo el informe.

### 5.5 Crear una campaña nueva

1. Pulse **Nueva campaña** (o vaya a la ruta de creación desde el menú).
2. Rellene los datos que pide el formulario (nombre, asunto, preheader si aplica, plantilla, fecha y zona horaria, tiempos de espera entre envíos, senders).
3. Elija **una sola fuente** de destinatarios:
   - una **lista**, o  
   - **creadores** concretos, o  
   - una **segmentación**, o  
   - destinatarios **manuales** (según lo que permita su pantalla).
4. Guarde o confirme según las opciones disponibles.

**Importante:** el envío masivo real depende de que la campaña esté **programada** y de que el **servicio de envío** (cola de trabajos) esté en marcha en su infraestructura. Si algo no sale, consulte con su administrador y la [sección 17](#17-solución-de-problemas).

### 5.6 Preparar envío (si su flujo lo incluye)

Algunas organizaciones usan un paso explícito de preparación antes del envío:

1. Localice la acción **Preparar envío** (o equivalente en API/documentación interna).
2. Ese paso suele **asignar remitente** a cada destinatario y **calcular horarios** escalonados.

Si no ve ese botón, puede que su entorno prepare la cola automáticamente; siga las instrucciones internas de su empresa.

---

## 6. Plantillas

### 6.1 Listar y crear

1. Menú **Plantillas**.
2. Para crear: **Nueva plantilla** (o similar).
3. Para editar: elija la plantilla y abra **Editar**.

### 6.2 Variables en el correo

Las plantillas pueden incluir **variables** (por ejemplo nombre del destinatario). Use la ayuda o el asistente de variables que muestre su pantalla para no equivocarse de nombre de campo.

**Nota:** si una variable no existe para una persona, el sistema puede dejar el campo vacío o mostrar un valor por defecto según la configuración.

---

## 7. Senders (remitentes)

1. Menú **Senders**.
2. **Alta:** nombre visible y correo electrónico desde el que se envía (debe ser un dominio/cuenta autorizada en su proveedor de correo).
3. **Edición o baja:** según los botones disponibles en la lista.

**Advertencia de seguridad:** solo personal autorizado debería crear senders. Un remitente falso puede dañar la reputación del dominio y violar políticas del proveedor (Brevo, Google, etc.).

---

## 8. Reportes

1. Menú **Reportes**.
2. Navegue por las subsecciones (campañas, senders, plantillas, destinatarios/recipientes).
3. Use filtros o tablas según lo que muestre cada pantalla.

**Nota:** los reportes del menú pueden diferir del detalle muy visual de **Campañas**; úselos según el tipo de análisis que necesite.

---

## 9. Listas

1. Menú **Listas**.
2. Cree una lista o abra una existente.
3. En el **detalle de lista** podrá vincular creadores, importar o gestionar miembros según las acciones disponibles.

**Importante:** cargue solo personas respecto a las cuales tenga **base legal** para comunicaciones comerciales o relacionadas (véase [sección 15](#15-protección-de-datos-y-cumplimiento-normativo)).

---

## 10. Segmentación

1. Menú **Segmentación**.
2. Cree o abra un segmento para ver sus criterios y, si aplica, campañas vinculadas.
3. Al crear una campaña, podrá elegir ese segmento como audiencia (si su flujo lo permite).

---

## 11. Creadores

1. Menú **Creadores**.
2. Consulte, cree o edite fichas de creadores según sus permisos.
3. Los datos enriquecidos (perfiles por plataforma, etc.) sirven para personalizar plantillas.

---

## 12. Entorno de prueba y códigos QR

### 12.1 Pruebas

1. Menú **Pruebas**.
2. Use este espacio para listas y creadores de **prueba**, separados de producción.
3. Ideal para formación sin riesgo de enviar a clientes reales.

### 12.2 Códigos QR

1. Menú **Códigos QR**.
2. Cree un código con nombre, URL de destino e imagen si aplica.
3. Las visitas o escaneos pueden contabilizarse según la configuración del sistema.

---

## 13. Baja de correo (página pública)

Algunos correos incluyen un enlace a una página pública de **baja** (ruta tipo `/baja-creador`).

1. El destinatario abre el enlace.
2. Sigue los pasos en pantalla para solicitar no recibir más correos (según el texto legal de su organización).

**Importante:** respete las bajas. Seguir enviando a quien se ha dado de baja puede ser ilícito y perjudicar la reputación del envío.

---

## 14. Seguridad

### 14.1 Credenciales

1. No comparta usuario y contraseña.
2. Use contraseñas largas y únicas.
3. No las envíe por chat o correo sin cifrar.

### 14.2 Sesión y equipo

1. Cierre sesión al alejarse del puesto.
2. En equipos compartidos, no marque “recordar contraseña” del navegador.

### 14.3 Datos en pantalla

1. Los listados pueden contener **datos personales**; no los fotografíe ni los comparta fuera del trabajo sin autorización.
2. Los informes descargados deben guardarse en ubicaciones controladas por su organización.

### 14.4 Enlaces y archivos

1. No abra enlaces sospechosos que simulen ser el panel.
2. Verifique que la URL coincide con la que le dio su administrador.

---

## 15. Protección de datos y cumplimiento normativo

Esta sección es **orientativa**. La responsabilidad última del cumplimiento corresponde a su organización y a sus asesores legales.

### 15.1 Principios básicos (RGPD y normativa española de referencia)

Si trata datos de personas en la UE / España, suelen aplicarse reglas como:

1. **Licitud:** solo tratar datos cuando exista base legal (consentimiento, ejecución de contrato, interés legítimo bien ponderado, etc.).
2. **Información:** informar a las personas (política de privacidad, finalidad, derechos).
3. **Minimización:** no recolectar más datos de los necesarios.
4. **Limitación del plazo:** conservar solo el tiempo necesario.
5. **Derechos:** acceso, rectificación, supresión, oposición, limitación, portabilidad cuando corresponda.
6. **Registro de actividades** y, en su caso, **evaluación de impacto** y **delegado de protección de datos**.

**Advertencia:** el envío de comunicaciones comerciales por correo suele exigir **consentimiento previo** o encajar en excepciones muy concretas; consúltelo con legal antes de masivos envíos.

### 15.2 Proveedores externos (correo, nube, etc.)

1. Si usa **Brevo**, **Supabase**, almacenamiento en **nube** u otros servicios, su organización debe tener **contratos o cláusulas** adecuadas (encargados del tratamiento, transferencias internacionales, etc.).
2. Revise la documentación y el DPA (Data Processing Agreement) de cada proveedor.

### 15.3 Registros de actividad

1. El sistema puede registrar **accesos o peticiones** para auditoría (según configuración).
2. Use la herramienta de forma profesional; las acciones pueden quedar trazadas.

### 15.4 Menores

1. No debe usar listas dirigidas a menores sin marco legal y parentalidad que corresponda.

---

## 16. Exención de responsabilidad

1. **Este manual** describe el uso general de la herramienta según el diseño del software en el momento de redacción. Puede haber diferencias entre su instalación y este texto.
2. **Los ejemplos numéricos, flujos o nombres de botones** son orientativos; la interfaz puede cambiar con actualizaciones.
3. **Nada en este manual constituye asesoramiento legal, fiscal ni de protección de datos.** Su organización debe contar con asesoramiento profesional para el cumplimiento normativo aplicable en su sector y país.
4. **El titular del tratamiento** de los datos personales es normalmente su organización (responsable del tratamiento). Los proveedores de software o hosting actúan según los roles definidos contractualmente.
5. **El uso indebido** de la plataforma (spam, datos obtenidos ilegalmente, suplantación, etc.) es responsabilidad de quien realiza el uso, sin perjuicio de las acciones legales que correspondan.

---

## 17. Solución de problemas

### 17.1 No puedo entrar al panel

1. Compruebe usuario y contraseña (mayúsculas, teclado en español).
2. Pruebe otro navegador o ventana de incógnito.
3. Pida a su administrador que confirme que su usuario está activo.

### 17.2 La página se queda en blanco o “Cargando…”

1. Actualice la página (F5).
2. Desactive extensiones que bloqueen scripts.
3. Si persiste, informe a soporte con captura y hora aproximada.

### 17.3 No veo mi campaña en el listado

1. Revise **filtros** (fechas, asunto, plantilla).
2. Si existen campañas de **prueba**, puede que haya que marcar una opción para incluirlas (según configuración).
3. Confirme que busca en el entorno correcto (producción vs pruebas).

### 17.4 Los correos no se envían

1. Confirme que la campaña tiene **destinatarios** y **fecha** válida.
2. El envío masivo suele depender de un **servicio en segundo plano** (cola); solo el administrador técnico puede verificar que está activo.
3. Verifique que los **senders** y el **proveedor de correo** (Brevo/SMTP) están bien configurados en el servidor.

### 17.5 Las métricas no coinciden con el proveedor de correo

1. Es **normal** ver pequeñas diferencias (bloqueadores de imágenes, clientes que no cargan el pixel de apertura, retrasos).
2. Use la comparativa **Interno vs Brevo** como guía, no como cifra legal única.

### 17.6 Error al descargar Excel o CSV

1. Compruebe que sigue **conectado** (vuelva a iniciar sesión si hace falta).
2. Intente otro navegador.
3. Si el informe completo en CSV es un **ZIP**, descomprímalo antes de abrir cada CSV en Excel.

### 17.7 La plantilla se ve mal en el móvil

1. Las plantillas HTML deben ser **responsivas**; pida a diseño/marketing que revise el código o use plantillas probadas.

---

## 18. Glosario

| Término | Explicación sencilla |
|---------|----------------------|
| **API** | Forma técnica en que programas hablan entre sí (puede no ser visible para usted). |
| **Brevo** | Proveedor habitual de envío de correo transaccional y marketing (antes Sendinblue). |
| **Campaña** | Envío coordinado a muchas personas con mismos parámetros generales. |
| **Clic** | Pulsar un enlace del correo (puede quedar registrado para estadísticas). |
| **CSV** | Archivo de texto en tabla, apto para Excel. |
| **KPI** | Indicador clave (número que resume un resultado). |
| **Pixel de apertura** | Imagen diminuta que ayuda a saber si se abrió el correo (no es 100 % fiable). |
| **Plantilla** | Modelo de correo reutilizable. |
| **Preheader** | Texto corto que algunos correos muestran junto al asunto. |
| **Segmentación** | Subconjunto de audiencia por reglas. |
| **Sender** | Remitente (nombre + email). |
| **SMTP** | Protocolo clásico de envío de correo. |
| **URL** | Dirección web. |

---

## 19. Referencias y lectura recomendada

*(Enlaces oficiales o de referencia; revíselos periódicamente por posibles cambios.)*

1. **Reglamento (UE) 2016/679 (RGPD)** — marco general de protección de datos en la Unión Europea.  
   [https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX%3A32016R0679](https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX%3A32016R0679)

2. **Ley Orgánica 3/2018 (España)** — de Protección de Datos Personales y garantía de los derechos digitales (LOPDGDD).  
   [https://www.boe.es/buscar/act.php?id=BOE-A-2018-16673](https://www.boe.es/buscar/act.php?id=BOE-A-2018-16673)

3. **Ley 34/2002 (España)** — de servicios de la sociedad de la información y comercio electrónico (LSSI; aspectos de comunicaciones comerciales).  
   [https://www.boe.es/buscar/act.php?id=BOE-A-2002-13758](https://www.boe.es/buscar/act.php?id=BOE-A-2002-13758)

4. **Agencia Española de Protección de Datos (AEPD)** — guías y materiales para responsables del tratamiento.  
   [https://www.aepd.es](https://www.aepd.es)

5. **Brevo** — documentación y condiciones del proveedor (si su organización lo utiliza).  
   [https://developers.brevo.com](https://developers.brevo.com)  
   [https://www.brevo.com/legal](https://www.brevo.com/legal)

6. **Guías de buenas prácticas en email marketing** — busque en su autoridad de consumo o asociación sectorial del país donde opere.

---

## 20. Material gráfico sugerido (capturas de pantalla)

Si desea enriquecer este manual con imágenes, le recomiendo capturar **en orden** lo siguiente (sin datos personales reales; use datos ficticios o anonimice):

1. **Pantalla de inicio de sesión** completa.
2. **Menú lateral** del panel con todas las secciones visibles.
3. **Campañas:** tabla de listado con filtros cerrados y otra con filtros abiertos.
4. **Campañas:** misma pantalla con **una campaña seleccionada** y KPIs visibles.
5. **Campañas:** zona de **Todo · Excel** y **Todo · CSV (ZIP)** y un detalle de **Exportar** en una tarjeta de gráfico.
6. **Nueva campaña:** formulario principal (sin contraseñas ni datos sensibles).
7. **Plantillas:** listado y **editor** (vista parcial).
8. **Senders:** listado.
9. **Reportes:** una subpágina representativa.
10. **Lista:** detalle con miembros **anonimizados** (emails tapados).
11. **Segmentación:** detalle de un segmento.
12. **Creadores:** listado anonimizado.
13. **Pruebas** y **Códigos QR:** una captura cada una.
14. **Baja de creador:** página pública (texto legal visible).

**Formato:** PNG o WebP, ancho razonable (p. ej. 1200 px), nombres de archivo claros (`01-login.png`, `02-menu.png`, …).

**Privacidad:** antes de publicar el manual, revise que **no aparezcan** correos reales, teléfonos, URLs internas confidenciales ni tokens en la barra de direcciones.

---

*Fin del manual de usuario (versión 1.0).*
