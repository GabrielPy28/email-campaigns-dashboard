import {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
  useId,
  type FormEvent,
  type ReactNode,
} from "react";
import type { StylesConfig } from "react-select";
import { SiInstagram, SiTiktok, SiYoutube } from "react-icons/si";
import Select from "react-select";
import type {
  ActionMeta,
  GroupBase,
  MultiValue,
  OnChangeValue,
  SingleValue,
} from "react-select";
import { cn } from "../../lib/utils";
import { AvatarWithFallback } from "../../components/AvatarWithFallback";
import { selectListStyles, type ListOption } from "../../components/ui/select-list";
import {
  fetchCreatorsPage,
  fetchCreatorsTestPage,
  fetchCreator,
  fetchCreatorTest,
  fetchPlatforms,
  fetchListas,
  fetchListasTest,
  createLista,
  createListaTest,
  linkCreatorToLista,
  linkCreatorToListaTest,
  registerCreator,
  registerCreatorTest,
  updateCreator,
  updateCreatorTest,
  deleteCreator,
  deleteCreatorTest,
  uploadCreatorsFile,
  uploadCreatorsFileTest,
  type CreatorRead,
  type CreatorListFilters,
  type CreatorCreatePayload,
  type ListaRead,
  type PlatformRead,
} from "../../lib/api";
import {
  downloadCreadoresPlantillaCsv,
  downloadCreadoresPlantillaXlsx,
} from "../../lib/creadoresBulkLayout";
import {
  downloadCreatorsSelectionCsv,
  downloadCreatorsSelectionXlsx,
} from "../../lib/creadoresExport";
import Swal from "sweetalert2";
import {
  HiOutlineChevronDown,
  HiOutlineChevronLeft,
  HiOutlineChevronRight,
  HiOutlineArrowDownTray,
  HiOutlineUserPlus,
  HiOutlinePencilSquare,
  HiOutlineTrash,
  HiOutlineFunnel,
  HiOutlineInformationCircle,
  HiOutlineMagnifyingGlass,
  HiOutlinePlus,
  HiOutlinePlusCircle,
  HiOutlineXMark,
  HiOutlineEnvelope,
  HiOutlineUser,
  HiOutlinePhoto,
  HiOutlineTag,
} from "react-icons/hi2";

type CreatorRow = {
  id: string;
  picture: string | null;
  fullName: string;
  email: string;
  username: string;
  mainPlatforme: string;
  status: "activo" | "inactivo";
  numCampaigns: number;
};

function inferMainPlatform(c: CreatorRead): string {
  const mp = (c.main_platform ?? "").trim();
  if (mp) return mp;
  const t = (s: string | null | undefined) => !!s?.trim();
  if (t(c.tiktok_url) || t(c.tiktok_username)) return "TikTok";
  if (t(c.instagram_url) || t(c.instagram_username)) return "Instagram";
  if (t(c.youtube_channel_url) || t(c.youtube_channel)) return "YouTube";
  if (t(c.facebook_page)) return "Facebook";
  return "—";
}

function displayFullName(c: CreatorRead): string {
  if (c.full_name?.trim()) return c.full_name.trim();
  const parts = [c.first_name, c.last_name].filter(Boolean).join(" ").trim();
  if (parts) return parts;
  return c.email;
}

function normalizeStatus(s: string): CreatorRow["status"] {
  return s === "inactivo" ? "inactivo" : "activo";
}

function creatorReadToRow(c: CreatorRead): CreatorRow {
  const u = (c.username || "").trim();
  return {
    id: c.id,
    picture: c.picture,
    fullName: displayFullName(c),
    email: c.email,
    username: u ? u.replace(/^@/, "") : "—",
    mainPlatforme: inferMainPlatform(c),
    status: normalizeStatus(c.status),
    numCampaigns: c.num_campaigns,
  };
}

const FILTER_FIELDS = [
  { key: "id", label: "ID", placeholder: "UUID o fragmento" },
  { key: "email", label: "Email", placeholder: "correo@..." },
  { key: "nombre", label: "Nombre", placeholder: "Nombre" },
  { key: "apellido", label: "Apellido", placeholder: "Apellido" },
  { key: "username", label: "Username", placeholder: "@usuario" },
  { key: "facebook_page", label: "Facebook page", placeholder: "Página o URL" },
] as const;

type FilterFieldKey = (typeof FILTER_FIELDS)[number]["key"];

const FIELD_TO_API: Record<FilterFieldKey, keyof CreatorListFilters> = {
  id: "id_contains",
  email: "email_contains",
  nombre: "first_name_contains",
  apellido: "last_name_contains",
  username: "username_contains",
  facebook_page: "facebook_page_contains",
};

const STATUS_FILTER_OPTIONS: ListOption[] = [
  { value: "activo", label: "Activo" },
  { value: "inactivo", label: "Inactivo" },
];

const LISTA_STATUS_MODAL: ListOption[] = [
  { value: "activo", label: "Activa" },
  { value: "inactivo", label: "Inactiva" },
];

/** Chips del multiselect de plataformas (filtro): colores por marca, resto tema violeta. */
function platformFilterChipStyle(label: string): {
  backgroundColor: string;
  borderColor: string;
  color: string;
  removeHoverBg: string;
} {
  const n = label.toLowerCase();
  if (n.includes("instagram")) {
    return {
      backgroundColor: "rgb(253 242 248)",
      borderColor: "rgb(244 114 182)",
      color: "rgb(131 24 67)",
      removeHoverBg: "rgb(251 207 232)",
    };
  }
  if (n.includes("tiktok")) {
    return {
      backgroundColor: "rgb(30 41 59)",
      borderColor: "rgb(51 65 85)",
      color: "rgb(255 255 255)",
      removeHoverBg: "rgb(51 65 85)",
    };
  }
  if (n.includes("youtube")) {
    return {
      backgroundColor: "rgb(254 226 226)",
      borderColor: "rgb(248 113 113)",
      color: "rgb(127 29 29)",
      removeHoverBg: "rgb(252 165 165)",
    };
  }
  if (n.includes("facebook")) {
    return {
      backgroundColor: "rgb(239 246 255)",
      borderColor: "rgb(96 165 250)",
      color: "rgb(30 64 175)",
      removeHoverBg: "rgb(191 219 254)",
    };
  }
  return {
    backgroundColor: "rgb(237 233 254)",
    borderColor: "rgb(167 139 250)",
    color: "rgb(76 29 149)",
    removeHoverBg: "rgb(221 214 254)",
  };
}

const creatorsFilterStatusStyles: StylesConfig<
  ListOption,
  false,
  GroupBase<ListOption>
> = {
  ...selectListStyles,
  control: (base, state) => ({
    ...(typeof selectListStyles.control === "function"
      ? selectListStyles.control(base, state)
      : base),
    minHeight: 44,
    borderRadius: 12,
    borderColor: state.isFocused ? "rgb(167 139 250)" : "rgb(199 210 254)",
    backgroundColor: "#ffffff",
    backgroundImage:
      "linear-gradient(180deg, rgb(255 255 255) 0%, rgb(250 245 255) 100%)",
    boxShadow: state.isFocused
      ? "0 0 0 2px rgba(139, 92, 246, 0.22)"
      : "0 1px 3px rgb(15 23 42 / 0.06)",
  }),
  singleValue: (base, props) => ({
    ...base,
    fontWeight: 700,
    fontSize: "0.875rem",
    letterSpacing: "-0.01em",
    color:
      props.data.value === "activo"
        ? "rgb(5 122 85)"
        : props.data.value === "inactivo"
          ? "rgb(71 85 105)"
          : "rgb(15 23 42)",
  }),
  placeholder: (base) => ({
    ...base,
    color: "rgb(148 163 184)",
    fontSize: "0.875rem",
  }),
  dropdownIndicator: (base, state) => ({
    ...base,
    color: state.isFocused ? "rgb(102 65 237)" : "rgb(139 92 246)",
    "&:hover": { color: "rgb(91 33 182)" },
  }),
  clearIndicator: (base) => ({
    ...base,
    color: "rgb(148 163 184)",
    "&:hover": { color: "rgb(102 65 237)" },
  }),
  menu: (base) => ({
    ...base,
    borderRadius: 12,
    border: "1px solid rgb(221 214 254)",
    boxShadow:
      "0 16px 32px -8px rgb(15 23 42 / 0.12), 0 4px 12px -4px rgb(15 23 42 / 0.08)",
    overflow: "hidden",
  }),
  option: (base, state) => ({
    ...base,
    borderRadius: 8,
    margin: "2px 4px",
    fontSize: "0.875rem",
    cursor: "pointer",
    backgroundColor: state.isSelected
      ? "rgb(237 233 254)"
      : state.isFocused
        ? "rgb(245 243 255)"
        : "transparent",
    color: state.isSelected
      ? "rgb(76 29 149)"
      : state.data.value === "activo"
        ? "rgb(5 122 85)"
        : "rgb(71 85 105)",
    fontWeight: state.isSelected ? 700 : 600,
  }),
  menuPortal: (base) => ({ ...base, zIndex: 10000 }),
};

const creatorsFilterPlatformMultiStyles = {
  ...selectListStyles,
  control: (base: Record<string, unknown>, state: { isDisabled?: boolean; isFocused?: boolean }) => ({
    ...(typeof selectListStyles.control === "function"
      ? (selectListStyles.control as (b: typeof base, s: unknown) => typeof base)(
          base,
          state
        )
      : base),
    minHeight: 48,
    minWidth: "100%",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: state.isFocused ? "rgb(167 139 250)" : "rgb(199 210 254)",
    backgroundColor: "#ffffff",
    backgroundImage:
      "linear-gradient(180deg, rgb(255 255 255) 0%, rgb(248 250 252) 55%, rgb(250 245 255) 100%)",
    boxShadow: state.isFocused
      ? "0 0 0 2px rgba(139, 92, 246, 0.2)"
      : "0 1px 3px rgb(15 23 42 / 0.06)",
  }),
  valueContainer: (base: Record<string, unknown>) => ({
    ...base,
    padding: "6px 10px",
    gap: 6,
    flexWrap: "wrap",
  }),
  placeholder: (base: Record<string, unknown>) => ({
    ...base,
    color: "rgb(100 116 139)",
    fontSize: "0.875rem",
  }),
  multiValue: (base: Record<string, unknown>, state: { data: ListOption }) => {
    const chip = platformFilterChipStyle(state.data.label);
    return {
      ...base,
      borderRadius: 9999,
      padding: "2px 2px 2px 10px",
      backgroundColor: chip.backgroundColor,
      border: `1px solid ${chip.borderColor}`,
      boxShadow: "0 1px 2px rgb(15 23 42 / 0.06)",
    };
  },
  multiValueLabel: (base: Record<string, unknown>, state: { data: ListOption }) => {
    const chip = platformFilterChipStyle(state.data.label);
    return {
      ...base,
      color: chip.color,
      fontWeight: 600,
      fontSize: "0.8125rem",
      paddingRight: 4,
    };
  },
  multiValueRemove: (base: Record<string, unknown>, state: { data: ListOption }) => {
    const chip = platformFilterChipStyle(state.data.label);
    return {
      ...base,
      color: chip.color,
      borderRadius: "0 9999px 9999px 0",
      "&:hover": {
        backgroundColor: chip.removeHoverBg,
        color: chip.color,
      },
    };
  },
  menu: (base: Record<string, unknown>) => ({
    ...base,
    borderRadius: 12,
    border: "1px solid rgb(221 214 254)",
    boxShadow:
      "0 16px 32px -8px rgb(15 23 42 / 0.12), 0 4px 12px -4px rgb(15 23 42 / 0.08)",
    overflow: "hidden",
  }),
  option: (base: Record<string, unknown>, state: { isSelected?: boolean; isFocused?: boolean }) => ({
    ...base,
    borderRadius: 8,
    margin: "2px 4px",
    fontSize: "0.875rem",
    cursor: "pointer",
    backgroundColor: state.isSelected
      ? "rgb(237 233 254)"
      : state.isFocused
        ? "rgb(245 243 255)"
        : "transparent",
    color: state.isSelected ? "rgb(76 29 149)" : "rgb(15 23 42)",
    fontWeight: state.isSelected ? 700 : 500,
  }),
  dropdownIndicator: (base: Record<string, unknown>, state: { isFocused?: boolean }) => ({
    ...base,
    color: state.isFocused ? "rgb(102 65 237)" : "rgb(139 92 246)",
  }),
  clearIndicator: (base: Record<string, unknown>) => ({
    ...base,
    color: "rgb(148 163 184)",
    ":hover": { color: "rgb(102 65 237)" },
  }),
  indicatorSeparator: () => ({ display: "none" }),
  menuPortal: (base: Record<string, unknown>) => ({ ...base, zIndex: 10000 }),
} as StylesConfig<ListOption, true, GroupBase<ListOption>>;

