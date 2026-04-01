export type DocBlock =
  | { type: "paragraph"; text: string }
  | { type: "steps"; title?: string; items: string[] }
  | { type: "warning"; title?: string; text: string }
  | { type: "note"; text: string }
  | { type: "heading"; level: 2 | 3; text: string }
  | { type: "table"; headers: string[]; rows: string[][] }
  | {
      type: "media";
      image?: string;
      imageAlt?: string;
      caption?: string;
      videoEmbedUrl?: string;
      videoTitle?: string;
    };

export type DocSectionMeta = {
  slug: string;
  title: string;
  description: string;
  /** Imagen opcional para tarjeta del índice (ruta bajo /public) */
  cardImage?: string;
};

export type DocSection = DocSectionMeta & {
  blocks: DocBlock[];
};
