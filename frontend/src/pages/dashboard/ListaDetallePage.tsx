import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { StylesConfig } from "react-select";
import Select from "react-select";
import type { GroupBase, MultiValue, SingleValue } from "react-select";
import Swal from "sweetalert2";
import {
  HiOutlineChevronDown,
  HiOutlineChevronRight,
  HiOutlineFunnel,
  HiOutlineUserMinus,
} from "react-icons/hi2";
import { cn } from "../../lib/utils";
import { AvatarWithFallback } from "../../components/AvatarWithFallback";
import { selectListStyles, type ListOption } from "../../components/ui/select-list";
import {
  fetchListaById,
  fetchListaRecipients,
  fetchPlatforms,
  removeCreatorFromLista,
  updateLista,
  type CreatorRead,
  type ListaRead,
  type PlatformRead,
} from "../../lib/api";

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

  const saveListaMeta = async (e: FormEvent) => {
    e.preventDefault();
    if (!listId || !lista) return;
    const nombre = formNombre.trim();
    if (!nombre) {
      void Swal.fire({
        icon: "warning",
        title: "Nombre requerido",
        text: "Indica un nombre para la lista.",
      });
      return;
    }
    const st = (formListaStatus?.value ?? "activo") as "activo" | "inactivo";
    setSavingMeta(true);
    try {
      const updated = await updateLista(listId, { nombre, status: st });
      setLista(updated);
      void Swal.fire({
        icon: "success",
        title: "Guardado",
        timer: 1600,
        showConfirmButton: false,
      });
    } catch (err) {
      void Swal.fire({
        icon: "error",
        title: "Error",
        text: err instanceof Error ? err.message : "No se pudo guardar.",
      });
    } finally {
      setSavingMeta(false);
    }
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

  const breadcrumbName = lista?.nombre ?? (pageLoading ? "…" : "Lista");

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
            {/* Nombre y status de la lista */}
            <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm shadow-slate-200/50 sm:p-8">
              <div
                className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-gradient-to-br from-purple/12 via-transparent to-blue/10 blur-2xl"
                aria-hidden
              />
              <form
                onSubmit={(e) => void saveListaMeta(e)}
                className="relative grid gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_220px_auto] lg:items-end"
              >
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-slate-600">Nombre de la lista</span>
                  <input
                    type="text"
                    value={formNombre}
                    onChange={(e) => setFormNombre(e.target.value)}
                    disabled={pageLoading}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm !text-slate-900 placeholder:text-slate-400 focus:border-purple/40 focus:outline-none focus:ring-2 focus:ring-purple/15"
                    placeholder="Nombre"
                    maxLength={255}
                    autoComplete="off"
                  />
                </label>
                <div className="w-full min-w-[180px] max-w-[320px]">
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-semibold text-slate-600">Status</span>
                    <Select<ListOption, false, GroupBase<ListOption>>
                      instanceId="lista-detalle-meta-status"
                      inputId="lista-detalle-meta-status-input"
                      classNamePrefix="react-select-lista-detalle-meta"
                      styles={selectListStyles}
                      options={LISTA_STATUS_OPTIONS}
                      value={formListaStatus}
                      onChange={(opt: SingleValue<ListOption>) =>
                        setFormListaStatus(opt ?? LISTA_STATUS_OPTIONS[0])
                      }
                      isDisabled={pageLoading}
                      menuPosition="fixed"
                      menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                    />
                  </label>
                </div>
                <div className="flex sm:col-span-2 lg:col-span-1 lg:justify-end">
                  <button
                    type="submit"
                    disabled={pageLoading || savingMeta}
                    className="rounded-xl bg-purple px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-purple/90 disabled:opacity-50"
                  >
                    {savingMeta ? "Guardando…" : "Guardar cambios"}
                  </button>
                </div>
              </form>
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

            {/* Tabla (misma estructura que Creadores, con selección) */}
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
          </>
        )}
      </div>
    </div>
  );
}
