import Select, {
  type GroupBase,
  type Props as ReactSelectProps,
  type StylesConfig,
} from "react-select";

/** Opción estándar para selects tipo lista (valor + etiqueta visible). */
export type ListOption = { value: string; label: string };

/** Estilos del panel para reutilizar con `<Select styles={selectListStyles} />` */
export const selectListStyles: StylesConfig<ListOption, false, GroupBase<ListOption>> = {
  control: (base, state) => ({
    ...base,
    minHeight: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: state.isFocused ? "rgb(167 139 250)" : "rgb(226 232 240)",
    backgroundColor: state.isDisabled ? "rgb(248 250 252)" : "rgb(248 250 252 / 0.8)",
    boxShadow: state.isFocused ? "0 0 0 2px rgba(139, 92, 246, 0.18)" : "none",
    "&:hover": {
      borderColor: state.isFocused ? "rgb(167 139 250)" : "rgb(203 213 225)",
    },
  }),
  valueContainer: (base) => ({
    ...base,
    padding: "2px 10px",
  }),
  placeholder: (base) => ({
    ...base,
    color: "rgb(148 163 184)",
    fontSize: "0.875rem",
  }),
  singleValue: (base) => ({
    ...base,
    color: "rgb(15 23 42)",
    fontSize: "0.875rem",
  }),
  input: (base) => ({
    ...base,
    color: "rgb(15 23 42)",
  }),
  menu: (base) => ({
    ...base,
    borderRadius: 10,
    overflow: "hidden",
    border: "1px solid rgb(226 232 240)",
    boxShadow:
      "0 10px 15px -3px rgb(0 0 0 / 0.08), 0 4px 6px -4px rgb(0 0 0 / 0.06)",
    zIndex: 50,
  }),
  menuList: (base) => ({
    ...base,
    padding: 4,
  }),
  option: (base, state) => ({
    ...base,
    borderRadius: 6,
    fontSize: "0.875rem",
    cursor: "pointer",
    backgroundColor: state.isSelected
      ? "rgb(102 65 237 / 0.12)"
      : state.isFocused
        ? "rgb(241 245 249)"
        : "transparent",
    color: state.isSelected ? "rgb(76 29 149)" : "rgb(15 23 42)",
    fontWeight: state.isSelected ? 600 : 400,
  }),
  indicatorSeparator: () => ({
    display: "none",
  }),
  dropdownIndicator: (base, state) => ({
    ...base,
    color: state.isFocused ? "rgb(100 116 139)" : "rgb(148 163 184)",
    "&:hover": { color: "rgb(71 85 105)" },
  }),
  clearIndicator: (base) => ({
    ...base,
    color: "rgb(148 163 184)",
    "&:hover": { color: "rgb(100 116 139)" },
  }),
  menuPortal: (base) => ({ ...base, zIndex: 9999 }),
};

export type SelectListProps = Omit<
  ReactSelectProps<ListOption, false, GroupBase<ListOption>>,
  "styles" | "classNames"
> & {
  /** Fusiona con los estilos por defecto del panel (mapear por nombre de parte). */
  styles?: StylesConfig<ListOption, false, GroupBase<ListOption>>;
};

/**
 * React Select con estilo alineado al dashboard (listas, estados, etc.).
 * @see https://react-select.com/home
 */
export function SelectList(props: SelectListProps) {
  const { styles: stylesProp, menuPortalTarget, ...rest } = props;
  return (
    <Select<ListOption, false, GroupBase<ListOption>>
      classNamePrefix="select-list"
      menuPosition="fixed"
      menuPortalTarget={
        menuPortalTarget !== undefined
          ? menuPortalTarget
          : typeof document !== "undefined"
            ? document.body
            : null
      }
      styles={
        stylesProp
          ? {
              ...selectListStyles,
              ...stylesProp,
            }
          : selectListStyles
      }
      {...rest}
    />
  );
}
