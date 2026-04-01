import type { DocSection } from "./types";

/** Vídeo de bienvenida: URL de embed (YouTube "embed/ID" o similar). Opcional vía .env: VITE_DOCS_WELCOME_VIDEO_EMBED */
export const DOCS_WELCOME_VIDEO_EMBED =
  typeof import.meta.env.VITE_DOCS_WELCOME_VIDEO_EMBED === "string"
    ? import.meta.env.VITE_DOCS_WELCOME_VIDEO_EMBED
    : "";

export const DOCUMENTATION_SECTIONS: DocSection[] = [
  {
    slug: "bienvenida",
    title: "Bienvenida al manual",
    description: "Cómo usar esta ayuda dentro del panel y qué encontrará en cada parte.",
    blocks: [
      {
        type: "media",
        videoEmbedUrl: DOCS_WELCOME_VIDEO_EMBED || undefined,
        videoTitle: "Introducción a la plataforma",
        caption: DOCS_WELCOME_VIDEO_EMBED
          ? "Vídeo de introducción."
          : "Puede enlazar un vídeo de bienvenida: defina la variable de entorno VITE_DOCS_WELCOME_VIDEO_EMBED con la URL de inserción (por ejemplo https://www.youtube-nocookie.com/embed/SU_ID).",
      },
      {
        type: "paragraph",
        text: "Esta documentación está integrada en el mismo panel que usa para trabajar. Puede saltar a cualquier tema desde el índice lateral (en pantallas grandes) o desde las tarjetas de la página principal de Documentación.",
      },
      {
        type: "steps",
        title: "Cómo aprovechar mejor esta guía",
        items: [
          "Si es su primer día, lea «Qué es la herramienta» y «Requisitos y acceso».",
          "Si ya envía campañas, vaya directamente a «Campañas» o «Solución de problemas».",
          "Use el menú lateral de esta sección para cambiar de tema sin perder el contexto del panel.",
        ],
      },
      {
        type: "note",
        text: "Los textos marcados como Nota son recomendaciones. Los recuadros de advertencia indican seguridad o cumplimiento y deben leerse con atención.",
      },
    ],
  },
  {
    slug: "que-es",
    title: "Qué es la herramienta",
    description: "Funciones principales de la plataforma.",
    cardImage: "/docs/hero-plataforma.svg",
    blocks: [
      {
        type: "paragraph",
        text: "La plataforma le permite gestionar envíos de correo a muchas personas de forma organizada, sin programar. Estas son las capacidades centrales:",
      },
      {
        type: "steps",
        items: [
          "Guardar y agrupar destinatarios (listas, creadores, segmentaciones).",
          "Crear plantillas de correo reutilizables con datos personalizados por persona.",
          "Definir remitentes (senders) autorizados.",
          "Programar campañas y ver aperturas, clics, dispositivos e informes descargables.",
        ],
      },
      {
        type: "media",
        image: "/docs/hero-plataforma.svg",
        imageAlt: "Esquema conceptual de la plataforma",
        caption: "Puede sustituir esta imagen por una captura real en public/docs/hero-plataforma.svg o .png.",
      },
    ],
  },
  {
    slug: "requisitos-acceso",
    title: "Requisitos y acceso",
    description: "Navegador, credenciales y buenas prácticas al entrar al panel.",
    blocks: [
      {
        type: "heading",
        level: 2,
        text: "Qué necesita",
      },
      {
        type: "steps",
        items: [
          "Un navegador actualizado (Chrome, Edge, Firefox o Safari reciente).",
          "Usuario y contraseña (u otro método) facilitados por el administrador de su organización.",
          "La dirección web (URL) del panel; no la comparta en redes públicas.",
        ],
      },
      {
        type: "heading",
        level: 2,
        text: "Iniciar sesión",
      },
      {
        type: "steps",
        items: [
          "Abra la URL del sistema.",
          "Si no está identificado, accederá a la pantalla de inicio de sesión.",
          "Introduzca sus credenciales y confirme para entrar.",
        ],
      },
      {
        type: "warning",
        title: "Seguridad",
        text: "No guarde la contraseña en equipos compartidos. Cierre sesión al alejarse del puesto.",
      },
    ],
  },
  {
    slug: "navegacion",
    title: "Navegación del panel",
    description: "Menú lateral, secciones y a dónde lleva cada entrada.",
    blocks: [
      {
        type: "paragraph",
        text: "Tras iniciar sesión verá un menú lateral. Las secciones habituales son:",
      },
      {
        type: "table",
        headers: ["Entrada del menú", "Uso principal"],
        rows: [
          ["Campañas", "Listado, análisis, exportación y nueva campaña."],
          ["Plantillas", "Crear y editar diseños de correo."],
          ["Senders", "Remitentes (nombre y correo visible)."],
          ["Reportes", "Vistas agregadas por campañas, senders, plantillas y destinatarios."],
          ["Listas", "Grupos de creadores para envíos."],
          ["Segmentación", "Segmentos reutilizables."],
          ["Creadores", "Fichas de contactos."],
          ["Pruebas", "Entorno de prueba sin mezclar datos reales."],
          ["Códigos QR", "Códigos con enlace, imagen y estadísticas."],
          ["Documentación", "Este manual dentro del panel."],
        ],
      },
      {
        type: "note",
        text: "La primera pantalla al entrar suele ser Campañas.",
      },
    ],
  },
  {
    slug: "campanas",
    title: "Campañas",
    description: "Listado, filtros, análisis, exportaciones y creación paso a paso.",
    cardImage: "/docs/campanas-kpis.png",
    blocks: [
      {
        type: "heading",
        level: 2,
        text: "Ver el listado",
      },
      {
        type: "steps",
        items: [
          "En el menú principal pulse Campañas.",
          "Revise la tabla: fechas, remitente, estado y métricas resumidas.",
          "Abra Filtros si desea acotar por fecha, asunto, plantilla, sender, etc.",
        ],
      },
      {
        type: "heading",
        level: 2,
        text: "Exportar el listado a Excel",
      },
      {
        type: "steps",
        items: [
          "Opcional: ajuste filtros para limitar filas.",
          "Pulse el botón del listado (p. ej. «Listado · Excel»).",
          "Abra el archivo descargado con Excel o similar.",
        ],
      },
      {
        type: "note",
        text: "Ese Excel es el listado de campañas, no el informe analítico detallado de una sola campaña.",
      },
      {
        type: "media",
        image: "/docs/campanas-kpis.png",
        imageAlt: "Vista de campañas con KPIs y gráficos",
        caption: "Sustituya por su captura en public/docs/campanas-kpis.png.",
      },
      {
        type: "heading",
        level: 2,
        text: "Analizar una campaña seleccionada",
      },
      {
        type: "steps",
        items: [
          "En la tabla inferior seleccione una campaña (clic en la fila o según el diseño de su pantalla).",
          "Espere a que carguen los KPIs y gráficos.",
          "Revise destinatarios, aperturas únicas, eventos de apertura, clics, gráfico por destinatario, radar del remitente, dispositivos, comparativa con el proveedor de correo (si hay datos) y clics por botón.",
        ],
      },
      {
        type: "heading",
        level: 2,
        text: "Descargar informe de resultados",
      },
      {
        type: "steps",
        items: [
          "Con la campaña seleccionada, use «Todo · Excel» para un libro con varias hojas (resumen, actividad, dispositivos, etc.).",
          "Use «Todo · CSV (ZIP)» para varios CSV dentro de un archivo ZIP.",
          "En cada tarjeta de gráfico use Exportar → Excel o CSV para bajar solo esa parte.",
        ],
      },
      {
        type: "note",
        text: "Los CSV suelen usar separador «;» y codificación adecuada para Excel en español.",
      },
      {
        type: "heading",
        level: 2,
        text: "Crear una campaña nueva",
      },
      {
        type: "steps",
        items: [
          "Pulse Nueva campaña.",
          "Complete nombre, asunto, preheader si aplica, plantilla, fecha y zona horaria, intervalos de espera entre envíos y senders (remitentes).",
          "Elija una sola fuente de destinatarios: lista, creadores concretos, segmentación o carga manual, según las opciones de su pantalla.",
          "Guarde o envíe según su flujo de trabajo establecido.",
        ],
      },
      {
        type: "warning",
        title: "Importante",
        text: "El envío masivo depende de la campaña programada y de que el servicio de cola (worker) esté activo en el servidor. Si no se envía, contacte al administrador técnico.",
      },
    ],
  },
  {
    slug: "plantillas",
    title: "Plantillas",
    description: "Crear, editar y usar variables en el HTML del correo.",
    blocks: [
      {
        type: "steps",
        items: [
          "Menú Plantillas.",
          "Nueva plantilla para crear desde cero o duplicar según su flujo.",
          "Editar para modificar el HTML y el nombre.",
        ],
      },
      {
        type: "paragraph",
        text: "Las plantillas pueden incluir variables (por ejemplo nombre del destinatario). Use el asistente o la referencia de variables de la pantalla de edición para no equivocarse de nombre.",
      },
      {
        type: "note",
        text: "Si falta un dato para una persona, el campo puede quedar vacío o con un valor por defecto según la configuración.",
      },
    ],
  },
  {
    slug: "senders",
    title: "Senders (remitentes)",
    description: "Alta y gestión de las direcciones desde las que se envía.",
    blocks: [
      {
        type: "steps",
        items: [
          "Menú Senders.",
          "Alta: indique nombre visible y correo electrónico.",
          "Verifique con su administrador que el dominio o cuenta esté autorizado en el proveedor de envío (Brevo, etc.).",
        ],
      },
      {
        type: "warning",
        title: "Seguridad y reputación",
        text: "Solo el personal autorizado debe crear senders. Remitentes no válidos pueden dañar la reputación del dominio y violar políticas del proveedor.",
      },
    ],
  },
  {
    slug: "reportes",
    title: "Reportes",
    description: "Vistas agregadas del menú Reportes.",
    blocks: [
      {
        type: "steps",
        items: [
          "Menú Reportes.",
          "Navegue por campañas, senders, plantillas o destinatarios según necesite.",
          "Aplique filtros o exportaciones si su pantalla las ofrece.",
        ],
      },
      {
        type: "note",
        text: "El detalle visual muy fino de una campaña concreta suele estar en la página Campañas al seleccionar una fila.",
      },
    ],
  },
  {
    slug: "listas",
    title: "Listas",
    description: "Grupos de creadores vinculados para usar como audiencia.",
    blocks: [
      {
        type: "steps",
        items: [
          "Menú Listas.",
          "Cree una lista o abra una existente.",
          "En el detalle, añada o vincule creadores e importe según las acciones disponibles.",
        ],
      },
      {
        type: "warning",
        title: "Cumplimiento",
        text: "Cargue solo personas respecto a las cuales exista base legal para el envío (consentimiento u otra base aplicable). Consulte con su responsable legal.",
      },
    ],
  },
  {
    slug: "segmentacion",
    title: "Segmentación",
    description: "Segmentos reutilizables para campañas.",
    blocks: [
      {
        type: "steps",
        items: [
          "Menú Segmentación.",
          "Cree un segmento o abra uno para revisar criterios y campañas asociadas.",
          "Al crear una campaña, elija el segmento como audiencia si la opción está disponible.",
        ],
      },
    ],
  },
  {
    slug: "creadores",
    title: "Creadores",
    description: "Fichas de contactos y datos para personalizar correos.",
    blocks: [
      {
        type: "steps",
        items: [
          "Menú Creadores.",
          "Consulte, cree o edite fichas según sus permisos.",
          "Los perfiles por plataforma y campos extra alimentan las variables de las plantillas.",
        ],
      },
    ],
  },
  {
    slug: "pruebas-qr",
    title: "Pruebas y códigos QR",
    description: "Entorno de prueba y gestión de códigos QR.",
    blocks: [
      {
        type: "heading",
        level: 2,
        text: "Entorno de prueba",
      },
      {
        type: "steps",
        items: [
          "Menú Pruebas.",
          "Use listas y creadores de prueba separados de producción.",
          "Ideal para formación sin impacto en clientes reales.",
        ],
      },
      {
        type: "heading",
        level: 2,
        text: "Códigos QR",
      },
      {
        type: "steps",
        items: [
          "Menú Códigos QR.",
          "Cree un código con nombre, URL de destino e imagen opcional.",
          "Consulte estadísticas de escaneos si están habilitadas.",
        ],
      },
    ],
  },
  {
    slug: "baja-correo",
    title: "Baja de correo (pública)",
    description: "Enlace de baja que reciben los destinatarios.",
    blocks: [
      {
        type: "paragraph",
        text: "Algunos correos incluyen un enlace a una página pública de baja (por ejemplo /baja-creador). El destinatario sigue los pasos en pantalla.",
      },
      {
        type: "warning",
        title: "Obligación",
        text: "Respete las solicitudes de baja. Seguir enviando puede ser ilícito y dañar la reputación del envío.",
      },
    ],
  },
  {
    slug: "seguridad",
    title: "Seguridad",
    description: "Credenciales, sesión y manejo de datos en pantalla.",
    blocks: [
      {
        type: "steps",
        title: "Credenciales",
        items: [
          "No comparta usuario y contraseña.",
          "Use contraseñas largas y únicas.",
          "No las envíe por chat o correo sin cifrar.",
        ],
      },
      {
        type: "steps",
        title: "Sesión y equipo",
        items: [
          "Cierre sesión al alejarse del puesto.",
          "En equipos compartidos, evite «recordar contraseña» del navegador.",
        ],
      },
      {
        type: "steps",
        title: "Datos personales",
        items: [
          "Los listados pueden contener datos personales: no los difunda sin autorización.",
          "Guarde los informes descargados en ubicaciones controladas por su organización.",
        ],
      },
      {
        type: "warning",
        title: "Phishing",
        text: "Compruebe que la URL del panel es la oficial. No abra enlaces sospechosos que imiten el inicio de sesión.",
      },
    ],
  },
  {
    slug: "datos-personales",
    title: "Protección de datos",
    description: "Orientación sobre RGPD y normativa (no es asesoramiento legal).",
    blocks: [
      {
        type: "paragraph",
        text: "Su organización es normalmente el responsable del tratamiento de los datos personales. Este texto es orientativo; consulte siempre a su asesor legal.",
      },
      {
        type: "table",
        headers: ["Principio", "Idea breve"],
        rows: [
          ["Licitud", "Tratar datos solo con base legal adecuada."],
          ["Información", "Informar a las personas sobre el tratamiento y sus derechos."],
          ["Minimización", "No recoger más datos de los necesarios."],
          ["Plazo", "Conservar solo el tiempo necesario."],
          ["Derechos", "Atender acceso, rectificación, supresión, etc., cuando correspondan."],
        ],
      },
      {
        type: "warning",
        title: "Comunicaciones comerciales",
        text: "El envío masivo de correos comerciales suele exigir consentimiento previo u otra figura legal concreta. No deduzca el cumplimiento solo de este manual.",
      },
      {
        type: "paragraph",
        text: "Si usa proveedores externos (Brevo, nube, etc.), su organización debe tener encargados del tratamiento y cláusulas adecuadas.",
      },
    ],
  },
  {
    slug: "responsabilidad",
    title: "Exención de responsabilidad",
    description: "Alcance de esta documentación y límites.",
    blocks: [
      {
        type: "paragraph",
        text: "Esta ayuda describe el uso habitual del software según su diseño en el momento de publicación. La interfaz puede cambiar con actualizaciones.",
      },
      {
        type: "paragraph",
        text: "No sustituye asesoramiento legal, fiscal ni de protección de datos. El uso indebido (spam, datos ilegales, suplantación) es responsabilidad de quien lo realiza.",
      },
    ],
  },
  {
    slug: "solucion-problemas",
    title: "Solución de problemas",
    description: "Problemas frecuentes y qué comprobar.",
    blocks: [
      {
        type: "heading",
        level: 3,
        text: "No puedo entrar",
      },
      {
        type: "steps",
        items: [
          "Revise usuario y contraseña (mayúsculas, idioma del teclado).",
          "Pruebe otra ventana de incógnito u otro navegador.",
          "Pida al administrador que confirme que su cuenta está activa.",
        ],
      },
      {
        type: "heading",
        level: 3,
        text: "La página carga sin fin",
      },
      {
        type: "steps",
        items: [
          "Actualice con F5.",
          "Desactive extensiones que bloqueen scripts.",
          "Informe a soporte con captura y hora.",
        ],
      },
      {
        type: "heading",
        level: 3,
        text: "No se envían correos",
      },
      {
        type: "steps",
        items: [
          "Confirme destinatarios y fecha de programación.",
          "El envío masivo requiere el servicio en segundo plano activo: solo el administrador técnico puede verificarlo.",
          "Revise senders y configuración del proveedor de correo en el servidor.",
        ],
      },
      {
        type: "heading",
        level: 3,
        text: "Métricas distintas al proveedor",
      },
      {
        type: "paragraph",
        text: "Es habitual una pequeña diferencia (bloqueadores de imágenes, clientes que no cargan el pixel de apertura, retrasos). Use la comparativa como guía, no como única cifra oficial.",
      },
      {
        type: "heading",
        level: 3,
        text: "Error al descargar informes",
      },
      {
        type: "steps",
        items: [
          "Compruebe que la sesión sigue activa (vuelva a entrar si hace falta).",
          "Pruebe otro navegador.",
          "Si descarga CSV completo, recuerde que es un ZIP con varios archivos dentro.",
        ],
      },
    ],
  },
  {
    slug: "glosario",
    title: "Glosario",
    description: "Términos usados en el panel.",
    blocks: [
      {
        type: "table",
        headers: ["Término", "Significado"],
        rows: [
          ["Campaña", "Envío coordinado hacia un conjunto de destinatarios."],
          ["Plantilla", "Modelo HTML de correo reutilizable."],
          ["Sender", "Remitente visible (nombre + email)."],
          ["Lista", "Grupo guardado de creadores."],
          ["Segmentación", "Subconjunto de audiencia por reglas."],
          ["KPI", "Indicador clave (número resumen)."],
          ["Pixel de apertura", "Ayuda a medir aperturas; no es 100% exacto."],
          ["CSV", "Archivo de tabla para Excel."],
        ],
      },
    ],
  },
  {
    slug: "referencias",
    title: "Referencias legales y enlaces",
    description: "Fuentes oficiales para profundizar (España / UE).",
    blocks: [
      {
        type: "paragraph",
        text: "Enlaces de referencia (revise fechas y versiones vigentes en la fuente):",
      },
      {
        type: "table",
        headers: ["Recurso", "Enlace"],
        rows: [
          [
            "RGPD (texto UE)",
            "https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX%3A32016R0679",
          ],
          ["LOPDGDD (España)", "https://www.boe.es/buscar/act.php?id=BOE-A-2018-16673"],
          ["LSSI (España)", "https://www.boe.es/buscar/act.php?id=BOE-A-2002-13758"],
          ["AEPD", "https://www.aepd.es"],
          ["Brevo (documentación)", "https://developers.brevo.com"],
        ],
      },
      {
        type: "note",
        text: "Los enlaces se abren mejor en una nueva pestaña desde su navegador copiando la URL.",
      },
    ],
  },
];

export function getDocSectionBySlug(slug: string): DocSection | undefined {
  return DOCUMENTATION_SECTIONS.find((s) => s.slug === slug);
}
