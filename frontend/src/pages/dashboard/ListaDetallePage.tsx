import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { StylesConfig } from "react-select";
import Select from "react-select";
import type { GroupBase, MultiValue, SingleValue } from "react-select";
import Swal from "sweetalert2";
import {
  HiOutlineCalendarDays,
  HiOutlineCheckBadge,
  HiOutlineChevronDown,
  HiOutlineChevronRight,
  HiOutlineCircleStack,
  HiOutlineFunnel,
  HiOutlineInformationCircle,
  HiOutlinePencilSquare,
  HiOutlinePlusCircle,
  HiOutlineSparkles,
  HiOutlineUserMinus,
  HiOutlineUsers,
  HiOutlineXMark,
} from "react-icons/hi2";
import { cn } from "../../lib/utils";
import { AvatarWithFallback } from "../../components/AvatarWithFallback";
import { selectListStyles, type ListOption } from "../../components/ui/select-list";
import {
  fetchListaById,
  fetchCreators,
  fetchListaRecipients,
  fetchPlatforms,
  linkManyCreatorsToLista,
  removeCreatorFromLista,
  uploadListaRecipientsFile,
  updateLista,
  type CreatorRead,
  type ListaRead,
  type PlatformRead,
} from "../../lib/api";
import {
  downloadCreadoresPlantillaCsv,
  downloadCreadoresPlantillaXlsx,
} from "../../lib/creadoresBulkLayout";

const LISTA_STATUS_OPTIONS: ListOption[] = [
  { value: "activo", label: "Activa" },
  { value: "inactivo", label: "Inactiva" },
];

const FILTER_FIELDS = [
  { key: "id", label: "ID", placeholder: "UUID o fragmento" },
  { key: "email", label: "Email", placeholder: "correo@..." },
  { key: "nombre", label: "Nombre", placeholder: "Nombre" },
  { key: "apellido", label: "Apellido", placeholder: "Apellido" },
  { key: "username", label: "Username", placeholder: "@usuario" },
  { key: "facebook_page", label: "Facebook page", placeholder: "Página o URL" },
] as const;

type FilterFieldKey = (typeof FILTER_FIELDS)[number]["key"];

const STATUS_FILTER_OPTIONS: ListOption[] = [
  { value: "activo", label: "Activo" },
  { value: "inactivo", label: "Inactivo" },
];

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

