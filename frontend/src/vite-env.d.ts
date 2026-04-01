/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  /** URL de inserción del vídeo de bienvenida en Documentación (p. ej. YouTube nocookie embed) */
  readonly VITE_DOCS_WELCOME_VIDEO_EMBED?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
