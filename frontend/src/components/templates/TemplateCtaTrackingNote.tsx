/**
 * Buenas prácticas alineadas con el inyector de tracking (data-button-id en enlaces).
 * Ver app/emails/template_renderer.py
 */
export function TemplateCtaTrackingNote() {
  return (
    <aside className="rounded-xl border border-teal-200/80 bg-gradient-to-br from-teal-50/60 via-white to-slate-50/40 p-4 shadow-sm ring-1 ring-teal-100/70">
      <h3 className="text-sm font-semibold text-teal-950 mb-2">CTAs y seguimiento de clics</h3>
      <p className="text-xs text-slate-700 leading-relaxed mb-3">
        Para medir qué enlaces o botones reciben clics en reportes de campaña, el HTML inyecta el seguimiento usando el
        atributo <code className="text-teal-900 bg-teal-100/80 px-1 rounded">data-button-id</code>. Colócalo en cada{" "}
        <span className="font-medium text-slate-800">&lt;a&gt;</span> (o elemento envuelto por el tracker) que quieras
        identificar de forma independiente.
      </p>
      <ul className="text-xs text-slate-700 space-y-1.5 list-disc pl-4 mb-3 leading-relaxed">
        <li>
          Usa un id <span className="font-medium text-slate-800">estable y único</span> por acción (p. ej.{" "}
          <code className="text-[11px] bg-slate-100 px-1 rounded">nombre_boton</code>,{" "}
          <code className="text-[11px] bg-slate-100 px-1 rounded">hero-cta-registro</code>,{" "}
          <code className="text-[11px] bg-slate-100 px-1 rounded">footer-unsubscribe</code>).
        </li>
        <li>
          Evita repetir el mismo <code className="text-[11px] bg-slate-100 px-1 rounded">data-button-id</code> en dos
          CTAs distintos de la misma plantilla.
        </li>
        <li>
          Prefiere <span className="font-medium text-slate-800">intel-cores</span> o{" "}
          <span className="font-medium text-slate-800">ryzen_cores</span>; sin espacios.
        </li>
        <li>Los enlaces sin este atributo siguen registrando clics como URL genérica, sin desglose por botón.</li>
      </ul>
      <p className="text-[11px] font-medium text-slate-600 mb-1.5">Ejemplo</p>
      <pre className="text-[11px] leading-relaxed bg-slate-900/95 text-slate-100 rounded-lg p-3 overflow-x-auto border border-slate-700/80">
{`<a href="https://ejemplo.com/oferta"
   target="_blank"
   data-button-id="cta_oferta_principal"
   style="...">
  Ver oferta
</a>`}
      </pre>
    </aside>
  );
}
