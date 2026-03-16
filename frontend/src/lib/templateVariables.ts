/**
 * Variables disponibles en las plantillas de correo (Jinja2).
 * La mayoría coinciden con las columnas del archivo de destinatarios (CSV/Excel).
 * sender_name no viene del CSV: se asigna al enviar (remitente round-robin).
 */
export const TEMPLATE_VARIABLES: { column: string; expression: string; description: string }[] = [
  { column: "email", expression: "{{ email }}", description: "Correo del destinatario" },
  { column: "first_name", expression: "{{ extra.first_name }}", description: "Nombre (pila)" },
  { column: "last_name", expression: "{{ extra.last_name }}", description: "Apellido" },
  { column: "nombre", expression: "{{ nombre }}", description: "Nombre completo (Nombre & Apellido)" },
  { column: "username", expression: "{{ username }}", description: "Usuario / identificador" },
  { column: "handle_instagram", expression: "{{ extra.handle_instagram }}", description: "Usuario de Instagram" },
  { column: "handle_tiktok", expression: "{{ extra.handle_tiktok }}", description: "Usuario de TikTok" },
  { column: "youtube_channel", expression: "{{ extra.youtube_channel }}", description: "Canal de YouTube" },
  { column: "youtube_url", expression: "{{ extra.youtube_url }}", description: "URL del canal YouTube" },
  { column: "vertical", expression: "{{ extra.vertical }}", description: "Vertical / categoría" },
  {
    column: "sender_name",
    expression: "{{ sender_name }}",
    description: "Nombre del remitente (asignado al enviar la campaña)",
  },
  { column: "instagram_followers", expression: "{{ extra.instagram_followers }}", description: "Seguidores Instagram" },
  { column: "tiktok_followers", expression: "{{ extra.tiktok_followers }}", description: "Seguidores TikTok" },
  { column: "youtube_subscribers", expression: "{{ extra.youtube_subscribers }}", description: "Suscriptores YouTube" },
];