const registerModalSelectStyles: StylesConfig<
  ListOption,
  false,
  GroupBase<ListOption>
> = {
  ...selectListStyles,
  control: (base, state) => ({
    ...(typeof selectListStyles.control === "function"
      ? selectListStyles.control(base, state)
      : base),
    backgroundColor: state.isDisabled ? "rgb(248 250 252)" : "#ffffff",
    minHeight: 42,
  }),
  menuPortal: (base) => ({ ...base, zIndex: 10000 }),
};

type CategoryOption = ListOption & { isFixed?: boolean };

/** Etiquetas cortas */
const CATEGORY_OPTIONS: CategoryOption[] = [
  { value: "general", label: "General" },
  { value: "gaming", label: "Gaming" },
  { value: "lifestyle", label: "Estilo de vida" },
  { value: "beauty", label: "Belleza personal" },
  { value: "tech", label: "Reseñas tech" },
  { value: "food", label: "Comida y recetas" },
  { value: "fitness", label: "Salud y fitness" },
  { value: "music", label: "Música" },
  { value: "comedy", label: "Humor" },
  { value: "education", label: "Educación" },
];

function orderCategoryOptions(values: readonly CategoryOption[]): CategoryOption[] {
  const order = new Map(CATEGORY_OPTIONS.map((c, i) => [c.value, i]));
  return [...values].sort(
    (a, b) => (order.get(a.value) ?? 999) - (order.get(b.value) ?? 999)
  );
}

const categoryMultiSelectStyles = {
  ...selectListStyles,
  control: (base: Record<string, unknown>, state: { isDisabled?: boolean; isFocused?: boolean }) => ({
    ...(typeof selectListStyles.control === "function"
      ? (selectListStyles.control as (b: typeof base, s: unknown) => typeof base)(
          base,
          state
        )
      : base),
    minHeight: 52,
    minWidth: "100%",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: state.isFocused ? "rgb(167 139 250)" : "rgb(221 214 254)",
    backgroundColor: state.isDisabled ? "rgb(248 250 252)" : "rgba(255,255,255,0.95)",
    boxShadow: state.isFocused ? "0 0 0 2px rgba(139, 92, 246, 0.18)" : "inset 0 1px 2px rgb(0 0 0 / 0.04)",
  }),
  valueContainer: (base: Record<string, unknown>) => ({
    ...base,
    padding: "8px 10px",
    gap: 6,
    flexWrap: "wrap",
  }),
  placeholder: (base: Record<string, unknown>) => ({
    ...base,
    color: "rgb(148 163 184)",
    fontSize: "0.875rem",
  }),
  multiValue: (base: Record<string, unknown>, state: { data: CategoryOption }) => ({
    ...base,
    borderRadius: 9999,
    padding: "2px 2px 2px 8px",
    backgroundColor: state.data.isFixed ? "rgb(71 85 105)" : "rgb(237 233 254)",
    border: state.data.isFixed
      ? "1px solid rgb(100 116 139)"
      : "1px solid rgb(196 181 253)",
  }),
  multiValueLabel: (base: Record<string, unknown>, state: { data: CategoryOption }) => ({
    ...base,
    color: state.data.isFixed ? "white" : "rgb(76 29 149)",
    fontWeight: state.data.isFixed ? 600 : 500,
    fontSize: "0.8125rem",
    paddingRight: state.data.isFixed ? 6 : 2,
  }),
  multiValueRemove: (base: Record<string, unknown>, state: { data: CategoryOption }) =>
    state.data.isFixed
      ? { ...base, display: "none" }
      : { ...base, color: "rgb(107 33 168)", ":hover": { backgroundColor: "rgb(221 214 254)" } },
  menuPortal: (base: Record<string, unknown>) => ({ ...base, zIndex: 10000 }),
  menu: (base: Record<string, unknown>) => ({
    ...base,
    borderRadius: 12,
    overflow: "hidden",
    border: "1px solid rgb(221 214 254)",
    boxShadow:
      "0 20px 25px -5px rgb(0 0 0 / 0.08), 0 8px 10px -6px rgb(0 0 0 / 0.06)",
  }),
  option: (base: Record<string, unknown>, state: { isSelected?: boolean; isFocused?: boolean }) => ({
    ...base,
    borderRadius: 8,
    fontSize: "0.875rem",
    cursor: "pointer",
    backgroundColor: state.isSelected
      ? "rgb(102 65 237 / 0.12)"
      : state.isFocused
        ? "rgb(245 243 255)"
        : "transparent",
    color: state.isSelected ? "rgb(76 29 149)" : "rgb(15 23 42)",
    fontWeight: state.isSelected ? 600 : 400,
  }),
  dropdownIndicator: (base: Record<string, unknown>, state: { isFocused?: boolean }) => ({
    ...base,
    color: state.isFocused ? "rgb(102 65 237)" : "rgb(167 139 250)",
  }),
  clearIndicator: (base: Record<string, unknown>) => ({
    ...base,
    color: "rgb(148 163 184)",
    ":hover": { color: "rgb(100 116 139)" },
  }),
  indicatorSeparator: () => ({ display: "none" }),
} as StylesConfig<CategoryOption, true, GroupBase<CategoryOption>>;

function StatusBadge({ status }: { status: CreatorRow["status"] }) {
  const styles = {
    activo: "bg-emerald-50 text-emerald-800 ring-emerald-600/15",
    inactivo: "bg-slate-100 text-slate-600 ring-slate-500/10",
  };
  const labels = { activo: "Activo", inactivo: "Inactivo" };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset",
        styles[status]
      )}
    >
      {labels[status]}
    </span>
  );
}

/** Checkbox con estilo de marca (gradiente morado/azul); reutilizable en tabla y formularios. */
function BrandCheckboxControl({
  id,
  checked,
  indeterminate = false,
  onCheckedChange,
  "aria-label": ariaLabel,
  size = "sm",
}: {
  id: string;
  checked: boolean;
  indeterminate?: boolean;
  onCheckedChange: (next: boolean) => void;
  "aria-label": string;
  size?: "sm" | "md";
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const el = inputRef.current;
    if (el) el.indeterminate = indeterminate;
  }, [indeterminate]);

  const dim = size === "md" ? "h-6 w-6" : "h-5 w-5";
  const rounded = size === "md" ? "rounded-xl" : "rounded-lg";
  const iconClass =
    size === "md" ? "h-3.5 w-3.5 stroke-[2.4]" : "h-3 w-3 stroke-[2.4]";

  return (
    <span className={cn("relative inline-flex shrink-0", dim)}>
      <input
        ref={inputRef}
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onCheckedChange(e.target.checked)}
        className={cn(
          "absolute inset-0 z-[1] m-0 cursor-pointer opacity-0",
          rounded
        )}
        aria-label={ariaLabel}
      />
      <span
        className={cn(
          "pointer-events-none absolute inset-0 flex items-center justify-center border-2 shadow-sm transition-all duration-200",
          rounded,
          indeterminate &&
            "border-purple/60 bg-gradient-to-br from-purple/15 to-blue/15 shadow-purple/10",
          !indeterminate &&
            checked &&
            "border-transparent bg-gradient-to-br from-purple to-blue shadow-md shadow-purple/25",
          !indeterminate &&
            !checked &&
            "border-slate-300/95 bg-white shadow-slate-200/40 group-hover:border-purple/40 group-hover:shadow-purple/10"
        )}
        aria-hidden
      >
        {indeterminate ? (
          <span className="h-0.5 w-2.5 rounded-full bg-purple" />
        ) : (
          <svg
            viewBox="0 0 12 12"
            fill="none"
            className={cn(
              iconClass,
              "stroke-white transition-all duration-200",
              checked ? "scale-100 opacity-100" : "scale-50 opacity-0"
            )}
          >
            <path d="M2.5 6l2.5 2.5L9.5 3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
    </span>
  );
}

function TableCheckbox({
  checked,
  indeterminate = false,
  onChange,
  "aria-label": ariaLabel,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
  "aria-label": string;
}) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className="inline-flex cursor-pointer items-center justify-center rounded-md p-0.5 outline-none ring-offset-2 focus-within:ring-2 focus-within:ring-purple/35 focus-within:ring-offset-white"
    >
      <BrandCheckboxControl
        id={id}
        checked={checked}
        indeterminate={indeterminate}
        onCheckedChange={() => onChange()}
        aria-label={ariaLabel}
        size="sm"
      />
    </label>
  );
}

type PlatformAccountDraft = {
  username: string;
  url: string;
  picture: string;
  bio: string;
  followersCount: string;
  postCount: string;
  categoryValues: readonly CategoryOption[];
  isVerified: boolean;
};

type RegisterFormState = {
  email: string;
  first_name: string;
  last_name: string;
  username: string;
  status: "activo" | "inactivo";
  picture: string;
  personalized_paragraph: string;
  accounts: Record<string, PlatformAccountDraft>;
};

function defaultAccountDraft(): PlatformAccountDraft {
  return {
    username: "",
    url: "",
    picture: "",
    bio: "",
    followersCount: "",
    postCount: "",
    categoryValues: orderCategoryOptions([CATEGORY_OPTIONS[0]]),
    isVerified: false,
  };
}

function getInitialRegisterForm(platforms: PlatformRead[]): RegisterFormState {
  const accounts: Record<string, PlatformAccountDraft> = {};
  for (const p of platforms) {
    accounts[p.id] = defaultAccountDraft();
  }
  return {
    email: "",
    first_name: "",
    last_name: "",
    username: "",
    status: "activo",
    picture: "",
    personalized_paragraph: "",
    accounts,
  };
}

function slugToCategoryOptions(slugs: string[]): CategoryOption[] {
  const byValue = new Map(CATEGORY_OPTIONS.map((c) => [c.value, c]));
  const mapped = slugs.map(
    (s) => byValue.get(s) ?? ({ value: s, label: s } as CategoryOption)
  );
  return orderCategoryOptions(mapped);
}

function registerFormStateFromCreatorRead(
  c: CreatorRead,
  platforms: PlatformRead[]
): RegisterFormState {
  const accounts: Record<string, PlatformAccountDraft> = {};
  for (const p of platforms) {
    const prof = c.account_profiles.find((ap) => ap.platform_id === p.id);
    if (prof) {
      accounts[p.id] = {
        username: prof.username ?? "",
        url: prof.url ?? "",
        picture: prof.picture ?? "",
        bio: prof.bio ?? "",
        followersCount: String(prof.followers_count ?? 0),
        postCount: String(prof.post_count ?? 0),
        categoryValues: slugToCategoryOptions(prof.category ?? []),
        isVerified: prof.is_verified,
      };
    } else {
      accounts[p.id] = defaultAccountDraft();
    }
  }
  return {
    email: c.email,
    first_name: c.first_name ?? "",
    last_name: c.last_name ?? "",
    username: c.username ?? "",
    status: normalizeStatus(c.status),
    picture: c.picture ?? "",
    personalized_paragraph: c.personalized_paragraph ?? "",
    accounts,
  };
}

function emptyToNull(s: string): string | null {
  const t = s.trim();
  return t === "" ? null : t;
}

function accountDraftHasIdentity(a: PlatformAccountDraft): boolean {
  return Boolean(a.username.trim() || a.url.trim());
}

