/**
 * Variables Jinja2 para plantillas de correo.
 *
 * Los datos vienen de tablas conocidas (`creators` / `creators_test`, `account_profiles`, etc.).
 * El backend las lee en `creator_to_extra_dict`, guarda el resultado en `campaign_recipients.extra_data`
 * y en el motor de envío ese objeto llega al contexto Jinja como **`extra`** (convención del renderer).
 * es el mismo contenido de filas/columnas, solo **serializado** con una jerarquía estable
 * (`extra.creator.*`, `extra.account.<red>.*`) y algunas claves planas legadas (`extra.first_name`, etc.).
 *
 * ## Grupos
 * - **creator**: columnas de la fila del creador (producción: `creators`; prueba: `creators_test`).
 * - **account**: en producción, `account_profiles` por plataforma; en prueba, columnas equivalentes en `creators_test`.
 * - **envio**: remitente en el momento del envío (no es columna de creador).
 */

export type TemplateVariableGroup = "creator" | "account" | "envio";

export interface TemplateVariableDef {
  column: string;
  expression: string;
  /** Texto corto para la UI. */
  description: string;
  group: TemplateVariableGroup;
  /** Origen en base de datos o nota (tabla.columna / derivado). */
  sourceHint?: string;
}

export const TEMPLATE_VARIABLE_GROUP_ORDER: TemplateVariableGroup[] = ["creator", "account", "envio"];

export const TEMPLATE_VARIABLE_GROUP_LABELS: Record<TemplateVariableGroup, string> = {
  creator: "Creador (tablas creators / creators_test)",
  account: "Cuentas (account_profiles en prod.; creators_test en prueba)",
  envio: "Envío",
};

