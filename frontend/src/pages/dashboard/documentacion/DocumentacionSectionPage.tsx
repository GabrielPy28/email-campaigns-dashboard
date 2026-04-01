import { Navigate, useParams } from "react-router-dom";
import { getDocSectionBySlug } from "./content";
import { DocBlockRenderer } from "./DocBlockRenderer";

export function DocumentacionSectionPage() {
  const { slug } = useParams<{ slug: string }>();
  const section = slug ? getDocSectionBySlug(slug) : undefined;

  if (!section) {
    return <Navigate to="/dashboard/documentacion" replace />;
  }

  return (
    <div>
      <header className="mb-8 border-b border-slate-100 pb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          {section.title}
        </h1>
        <p className="mt-3 max-w-3xl text-base leading-relaxed text-slate-600">
          {section.description}
        </p>
      </header>
      <DocBlockRenderer blocks={section.blocks} />
    </div>
  );
}
