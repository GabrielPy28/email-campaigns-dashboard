import {
  TEMPLATE_VARIABLES,
  TEMPLATE_VARIABLE_GROUP_LABELS,
  TEMPLATE_VARIABLE_GROUP_ORDER,
  type TemplateVariableGroup,
} from "../../lib/templateVariables";

type Props = {
  onInsert: (expression: string) => void;
  /** Clases del contenedor exterior (p. ej. en columna lateral). */
  className?: string;
  /** Altura máxima del listado de variables (scroll interno). */
  scrollMaxHeightClassName?: string;
};

export function TemplateVariablePicker({
  onInsert,
  className = "",
  scrollMaxHeightClassName = "max-h-[min(28rem,50vh)]",
}: Props) {
  const byGroup = TEMPLATE_VARIABLE_GROUP_ORDER.reduce(
    (acc, g) => {
      acc[g] = TEMPLATE_VARIABLES.filter((v) => v.group === g);
      return acc;
    },
    {} as Record<TemplateVariableGroup, typeof TEMPLATE_VARIABLES>
  );

  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col min-h-0 min-w-0 ${className}`.trim()}
    >
      <p className="text-sm font-semibold text-slate-800 mb-2">Etiquetas de contenido dinámico</p>
      <p className="text-sm text-slate-600 mb-3 leading-relaxed">
        El origen de los datos son las tablas{" "}
        <span className="font-medium text-slate-800">creators</span> /{" "}
        <span className="font-medium text-slate-800">creators_test</span> y, para métricas por red,{" "}
        <span className="font-medium text-slate-800">account_profiles</span> (en prueba, columnas equivalentes en{" "}
        <span className="font-medium text-slate-800">creators_test</span>). El backend vuelca esos valores en el
        destinatario y en plantillas se accede como <code className="text-violet-700 bg-violet-50 px-1 rounded text-xs">extra</code>{" "}
        (es el objeto serializado en envío, no un origen distinto de la base de datos).
      </p>
      <p className="text-sm text-slate-600 mb-3 leading-relaxed">
        Haz clic en una fila para insertar la etiqueta donde tengas el cursor en el editor. Cada fila indica de qué
        columna o tabla proviene el valor.
      </p>
      <div className={`space-y-4 overflow-y-auto pr-1 min-h-0 flex-1 ${scrollMaxHeightClassName}`}>
        {TEMPLATE_VARIABLE_GROUP_ORDER.map((gid) => (
          <div key={gid}>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
              {TEMPLATE_VARIABLE_GROUP_LABELS[gid]}
            </p>
            <ul className="rounded-lg border border-slate-200 bg-slate-50/50 overflow-hidden divide-y divide-slate-200">
              {byGroup[gid].map((v) => (
                <li key={v.column}>
                  <button
                    type="button"
                    onClick={() => onInsert(v.expression)}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-violet-50/80 transition-colors group"
                  >
                    <span className="min-w-0 text-left">
                      <span className="text-slate-700 group-hover:text-violet-800 block">{v.description}</span>
                      {v.sourceHint ? (
                        <span className="text-[11px] text-slate-500 leading-snug block mt-0.5">{v.sourceHint}</span>
                      ) : null}
                    </span>
                    <code className="text-xs font-mono text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded shrink-0 max-w-[55%] truncate">
                      {v.expression}
                    </code>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