type CreatorOption = ListOption & {
  email: string;
  fullName: string;
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

function creatorToOption(c: CreatorRead): CreatorOption {
  const fullName = c.full_name?.trim() || [c.first_name, c.last_name].filter(Boolean).join(" ").trim() || c.email;
  return {
    value: c.id,
    label: `${fullName} · ${c.email}`,
    email: c.email,
    fullName,
  };
}

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

function PlatformBadge({ name }: { name: string }) {
  const tone: Record<string, string> = {
    TikTok: "from-slate-900 to-slate-800",
    Instagram: "from-fuchsia-600 via-pink-600 to-amber-500",
    YouTube: "from-red-600 to-red-500",
    Facebook: "from-[#1877F2] to-[#0C63D4]",
  };
  const g = tone[name] ?? "from-purple to-blue";
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

type AppliedRecipientFilters = {
  status: string | null;
  fields: Record<FilterFieldKey, string>;
  platformIds: string[];
  minCamp: number | null;
  maxCamp: number | null;
};

function emptyAppliedFilters(): AppliedRecipientFilters {
  return {
    status: null,
    fields: Object.fromEntries(FILTER_FIELDS.map((f) => [f.key, ""])) as Record<
      FilterFieldKey,
      string
    >,
    platformIds: [],
    minCamp: null,
    maxCamp: null,
  };
}

function recipientMatchesApplied(c: CreatorRead, applied: AppliedRecipientFilters): boolean {
  if (applied.status && normalizeStatus(c.status) !== applied.status) return false;

  const idFrag = applied.fields.id.trim().toLowerCase();
  if (idFrag && !c.id.toLowerCase().includes(idFrag)) return false;

  const emailFrag = applied.fields.email.trim().toLowerCase();
  if (emailFrag && !c.email.toLowerCase().includes(emailFrag)) return false;

  const nombre = applied.fields.nombre.trim().toLowerCase();
  if (nombre && !(c.first_name ?? "").toLowerCase().includes(nombre)) return false;

  const apellido = applied.fields.apellido.trim().toLowerCase();
  if (apellido && !(c.last_name ?? "").toLowerCase().includes(apellido)) return false;

  const uname = applied.fields.username.trim().toLowerCase().replace(/^@/, "");
  if (uname) {
    const cu = (c.username ?? "").toLowerCase().replace(/^@/, "");
    if (!cu.includes(uname)) return false;
  }

  const fb = applied.fields.facebook_page.trim().toLowerCase();
  if (fb && !(c.facebook_page ?? "").toLowerCase().includes(fb)) return false;

  if (applied.platformIds.length > 0) {
    const ids = new Set(c.account_profiles.map((ap) => ap.platform_id));
    for (const pid of applied.platformIds) {
      if (!ids.has(pid)) return false;
    }
  }

  if (applied.minCamp != null && c.num_campaigns < applied.minCamp) return false;
  if (applied.maxCamp != null && c.num_campaigns > applied.maxCamp) return false;

  return true;
}

export function ListaDetallePage() {
  const { listId } = useParams<{ listId: string }>();
  const navigate = useNavigate();

  const [lista, setLista] = useState<ListaRead | null>(null);
  const [recipientsRaw, setRecipientsRaw] = useState<CreatorRead[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const [formNombre, setFormNombre] = useState("");
  const [formListaStatus, setFormListaStatus] = useState<ListOption | null>(LISTA_STATUS_OPTIONS[0]);
  const [savingMeta, setSavingMeta] = useState(false);

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
  const [draftFilterPlatforms, setDraftFilterPlatforms] = useState<readonly ListOption[]>([]);
  const [appliedRecipientFilters, setAppliedRecipientFilters] = useState<AppliedRecipientFilters>(
    () => emptyAppliedFilters()
  );

  const [platformsList, setPlatformsList] = useState<PlatformRead[]>([]);
  const [rowBusyId, setRowBusyId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [manageOpen, setManageOpen] = useState(false);
  const [creatorOptions, setCreatorOptions] = useState<CreatorOption[]>([]);
  const [creatorSelectLoading, setCreatorSelectLoading] = useState(false);
  const [selectedCreatorOptions, setSelectedCreatorOptions] = useState<readonly CreatorOption[]>([]);
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [manageBusy, setManageBusy] = useState(false);
  const [manageMode, setManageMode] = useState<"existing" | "import">("existing");
  const [editingListName, setEditingListName] = useState(false);
  const listNameInputRef = useRef<HTMLInputElement>(null);

  const filterPlatformOptions = useMemo<ListOption[]>(
    () =>
      [...platformsList]
        .sort((a, b) => a.nombre.localeCompare(b.nombre))
        .map((p) => ({ value: p.id, label: p.nombre })),
    [platformsList]
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

  const reloadAll = useCallback(async () => {
    if (!listId) return;
    setPageLoading(true);
    setPageError(null);
    try {
      const [l, rec] = await Promise.all([
        fetchListaById(listId),
        fetchListaRecipients(listId),
      ]);
      setLista(l);
      setRecipientsRaw(rec);
      setFormNombre(l.nombre);
      setFormListaStatus(
        LISTA_STATUS_OPTIONS.find((o) => o.value === l.status) ?? LISTA_STATUS_OPTIONS[0]
      );
    } catch (e) {
      setPageError(e instanceof Error ? e.message : "No se pudo cargar la lista.");
      setLista(null);
      setRecipientsRaw([]);
    } finally {
      setPageLoading(false);
    }
  }, [listId]);

  useEffect(() => {
    if (!listId) {
      navigate("/dashboard/listas", { replace: true });
      return;
    }
    void reloadAll();
  }, [listId, navigate, reloadAll]);

  useEffect(() => {
    setSelected(new Set());
  }, [listId]);

  const filteredRecipients = useMemo(
    () => recipientsRaw.filter((c) => recipientMatchesApplied(c, appliedRecipientFilters)),
    [recipientsRaw, appliedRecipientFilters]
  );

  const tableRows = useMemo(
    () => filteredRecipients.map(creatorReadToRow),
    [filteredRecipients]
  );

  const allRecipientIds = tableRows.map((r) => r.id);
  const selectedCount = selected.size;
  const allSelected =
    allRecipientIds.length > 0 && selectedCount === allRecipientIds.length;
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
    else setSelected(new Set(allRecipientIds));
  };

  const handleRemoveSelectedFromList = useCallback(async () => {
    if (!listId) return;
    const ids = Array.from(selected);
    if (ids.length === 0) return;

    const r = await Swal.fire({
      icon: "question",
      title: "¿Quitar de la lista?",
      html: `Se desvincularán <strong>${ids.length}</strong> creador(es) de esta lista. Los creadores seguirán en el directorio.`,
      showCancelButton: true,
      confirmButtonText: "Sí, quitar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#7c3aed",
    });
    if (!r.isConfirmed) return;

    void Swal.fire({
      title: "Quitando de la lista…",
      html: `Procesando <strong>${ids.length}</strong> creador(es).`,
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    const errors: string[] = [];
    let removed = 0;
    for (const id of ids) {
      try {
        await removeCreatorFromLista(listId, id);
        removed += 1;
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
          ? "No se pudieron quitar"
          : errors.length > 0
            ? "Proceso completado con avisos"
            : "Quitados de la lista",
      html: `<p class="text-sm text-slate-600">Desvinculados correctamente: <strong>${removed}</strong></p>${errHtml}`,
      confirmButtonText: "Aceptar",
      confirmButtonColor: "#7c3aed",
    });

    setSelected(new Set());
    await reloadAll();
  }, [listId, selected, reloadAll]);

  const applyFilters = () => {
    const next: AppliedRecipientFilters = {
      status: draftStatus?.value ?? null,
      fields: { ...draftFields },
      platformIds: draftFilterPlatforms.map((o) => o.value),
      minCamp: null,
      maxCamp: null,
    };
    const minS = draftMinCamp.trim();
    const maxS = draftMaxCamp.trim();
    if (minS) {
      const n = parseInt(minS, 10);
      if (!Number.isNaN(n)) next.minCamp = n;
    }
    if (maxS) {
      const n = parseInt(maxS, 10);
      if (!Number.isNaN(n)) next.maxCamp = n;
    }
    setAppliedRecipientFilters(next);
  };

  const clearFilters = () => {
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
    setAppliedRecipientFilters(emptyAppliedFilters());
  };

  const persistListaMeta = useCallback(
    async (params?: { nombre?: string; status?: "activo" | "inactivo"; silent?: boolean }) => {
      if (!listId || !lista) return false;
      const nombre = (params?.nombre ?? formNombre).trim();
      if (!nombre) {
        void Swal.fire({
          icon: "warning",
          title: "Nombre requerido",
          text: "Indica un nombre para la lista.",
        });
        setFormNombre(lista.nombre);
        return false;
      }
      const st =
        params?.status ?? ((formListaStatus?.value ?? "activo") as "activo" | "inactivo");
      const unchanged = nombre === lista.nombre && st === lista.status;
      if (unchanged) return true;
      setSavingMeta(true);
      try {
        const updated = await updateLista(listId, { nombre, status: st });
        setLista(updated);
        setFormNombre(updated.nombre);
        setFormListaStatus(
          LISTA_STATUS_OPTIONS.find((o) => o.value === updated.status) ?? LISTA_STATUS_OPTIONS[0]
        );
        if (!params?.silent) {
          void Swal.fire({
            icon: "success",
            title: "Guardado",
            timer: 1400,
            showConfirmButton: false,
          });
        }
        return true;
      } catch (err) {
        void Swal.fire({
          icon: "error",
          title: "Error",
          text: err instanceof Error ? err.message : "No se pudo guardar.",
        });
        setFormNombre(lista.nombre);
        setFormListaStatus(
          LISTA_STATUS_OPTIONS.find((o) => o.value === lista.status) ?? LISTA_STATUS_OPTIONS[0]
        );
        return false;
      } finally {
        setSavingMeta(false);
      }
    },
    [listId, lista, formNombre, formListaStatus]
  );

  useEffect(() => {
    if (editingListName) {
      listNameInputRef.current?.focus();
      listNameInputRef.current?.select();
    }
  }, [editingListName]);

  const startEditingListName = () => {
    if (!lista || pageLoading || savingMeta) return;
    setFormNombre(lista.nombre);
    setEditingListName(true);
  };

  const commitListNameEdit = () => {
    if (!lista) return;
    const trimmed = formNombre.trim();
    setEditingListName(false);
    if (!trimmed) {
      setFormNombre(lista.nombre);
      return;
    }
    if (trimmed === lista.nombre) return;
    void persistListaMeta({ nombre: trimmed });
  };

  const cancelListNameEdit = () => {
    if (!lista) return;
    setFormNombre(lista.nombre);
    setEditingListName(false);
  };

  const removeFromList = async (row: CreatorRow) => {
    if (!listId) return;
    const r = await Swal.fire({
      icon: "question",
      title: "¿Quitar de la lista?",
      html: `Se desvinculará <strong>${row.fullName}</strong> de esta lista. El creador seguirá en el directorio.`,
      showCancelButton: true,
      confirmButtonText: "Sí, quitar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#7c3aed",
    });
    if (!r.isConfirmed) return;
    setRowBusyId(row.id);
    try {
      await removeCreatorFromLista(listId, row.id);
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(row.id);
        return next;
      });
      await reloadAll();
      void Swal.fire({
        icon: "success",
        title: "Quitado de la lista",
        timer: 1400,
        showConfirmButton: false,
      });
    } catch (err) {
      void Swal.fire({
        icon: "error",
        title: "Error",
        text: err instanceof Error ? err.message : "No se pudo quitar.",
      });
    } finally {
      setRowBusyId(null);
    }
  };

  const openManageCreators = async () => {
    if (!lista) return;
    setManageOpen(true);
    setManageMode("existing");
    setSelectedCreatorOptions([]);
    setBulkFile(null);
    setCreatorSelectLoading(true);
    try {
      const creators = await fetchCreators({ status: "activo", limit: 500 });
      setCreatorOptions(creators.map(creatorToOption));
    } catch (err) {
      void Swal.fire({
        icon: "error",
        title: "No se pudieron cargar creadores",
        text: err instanceof Error ? err.message : "Error cargando creadores.",
      });
      setCreatorOptions([]);
    } finally {
      setCreatorSelectLoading(false);
    }
  };

  const closeManageModal = () => {
    if (manageBusy) return;
    setManageOpen(false);
    setManageMode("existing");
    setSelectedCreatorOptions([]);
    setBulkFile(null);
  };

  const submitExistingCreators = async () => {
    if (!lista) return;
    const ids = selectedCreatorOptions.map((o) => o.value);
    if (ids.length === 0) {
      void Swal.fire({
        icon: "warning",
        title: "Selecciona creadores",
        text: "Elige al menos un creador para agregar a la lista.",
      });
      return;
    }
    setManageBusy(true);
    try {
      const res = await linkManyCreatorsToLista(lista.id, ids);
      await reloadAll();
      await Swal.fire({
        icon: "success",
        title: "Creadores procesados",
        html: `
          <div style="text-align:left;font-size:13px;line-height:1.5">
            <div><strong>Nuevos en lista:</strong> ${res.linked_new}</div>
            <div><strong>Ya estaban:</strong> ${res.already_in_list}</div>
            <div><strong>No encontrados:</strong> ${res.not_found.length}</div>
          </div>
        `,
        confirmButtonColor: "#7c3aed",
      });
      setSelectedCreatorOptions([]);
    } catch (err) {
      void Swal.fire({
        icon: "error",
        title: "Error",
        text: err instanceof Error ? err.message : "No se pudieron agregar creadores.",
      });
    } finally {
      setManageBusy(false);
    }
  };

  const submitFileToList = async () => {
    if (!listId || !bulkFile) return;
    setManageBusy(true);
    try {
      const res = await uploadListaRecipientsFile(listId, bulkFile);
      await reloadAll();
      await Swal.fire({
        icon: "success",
        title: "Importación completada",
        html: `
          <div style="text-align:left;font-size:13px;line-height:1.5">
            <div><strong>Registros del archivo:</strong> ${res.rows_upserted}</div>
            <div><strong>Creados:</strong> ${res.creators_created}</div>
            <div><strong>Actualizados:</strong> ${res.creators_updated}</div>
            <div><strong>Nuevos en lista:</strong> ${res.linked_new}</div>
            <div><strong>Ya estaban:</strong> ${res.already_in_list}</div>
            <div><strong>Errores:</strong> ${res.errors.length}</div>
          </div>
        `,
        confirmButtonColor: "#7c3aed",
      });
      setBulkFile(null);
    } catch (err) {
      void Swal.fire({
        icon: "error",
        title: "Importación fallida",
        text: err instanceof Error ? err.message : "No se pudo procesar el archivo.",
      });
    } finally {
      setManageBusy(false);
    }
  };

  const breadcrumbName = lista?.nombre ?? (pageLoading ? "…" : "Lista");
  const createdAtLabel = lista?.created_at
    ? new Date(lista.created_at).toLocaleString("es")
    : "—";
  const activeRecipientsCount = useMemo(
    () => recipientsRaw.filter((r) => normalizeStatus(r.status) === "activo").length,
    [recipientsRaw]
  );
  const platformCount = useMemo(() => {
    const ids = new Set<string>();
    recipientsRaw.forEach((r) => r.account_profiles.forEach((ap) => ids.add(ap.platform_id)));
    return ids.size;
  }, [recipientsRaw]);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-gradient-to-b from-slate-50 via-white to-slate-50/90">
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,transparent_0%,rgba(255,255,255,0.35)_45%,transparent_100%)]"
        aria-hidden
      />

      <div className="relative z-10 mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {/* Fila 1: breadcrumb */}
        <nav
          className="mb-6 flex flex-wrap items-center gap-2 text-sm text-slate-600"
          aria-label="Ruta"
        >
          <Link
            to="/dashboard/listas"
            className="font-semibold text-purple hover:text-purple/80 hover:underline"
          >
            Listas
          </Link>
          <span className="text-slate-400" aria-hidden>
            /
          </span>
          <span className="font-medium text-slate-900">{breadcrumbName}</span>
        </nav>

        {pageError && (
          <div
            className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-900"
            role="alert"
          >
            <p>{pageError}</p>
            <button
              type="button"
              onClick={() => navigate("/dashboard/listas")}
              className="mt-3 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-rose-900 ring-1 ring-rose-200 hover:bg-rose-50"
            >
              Volver a listas
            </button>
          </div>
        )}

        {!pageError && (
          <>
            <div className="mt-4 relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm shadow-slate-200/50 sm:p-8">
              <div
                className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-gradient-to-br from-purple/12 via-transparent to-blue/10 blur-2xl"
                aria-hidden
              />
              <div className="relative flex flex-col gap-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-purple">
                      Audiencia Reutilizable
                    </p>
                    <div className="group/title mt-2 flex min-w-0 flex-wrap items-center gap-2">
                      {editingListName ? (
                        <div className="flex min-w-0 max-w-xl flex-1 items-center gap-2">
                          <input
                            ref={listNameInputRef}
                            type="text"
                            value={formNombre}
                            onChange={(e) => setFormNombre(e.target.value)}
                            onBlur={() => void commitListNameEdit()}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                listNameInputRef.current?.blur();
                              }
                              if (e.key === "Escape") {
                                e.preventDefault();
                                cancelListNameEdit();
                              }
                            }}
                            disabled={pageLoading || savingMeta}
                            maxLength={255}
                            autoComplete="off"
                            className="min-w-0 flex-1 rounded-lg border border-purple/35 bg-white px-3 py-2 text-2xl font-bold tracking-tight !text-slate-900 shadow-sm focus:border-purple focus:outline-none focus:ring-2 focus:ring-purple/20 disabled:opacity-60 sm:text-3xl"
                          />
                          <button
                            type="button"
                            title="Cancelar"
                            aria-label="Cancelar edición del nombre"
                            disabled={pageLoading || savingMeta}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              cancelListNameEdit();
                            }}
                            className="shrink-0 rounded-lg border border-slate-200 bg-white p-2 text-slate-500 shadow-sm transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-40"
                          >
                            <HiOutlineXMark className="h-5 w-5 sm:h-6 sm:w-6" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <h1 className="min-w-0 truncate text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                            {lista?.nombre ?? "Detalle de lista"}
                          </h1>
                          <button
                            type="button"
                            title="Editar nombre"
                            aria-label="Editar nombre de la lista"
                            onClick={() => startEditingListName()}
                            disabled={pageLoading || savingMeta || !lista}
                            className="shrink-0 rounded-lg p-1.5 text-purple opacity-0 transition hover:bg-purple/10 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple/30 disabled:opacity-30 group-hover/title:opacity-100"
                          >
                            <HiOutlinePencilSquare className="h-6 w-6" />
                          </button>
                        </>
                      )}
                    </div>
                    <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
                      Gestiona nombre, estado y miembros de tu lista para campañas futuras. Usa filtros
                      avanzados para validar rápidamente la calidad de tus destinatarios.
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-stretch gap-2 self-start sm:flex-row sm:items-center">
                    <div
                      className={cn(
                        "flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold",
                        lista?.status === "inactivo"
                          ? "border-slate-200 bg-slate-100 text-slate-700"
                          : "border-indigo-200 bg-indigo-50 text-indigo-700"
                      )}
                    >
                      <HiOutlineSparkles className="h-4 w-4" />
                      {lista?.status === "inactivo" ? "Lista inactiva" : "Lista activa y editable"}
                    </div>
                    <button
                      type="button"
                      onClick={() => void openManageCreators()}
                      disabled={pageLoading || manageBusy || !lista}
                      className="inline-flex items-center justify-center gap-1 rounded-lg border border-indigo-100 bg-indigo-50/80 px-3 py-2 text-sm font-semibold text-indigo-800 hover:bg-indigo-100 disabled:opacity-50"
                    >
                      <HiOutlinePlusCircle className="h-4 w-4" />
                      Agregar creadores
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Miembros totales
                    </p>
                    <p className="mt-1 inline-flex items-center gap-2 text-xl font-bold text-slate-900">
                      <HiOutlineUsers className="h-5 w-5 text-purple" />
                      {recipientsRaw.length}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Creadores activos
                    </p>
                    <p className="mt-1 inline-flex items-center gap-2 text-xl font-bold text-slate-900">
                      <HiOutlineCheckBadge className="h-5 w-5 text-emerald-600" />
                      {activeRecipientsCount}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Plataformas detectadas
                    </p>
                    <p className="mt-1 inline-flex items-center gap-2 text-xl font-bold text-slate-900">
                      <HiOutlineCircleStack className="h-5 w-5 text-indigo-600" />
                      {platformCount}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</p>
                    <div className="mt-1.5 min-w-0">
                      <Select<ListOption, false, GroupBase<ListOption>>
                        instanceId="lista-detalle-summary-status"
                        inputId="lista-detalle-summary-status-input"
                        classNamePrefix="react-select-lista-summary-status"
                        styles={selectListStyles}
                        options={LISTA_STATUS_OPTIONS}
                        value={formListaStatus}
                        onChange={(opt: SingleValue<ListOption>) => {
                          const next = opt ?? LISTA_STATUS_OPTIONS[0];
                          const st = next.value as "activo" | "inactivo";
                          setFormListaStatus(next);
                          if (lista && st !== lista.status) {
                            void persistListaMeta({ status: st });
                          }
                        }}
                        isDisabled={pageLoading || savingMeta || !lista}
                        menuPosition="fixed"
                        menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                      />
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Fecha creación
                    </p>
                    <p className="mt-1 inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
                      <HiOutlineCalendarDays className="h-5 w-5 text-slate-500" />
                      {createdAtLabel}
                    </p>
                  </div>
                </div>

                <div className="flex w-full items-start gap-2 rounded-xl border border-sky-100 bg-sky-50/80 px-4 py-3 text-sm text-sky-900">
                  <HiOutlineInformationCircle className="mt-0.5 h-5 w-5 shrink-0 text-sky-600" />
                  <p className="text-xs leading-relaxed text-sky-900/90">
                    Consejo: aplica filtros antes de hacer limpieza masiva para evitar quitar creadores
                    por error.
                  </p>
                </div>
              </div>
            </div>

            {/* Filtros (misma lógica visual que Creadores; filtrado en cliente) */}
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
                  Filtrar creadores de la lista
                </span>
                {filtersOpen ? (
                  <HiOutlineChevronDown className="h-5 w-5 text-slate-500" />
                ) : (
                  <HiOutlineChevronRight className="h-5 w-5 text-slate-500" />
                )}
              </button>
              {filtersOpen && (
                <div className="border-t border-slate-100 px-4 pb-5 pt-3 sm:px-5">
                  <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-end">
                    <div className="w-full min-w-[180px] max-w-[320px]">
                      <label className="flex flex-col gap-1">
                        <span className="text-xs font-semibold text-slate-600">Status</span>
                        <Select<ListOption, false, GroupBase<ListOption>>
                          instanceId="lista-detalle-filter-creator-status"
                          inputId="lista-detalle-filter-creator-status-input"
                          classNamePrefix="react-select-lista-detalle-creator-status"
                          styles={creatorsFilterStatusStyles}
                          isClearable
                          placeholder="Todos"
                          options={STATUS_FILTER_OPTIONS}
                          value={draftStatus}
                          onChange={(opt: SingleValue<ListOption>) => setDraftStatus(opt)}
                          menuPosition="fixed"
                          menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                        />
                      </label>
                    </div>
                    <div className="min-w-0">
                      <label className="flex flex-col gap-1">
                        <span className="text-xs font-semibold text-slate-600">
                          Plataformas (cuenta registrada)
                        </span>
                        <Select<ListOption, true, GroupBase<ListOption>>
                          instanceId="lista-detalle-filter-platforms"
                          inputId="lista-detalle-filter-platforms-input"
                          classNamePrefix="react-select-lista-detalle-platforms"
                          styles={creatorsFilterPlatformMultiStyles}
                          isMulti
                          isClearable
                          closeMenuOnSelect={false}
                          placeholder="Todas · elige una o varias…"
                          options={filterPlatformOptions}
                          value={[...draftFilterPlatforms]}
                          onChange={(opts: MultiValue<ListOption>) =>
                            setDraftFilterPlatforms(opts ?? [])
                          }
                          menuPosition="fixed"
                          menuPortalTarget={typeof document !== "undefined" ? document.body : null}
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
                      <label key={key} className="mt-4 flex flex-col gap-1.5">
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
                    <div className="mt-4 flex flex-col gap-1.5 sm:col-span-2 lg:col-span-1">
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
                      onClick={applyFilters}
                    >
                      Aplicar filtros
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                      onClick={clearFilters}
                    >
                      Limpiar
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <p className="text-sm text-slate-600">
                {pageLoading ? (
                  "Cargando creadores…"
                ) : (
                  <>
                    Mostrando{" "}
                    <strong className="text-slate-700">{tableRows.length}</strong> de{" "}
                    <strong className="text-slate-700">{recipientsRaw.length}</strong> creadores en
                    esta lista
                  </>
                )}
              </p>
              {selectedCount > 0 && (
                <button
                  type="button"
                  onClick={() => void handleRemoveSelectedFromList()}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-2.5 text-sm font-semibold text-amber-950 shadow-sm",
                    "hover:border-amber-300 hover:bg-amber-100"
                  )}
                >
                  <HiOutlineUserMinus className="h-4 w-4 shrink-0" />
                  Quitar seleccionados de la lista
                  <span className="rounded-full bg-white/90 px-2 py-0.5 text-xs font-bold text-amber-900">
                    {selectedCount}
                  </span>
                </button>
              )}
            </div>

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
                            aria-label="Seleccionar todos los creadores visibles"
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
                      <th className="min-w-[160px] px-3 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pageLoading && tableRows.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-3 py-12 text-center text-sm text-slate-500">
                          Cargando…
                        </td>
                      </tr>
                    ) : null}
                    {!pageLoading && tableRows.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-3 py-12 text-center text-sm text-slate-500">
                          {recipientsRaw.length === 0
                            ? "No hay creadores en esta lista."
                            : "Ningún creador coincide con los filtros."}
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
                          <div className="flex justify-end">
                            <button
                              type="button"
                              disabled={rowBusyId === row.id}
                              title="Quitar de la lista"
                              onClick={() => void removeFromList(row)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50/90 px-2.5 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-50"
                            >
                              <HiOutlineUserMinus className="h-4 w-4 shrink-0" />
                              Quitar de la lista
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {manageOpen && lista && (
              <div
                className="fixed inset-0 z-[210] flex items-center justify-center p-4"
                role="dialog"
                aria-modal="true"
                aria-labelledby="manage-creators-modal-title"
              >
                <button
                  type="button"
                  className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
                  aria-label="Cerrar"
                  onClick={closeManageModal}
                />
                <div
                  className="relative z-10 w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-300/50"
                  onClick={(e) => e.stopPropagation()}
                >
                  <h2 id="manage-creators-modal-title" className="text-lg font-bold text-slate-900">
                    Agregar creadores a: {lista.nombre}
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Puedes asociar creadores existentes con selección múltiple o importar CSV/XLSX
                    para crear/actualizar y vincular en una sola acción.
                  </p>

                  <div className="mt-5">
                    <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
                      <button
                        type="button"
                        onClick={() => setManageMode("existing")}
                        disabled={manageBusy}
                        className={cn(
                          "rounded-lg px-3 py-1.5 text-sm font-semibold transition",
                          manageMode === "existing"
                            ? "bg-white text-indigo-700 shadow-sm"
                            : "text-slate-600 hover:text-slate-800"
                        )}
                      >
                        Creadores preexistentes
                      </button>
                      <button
                        type="button"
                        onClick={() => setManageMode("import")}
                        disabled={manageBusy}
                        className={cn(
                          "rounded-lg px-3 py-1.5 text-sm font-semibold transition",
                          manageMode === "import"
                            ? "bg-white text-indigo-700 shadow-sm"
                            : "text-slate-600 hover:text-slate-800"
                        )}
                      >
                        Importar CSV/XLSX
                      </button>
                    </div>

                    {manageMode === "existing" ? (
                      <section className="mt-4 rounded-xl border border-slate-200 p-4">
                        <h3 className="text-sm font-semibold text-slate-800">Creadores preexistentes</h3>
                        <p className="mt-1 text-xs text-slate-500">
                          Selección múltiple con React Select. No duplica asociaciones si ya estaban en la lista.
                        </p>
                        <div className="mt-3">
                          <Select<CreatorOption, true, GroupBase<CreatorOption>>
                            instanceId="lista-detalle-add-existing-creators"
                            inputId="lista-detalle-add-existing-creators-input"
                            isMulti
                            isClearable
                            closeMenuOnSelect={false}
                            isLoading={creatorSelectLoading}
                            isDisabled={creatorSelectLoading || manageBusy}
                            options={creatorOptions}
                            value={selectedCreatorOptions}
                            onChange={(opts: MultiValue<CreatorOption>) => setSelectedCreatorOptions(opts)}
                            placeholder="Busca y selecciona creadores..."
                            menuPosition="fixed"
                            menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                            noOptionsMessage={() =>
                              creatorSelectLoading ? "Cargando creadores..." : "Sin resultados"
                            }
                          />
                        </div>
                        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs text-slate-500">
                            Seleccionados: <strong>{selectedCreatorOptions.length}</strong>
                          </p>
                          <button
                            type="button"
                            disabled={manageBusy || selectedCreatorOptions.length === 0}
                            onClick={() => void submitExistingCreators()}
                            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                          >
                            Agregar seleccionados
                          </button>
                        </div>
                      </section>
                    ) : (
                      <section className="mt-4 rounded-xl border border-slate-200 p-4">
                        <h3 className="text-sm font-semibold text-slate-800">Importar CSV/XLSX</h3>
                        <p className="mt-1 text-xs text-slate-500">
                          Si existe: actualiza datos y lo vincula. Si no existe: lo crea y lo vincula.
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={downloadCreadoresPlantillaCsv}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            Plantilla CSV
                          </button>
                          <button
                            type="button"
                            onClick={downloadCreadoresPlantillaXlsx}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            Plantilla XLSX
                          </button>
                        </div>
                        <input
                          type="file"
                          accept=".csv,.xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                          className="mt-3 w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-indigo-700 hover:file:bg-indigo-100"
                          onChange={(e) => setBulkFile(e.target.files?.[0] ?? null)}
                          disabled={manageBusy}
                        />
                        {bulkFile ? (
                          <p className="mt-2 text-xs text-slate-600">
                            Archivo: <strong>{bulkFile.name}</strong>
                          </p>
                        ) : null}
                        <div className="mt-4 flex justify-end">
                          <button
                            type="button"
                            disabled={manageBusy || !bulkFile}
                            onClick={() => void submitFileToList()}
                            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                          >
                            Importar y vincular
                          </button>
                        </div>
                      </section>
                    )}
                  </div>

                  <div className="mt-6 flex justify-between gap-2 border-t border-slate-100 pt-4">
                    <p className="text-xs text-slate-500">
                      Tip: usa la importación para altas/actualizaciones masivas.
                    </p>
                    <button
                      type="button"
                      onClick={closeManageModal}
                      disabled={manageBusy}
                      className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      Cerrar
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
