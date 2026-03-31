import type { GroupBase, StylesConfig } from "react-select";

export type SenderSelectOption = { value: string; label: string };

export type ListaTestSelectOption = {
  value: string;
  label: string;
  nombre: string;
  num_creators: number;
};

export type CreatorTestSelectOption = {
  value: string;
  label: string;
  email: string;
  displayName: string;
};

const menuPortal = (base: Record<string, unknown>) => ({ ...base, zIndex: 11000 });

/** Remitentes — chips ámbar */
export const senderMultiSelectStyles: StylesConfig<
  SenderSelectOption,
  true,
  GroupBase<SenderSelectOption>
> = {
  control: (base, state) => ({
    ...base,
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: state.isFocused ? "rgb(245 158 11)" : "rgb(203 213 225)",
    backgroundColor: state.isDisabled ? "rgb(248 250 252)" : "#ffffff",
    boxShadow: state.isFocused ? "0 0 0 2px rgb(251 191 36 / 0.35)" : "none",
    "&:hover": { borderColor: "rgb(148 163 184)" },
  }),
  valueContainer: (base) => ({
    ...base,
    padding: "6px 10px",
    gap: 6,
    flexWrap: "wrap",
  }),
  placeholder: (base) => ({
    ...base,
    color: "rgb(100 116 139)",
    fontSize: "0.875rem",
  }),
  input: (base) => ({
    ...base,
    color: "rgb(15 23 42)",
  }),
  multiValue: (base) => ({
    ...base,
    borderRadius: 9999,
    backgroundColor: "rgb(254 243 199)",
    border: "1px solid rgb(252 211 77)",
  }),
  multiValueLabel: (base) => ({
    ...base,
    color: "rgb(120 53 15)",
    fontWeight: 600,
    fontSize: "0.8125rem",
  }),
  multiValueRemove: (base) => ({
    ...base,
    color: "rgb(146 64 14)",
    ":hover": {
      backgroundColor: "rgb(253 230 138)",
      color: "rgb(120 53 15)",
    },
  }),
  menu: (base) => ({
    ...base,
    borderRadius: 10,
    border: "1px solid rgb(226 232 240)",
    boxShadow: "0 16px 40px -8px rgb(15 23 42 / 0.15)",
    overflow: "hidden",
    zIndex: 1,
  }),
  menuPortal,
  option: (base, state) => ({
    ...base,
    fontSize: "0.875rem",
    cursor: "pointer",
    backgroundColor: state.isSelected
      ? "rgb(254 243 199)"
      : state.isFocused
        ? "rgb(255 251 235)"
        : "transparent",
    color: state.isSelected ? "rgb(120 53 15)" : "rgb(15 23 42)",
    fontWeight: state.isSelected ? 600 : 400,
  }),
  dropdownIndicator: (base, state) => ({
    ...base,
    color: state.isFocused ? "rgb(217 119 6)" : "rgb(148 163 184)",
  }),
  clearIndicator: (base) => ({
    ...base,
    color: "rgb(148 163 184)",
    ":hover": { color: "rgb(217 119 6)" },
  }),
  indicatorSeparator: () => ({ display: "none" }),
};

/** Lista de prueba (listas_test) — acentos violeta */
export const listaTestSingleSelectStyles: StylesConfig<
  ListaTestSelectOption,
  false,
  GroupBase<ListaTestSelectOption>