export const TEMPLATE_VARIABLES: TemplateVariableDef[] = [
  {
    column: "email",
    expression: "{{ email }}",
    description: "Correo del destinatario",
    sourceHint: "creators.email · creators_test.email (también en raíz Jinja)",
    group: "creator",
  },
  {
    column: "nombre_display",
    expression: "{{ nombre }}",
    description: "Nombre para mostrar",
    sourceHint: "Derivado en envío a partir de full_name / first_name + last_name",
    group: "creator",
  },
  {
    column: "username",
    expression: "{{ username }}",
    description: "Usuario / identificador principal",
    sourceHint: "creators.username",
    group: "creator",
  },
  {
    column: "creator_first_name",
    expression: "{{ extra.creator.first_name }}",
    description: "Nombre (pila)",
    sourceHint: "creators.first_name → mapeado en extra.creator / extra",
    group: "creator",
  },
  {
    column: "creator_last_name",
    expression: "{{ extra.creator.last_name }}",
    description: "Apellido(s)",
    sourceHint: "creators.last_name",
    group: "creator",
  },
  {
    column: "creator_full_name",
    expression: "{{ extra.creator.full_name }}",
    description: "Nombre completo en fila creador",
    sourceHint: "creators.full_name",
    group: "creator",
  },
  {
    column: "creator_picture",
    expression: "{{ extra.creator.picture }}",
    description: "URL de foto",
    sourceHint: "creators.picture",
    group: "creator",
  },
  {
    column: "personalized_paragraph",
    expression: "{{ extra.personalized_paragraph }}",
    description: "Párrafo personalizado",
    sourceHint: "creators.personalized_paragraph",
    group: "creator",
  },
  {
    column: "first_name_flat",
    expression: "{{ extra.first_name }}",
    description: "Nombre (pila), clave plana legada",
    sourceHint: "Mismo origen que creators.first_name (duplicado en extra para plantillas antiguas)",
    group: "creator",
  },
  {
    column: "category",
    expression: "{{ extra.category }}",
    description: "Categoría / vertical",
    sourceHint: "creators.category",
    group: "creator",
  },
  {
    column: "main_platform",
    expression: "{{ extra.main_platform }}",
    description: "Plataforma principal",
    sourceHint: "creators.main_platform",
    group: "creator",
  },
  {
    column: "main_platform_creator",
    expression: "{{ extra.creator.main_platform }}",
    description: "Plataforma principal (bloque creator)",
    sourceHint: "creators.main_platform",
    group: "creator",
  },
  {
    column: "max_followers",
    expression: "{{ extra.max_followers }}",
    description: "Máximo de seguidores (columna creador)",
    sourceHint: "creators.max_followers",
    group: "creator",
  },
  {
    column: "max_followers_creator",
    expression: "{{ extra.creator.max_followers }}",
    description: "Máximo de seguidores (bloque creator)",
    sourceHint: "creators.max_followers",
    group: "creator",
  },
  {
    column: "ig_followers",
    expression: "{{ extra.account.instagram.followers_count }}",
    description: "Seguidores Instagram",
    sourceHint: "Prod.: account_profiles.followers_count (plataforma Instagram). Prueba: lógica en creators_test",
    group: "account",
  },
  {
    column: "ig_username",
    expression: "{{ extra.account.instagram.username }}",
    description: "Usuario de Instagram",
    sourceHint: "Prod.: account_profiles.username. Prueba: creators_test.instagram_username",
    group: "account",
  },
  {
    column: "ig_url",
    expression: "{{ extra.account.instagram.url }}",
    description: "URL de perfil Instagram",
    sourceHint: "Prod.: account_profiles.url. Prueba: creators_test.instagram_url",
    group: "account",
  },
  {
    column: "tt_followers",
    expression: "{{ extra.account.tiktok.followers_count }}",
    description: "Seguidores TikTok",
    sourceHint: "Prod.: account_profiles (TikTok). Prueba: creators_test",
    group: "account",
  },
  {
    column: "tt_username",
    expression: "{{ extra.account.tiktok.username }}",
    description: "Usuario de TikTok",
    sourceHint: "Prod.: account_profiles. Prueba: creators_test.tiktok_username",
    group: "account",
  },
  {
    column: "yt_followers",
    expression: "{{ extra.account.youtube.followers_count }}",
    description: "Suscriptores / métrica YouTube",
    sourceHint: "Prod.: account_profiles. Prueba: creators_test (mismo campo followers_count en account)",
    group: "account",
  },
  {
    column: "yt_username",
    expression: "{{ extra.account.youtube.username }}",
    description: "Nombre de canal YouTube",
    sourceHint: "Prueba: creators_test.youtube_channel",
    group: "account",
  },
  {
    column: "instagram_followers_flat",
    expression: "{{ extra.instagram_followers }}",
    description: "Atajo numérico seguidores IG",
    sourceHint: "Derivado de account / creators_test; clave plana para plantillas antiguas",
    group: "account",
  },
  {
    column: "handle_instagram_legacy",
    expression: "{{ extra.handle_instagram }}",
    description: "Atajo handle Instagram",
    sourceHint: "Alias de instagram_username en extra",
    group: "account",
  },
  {
    column: "sender_name",
    expression: "{{ sender_name }}",
    description: "Nombre del remitente",
    sourceHint: "Tabla senders / remitente asignado al enviar (no es columna de creador)",
    group: "envio",
  },
];

/** Variables útiles en asunto y preheader (mismo contexto Jinja2 que el cuerpo HTML). */
export const SUBJECT_PREHEADER_SNIPPETS: { label: string; expression: string }[] = [
  { label: "Nombre para mostrar — {{ nombre }}", expression: "{{ nombre }}" },
  { label: "Correo — {{ email }}", expression: "{{ email }}" },
  { label: "Nombre (pila) — {{ extra.creator.first_name }}", expression: "{{ extra.creator.first_name }}" },
  { label: "Apellido — {{ extra.creator.last_name }}", expression: "{{ extra.creator.last_name }}" },
  { label: "Usuario — {{ username }}", expression: "{{ username }}" },
  { label: "Plataforma principal — {{ extra.main_platform }}", expression: "{{ extra.main_platform }}" },
  { label: "Máx. seguidores — {{ extra.max_followers }}", expression: "{{ extra.max_followers }}" },
  { label: "Remitente — {{ sender_name }}", expression: "{{ sender_name }}" },
  { label: "Seguidores IG — {{ extra.account.instagram.followers_count }}", expression: "{{ extra.account.instagram.followers_count }}" },
  { label: "Handle IG — {{ extra.account.instagram.username }}", expression: "{{ extra.account.instagram.username }}" },
];