function buildCreatorPayload(
  form: RegisterFormState,
  platforms: PlatformRead[]
): CreatorCreatePayload {
  const account_profiles = platforms
    .map((p) => {
      const a = form.accounts[p.id] ?? defaultAccountDraft();
      const cats = orderCategoryOptions([...a.categoryValues]).map((c) => c.value).slice(0, 3);
      return {
        platform_id: p.id,
        username: emptyToNull(a.username),
        url: emptyToNull(a.url),
        picture: emptyToNull(a.picture),
        bio: emptyToNull(a.bio),
        followers_count: Math.max(0, parseInt(a.followersCount, 10) || 0),
        post_count: Math.max(0, parseInt(a.postCount, 10) || 0),
        category: cats,
        is_verified: a.isVerified,
      };
    })
    .filter((row) => row.username != null || row.url != null);
  const derivedFullName = [form.first_name, form.last_name]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(" ")
    .trim();
  return {
    email: form.email.trim(),
    status: form.status,
    first_name: emptyToNull(form.first_name),
    last_name: emptyToNull(form.last_name),
    full_name: derivedFullName ? derivedFullName : null,
    username: emptyToNull(form.username),
    picture: emptyToNull(form.picture),
    instagram_url: null,
    tiktok_url: null,
    youtube_channel_url: null,
    tiktok_username: null,
    instagram_username: null,
    youtube_channel: null,
    max_followers: null,
    category: null,
    facebook_page: null,
    personalized_paragraph: emptyToNull(form.personalized_paragraph),
    account_profiles,
  };
}

const TOP_REGISTER_ERROR_KEYS = new Set(["email", "picture"]);

function isValidEmailFormat(s: string): boolean {
  const t = s.trim();
  if (!t) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(t);
}