> = {
  control: (base, state) => ({
    ...base,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: state.isFocused ? "rgb(167 139 250)" : "rgb(203 213 225)",
    backgroundColor: state.isDisabled ? "rgb(248 250 252)" : "#ffffff",
    boxShadow: state.isFocused ? "0 0 0 2px rgb(139 92 246 / 0.22)" : "0 1px 2px rgb(15 23 42 / 0.04)",
    "&:hover": { borderColor: "rgb(196 181 253)" },
  }),
  valueContainer: (base) => ({
    ...base,
    padding: "8px 12px",
  }),
  placeholder: (base) => ({
    ...base,
    color: "rgb(100 116 139)",
    fontSize: "0.875rem",
  }),
  singleValue: (base) => ({
    ...base,
    color: "rgb(15 23 42)",
    fontWeight: 500,
  }),
  input: (base) => ({
    ...base,
    color: "rgb(15 23 42)",
  }),
  menu: (base) => ({
    ...base,
    borderRadius: 12,
    border: "1px solid rgb(221 214 254)",
    boxShadow: "0 18px 44px -12px rgb(15 23 42 / 0.18)",
    overflow: "hidden",
    paddingTop: 4,
    paddingBottom: 4,
  }),
  menuPortal,
  option: (base, state) => ({
    ...base,
    cursor: "pointer",
    padding: "10px 12px",
    backgroundColor: state.isSelected
      ? "rgb(237 233 254)"
      : state.isFocused
        ? "rgb(245 243 255)"
        : "transparent",
    color: state.isSelected ? "rgb(76 29 149)" : "rgb(15 23 42)",
  }),
  dropdownIndicator: (base, state) => ({
    ...base,
    color: state.isFocused ? "rgb(124 58 237)" : "rgb(148 163 184)",
  }),
  clearIndicator: (base) => ({
    ...base,
    color: "rgb(148 163 184)",
    ":hover": { color: "rgb(124 58 237)" },
  }),
  indicatorSeparator: () => ({ display: "none" }),
};

/** Creadores de prueba (creators_test) — chips esmeralda, opciones en dos líneas vía formatOptionLabel */
export const creatorTestMultiSelectStyles: StylesConfig<
  CreatorTestSelectOption,
  true,
  GroupBase<CreatorTestSelectOption>
> = {
  control: (base, state) => ({
    ...base,
    minHeight: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: state.isFocused ? "rgb(52 211 153)" : "rgb(203 213 225)",
    backgroundColor: state.isDisabled ? "rgb(248 250 252)" : "#ffffff",
    boxShadow: state.isFocused ? "0 0 0 2px rgb(16 185 129 / 0.2)" : "0 1px 2px rgb(15 23 42 / 0.04)",
    "&:hover": { borderColor: "rgb(167 243 208)" },
  }),
  valueContainer: (base) => ({
    ...base,
    padding: "8px 10px",
    gap: 6,
    flexWrap: "wrap",
  }),
  placeholder: (base) => ({
    ...base,
    color: "rgb(100 116 139)",
    fontSize: "0.875rem",
  }),
  input: (base) => ({
    ...base,
    color: "rgb(15 23 42)",
  }),
  multiValue: (base) => ({
    ...base,
    borderRadius: 10,
    backgroundColor: "rgb(209 250 229)",
    border: "1px solid rgb(110 231 183)",
  }),
  multiValueLabel: (base) => ({
    ...base,
    color: "rgb(6 78 59)",
    fontWeight: 600,
    fontSize: "0.8125rem",
  }),
  multiValueRemove: (base) => ({
    ...base,
    color: "rgb(5 150 105)",
    borderRadius: "0 8px 8px 0",
    ":hover": {
      backgroundColor: "rgb(167 243 208)",
      color: "rgb(6 78 59)",
    },
  }),
  menu: (base) => ({
    ...base,
    borderRadius: 12,
    border: "1px solid rgb(167 243 208)",
    boxShadow: "0 18px 44px -12px rgb(15 23 42 / 0.16)",
    overflow: "hidden",
    paddingTop: 4,
    paddingBottom: 4,
  }),
  menuPortal,
  option: (base, state) => ({
    ...base,
    cursor: "pointer",
    padding: "10px 12px",
    backgroundColor: state.isSelected
      ? "rgb(209 250 229)"
      : state.isFocused
        ? "rgb(236 253 245)"
        : "transparent",
    color: "rgb(15 23 42)",
  }),
  dropdownIndicator: (base, state) => ({
    ...base,
    color: state.isFocused ? "rgb(16 185 129)" : "rgb(148 163 184)",
  }),
  clearIndicator: (base) => ({
    ...base,
    color: "rgb(148 163 184)",
    ":hover": { color: "rgb(5 150 105)" },
  }),
  indicatorSeparator: () => ({ display: "none" }),
};

export type SnippetVariableOption = {
  value: string;
  label: string;
  expression: string;
};

/** Variables Jinja2 para asunto / preheader — compacto, buscable */
export const snippetVariableSelectStyles: StylesConfig<
  SnippetVariableOption,
  false,
  GroupBase<SnippetVariableOption>
