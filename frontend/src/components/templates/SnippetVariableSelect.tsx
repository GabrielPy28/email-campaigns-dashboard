import { useMemo, useState } from "react";
import Select, {
  type FormatOptionLabelMeta,
  type GroupBase,
} from "react-select";
import { SUBJECT_PREHEADER_SNIPPETS } from "../../lib/templateVariables";
import {
  snippetVariableSelectStyles,
  type SnippetVariableOption,
} from "./templateTestSendSelectStyles";

type Props = {
  disabled?: boolean;
  onInsert: (snippet: string) => void;
  instanceId: string;
};

/**
 * Inserta expresiones Jinja2 en asunto/preheader (mismo contexto que el cuerpo del correo).
 */
export function SnippetVariableSelect({ disabled = false, onInsert, instanceId }: Props) {
  const options = useMemo<SnippetVariableOption[]>(
    () =>
      SUBJECT_PREHEADER_SNIPPETS.map((s) => ({
        value: s.expression,
        label: s.label,
        expression: s.expression,
      })),
    []
  );
  const [value, setValue] = useState<SnippetVariableOption | null>(null);

  return (
    <div className="mt-1.5">
      <Select<SnippetVariableOption, false, GroupBase<SnippetVariableOption>>
        inputId={`${instanceId}-input`}
        instanceId={instanceId}
        options={options}
        value={value}
        onChange={(opt) => {
          if (opt) {
            onInsert(opt.expression);
            setValue(null);
          }
        }}
        placeholder="Buscar o insertar variable"
        isDisabled={disabled}
        isSearchable
        isClearable
        blurInputOnSelect
        menuPortalTarget={typeof document !== "undefined" ? document.body : null}
        menuPosition="fixed"
        styles={snippetVariableSelectStyles}
        formatOptionLabel={(data: SnippetVariableOption, meta: FormatOptionLabelMeta<SnippetVariableOption>) => {
          if (meta.context === "value") {
            return (
              <span className="truncate font-mono text-xs text-slate-800" title={data.expression}>
                {data.expression}
              </span>
            );
          }
          return (
            <div className="text-left">
              <div className="text-sm leading-snug text-slate-800">{data.label}</div>
              <div className="mt-0.5 font-mono text-[11px] leading-tight text-amber-900/90">{data.expression}</div>
            </div>
          );
        }}
        noOptionsMessage={({ inputValue }) =>
          inputValue ? `Sin coincidencias para “${inputValue}”` : "Sin variables"
        }
      />
    </div>
  );
}