function isValidOptionalHttpUrl(s: string): boolean {
  const t = s.trim();
  if (!t) return true;
  try {
    const u = new URL(t);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function validateRegisterForm(
  form: RegisterFormState,
  platforms: PlatformRead[]
): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  if (!form.email.trim()) errors.email = "El email es obligatorio.";
  else if (!isValidEmailFormat(form.email)) {
    errors.email = "Introduce un email válido (ej. nombre@dominio.com).";
  }
  if (!isValidOptionalHttpUrl(form.picture)) {
    errors.picture = "Debe ser una URL que empiece por http:// o https://.";
  }
  const anyPlatformIdentity = platforms.some((p) =>
    accountDraftHasIdentity(form.accounts[p.id] ?? defaultAccountDraft())
  );
  if (!anyPlatformIdentity) {
    errors.accounts_min_one =
      "Indica usuario o URL del perfil en al menos una plataforma (las demás no se guardan si van vacías).";
  }
  for (const p of platforms) {
    const a = form.accounts[p.id];
    if (!a) continue;
    const pref = `acc:${p.id}`;
    if (!isValidOptionalHttpUrl(a.url)) {
      errors[`${pref}:url`] = "URL no válida. Usa https://…";
    }
    if (!isValidOptionalHttpUrl(a.picture)) {
      errors[`${pref}:picture`] = "URL de imagen no válida.";
    }
    const fc = a.followersCount.trim();
    if (fc !== "" && Number.isNaN(parseInt(fc, 10))) {
      errors[`${pref}:followers`] = "Introduce un número válido.";
    }
    const pc = a.postCount.trim();
    if (pc !== "" && Number.isNaN(parseInt(pc, 10))) {
      errors[`${pref}:posts`] = "Introduce un número válido.";
    }
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

function platformBrandIcon(nombre: string): ReactNode {
  const n = nombre.trim().toLowerCase();
  if (n.includes("instagram")) return <SiInstagram className="h-4 w-4 text-white" />;
  if (n.includes("tiktok")) return <SiTiktok className="h-4 w-4 text-white" />;
  if (n.includes("youtube")) return <SiYoutube className="h-4 w-4 text-white" />;
  return <HiOutlineTag className="h-5 w-5 text-slate-600" />;
}

function platformIconClass(nombre: string): string {
  const n = nombre.trim().toLowerCase();
  if (n.includes("instagram")) {
    return "bg-gradient-to-br from-[#f09433] via-[#dc2743] to-[#bc1888]";
  }
  if (n.includes("tiktok")) return "bg-slate-900";
  if (n.includes("youtube")) return "bg-red-600";
  return "bg-gradient-to-br from-slate-100 to-violet-50/80";
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="mt-1 text-xs font-medium text-rose-600">{msg}</p>;
}

/** Texto oscuro explícito: evita heredar color blanco del layout. */
const INPUT_TEXT_CLASS =
  "w-full border-0 bg-transparent py-2 pr-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0";

const STANDALONE_INPUT_CLASS =
  "w-full rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition focus:border-purple/50 focus:outline-none focus:ring-2 focus:ring-purple/20";

function IconInputRow({
  icon,
  label,
  requiredStar,
  children,
  error,
  iconClassName,
}: {
  icon: ReactNode;
  label: string;
  requiredStar?: boolean;
  children: ReactNode;
  error?: string;
  iconClassName?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-slate-600">
        {label}
        {requiredStar ? <span className="text-rose-600"> *</span> : null}
      </span>
      <div
        className={cn(
          "flex min-h-[42px] items-stretch overflow-hidden rounded-xl border bg-white shadow-sm transition focus-within:border-purple/50 focus-within:ring-2 focus-within:ring-purple/20",
          error ? "border-rose-300 ring-1 ring-rose-200" : "border-slate-200/90"
        )}
      >
        <span
          className={cn(
            "flex w-11 shrink-0 items-center justify-center border-r border-slate-100",
            iconClassName ??
              "bg-gradient-to-br from-slate-100 to-violet-50/80 text-slate-600"
          )}
          aria-hidden
        >
          {icon}
        </span>
        <div className="min-w-0 flex-1 px-2">{children}</div>
      </div>
      <FieldError msg={error} />
    </div>
  );
}

function PlatformBadge({ name }: { name: string }) {
  const tone: Record<string, string> = {
    TikTok: "from-slate-900 to-slate-800",
    Instagram: "from-fuchsia-600 via-pink-600 to-amber-500",
    YouTube: "from-red-600 to-red-500",
    /* Azul Meta/Facebook con valores arbitrarios*/
    Facebook: "from-[#1877F2] to-[#0C63D4]",
  };
  const g =
    tone[name] ??
    /* marca La Neta*/
    "from-purple to-blue";
  return (
    <span
      className={cn(
        "inline-flex max-w-[140px] truncate rounded-md bg-gradient-to-r px-2.5 py-1 text-xs font-semibold text-white shadow-sm",
        g
      )}
      title={name}
    >
      {name}
    </span>
  );
}

export type CreadoresPageMode = "production" | "pruebas";

const CREATOR_PAGE_SIZES = [50, 100, 1000] as const;
type CreatorPageSize = (typeof CREATOR_PAGE_SIZES)[number];

export function CreadoresPage({ mode = "production" }: { mode?: CreadoresPageMode } = {}) {
  const isPruebas = mode === "pruebas";
  const selPrefix = isPruebas ? "pruebas-" : "";
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [draftStatus, setDraftStatus] = useState<ListOption | null>(null);
  const [draftFields, setDraftFields] = useState<Record<FilterFieldKey, string>>(() =>
    Object.fromEntries(FILTER_FIELDS.map((f) => [f.key, ""])) as Record<
      FilterFieldKey,
      string
    >
  );
  const [draftMinCamp, setDraftMinCamp] = useState("");
  const [draftMaxCamp, setDraftMaxCamp] = useState("");
  /** Filtro: creadores con cuenta en todas las plataformas seleccionadas (tabla `platforms`). */
  const [draftFilterPlatforms, setDraftFilterPlatforms] = useState<readonly ListOption[]>([]);
  /** Filtros de listado (sin paginación; `skip`/`limit` se añaden al cargar). */
  const [listFilters, setListFilters] = useState<CreatorListFilters>({});
  const [creatorTotal, setCreatorTotal] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState<CreatorPageSize>(100);

  const [creatorsRaw, setCreatorsRaw] = useState<CreatorRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [registerMenuOpen, setRegisterMenuOpen] = useState(false);
  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [registerModalMode, setRegisterModalMode] = useState<"create" | "edit">("create");
  const [editingCreatorId, setEditingCreatorId] = useState<string | null>(null);
  const [registerPrefillLoading, setRegisterPrefillLoading] = useState(false);
  const [platformsList, setPlatformsList] = useState<PlatformRead[]>([]);
  const [registerForm, setRegisterForm] = useState<RegisterFormState>(() =>
    getInitialRegisterForm([])
  );
  const [expandedAccordions, setExpandedAccordions] = useState<Set<string>>(new Set());
  const [registerSubmitting, setRegisterSubmitting] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [registerFieldErrors, setRegisterFieldErrors] = useState<Record<string, string>>({});
  const [uploadBusy, setUploadBusy] = useState(false);
  const [actionNotice, setActionNotice] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);

  const [addToOpen, setAddToOpen] = useState(false);
  const [exportSelectionOpen, setExportSelectionOpen] = useState(false);
  const [addToListSearch, setAddToListSearch] = useState("");
  const [createListaSelectionOpen, setCreateListaSelectionOpen] = useState(false);
  const [createListaSelectionNombre, setCreateListaSelectionNombre] = useState("");
  const [createListaSelectionStatus, setCreateListaSelectionStatus] = useState<ListOption | null>(
    () => LISTA_STATUS_MODAL[0]
  );
  const [createListaSelectionSaving, setCreateListaSelectionSaving] = useState(false);
  const [listasCatalog, setListasCatalog] = useState<ListaRead[]>([]);
  const [listasLoading, setListasLoading] = useState(false);
  const [listasLoadError, setListasLoadError] = useState<string | null>(null);
  const downloadRef = useRef<HTMLDivElement>(null);
  const registerRef = useRef<HTMLDivElement>(null);
  const xlsxInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const addToRef = useRef<HTMLDivElement>(null);
  const exportSelectionRef = useRef<HTMLDivElement>(null);

  const resetRegisterModalState = useCallback(() => {
    setRegisterModalOpen(false);
    setEditingCreatorId(null);
    setRegisterModalMode("create");
    setRegisterPrefillLoading(false);
    setRegisterError(null);
    setRegisterFieldErrors({});
  }, []);

  const updateRegisterForm = useCallback((patch: Partial<RegisterFormState>) => {
    setRegisterForm((f) => ({ ...f, ...patch }));
    setRegisterError(null);
    setRegisterFieldErrors((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const k of Object.keys(patch)) {
        if (TOP_REGISTER_ERROR_KEYS.has(k) && next[k]) {
          delete next[k];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, []);

  const updateAccountDraft = useCallback(
    (platformId: string, patch: Partial<PlatformAccountDraft>) => {
      setRegisterForm((f) => ({
        ...f,
        accounts: {
          ...f.accounts,
          [platformId]: {
            ...(f.accounts[platformId] ?? defaultAccountDraft()),
            ...patch,
          },
        },
      }));
      setRegisterError(null);
      setRegisterFieldErrors((prev) => {
        const next = { ...prev };
        let changed = false;
        if ("username" in patch || "url" in patch) {
          if (next.accounts_min_one) {
            delete next.accounts_min_one;
            changed = true;
          }
        }
        for (const k of Object.keys(next)) {
          if (k.startsWith(`acc:${platformId}:`)) {
            delete next[k];
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    },
    []
  );

  const registerStatusSelectValue = useMemo(
    () =>
      STATUS_FILTER_OPTIONS.find((o) => o.value === registerForm.status) ??
      STATUS_FILTER_OPTIONS[0],
    [registerForm.status]
  );

  const sortedRegisterPlatforms = useMemo(
    () => [...platformsList].sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [platformsList]
  );

  const filterPlatformOptions = useMemo<ListOption[]>(
    () =>
      sortedRegisterPlatforms.map((p) => ({
        value: p.id,
        label: p.nombre,
      })),
    [sortedRegisterPlatforms]
  );

  useEffect(() => {
    let cancelled = false;
    void fetchPlatforms()
      .then((plats) => {
        if (!cancelled) setPlatformsList(plats);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const reloadCreators = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const payload: CreatorListFilters = {
        ...listFilters,
        skip: pageIndex * pageSize,
        limit: pageSize,
      };
      const { items, total } = isPruebas
        ? await fetchCreatorsTestPage(payload)
        : await fetchCreatorsPage(payload);
      setCreatorsRaw(items);
      setCreatorTotal(total);
      setSelected(new Set());
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Error al cargar creadores");
      setCreatorsRaw([]);
      setCreatorTotal(0);
    } finally {
      setLoading(false);
    }
  }, [listFilters, pageIndex, pageSize, isPruebas]);

  useEffect(() => {
    void reloadCreators();
  }, [reloadCreators]);

  useEffect(() => {
    const maxPage = Math.max(0, Math.ceil(creatorTotal / pageSize) - 1);
    setPageIndex((p) => (p > maxPage ? maxPage : p));
  }, [creatorTotal, pageSize]);

  const buildFiltersFromDraft = useCallback((): CreatorListFilters => {
    const next: CreatorListFilters = {};
    if (draftStatus?.value) next.status = draftStatus.value;
    for (const f of FILTER_FIELDS) {
      const v = draftFields[f.key].trim();
      if (v) Object.assign(next, { [FIELD_TO_API[f.key]]: v });
    }
    if (draftFilterPlatforms.length > 0) {
      next.platform_ids = draftFilterPlatforms.map((o) => o.value);
    }
    const min = draftMinCamp.trim();
    const max = draftMaxCamp.trim();
    if (min) {
      const n = parseInt(min, 10);
      if (!Number.isNaN(n)) next.min_campaigns = n;
    }
    if (max) {
      const n = parseInt(max, 10);
      if (!Number.isNaN(n)) next.max_campaigns = n;
    }
    return next;
  }, [draftStatus, draftFields, draftFilterPlatforms, draftMinCamp, draftMaxCamp]);

  const handleApplyFilters = () => {
    setPageIndex(0);
    setListFilters(buildFiltersFromDraft());
  };

  const handleClearFilters = () => {
    setDraftFields(
      Object.fromEntries(FILTER_FIELDS.map((f) => [f.key, ""])) as Record<
        FilterFieldKey,
        string
      >
    );
    setDraftStatus(null);
    setDraftMinCamp("");
    setDraftMaxCamp("");
    setDraftFilterPlatforms([]);
    setListFilters({});
    setPageIndex(0);
    setPageSize(100);
  };

  const tableRows = useMemo(() => creatorsRaw.map(creatorReadToRow), [creatorsRaw]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(creatorTotal / pageSize)),
    [creatorTotal, pageSize]
  );
  const canGoPrev = pageIndex > 0;
  const canGoNext = (pageIndex + 1) * pageSize < creatorTotal;
  const rangeFrom = creatorTotal === 0 ? 0 : pageIndex * pageSize + 1;
  const rangeTo = pageIndex * pageSize + tableRows.length;

  const listasFiltradasAgregar = useMemo(() => {
    const q = addToListSearch.trim().toLowerCase();
    if (!q) return listasCatalog;
    return listasCatalog.filter(
      (l) =>
        l.nombre.toLowerCase().includes(q) || l.id.toLowerCase().includes(q)
    );
  }, [addToListSearch, listasCatalog]);

  useEffect(() => {
    if (!addToOpen) return;
    let cancelled = false;
    setListasLoading(true);
    setListasLoadError(null);
    const loadListas = isPruebas ? fetchListasTest({}) : fetchListas({});
    void loadListas
      .then((data) => {
        if (!cancelled) setListasCatalog(data);
      })
      .catch((e) => {
        if (!cancelled) {
          setListasLoadError(
            e instanceof Error ? e.message : "No se pudieron cargar las listas."
          );
          setListasCatalog([]);
        }
      })
      .finally(() => {
        if (!cancelled) setListasLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [addToOpen, isPruebas]);

  const handleAddSelectionToLista = useCallback(async (lista: ListaRead) => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;

    void Swal.fire({
      title: "Añadiendo a la lista…",
      html: `Asociando <strong>${ids.length}</strong> creador(es) a <strong>${lista.nombre}</strong>.`,
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    let added = 0;
    let already = 0;
    const errors: string[] = [];

    const linkFn = isPruebas ? linkCreatorToListaTest : linkCreatorToLista;
    for (const creatorId of ids) {
      try {
        const r = await linkFn(lista.id, creatorId);
        if (r.linked) added += 1;
        else already += 1;
      } catch (e) {
        errors.push(e instanceof Error ? e.message : String(e));
      }
    }

    Swal.close();

    const errHtml =
      errors.length > 0
        ? `<p class="mt-2 max-h-40 overflow-y-auto text-left text-sm text-rose-700">${errors
            .slice(0, 12)
            .map((e) => `• ${e}`)
            .join("<br/>")}</p>`
        : "";

    const icon: "success" | "warning" | "error" =
      errors.length === ids.length ? "error" : errors.length > 0 ? "warning" : "success";

    await Swal.fire({
      icon,
      title:
        errors.length === ids.length
          ? "No se pudieron agregar los creadores"
          : errors.length > 0
            ? "Proceso completado con avisos"
            : "Creadores añadidos a la lista",
      html: `<p>Lista: <strong>${lista.nombre}</strong></p><p class="text-sm text-slate-600">Nuevos en la lista: <strong>${added}</strong> · Ya estaban: <strong>${already}</strong></p>${errHtml}`,
      confirmButtonText: "Aceptar",
      confirmButtonColor: "#7c3aed",
    });

    setAddToOpen(false);
    setSelected(new Set());
  }, [selected, isPruebas]);

  const handleExportSelection = useCallback(
    async (format: "csv" | "xlsx") => {
      const ids = Array.from(selected);
      if (ids.length === 0) return;
      setExportSelectionOpen(false);
      void Swal.fire({
        title: "Preparando exportación…",
        html: `Obteniendo datos de <strong>${ids.length}</strong> creador(es).`,
        allowOutsideClick: false,
        allowEscapeKey: false,
        showConfirmButton: false,
        didOpen: () => {
          Swal.showLoading();
        },
      });
      try {
        const rows = await Promise.all(
          ids.map(async (id) => {
            if (!isPruebas) {
              const fromPage = creatorsRaw.find((c) => c.id === id);
              if (fromPage) return fromPage;
              return fetchCreator(id);
            }
            return fetchCreatorTest(id);
          })
        );
        const base = isPruebas ? "creadores_prueba_seleccion" : "creadores_seleccion";
        if (format === "csv") downloadCreatorsSelectionCsv(rows, base);
        else downloadCreatorsSelectionXlsx(rows, base);
        Swal.close();
      } catch (e) {
        Swal.close();
        void Swal.fire({
          icon: "error",
          title: "No se pudo exportar",
          text: e instanceof Error ? e.message : "Error desconocido.",
          confirmButtonColor: "#7c3aed",
        });
      }
    },
    [selected, isPruebas, creatorsRaw]
  );

  const handleCreateListaSelectionSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const nombre = createListaSelectionNombre.trim();
    if (!nombre) {
      void Swal.fire({
        icon: "warning",
        title: "Nombre requerido",
        text: isPruebas
          ? "Indica un nombre para la nueva lista de prueba."
          : "Indica un nombre para la nueva lista.",
        confirmButtonColor: "#7c3aed",
      });
      return;
    }
    const ids = Array.from(selected);
    if (ids.length === 0) {
      setCreateListaSelectionOpen(false);
      return;
    }

    setCreateListaSelectionSaving(true);
    void Swal.fire({
      title: isPruebas ? "Creando lista de prueba…" : "Creando lista…",
      html: `Creando la lista y asociando <strong>${ids.length}</strong> creador(es) seleccionado(s).`,
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    try {
      const st = (createListaSelectionStatus?.value ?? "activo") as "activo" | "inactivo";
      const lista = isPruebas
        ? await createListaTest({ nombre, status: st })
        : await createLista({ nombre, status: st });
      setListasCatalog((prev) => {
        const rest = prev.filter((l) => l.id !== lista.id);
        return [lista, ...rest];
      });

      let added = 0;
      let already = 0;
      const errors: string[] = [];
      const linkFn = isPruebas ? linkCreatorToListaTest : linkCreatorToLista;
      for (const creatorId of ids) {
        try {
          const r = await linkFn(lista.id, creatorId);
          if (r.linked) added += 1;
          else already += 1;
        } catch (err) {
          errors.push(err instanceof Error ? err.message : String(err));
        }
      }

      Swal.close();

      const errHtml =
        errors.length > 0
          ? `<p class="mt-2 max-h-40 overflow-y-auto text-left text-sm text-rose-700">${errors
              .slice(0, 12)
              .map((msg) => `• ${msg}`)
              .join("<br/>")}</p>`
          : "";

      const icon: "success" | "warning" | "error" =
        errors.length === ids.length ? "error" : errors.length > 0 ? "warning" : "success";

      const successTitle = isPruebas ? "Lista de prueba lista" : "Lista creada";
      await Swal.fire({
        icon,
        title:
          errors.length === ids.length
            ? "Lista creada; no se pudieron asociar creadores"
            : errors.length > 0
              ? "Lista creada con avisos"
              : successTitle,
        html: `<p>Lista: <strong>${lista.nombre}</strong></p><p class="text-sm text-slate-600">Nuevos en la lista: <strong>${added}</strong> · Ya estaban: <strong>${already}</strong></p>${errHtml}`,
        confirmButtonText: "Aceptar",
        confirmButtonColor: "#7c3aed",
      });

      setCreateListaSelectionOpen(false);
      setCreateListaSelectionNombre("");
      setCreateListaSelectionStatus(LISTA_STATUS_MODAL[0]);
      setAddToOpen(false);
      setSelected(new Set());
    } catch (err) {
      Swal.close();
      void Swal.fire({
        icon: "error",
        title: "No se pudo crear la lista",
        text: err instanceof Error ? err.message : "Error desconocido.",
        confirmButtonColor: "#7c3aed",
      });
    } finally {
      setCreateListaSelectionSaving(false);
    }
  };

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (downloadRef.current && !downloadRef.current.contains(e.target as Node)) {
        setDownloadOpen(false);
      }
      if (registerRef.current && !registerRef.current.contains(e.target as Node)) {
        setRegisterMenuOpen(false);
      }
      if (addToRef.current && !addToRef.current.contains(e.target as Node)) {
        setAddToOpen(false);
      }
      if (
        exportSelectionRef.current &&
        !exportSelectionRef.current.contains(e.target as Node)
      ) {
        setExportSelectionOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (!registerModalOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !registerSubmitting && !registerPrefillLoading) {
        resetRegisterModalState();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [registerModalOpen, registerSubmitting, registerPrefillLoading, resetRegisterModalState]);

  const openRegisterModal = async () => {
    setRegisterMenuOpen(false);
    setRegisterError(null);
    setRegisterFieldErrors({});
    setRegisterModalMode("create");
    setEditingCreatorId(null);
    let plats = platformsList;
    if (plats.length === 0) {
      try {
        plats = await fetchPlatforms();
        setPlatformsList(plats);
      } catch {
        setActionNotice({
          tone: "error",
          message: "No se pudieron cargar las plataformas. Revisa la conexión o vuelve a intentar.",
        });
        return;
      }
    }
    setRegisterForm(getInitialRegisterForm(plats));
    setExpandedAccordions(new Set(plats.map((p) => p.id)));
    setRegisterModalOpen(true);
  };

  const openEditCreatorModal = async (creatorId: string) => {
    setRegisterMenuOpen(false);
    setRegisterError(null);
    setRegisterFieldErrors({});
    setRegisterModalMode("edit");
    setEditingCreatorId(creatorId);
    let plats = platformsList;
    if (plats.length === 0) {
      try {
        plats = await fetchPlatforms();
        setPlatformsList(plats);
      } catch {
        void Swal.fire({
          icon: "error",
          title: "No se pudieron cargar las plataformas",
          confirmButtonColor: "#7c3aed",
        });
        setRegisterModalMode("create");
        setEditingCreatorId(null);
        return;
      }
    }
    setRegisterPrefillLoading(true);
    setRegisterModalOpen(true);
    try {
      const c = isPruebas
        ? await fetchCreatorTest(creatorId)
        : await fetchCreator(creatorId);
      setRegisterForm(registerFormStateFromCreatorRead(c, plats));
      setExpandedAccordions(new Set(plats.map((p) => p.id)));
    } catch (e) {
      void Swal.fire({
        icon: "error",
        title: "No se pudo cargar el creador",
        text: e instanceof Error ? e.message : "Error desconocido",
        confirmButtonColor: "#7c3aed",
      });
      resetRegisterModalState();
    } finally {
      setRegisterPrefillLoading(false);
    }
  };

  const handleDeleteCreatorRow = async (row: CreatorRow) => {
    const r = await Swal.fire({
      icon: "warning",
      title: "¿Eliminar creador?",
      html: `Se eliminará <strong>${row.fullName}</strong> (${row.email}). Esta acción no se puede deshacer.`,
      showCancelButton: true,
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#64748b",
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
    });
    if (!r.isConfirmed) return;
    try {
      if (isPruebas) await deleteCreatorTest(row.id);
      else await deleteCreator(row.id);
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(row.id);
        return next;
      });
      await reloadCreators();
      void Swal.fire({
        icon: "success",
        title: "Creador eliminado",
        confirmButtonColor: "#7c3aed",
      });
    } catch (e) {
      void Swal.fire({
        icon: "error",
        title: "No se pudo eliminar",
        text: e instanceof Error ? e.message : "Error desconocido",
        confirmButtonColor: "#7c3aed",
      });
    }
  };

  const handleRegisterSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (platformsList.length === 0) {
      setRegisterError("No hay plataformas configuradas.");
      return;
    }
    const { valid, errors } = validateRegisterForm(registerForm, platformsList);
    setRegisterFieldErrors(errors);
    if (!valid) {
      setRegisterError("Revisa los campos marcados en rojo.");
      return;
    }
    setRegisterError(null);
    setRegisterSubmitting(true);
    try {
      const payload = buildCreatorPayload(registerForm, platformsList);
      if (registerModalMode === "edit" && editingCreatorId) {
        if (isPruebas) await updateCreatorTest(editingCreatorId, payload);
        else await updateCreator(editingCreatorId, payload);
        resetRegisterModalState();
        await reloadCreators();
        void Swal.fire({
          icon: "success",
          title: "Cambios guardados",
          text: "Los datos del creador se actualizaron correctamente.",
          confirmButtonColor: "#7c3aed",
          confirmButtonText: "Aceptar",
        });
      } else {
        if (isPruebas) await registerCreatorTest(payload);
        else await registerCreator(payload);
        resetRegisterModalState();
        await reloadCreators();
        void Swal.fire({
          icon: "success",
          title: "Creador registrado correctamente.",
          confirmButtonColor: "#7c3aed",
          confirmButtonText: "Aceptar",
        });
      }
    } catch (err) {
      setRegisterError(
        err instanceof Error ? err.message : "No se pudo completar la operación."
      );
    } finally {
      setRegisterSubmitting(false);
    }
  };

  const handleCreatorsFile = async (file: File | undefined) => {
    if (!file) return;
    setRegisterMenuOpen(false);
    setUploadBusy(true);
    setActionNotice(null);

    void Swal.fire({
      title: "Procesando archivo…",
      html: `Se está procesando la solicitud y registrando los datos de <strong>${file.name}</strong>. Por favor espera.`,
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    try {
      const r = isPruebas
        ? await uploadCreatorsFileTest(file)
        : await uploadCreatorsFile(file);
      Swal.close();

      const errLines =
        r.errors.length > 0
          ? `<p class="mt-3 text-left text-sm text-slate-600"><span class="font-semibold text-slate-800">Avisos o filas con error</span> (mostramos hasta 5):<br/>${r.errors
              .slice(0, 5)
              .map((e) => `• ${e}`)
              .join("<br/>")}</p>`
          : "";

      const successBody = `<p>Se completó el registro de los creadores del archivo subido.</p>
        <p class="mt-2 text-sm text-slate-600">Filas aplicadas: <strong>${r.rows_upserted}</strong> · Omitidas sin email: <strong>${r.skipped_empty_email}</strong></p>${errLines}`;

      await Swal.fire({
        icon: r.errors.length > 0 && r.rows_upserted === 0 ? "warning" : "success",
        title:
          r.errors.length > 0 && r.rows_upserted === 0
            ? "Importación sin registros válidos"
            : "Importación completada",
        html: successBody,
        confirmButtonText: "Aceptar",
        confirmButtonColor: "#7c3aed",
      });

      await reloadCreators();
    } catch (err) {
      Swal.close();
      const msg = err instanceof Error ? err.message : "No se pudo procesar la solicitud.";
      await Swal.fire({
        icon: "error",
        title: "No se pudo procesar la solicitud",
        text: msg,
        confirmButtonText: "Aceptar",
        confirmButtonColor: "#7c3aed",
      });
    } finally {
      setUploadBusy(false);
      if (xlsxInputRef.current) xlsxInputRef.current.value = "";
      if (csvInputRef.current) csvInputRef.current.value = "";
    }
  };

  useEffect(() => {
    if (!actionNotice) return;
    const t = window.setTimeout(() => setActionNotice(null), 9000);
    return () => window.clearTimeout(t);
  }, [actionNotice]);

  const selectedCount = selected.size;
  const allIds = tableRows.map((c) => c.id);
  const allSelected = allIds.length > 0 && selectedCount === allIds.length;
  const someSelected = selectedCount > 0 && !allSelected;

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(allIds));
  };

  const handleDeleteSelectedCreators = useCallback(async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;

    const r = await Swal.fire({
      icon: "warning",
      title: "¿Eliminar creadores seleccionados?",
      html: `Se eliminarán <strong>${ids.length}</strong> creador(es) del directorio. Esta acción no se puede deshacer.`,
      showCancelButton: true,
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#64748b",
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
    });
    if (!r.isConfirmed) return;

    void Swal.fire({
      title: "Eliminando…",
      html: `Procesando la eliminación de <strong>${ids.length}</strong> creador(es).`,
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    const errors: string[] = [];
    let deleted = 0;
    const delFn = isPruebas ? deleteCreatorTest : deleteCreator;
    for (const id of ids) {
      try {
        await delFn(id);
        deleted += 1;
      } catch (e) {
        errors.push(e instanceof Error ? e.message : String(e));
      }
    }

    Swal.close();

    const errHtml =
      errors.length > 0
        ? `<p class="mt-2 max-h-40 overflow-y-auto text-left text-sm text-rose-700">${errors
            .slice(0, 12)
            .map((e) => `• ${e}`)
            .join("<br/>")}</p>`
        : "";

    await Swal.fire({
      icon: errors.length === ids.length ? "error" : errors.length > 0 ? "warning" : "success",
      title:
        errors.length === ids.length
          ? "No se pudieron eliminar"
          : errors.length > 0
            ? "Eliminación parcial"
            : "Creadores eliminados",
      html: `<p class="text-sm text-slate-600">Eliminados correctamente: <strong>${deleted}</strong></p>${errHtml}`,
      confirmButtonText: "Aceptar",
      confirmButtonColor: "#7c3aed",
    });

    setSelected(new Set());
    await reloadCreators();
  }, [selected, reloadCreators, isPruebas]);

  useEffect(() => {
    if (selectedCount === 0) {
      setAddToOpen(false);
      setExportSelectionOpen(false);
      setCreateListaSelectionOpen(false);
    }
  }, [selectedCount]);

  useEffect(() => {
    if (!addToOpen) setAddToListSearch("");
  }, [addToOpen]);

  return (
    <div className="relative min-h-full overflow-hidden">
      {/* Fondo de página: degradado suave + velos de marca*/}
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(165deg,#f1f5f9_0%,#f8fafc_18%,#f5f3ff_42%,#f0f9ff_68%,#faf5ff_88%,#f1f5f9_100%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.85]"
        style={{
          background: `
            radial-gradient(ellipse 85% 55% at 0% 0%, rgba(102, 65, 237, 0.09), transparent 55%),
            radial-gradient(ellipse 70% 50% at 100% 15%, rgba(121, 188, 247, 0.12), transparent 50%),
            radial-gradient(ellipse 65% 45% at 50% 100%, rgba(255, 71, 172, 0.06), transparent 52%)
          `,
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,transparent_0%,rgba(255,255,255,0.35)_45%,transparent_100%)]"
        aria-hidden
      />

      <div className="relative z-10 mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {/* Cabecera */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm shadow-slate-200/50 sm:p-8">
          <div
            className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-gradient-to-br from-purple/12 via-transparent to-blue/10 blur-2xl"
            aria-hidden
          />
          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-purple">
                {isPruebas ? "Calidad" : "Audiencia"}
              </p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                {isPruebas ? "Creadores de prueba" : "Creadores Registrados"}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
                {isPruebas ? (
                  <>
                    Estos registros son solo para <strong>probar plantillas</strong> y la{" "}
                    <strong>vista previa del mensaje en el inbox</strong>. No afectan a campañas
                    ni al directorio de producción. Usa filtros y acciones igual que en Creadores;
                    los datos viven en <code className="rounded bg-slate-100 px-1 text-xs">creadores-test</code> y{" "}
                    <code className="rounded bg-slate-100 px-1 text-xs">listas-test</code>.
                  </>
                ) : (
                  <>
                    Consulta y administra el directorio de creadores. Usa los filtros para acotar
                    resultados; selecciona filas para asignarlas a listas o exportar datos. Las
                    acciones por fila permiten editar o eliminar cuando la funcionalidad esté
                    conectada al backend.
                  </>
                )}
              </p>
            </div>
            <div className="flex shrink-0 items-start gap-2 rounded-xl border border-sky-100 bg-sky-50/80 px-4 py-3 text-sm text-sky-900">
              <HiOutlineInformationCircle className="mt-0.5 h-5 w-5 shrink-0 text-sky-600" />
              <div className="space-y-1 text-sky-900/90">
                <p className="font-semibold text-sky-950">Guía rápida</p>
                <ul className="list-inside list-disc space-y-0.5 text-xs leading-relaxed text-sky-900/85">
                  {isPruebas ? (
                    <>
                      <li>
                        Usa estos perfiles para validar <strong>plantillas</strong> y previsualizar
                        correos sin tocar producción.
                      </li>
                      <li>
                        Las <strong>listas de prueba</strong> (<code className="rounded bg-white/80 px-1">listas-test</code>) son independientes de las listas reales.
                      </li>
                      <li>
                        <strong>Descargar</strong> ofrece plantillas de importación (misma maqueta que en Creadores).
                      </li>
                    </>
                  ) : (
                    <>
                      <li>Filtra por cualquier campo visible antes de exportar.</li>
                      <li>Marca creadores y usa <strong>Agregar a</strong> para listas.</li>
                      <li>
                        <strong>Descargar</strong> generará el archivo en el formato elegido (maqueta).
                      </li>
                    </>
                  )}
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="mt-6 rounded-2xl border border-slate-200/90 bg-white/90 shadow-sm backdrop-blur-sm">
          <button
            type="button"
            onClick={() => setFiltersOpen((v) => !v)}
            className={cn(
              "flex w-full items-center justify-between gap-3 rounded-t-2xl px-4 py-3.5 text-left sm:px-5",
              "transition-colors",
              filtersOpen
                ? "bg-gradient-to-r from-purple/[0.06] via-white to-blue/[0.06]"
                : "hover:bg-slate-50/80"
            )}
          >
            <span className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <HiOutlineFunnel className="h-5 w-5" />
              </span>
              {isPruebas ? "Filtrar creadores de prueba" : "Filtrar creadores"}
            </span>
            {filtersOpen ? (
              <HiOutlineChevronDown className="h-5 w-5 text-slate-500" />
            ) : (
              <HiOutlineChevronRight className="h-5 w-5 text-slate-500" />
            )}
          </button>
          {filtersOpen && (
            <div className="border-t border-slate-100 px-4 pb-5 pt-3 sm:px-5">
              {/* Status + plataformas (desde tabla `platforms`) */}
              <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-end">
                <div className="w-full min-w-[180px] max-w-[320px]">
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-semibold text-slate-600">Status</span>
                    <Select<ListOption, false, GroupBase<ListOption>>
                      instanceId={`${selPrefix}creators-filter-status`}
                      inputId={`${selPrefix}creators-filter-status-input`}
                      classNamePrefix={`${selPrefix}react-select-status`}
                      styles={creatorsFilterStatusStyles}
                      isClearable
                      placeholder="Todos"
                      options={STATUS_FILTER_OPTIONS}
                      value={draftStatus}
                      onChange={(opt: SingleValue<ListOption>) => setDraftStatus(opt)}
                      menuPosition="fixed"
                      menuPortalTarget={
                        typeof document !== "undefined" ? document.body : null
                      }
                    />
                  </label>
                </div>
                <div className="min-w-0">
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-semibold text-slate-600">
                      Plataformas (cuenta registrada)
                    </span>
                    <Select<ListOption, true, GroupBase<ListOption>>
                      instanceId={`${selPrefix}creators-filter-platforms`}
                      inputId={`${selPrefix}creators-filter-platforms-input`}
                      classNamePrefix={`${selPrefix}react-select-filter-platforms`}
                      styles={creatorsFilterPlatformMultiStyles}
                      isMulti
                      isClearable
                      closeMenuOnSelect={false}
                      placeholder="Todas · elige una o varias…"
                      options={filterPlatformOptions}
                      value={[...draftFilterPlatforms]}
                      onChange={(opts: MultiValue<ListOption>) =>
                        setDraftFilterPlatforms(opts ? Array.from(opts) : [])
                      }
                      menuPosition="fixed"
                      menuPortalTarget={
                        typeof document !== "undefined" ? document.body : null
                      }
                      noOptionsMessage={() =>
                        filterPlatformOptions.length === 0
                          ? "Cargando plataformas…"
                          : "Sin opciones"
                      }
                    />
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {FILTER_FIELDS.map(({ key, label, placeholder }) => (
                  <label key={key} className="flex flex-col gap-1.5 mt-4">
                    <span className="text-xs font-medium text-slate-500">{label}</span>
                    <input
                      type="text"
                      value={draftFields[key]}
                      onChange={(e) =>
                        setDraftFields((prev) => ({ ...prev, [key]: e.target.value }))
                      }
                      placeholder={placeholder}
                      className={cn(
                        "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800",
                        "placeholder:text-slate-400",
                        "focus:border-purple/40 focus:outline-none focus:ring-2 focus:ring-purple/20"
                      )}
                    />
                  </label>
                ))}
                <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-1 mt-4">
                  <span className="text-xs font-medium text-slate-500">Nº campañas</span>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min={0}
                      value={draftMinCamp}
                      onChange={(e) => setDraftMinCamp(e.target.value)}
                      placeholder="Mín."
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-purple/40 focus:outline-none focus:ring-2 focus:ring-purple/20"
                    />
                    <input
                      type="number"
                      min={0}
                      value={draftMaxCamp}
                      onChange={(e) => setDraftMaxCamp(e.target.value)}
                      placeholder="Máx."
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-purple/40 focus:outline-none focus:ring-2 focus:ring-purple/20"
                    />
                  </div>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-lg bg-gradient-to-r from-purple to-blue px-4 py-2 text-sm font-semibold text-white shadow-md shadow-purple/25 transition hover:opacity-95"
                  onClick={handleApplyFilters}
                >
                  Aplicar filtros
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  onClick={handleClearFilters}
                >
                  Limpiar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Barra de acciones */}
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={xlsxInputRef}
              type="file"
              accept=".xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={(e) => void handleCreatorsFile(e.target.files?.[0])}
            />
            <input
              ref={csvInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => void handleCreatorsFile(e.target.files?.[0])}
            />
            <div className="relative" ref={registerRef}>
              <button
                type="button"
                disabled={uploadBusy}
                onClick={() => setRegisterMenuOpen((v) => !v)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-xl border border-purple/25 bg-gradient-to-r from-purple/10 to-blue/10 px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-sm",
                  "hover:border-purple/40 hover:shadow-md",
                  uploadBusy && "pointer-events-none opacity-60"
                )}
              >
                <HiOutlinePlus className="h-4 w-4 text-purple" />
                Registrar
                <HiOutlineChevronDown
                  className={cn(
                    "h-4 w-4 text-slate-500 transition",
                    registerMenuOpen && "rotate-180"
                  )}
                />
              </button>
              {registerMenuOpen && (
                <div className="absolute left-0 top-full z-30 mt-1.5 min-w-[200px] overflow-hidden rounded-xl border border-slate-200/90 bg-white py-1 shadow-lg shadow-slate-300/40">
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-purple/5 hover:text-purple"
                    onClick={() => void openRegisterModal()}
                  >
                    <HiOutlineUserPlus className="h-4 w-4 shrink-0 text-purple" />
                    Nuevo creador
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-purple/5 hover:text-purple"
                    onClick={() => {
                      setRegisterMenuOpen(false);
                      xlsxInputRef.current?.click();
                    }}
                  >
                    <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                      XLSX
                    </span>
                    Desde Excel
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-purple/5 hover:text-purple"
                    onClick={() => {
                      setRegisterMenuOpen(false);
                      csvInputRef.current?.click();
                    }}
                  >
                    <span className="rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-bold text-sky-700">
                      CSV
                    </span>
                    Desde CSV
                  </button>
                </div>
              )}
            </div>

            {/* Descargar */}
            <div className="relative" ref={downloadRef}>
              <button
                type="button"
                onClick={() => setDownloadOpen((v) => !v)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm",
                  "hover:border-purple/30 hover:shadow-md hover:shadow-purple/5"
                )}
              >
                <HiOutlineArrowDownTray className="h-4 w-4 text-purple" />
                Descargar
                <HiOutlineChevronDown
                  className={cn("h-4 w-4 text-slate-500 transition", downloadOpen && "rotate-180")}
                />
              </button>
              {downloadOpen && (
                <div className="absolute left-0 top-full z-20 mt-1.5 min-w-[200px] overflow-hidden rounded-xl border border-slate-200/90 bg-white py-1 shadow-lg shadow-slate-300/40">
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-purple/5 hover:text-purple"
                    onClick={() => {
                      setDownloadOpen(false);
                      downloadCreadoresPlantillaXlsx();
                    }}
                  >
                    <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                      XLSX
                    </span>
                    Plantilla Excel (.xlsx)
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-purple/5 hover:text-purple"
                    onClick={() => {
                      setDownloadOpen(false);
                      downloadCreadoresPlantillaCsv();
                    }}
                  >
                    <span className="rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-bold text-sky-700">
                      CSV
                    </span>
                    Plantilla CSV (.csv)
                  </button>
                </div>
              )}
            </div>

            {/* Agregar a — solo visible con al menos una fila seleccionada */}
            {selectedCount > 0 && (
              <div className="relative" ref={addToRef}>
                <button
                  type="button"
                  onClick={() => setAddToOpen((v) => !v)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-xl border border-pink-200 bg-gradient-to-r from-pink/10 to-purple/10 px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-sm",
                    "hover:border-pink-300 hover:shadow-md"
                  )}
                >
                  <HiOutlineUserPlus className="h-4 w-4 text-pink-600" />
                  Agregar a
                  <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-bold text-purple">
                    {selectedCount}
                  </span>
                  <HiOutlineChevronDown
                    className={cn("h-4 w-4 text-slate-500 transition", addToOpen && "rotate-180")}
                  />
                </button>
                {addToOpen && (
                  <div
                    className={cn(
                      "absolute left-0 top-full z-[100] mt-1.5 flex w-[min(calc(100vw-2rem),22rem)] flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-xl shadow-slate-300/50",
                      "ring-1 ring-black/[0.04]"
                    )}
                  >
                    <div className="shrink-0 border-b border-slate-100 bg-slate-50/80 px-3 py-2">
                      <p className="text-xs font-semibold text-slate-700">
                        {isPruebas ? "Listas de prueba disponibles" : "Listas disponibles"}
                      </p>
                      <p className="mt-0.5 text-[10px] text-slate-500">
                        {isPruebas
                          ? "Crea una lista nueva o elige una existente; todo queda en listas-test."
                          : "Crea una lista nueva desde aquí o elige una existente; busca por nombre o ID."}
                      </p>
                    </div>
                    <div className="shrink-0 border-b border-pink-100 bg-gradient-to-r from-pink/[0.08] to-purple/[0.06] px-3 py-2.5">
                      <button
                        type="button"
                        onClick={() => {
                          setCreateListaSelectionOpen(true);
                          setAddToOpen(false);
                        }}
                        className="flex w-full items-center gap-2 rounded-lg border border-pink-200/80 bg-white/90 px-3 py-2 text-left text-sm font-semibold text-slate-800 shadow-sm transition hover:border-purple/30 hover:bg-white"
                      >
                        <HiOutlinePlusCircle className="h-5 w-5 shrink-0 text-pink-600" />
                        <span>
                          {isPruebas ? "Nueva lista de prueba" : "Nueva lista"} y agregar{" "}
                          <span className="tabular-nums text-purple">{selectedCount}</span>{" "}
                          seleccionado(s)
                        </span>
                      </button>
                    </div>
                    <div className="shrink-0 border-b border-slate-100 p-2">
                      <div className="relative">
                        <HiOutlineMagnifyingGlass className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                          type="search"
                          value={addToListSearch}
                          onChange={(e) => setAddToListSearch(e.target.value)}
                          placeholder="Buscar por nombre o ID…"
                          className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-purple/40 focus:outline-none focus:ring-2 focus:ring-purple/15"
                          autoComplete="off"
                        />
                      </div>
                    </div>
                    <ul
                      className="max-h-[min(280px,42vh)] overflow-y-auto overscroll-y-contain py-1"
                      role="listbox"
                    >
                      {listasLoading ? (
                        <li className="px-3 py-8 text-center text-sm text-slate-500">
                          Cargando listas…
                        </li>
                      ) : listasLoadError ? (
                        <li className="px-3 py-6 text-center text-sm text-rose-700">
                          {listasLoadError}
                        </li>
                      ) : listasFiltradasAgregar.length === 0 ? (
                        <li className="px-3 py-6 text-center text-sm text-slate-500">
                          {listasCatalog.length === 0
                            ? isPruebas
                              ? "No hay listas de prueba aún. Usa el botón de arriba para crear una."
                              : "No hay listas aún. Usa «Nueva lista» arriba o crea una en la página Listas."
                            : "Ninguna lista coincide con la búsqueda."}
                        </li>
                      ) : (
                        listasFiltradasAgregar.map((lista) => (
                          <li key={lista.id} role="none">
                            <button
                              type="button"
                              role="option"
                              className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm text-slate-800 hover:bg-purple/5"
                              onClick={() => void handleAddSelectionToLista(lista)}
                            >
                              <span className="font-medium leading-snug">{lista.nombre}</span>
                              <span className="text-[11px] text-slate-400">
                                ID: {lista.id.slice(0, 13)}… · {lista.num_creators} creador
                                {lista.num_creators === 1 ? "" : "es"}
                              </span>
                            </button>
                          </li>
                        ))
                      )}
                    </ul>
                    <div className="shrink-0 border-t border-slate-100 bg-slate-50/90 px-3 py-1.5 text-[10px] text-slate-500">
                      {listasLoading
                        ? "…"
                        : `${listasFiltradasAgregar.length} de ${listasCatalog.length} listas`}
                      {addToListSearch.trim() ? " (filtrado)" : ""}
                    </div>
                  </div>
                )}
              </div>
            )}

            {selectedCount > 0 && (
              <div className="relative" ref={exportSelectionRef}>
                <button
                  type="button"
                  onClick={() => setExportSelectionOpen((v) => !v)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-xl border border-sky-200 bg-gradient-to-r from-sky-50/90 to-indigo-50/80 px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-sm",
                    "hover:border-sky-300 hover:shadow-md"
                  )}
                >
                  <HiOutlineArrowDownTray className="h-4 w-4 text-sky-600" />
                  Exportar selección
                  <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-bold text-sky-800">
                    {selectedCount}
                  </span>
                  <HiOutlineChevronDown
                    className={cn(
                      "h-4 w-4 text-slate-500 transition",
                      exportSelectionOpen && "rotate-180"
                    )}
                  />
                </button>
                {exportSelectionOpen && (
                  <div className="absolute left-0 top-full z-[100] mt-1.5 min-w-[220px] overflow-hidden rounded-xl border border-slate-200/90 bg-white py-1 shadow-xl shadow-slate-300/50">
                    <p className="border-b border-slate-100 px-4 py-2 text-[11px] font-medium text-slate-500">
                      Descargar todos los datos de los creadores marcados
                    </p>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-purple/5 hover:text-purple"
                      onClick={() => void handleExportSelection("csv")}
                    >
                      <span className="rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-bold text-sky-700">
                        CSV
                      </span>
                      Archivo CSV (.csv)
                    </button>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-purple/5 hover:text-purple"
                      onClick={() => void handleExportSelection("xlsx")}
                    >
                      <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                        XLSX
                      </span>
                      Excel (.xlsx)
                    </button>
                  </div>
                )}
              </div>
            )}

            {selectedCount > 0 && (
              <button
                type="button"
                onClick={() => void handleDeleteSelectedCreators()}
                className={cn(
                  "inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50/90 px-4 py-2.5 text-sm font-semibold text-rose-900 shadow-sm",
                  "hover:border-rose-300 hover:bg-rose-100"
                )}
              >
                <HiOutlineTrash className="h-4 w-4 shrink-0" />
                Eliminar seleccionados
                <span className="rounded-full bg-white/90 px-2 py-0.5 text-xs font-bold text-rose-800">
                  {selectedCount}
                </span>
              </button>
            )}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
            <p className="text-xs text-slate-500">
              {loading ? (
                "Cargando creadores…"
              ) : (
                <>
                  Mostrando{" "}
                  <strong className="text-slate-700">
                    {rangeFrom}-{rangeTo}
                  </strong>{" "}
                  de <strong className="text-slate-700">{creatorTotal}</strong> creadores
                </>
              )}
            </p>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
              <label className="flex items-center gap-2 font-medium">
                <span className="text-slate-500">Por página</span>
                <select
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm font-semibold text-slate-800 shadow-sm outline-none ring-purple/30 focus:ring-2"
                  value={pageSize}
                  onChange={(e) => {
                    const v = Number(e.target.value) as CreatorPageSize;
                    if (CREATOR_PAGE_SIZES.includes(v as CreatorPageSize)) {
                      setPageSize(v as CreatorPageSize);
                      setPageIndex(0);
                    }
                  }}
                >
                  {CREATOR_PAGE_SIZES.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm">
                <button
                  type="button"
                  disabled={!canGoPrev || loading}
                  onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm font-semibold",
                    canGoPrev && !loading
                      ? "text-slate-700 hover:bg-slate-100"
                      : "cursor-not-allowed text-slate-300"
                  )}
                >
                  <HiOutlineChevronLeft className="h-4 w-4" />
                  Anterior
                </button>
                <span className="px-2 text-slate-500">
                  Página {pageIndex + 1} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={!canGoNext || loading}
                  onClick={() => setPageIndex((p) => p + 1)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm font-semibold",
                    canGoNext && !loading
                      ? "text-slate-700 hover:bg-slate-100"
                      : "cursor-not-allowed text-slate-300"
                  )}
                >
                  Siguiente
                  <HiOutlineChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {loadError && (
          <div
            className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900"
            role="alert"
          >
            {loadError}
          </div>
        )}

        {actionNotice && (
          <div
            className={cn(
              "mt-4 rounded-xl border px-4 py-3 text-sm",
              actionNotice.tone === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-950"
                : "border-amber-200 bg-amber-50 text-amber-950"
            )}
            role="status"
          >
            {actionNotice.message}
          </div>
        )}

        {/* Tabla */}
        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm shadow-slate-200/40">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-gradient-to-r from-slate-50/90 to-indigo-50/40">
                  <th className="w-14 px-3 py-3.5">
                    <div className="flex justify-center">
                      <TableCheckbox
                        checked={allSelected}
                        indeterminate={someSelected}
                        onChange={toggleAll}
                        aria-label="Seleccionar todos los creadores"
                      />
                    </div>
                  </th>
                  <th className="px-3 py-3.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    ID
                  </th>
                  <th className="min-w-[200px] px-3 py-3.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Creador
                  </th>
                  <th className="min-w-[180px] px-3 py-3.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Email
                  </th>
                  <th className="px-3 py-3.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Username
                  </th>
                  <th className="px-3 py-3.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Plataforma principal
                  </th>
                  <th className="px-3 py-3.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Status
                  </th>
                  <th className="px-3 py-3.5 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Campañas
                  </th>
                  <th className="w-[120px] px-3 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading && tableRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-3 py-12 text-center text-sm text-slate-500">
                      Cargando…
                    </td>
                  </tr>
                ) : null}
                {!loading && tableRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-3 py-12 text-center text-sm text-slate-500">
                      No hay creadores que coincidan con los filtros.
                    </td>
                  </tr>
                ) : null}
                {tableRows.map((row, idx) => (
                  <tr
                    key={row.id}
                    className={cn(
                      "transition-colors hover:bg-slate-50/80",
                      idx % 2 === 0 ? "bg-white" : "bg-slate-50/40"
                    )}
                  >
                    <td className="px-3 py-3 align-middle">
                      <div className="flex justify-center">
                        <TableCheckbox
                          checked={selected.has(row.id)}
                          onChange={() => toggleOne(row.id)}
                          aria-label={`Seleccionar ${row.fullName}`}
                        />
                      </div>
                    </td>
                    <td className="max-w-[120px] truncate px-3 py-3 align-middle font-mono text-xs text-slate-500">
                      {row.id.slice(0, 13)}…
                    </td>
                    <td className="px-3 py-3 align-middle">
                      <div className="flex items-center gap-3">
                        <AvatarWithFallback
                          name={row.fullName}
                          email={row.email}
                          avatarUrl={row.picture ?? undefined}
                          className="h-10 w-10 shrink-0 text-purple"
                          imageClassName="border-slate-200"
                        />
                        <span className="font-medium text-slate-900">{row.fullName}</span>
                      </div>
                    </td>
                    <td className="max-w-[200px] truncate px-3 py-3 align-middle text-slate-700">
                      {row.email}
                    </td>
                    <td className="px-3 py-3 align-middle text-slate-700">
                      {row.username === "—" ? "—" : `@${row.username}`}
                    </td>
                    <td className="px-3 py-3 align-middle">
                      <PlatformBadge name={row.mainPlatforme} />
                    </td>
                    <td className="px-3 py-3 align-middle">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="px-3 py-3 text-center align-middle">
                      <span className="inline-flex min-w-[2rem] justify-center rounded-lg bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700">
                        {row.numCampaigns}
                      </span>
                    </td>
                    <td className="px-3 py-3 align-middle">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          className="rounded-lg p-2 text-slate-500 transition hover:bg-purple/10 hover:text-purple"
                          title="Editar"
                          onClick={() => void openEditCreatorModal(row.id)}
                        >
                          <HiOutlinePencilSquare className="h-5 w-5" />
                        </button>
                        <button
                          type="button"
                          className="rounded-lg p-2 text-slate-500 transition hover:bg-rose-50 hover:text-rose-600"
                          title="Eliminar"
                          onClick={() => void handleDeleteCreatorRow(row)}
                        >
                          <HiOutlineTrash className="h-5 w-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {createListaSelectionOpen && (
          <div
            className="fixed inset-0 z-[210] flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-lista-selection-title"
          >
            <button
              type="button"
              aria-label="Cerrar"
              className="absolute inset-0 z-0 bg-slate-900/45 backdrop-blur-[2px]"
              onClick={() => {
                if (!createListaSelectionSaving) setCreateListaSelectionOpen(false);
              }}
            />
            <div
              className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-300/40"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <h2
                id="create-lista-selection-title"
                className="text-lg font-bold tracking-tight text-slate-900"
              >
                {isPruebas ? "Nueva lista de prueba" : "Nueva lista"}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                {isPruebas ? (
                  <>
                    Se creará en{" "}
                    <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-800">
                      listas-test
                    </code>{" "}
                    y se añadirán los{" "}
                    <strong className="text-slate-800">{selectedCount}</strong> creador(es) que
                    tienes seleccionados.
                  </>
                ) : (
                  <>
                    Se registrará una lista de producción y se añadirán los{" "}
                    <strong className="text-slate-800">{selectedCount}</strong> creador(es)
                    seleccionados.
                  </>
                )}
              </p>
              <form
                onSubmit={(e) => void handleCreateListaSelectionSubmit(e)}
                className="mt-5 space-y-4"
              >
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-slate-600">Nombre de la lista</span>
                  <input
                    type="text"
                    value={createListaSelectionNombre}
                    onChange={(e) => setCreateListaSelectionNombre(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm !text-slate-900 placeholder:text-slate-400 focus:border-purple/40 focus:outline-none focus:ring-2 focus:ring-purple/15"
                    placeholder={isPruebas ? "Ej. QA plantilla marzo" : "Ej. Influencers Q2"}
                    maxLength={255}
                    autoComplete="off"
                    autoFocus
                    disabled={createListaSelectionSaving}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-slate-600">Status</span>
                  <Select<ListOption, false, GroupBase<ListOption>>
                    instanceId={`${selPrefix}create-lista-selection-status`}
                    inputId={`${selPrefix}create-lista-selection-status-input`}
                    classNamePrefix={`${selPrefix}react-select-lista-selection-modal`}
                    styles={selectListStyles}
                    options={LISTA_STATUS_MODAL}
                    value={createListaSelectionStatus}
                    onChange={(opt: SingleValue<ListOption>) =>
                      setCreateListaSelectionStatus(opt ?? LISTA_STATUS_MODAL[0])
                    }
                    isDisabled={createListaSelectionSaving}
                    menuPosition="fixed"
                    menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                  />
                </label>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    disabled={createListaSelectionSaving}
                    onClick={() => setCreateListaSelectionOpen(false)}
                    className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={createListaSelectionSaving}
                    className="rounded-lg bg-purple px-4 py-2 text-sm font-semibold text-white hover:bg-purple/90 disabled:opacity-50"
                  >
                    {createListaSelectionSaving ? "Creando…" : "Crear y agregar creadores"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {registerModalOpen && (
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center p-4"
            role="presentation"
          >
            <button
              type="button"
              aria-label="Cerrar"
              className="absolute inset-0 z-0 bg-slate-900/45 backdrop-blur-[2px]"
              onClick={() =>
                !registerSubmitting && !registerPrefillLoading && resetRegisterModalState()
              }
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="register-creator-title"
              className="relative z-10 flex max-h-[min(94vh,880px)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-purple/15 bg-gradient-to-b from-slate-50 via-white to-violet-50/60 shadow-2xl shadow-purple/20 ring-1 ring-white/80"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="flex shrink-0 items-center justify-between border-b border-purple/10 bg-gradient-to-r from-purple/12 via-blue/[0.08] to-pink/[0.06] px-5 py-4">
                <div>
                  <h2
                    id="register-creator-title"
                    className="text-lg font-bold tracking-tight text-slate-900"
                  >
                    {registerModalMode === "edit" ? "Editar creador" : "Nuevo creador"}
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-600">
                    {registerModalMode === "edit"
                      ? "Modifica los datos y guarda los cambios."
                      : "Email obligatorio · URLs con https:// · validación al guardar"}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={registerSubmitting || registerPrefillLoading}
                  className="rounded-xl p-2 text-slate-600 transition hover:bg-white/70 hover:text-slate-900 disabled:opacity-50"
                  onClick={() =>
                    !registerSubmitting && !registerPrefillLoading && resetRegisterModalState()
                  }
                  aria-label="Cerrar"
                >
                  <HiOutlineXMark className="h-5 w-5" />
                </button>
              </div>
              <form onSubmit={handleRegisterSubmit} className="relative flex min-h-0 flex-1 flex-col">
                {registerPrefillLoading ? (
                  <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-white/80 backdrop-blur-[1px]">
                    <span className="text-sm font-medium text-slate-600">Cargando datos del creador…</span>
                  </div>
                ) : null}
                <div className="space-y-4 overflow-y-auto px-5 py-4">
                  <div className="rounded-xl border border-slate-200/90 border-l-4 border-l-purple bg-white/95 p-4 shadow-sm shadow-slate-200/40">
                    <p className="mb-3 text-xs font-bold uppercase tracking-wide text-purple">
                      Datos principales
                    </p>
                    <div className="space-y-3">
                      <IconInputRow
                        icon={<HiOutlineEnvelope className="h-5 w-5" />}
                        label="Email"
                        requiredStar
                        error={registerFieldErrors.email}
                      >
                        <input
                          type="email"
                          autoComplete="email"
                          placeholder="correo@ejemplo.com"
                          value={registerForm.email}
                          onChange={(e) => updateRegisterForm({ email: e.target.value })}
                          className={INPUT_TEXT_CLASS}
                        />
                      </IconInputRow>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-semibold text-slate-600">Nombre</span>
                          <input
                            type="text"
                            value={registerForm.first_name}
                            onChange={(e) =>
                              updateRegisterForm({ first_name: e.target.value })
                            }
                            className={STANDALONE_INPUT_CLASS}
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-semibold text-slate-600">Apellido</span>
                          <input
                            type="text"
                            value={registerForm.last_name}
                            onChange={(e) =>
                              updateRegisterForm({ last_name: e.target.value })
                            }
                            className={STANDALONE_INPUT_CLASS}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <IconInputRow
                          icon={<HiOutlineUser className="h-5 w-5" />}
                          label="Username"
                        >
                          <input
                            type="text"
                            placeholder="@usuario"
                            value={registerForm.username}
                            onChange={(e) =>
                              updateRegisterForm({ username: e.target.value })
                            }
                            className={INPUT_TEXT_CLASS}
                          />
                        </IconInputRow>
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-semibold text-slate-600">Estado</span>
                          <Select<ListOption, false, GroupBase<ListOption>>
                            instanceId={`${selPrefix}register-creator-status`}
                            inputId={`${selPrefix}register-creator-status-input`}
                            classNamePrefix={`${selPrefix}react-select-register-status`}
                            styles={registerModalSelectStyles}
                            isSearchable={false}
                            options={STATUS_FILTER_OPTIONS}
                            value={registerStatusSelectValue}
                            onChange={(opt: SingleValue<ListOption>) => {
                              if (opt)
                                updateRegisterForm({
                                  status: opt.value as RegisterFormState["status"],
                                });
                            }}
                            menuPosition="fixed"
                            menuPortalTarget={
                              typeof document !== "undefined" ? document.body : null
                            }
                          />
                        </div>
                      </div>
                      <IconInputRow
                        icon={<HiOutlinePhoto className="h-5 w-5 text-violet-700" />}
                        iconClassName="bg-gradient-to-br from-violet-100 to-purple-50"
                        label="Foto principal (URL)"
                        error={registerFieldErrors.picture}
                      >
                        <input
                          type="text"
                          inputMode="url"
                          placeholder="https://…"
                          value={registerForm.picture}
                          onChange={(e) => updateRegisterForm({ picture: e.target.value })}
                          className={INPUT_TEXT_CLASS}
                        />
                      </IconInputRow>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200/90 border-l-4 border-l-blue bg-white/95 p-4 shadow-sm shadow-slate-200/40">
                    <p className="mb-1 text-xs font-bold uppercase tracking-wide text-blue">
                      Cuentas por plataforma
                    </p>
                    <FieldError msg={registerFieldErrors.accounts_min_one} />
                    <div className="space-y-2">
                      {sortedRegisterPlatforms.map((p) => {
                        const acc = registerForm.accounts[p.id] ?? defaultAccountDraft();
                        const open = expandedAccordions.has(p.id);
                        return (
                          <div
                            key={p.id}
                            className="overflow-hidden rounded-xl border border-slate-200/90 bg-gradient-to-r from-slate-50/80 to-white shadow-sm"
                          >
                            <button
                              type="button"
                              className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition hover:bg-white/90"
                              onClick={() =>
                                setExpandedAccordions((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(p.id)) next.delete(p.id);
                                  else next.add(p.id);
                                  return next;
                                })
                              }
                              aria-expanded={open}
                            >
                              <span className="flex items-center gap-2">
                                <span
                                  className={cn(
                                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                                    platformIconClass(p.nombre)
                                  )}
                                >
                                  {platformBrandIcon(p.nombre)}
                                </span>
                                <span className="text-sm font-bold text-slate-900">{p.nombre}</span>
                              </span>
                              {open ? (
                                <HiOutlineChevronDown className="h-5 w-5 shrink-0 text-slate-500" />
                              ) : (
                                <HiOutlineChevronRight className="h-5 w-5 shrink-0 text-slate-500" />
                              )}
                            </button>
                            {open && (
                              <div className="space-y-3 border-t border-slate-100 px-3 pb-3 pt-3">
                                <div>
                                  <p className="mb-2 text-xs font-bold text-slate-800">{p.nombre}</p>
                                  <div className="grid grid-cols-1 gap-2 md:grid-cols-10 md:gap-3 md:items-end">
                                    <div className="md:col-span-3">
                                      <label className="mb-1 block text-[11px] font-semibold text-slate-500">
                                        Usuario
                                      </label>
                                      <input
                                        type="text"
                                        value={acc.username}
                                        onChange={(e) =>
                                          updateAccountDraft(p.id, {
                                            username: e.target.value,
                                          })
                                        }
                                        placeholder="@handle"
                                        className={STANDALONE_INPUT_CLASS}
                                      />
                                    </div>
                                    <div className="md:col-span-7">
                                      <label className="mb-1 block text-[11px] font-semibold text-slate-500">
                                        URL del perfil o canal
                                      </label>
                                      <input
                                        type="text"
                                        inputMode="url"
                                        value={acc.url}
                                        onChange={(e) =>
                                          updateAccountDraft(p.id, { url: e.target.value })
                                        }
                                        placeholder="https://…"
                                        className={cn(
                                          STANDALONE_INPUT_CLASS,
                                          registerFieldErrors[`acc:${p.id}:url`]
                                            ? "border-rose-300 ring-1 ring-rose-200"
                                            : ""
                                        )}
                                      />
                                      <FieldError msg={registerFieldErrors[`acc:${p.id}:url`]} />
                                    </div>
                                  </div>
                                </div>
                                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
                                  <div className="flex flex-col gap-1">
                                    <span className="text-xs font-semibold text-slate-600">
                                      Foto de la cuenta (URL)
                                    </span>
                                    <input
                                      type="text"
                                      value={acc.picture}
                                      onChange={(e) =>
                                        updateAccountDraft(p.id, { picture: e.target.value })
                                      }
                                      placeholder="https://…"
                                      className={cn(
                                        STANDALONE_INPUT_CLASS,
                                        registerFieldErrors[`acc:${p.id}:picture`]
                                          ? "border-rose-300 ring-1 ring-rose-200"
                                          : ""
                                      )}
                                    />
                                    <FieldError msg={registerFieldErrors[`acc:${p.id}:picture`]} />
                                  </div>
                                  <div className="flex min-w-0 flex-col gap-1.5">
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-50 to-purple-100 text-purple">
                                          <HiOutlineTag className="h-4 w-4" />
                                        </span>
                                        Categorías
                                      </span>
                                      <span className="shrink-0 rounded-full bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-500 ring-1 ring-slate-200">
                                        máx. 3
                                      </span>
                                    </div>
                                    <div className="rounded-xl border border-violet-200/80 bg-gradient-to-b from-white to-violet-50/30 p-1 shadow-inner ring-1 ring-violet-100/50">
                                      <Select<CategoryOption, true, GroupBase<CategoryOption>>
                                        instanceId={`register-cat-${p.id}`}
                                        inputId={`register-cat-input-${p.id}`}
                                        classNamePrefix="react-select-register-cat"
                                        styles={categoryMultiSelectStyles}
                                        isMulti
                                        closeMenuOnSelect={false}
                                        options={CATEGORY_OPTIONS}
                                        value={[...acc.categoryValues]}
                                        isClearable={acc.categoryValues.length > 0}
                                        placeholder="Elige hasta 3…"
                                        onChange={(
                                          newValue: OnChangeValue<CategoryOption, true>,
                                          actionMeta: ActionMeta<CategoryOption>
                                        ) => {
                                          let next = [...(newValue ?? [])] as CategoryOption[];
                                          if (actionMeta.action === "clear") {
                                            next = [];
                                          }
                                          next = orderCategoryOptions(next);
                                          if (next.length > 3) next = next.slice(0, 3);
                                          updateAccountDraft(p.id, { categoryValues: next });
                                        }}
                                        menuPosition="fixed"
                                        menuPortalTarget={
                                          typeof document !== "undefined" ? document.body : null
                                        }
                                      />
                                    </div>
                                  </div>
                                </div>
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                  <div className="flex flex-col gap-1">
                                    <span className="text-xs font-semibold text-slate-600">
                                      Seguidores actuales
                                    </span>
                                    <input
                                      type="number"
                                      min={0}
                                      value={acc.followersCount}
                                      onChange={(e) =>
                                        updateAccountDraft(p.id, {
                                          followersCount: e.target.value,
                                        })
                                      }
                                      placeholder="0"
                                      className={cn(
                                        STANDALONE_INPUT_CLASS,
                                        registerFieldErrors[`acc:${p.id}:followers`]
                                          ? "border-rose-300 ring-1 ring-rose-200"
                                          : ""
                                      )}
                                    />
                                    <FieldError
                                      msg={registerFieldErrors[`acc:${p.id}:followers`]}
                                    />
                                  </div>
                                  <div className="flex flex-col gap-1">
                                    <span className="text-xs font-semibold text-slate-600">
                                      Publicaciones (aprox.)
                                    </span>
                                    <input
                                      type="number"
                                      min={0}
                                      value={acc.postCount}
                                      onChange={(e) =>
                                        updateAccountDraft(p.id, { postCount: e.target.value })
                                      }
                                      placeholder="0"
                                      className={cn(
                                        STANDALONE_INPUT_CLASS,
                                        registerFieldErrors[`acc:${p.id}:posts`]
                                          ? "border-rose-300 ring-1 ring-rose-200"
                                          : ""
                                      )}
                                    />
                                    <FieldError msg={registerFieldErrors[`acc:${p.id}:posts`]} />
                                  </div>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <span className="text-xs font-semibold text-slate-600">Bio</span>
                                    <textarea
                                      rows={2}
                                      value={acc.bio}
                                      onChange={(e) =>
                                        updateAccountDraft(p.id, { bio: e.target.value })
                                      }
                                      className="min-h-[64px] resize-y rounded-xl border border-slate-200/90 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:border-purple/50 focus:outline-none focus:ring-2 focus:ring-purple/20"
                                    />
                                  </div>
                                <label
                                  htmlFor={`creator-acc-verified-${p.id}`}
                                  className="group -mx-1 -my-1 flex cursor-pointer items-start gap-3 rounded-xl border border-transparent px-2 py-2 transition hover:border-violet-200/80 hover:bg-violet-50/40 focus-within:ring-2 focus-within:ring-purple/30 focus-within:ring-offset-1"
                                >
                                  <span className="mt-0.5 shrink-0">
                                    <BrandCheckboxControl
                                      id={`creator-acc-verified-${p.id}`}
                                      checked={acc.isVerified}
                                      onCheckedChange={(next) =>
                                        updateAccountDraft(p.id, { isVerified: next })
                                      }
                                      aria-label={`Cuenta verificada en ${p.nombre}`}
                                      size="md"
                                    />
                                  </span>
                                  <span className="text-sm font-medium leading-snug text-slate-700">
                                    Cuenta verificada en esta plataforma
                                  </span>
                                </label>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-4 flex flex-col gap-1 border-t border-slate-100 pt-4">
                      <span className="text-xs font-semibold text-slate-600">
                        Párrafo personalizado
                      </span>
                      <textarea
                        rows={2}
                        value={registerForm.personalized_paragraph}
                        onChange={(e) =>
                          updateRegisterForm({ personalized_paragraph: e.target.value })
                        }
                        className="min-h-[72px] resize-y rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:border-purple/50 focus:outline-none focus:ring-2 focus:ring-purple/20"
                      />
                    </div>
                  </div>

                  {registerError && (
                    <p
                      className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm font-medium text-rose-800"
                      role="alert"
                    >
                      {registerError}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 justify-end gap-2 border-t border-slate-200/80 bg-gradient-to-r from-slate-50/95 to-violet-50/50 px-5 py-3.5">
                  <button
                    type="button"
                    disabled={registerSubmitting || registerPrefillLoading}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
                    onClick={() =>
                      !registerSubmitting && !registerPrefillLoading && resetRegisterModalState()
                    }
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={registerSubmitting || registerPrefillLoading}
                    className="rounded-xl bg-gradient-to-r from-purple to-blue px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-purple/25 transition hover:opacity-95 disabled:opacity-50"
                  >
                    {registerSubmitting
                      ? "Guardando…"
                      : registerModalMode === "edit"
                        ? "Guardar cambios"
                        : "Guardar creador"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