> = {
  control: (base, state) => ({
    ...base,
    minHeight: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: state.isFocused ? "rgb(251 191 36)" : "rgb(226 232 240)",
    backgroundColor: state.isDisabled ? "rgb(248 250 252)" : "rgb(255 251 235)",
    boxShadow: state.isFocused ? "0 0 0 2px rgb(251 191 36 / 0.35)" : "none",
    "&:hover": { borderColor: "rgb(253 224 71)" },
  }),
  valueContainer: (base) => ({
    ...base,
    padding: "2px 8px",
    fontSize: "0.75rem",
  }),
  placeholder: (base) => ({
    ...base,
    color: "rgb(100 116 139)",
    fontSize: "0.75rem",
  }),
  singleValue: (base) => ({
    ...base,
    color: "rgb(15 23 42)",
    fontSize: "0.75rem",
  }),
  input: (base) => ({
    ...base,
    color: "rgb(15 23 42)",
    fontSize: "0.75rem",
  }),
  menu: (base) => ({
    ...base,
    borderRadius: 10,
    border: "1px solid rgb(254 243 199)",
    boxShadow: "0 14px 36px -8px rgb(15 23 42 / 0.14)",
    overflow: "hidden",
    marginTop: 4,
    paddingTop: 4,
    paddingBottom: 4,
  }),
  menuPortal,
  option: (base, state) => ({
    ...base,
    cursor: "pointer",
    padding: "8px 10px",
    fontSize: "0.8125rem",
    backgroundColor: state.isSelected
      ? "rgb(254 243 199)"
      : state.isFocused
        ? "rgb(255 251 235)"
        : "transparent",
    color: "rgb(15 23 42)",
  }),
  dropdownIndicator: (base, state) => ({
    ...base,
    padding: "6px 6px",
    color: state.isFocused ? "rgb(217 119 6)" : "rgb(148 163 184)",
  }),
  clearIndicator: (base) => ({
    ...base,
    padding: "4px 6px",
    color: "rgb(148 163 184)",
    ":hover": { color: "rgb(217 119 6)" },
  }),
  indicatorSeparator: () => ({ display: "none" }),
};

/** Opción genérica para selects del diseñador de QR (modal claro / índigo). */
export type QrDesignerSelectOption = { value: string; label: string };

/** Diseñador QR — single select compacto, texto oscuro legible sobre fondo blanco. */
export const qrDesignerSelectStyles: StylesConfig<
  QrDesignerSelectOption,
  false,
  GroupBase<QrDesignerSelectOption>
> = {
  control: (base, state) => ({
    ...base,
    minHeight: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: state.isFocused ? "rgb(99 102 241)" : "rgb(203 213 225)",
    backgroundColor: state.isDisabled ? "rgb(248 250 252)" : "#ffffff",
    boxShadow: state.isFocused ? "0 0 0 2px rgb(99 102 241 / 0.22)" : "0 1px 2px rgb(15 23 42 / 0.04)",
    "&:hover": { borderColor: "rgb(165 180 252)" },
  }),
  valueContainer: (base) => ({
    ...base,
    padding: "6px 10px",
  }),
  placeholder: (base) => ({
    ...base,
    color: "rgb(100 116 139)",
    fontSize: "0.875rem",
  }),
  singleValue: (base) => ({
    ...base,
    color: "rgb(15 23 42)",
    fontWeight: 500,
  }),
  input: (base) => ({
    ...base,
    color: "rgb(15 23 42)",
  }),
  menu: (base) => ({
    ...base,
    borderRadius: 10,
    border: "1px solid rgb(199 210 254)",
    boxShadow: "0 18px 44px -12px rgb(15 23 42 / 0.18)",
    overflow: "hidden",
    paddingTop: 4,
    paddingBottom: 4,
  }),
  menuPortal,
  option: (base, state) => ({
    ...base,
    cursor: "pointer",
    padding: "8px 12px",
    fontSize: "0.875rem",
    backgroundColor: state.isSelected
      ? "rgb(224 231 255)"
      : state.isFocused
        ? "rgb(238 242 255)"
        : "transparent",
    color: state.isSelected ? "rgb(49 46 129)" : "rgb(15 23 42)",
  }),
  dropdownIndicator: (base, state) => ({
    ...base,
    color: state.isFocused ? "rgb(79 70 229)" : "rgb(148 163 184)",
  }),
  clearIndicator: (base) => ({
    ...base,
    color: "rgb(148 163 184)",
    ":hover": { color: "rgb(79 70 229)" },
  }),
  indicatorSeparator: () => ({ display: "none" }),
};
