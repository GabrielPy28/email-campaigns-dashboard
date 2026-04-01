import { useState } from "react";
import { HiOutlinePhoto, HiOutlinePlayCircle } from "react-icons/hi2";
import { cn } from "../../../lib/utils";
import type { DocBlock } from "./types";

function DocMediaBlock({
  image,
  imageAlt,
  caption,
  videoEmbedUrl,
  videoTitle,
}: Extract<DocBlock, { type: "media" }>) {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <figure
      className={cn(
        "my-8 overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm shadow-slate-200/50"
      )}
    >
      {videoEmbedUrl ? (
        <div className="relative aspect-video bg-slate-900">
          <iframe
            src={videoEmbedUrl}
            title={videoTitle || "Vídeo"}
            className="absolute inset-0 h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : image && !imgFailed ? (
        <div className="bg-slate-50/80">
          <img
            src={image}
            alt={imageAlt || ""}
            className="mx-auto max-h-[420px] w-full object-contain"
            onError={() => setImgFailed(true)}
          />
        </div>
      ) : (
        <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 bg-gradient-to-br from-indigo-50/90 via-white to-violet-50/80 px-8 py-12 text-center">
          {image ? (
            <HiOutlinePhoto className="h-12 w-12 text-slate-300" aria-hidden />
          ) : (
            <HiOutlinePlayCircle className="h-12 w-12 text-slate-300" aria-hidden />
          )}
          <p className="max-w-md text-sm leading-relaxed text-slate-600">
            {image && imgFailed
              ? "No se encontró la imagen. Coloque el archivo en public/docs/ con la ruta indicada en la documentación."
              : "Aquí puede mostrarse una imagen o vídeo. Añada archivos en la carpeta public/docs/ o configure VITE_DOCS_WELCOME_VIDEO_EMBED para el vídeo de bienvenida."}
          </p>
        </div>
      )}
      {caption ? (
        <figcaption className="border-t border-slate-100 bg-slate-50/90 px-4 py-3 text-center text-xs text-slate-600">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}

export function DocBlockRenderer({ blocks }: { blocks: DocBlock[] }) {
  return (
    <div className="space-y-6">
      {blocks.map((block, i) => {
        const key = `${block.type}-${i}`;
        switch (block.type) {
          case "paragraph":
            return (
              <p key={key} className="text-[15px] leading-relaxed text-slate-700">
                {block.text}
              </p>
            );
          case "heading":
            return block.level === 2 ? (
              <h2
                key={key}
                className="scroll-mt-24 border-b border-slate-200/80 pb-2 text-lg font-semibold text-slate-900"
              >
                {block.text}
              </h2>
            ) : (
              <h3 key={key} className="scroll-mt-24 text-base font-semibold text-slate-800">
                {block.text}
              </h3>
            );
          case "steps":
            return (
              <div key={key} className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm">
                {block.title ? (
                  <p className="mb-3 text-sm font-semibold text-slate-900">{block.title}</p>
                ) : null}
                <ol className="list-decimal space-y-2.5 pl-5 text-[15px] leading-relaxed text-slate-700 marker:text-indigo-600">
                  {block.items.map((item, j) => (
                    <li key={j}>{item}</li>
                  ))}
                </ol>
              </div>
            );
          case "warning":
            return (
              <div
                key={key}
                role="alert"
                className="rounded-2xl border border-amber-200/90 bg-amber-50/95 p-4 shadow-sm"
              >
                <p className="text-sm font-semibold text-amber-900">
                  {block.title || "Advertencia"}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-amber-950/90">{block.text}</p>
              </div>
            );
          case "note":
            return (
              <div
                key={key}
                className="rounded-2xl border border-sky-200/80 bg-sky-50/90 p-4 text-sm leading-relaxed text-sky-950/90"
              >
                <span className="font-semibold text-sky-900">Nota. </span>
                {block.text}
              </div>
            );
          case "table":
            return (
              <div
                key={key}
                className="overflow-x-auto rounded-2xl border border-slate-200/90 bg-white shadow-sm"
              >
                <table className="w-full min-w-[480px] text-left text-sm text-slate-700">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/95">
                      {block.headers.map((h, j) => (
                        <th key={j} className="px-4 py-3 font-semibold text-slate-900">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, ri) => (
                      <tr key={ri} className="border-b border-slate-100 last:border-0">
                        {row.map((cell, ci) => (
                          <td key={ci} className="px-4 py-2.5 align-top">
                            {cell.startsWith("http") ? (
                              <a
                                href={cell}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="break-all text-indigo-600 underline decoration-indigo-200 underline-offset-2 hover:text-indigo-800"
                              >
                                {cell}
                              </a>
                            ) : (
                              cell
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case "media":
            return <DocMediaBlock key={key} {...block} />;
          default:
            return null;
        }
      })}
    </div>
  );
}
