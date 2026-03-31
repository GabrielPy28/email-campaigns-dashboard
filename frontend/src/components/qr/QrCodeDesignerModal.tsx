import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Swal from "sweetalert2";
import Select, { type SingleValue } from "react-select";
import QRCodeStyling from "qr-code-styling";
import type { CornerDotType, CornerSquareType, DotType, GradientType, Options } from "qr-code-styling";
import { Modal } from "../ui/modal";
import { Button } from "../ui/button";
import { uploadQrCodeCustomImage } from "../../lib/api";
import {
  qrDesignerSelectStyles,
  type QrDesignerSelectOption,
} from "../templates/templateTestSendSelectStyles";

type DotsColorMode = "solid" | "gradient";
type BgMode = "solid" | "gradient";

const DOT_TYPES: { value: DotType; label: string }[] = [
  { value: "square", label: "Cuadrados" },
  { value: "dots", label: "Puntos" },
  { value: "rounded", label: "Redondeados" },
  { value: "extra-rounded", label: "Muy redondeados" },
  { value: "classy", label: "Clásico" },
  { value: "classy-rounded", label: "Clásico redondeado" },
];

const CORNER_SQUARE: { value: CornerSquareType; label: string }[] = [
  { value: "square", label: "Cuadrado" },
  { value: "dot", label: "Punto" },
  { value: "extra-rounded", label: "Extra redondeado" },
  { value: "rounded", label: "Redondeado" },
  { value: "dots", label: "Puntos" },
  { value: "classy", label: "Clásico" },
  { value: "classy-rounded", label: "Clásico redondeado" },
];

const CORNER_DOT: { value: CornerDotType; label: string }[] = [
  { value: "square", label: "Cuadrado" },
  { value: "dot", label: "Punto" },
  { value: "rounded", label: "Redondeado" },
  { value: "dots", label: "Puntos" },
  { value: "classy", label: "Clásico" },
  { value: "classy-rounded", label: "Clásico redondeado" },
];

const QR_SHAPE_OPTIONS: QrDesignerSelectOption[] = [
  { value: "square", label: "Cuadrada" },
  { value: "circle", label: "Circular (módulos en círculo)" },
];

const GRADIENT_TYPE_OPTIONS: QrDesignerSelectOption[] = [
  { value: "linear", label: "Lineal" },
  { value: "radial", label: "Radial" },
];

const selectMenuPortal = typeof document !== "undefined" ? document.body : null;

function buildOptions(
  trackingUrl: string,
  s: {
    dotsType: DotType;
    cornersSquare: CornerSquareType;
    cornersDot: CornerDotType;
    dotsColorMode: DotsColorMode;
    dotsSolid: string;
    dotsGradType: GradientType;
    dotsGradRotation: number;
    dotsGradC1: string;
    dotsGradC2: string;
    cornerSquareColor: string;
    cornerDotColor: string;
    bgMode: BgMode;
    bgSolid: string;
    bgGradType: GradientType;
    bgGradRotation: number;
    bgGradC1: string;
    bgGradC2: string;
    margin: number;
    logoDataUrl: string | null;
    logoSize: number;
    qrShape: "square" | "circle";
  }
): Options {
  const hasLogo = Boolean(s.logoDataUrl);
  // La librería fusiona opciones y espera siempre `imageOptions` definido (usa .hideBackgroundDots).
  const dotsOptions: Options["dotsOptions"] = {
    type: s.dotsType,
    color: s.dotsColorMode === "gradient" ? s.dotsGradC1 : s.dotsSolid,
    ...(s.dotsColorMode === "gradient"
      ? {
          gradient: {
            type: s.dotsGradType,
            rotation: s.dotsGradRotation,
            colorStops: [
              { offset: 0, color: s.dotsGradC1 },
              { offset: 1, color: s.dotsGradC2 },
            ],
          },
        }
      : {}),
  };

  const backgroundOptions: Options["backgroundOptions"] =
    s.bgMode === "gradient"
      ? {
          color: s.bgGradC1,
          round: 0,
          gradient: {
            type: s.bgGradType,
            rotation: s.bgGradRotation,
            colorStops: [
              { offset: 0, color: s.bgGradC1 },
              { offset: 1, color: s.bgGradC2 },
            ],
          },
        }
      : { color: s.bgSolid, round: 0 };

  const opts: Options = {
    type: "canvas",
    shape: s.qrShape,
    width: 320,
    height: 320,
    margin: s.margin,
    data: trackingUrl,
    qrOptions: {
      errorCorrectionLevel: hasLogo ? "H" : "Q",
    },
    dotsOptions,
    cornersSquareOptions: {
      type: s.cornersSquare,
      color: s.cornerSquareColor,
    },
    cornersDotOptions: {
      type: s.cornersDot,
      color: s.cornerDotColor,
    },
    backgroundOptions,
    imageOptions: {
      hideBackgroundDots: true,
      imageSize: hasLogo ? s.logoSize : 0.4,
      margin: hasLogo ? 6 : 0,
      saveAsBlob: false,
    },
  };
  if (hasLogo && s.logoDataUrl) {
    opts.image = s.logoDataUrl;
  }
  return opts;
}

type Props = {
  open: boolean;
  onClose: () => void;
  qrCodeId: string;
  trackingUrl: string;
  onApplied: () => void;
};

export function QrCodeDesignerModal({ open, onClose, qrCodeId, trackingUrl, onApplied }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const qrRef = useRef<QRCodeStyling | null>(null);

  const [dotsType, setDotsType] = useState<DotType>("rounded");
  const [cornersSquare, setCornersSquare] = useState<CornerSquareType>("extra-rounded");
  const [cornersDot, setCornersDot] = useState<CornerDotType>("dot");
  const [dotsColorMode, setDotsColorMode] = useState<DotsColorMode>("solid");
  const [dotsSolid, setDotsSolid] = useState("#1e1b4b");
  const [dotsGradType, setDotsGradType] = useState<GradientType>("linear");
  const [dotsGradRotation, setDotsGradRotation] = useState(0);
  const [dotsGradC1, setDotsGradC1] = useState("#4f46e5");
  const [dotsGradC2, setDotsGradC2] = useState("#db2777");
  const [cornerSquareColor, setCornerSquareColor] = useState("#312e81");
  const [cornerDotColor, setCornerDotColor] = useState("#6366f1");
  const [bgMode, setBgMode] = useState<BgMode>("solid");
  const [bgSolid, setBgSolid] = useState("#ffffff");
  const [bgGradType, setBgGradType] = useState<GradientType>("linear");
  const [bgGradRotation, setBgGradRotation] = useState(0);
  const [bgGradC1, setBgGradC1] = useState("#f8fafc");
  const [bgGradC2, setBgGradC2] = useState("#e0e7ff");
  const [margin, setMargin] = useState(12);
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [logoSize, setLogoSize] = useState(0.32);
  const [qrShape, setQrShape] = useState<"square" | "circle">("square");
  const [applying, setApplying] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const styleState = useMemo(
    () => ({
      dotsType,
      cornersSquare,
      cornersDot,
      dotsColorMode,
      dotsSolid,
      dotsGradType,
      dotsGradRotation,
      dotsGradC1,
      dotsGradC2,
      cornerSquareColor,
      cornerDotColor,
      bgMode,
      bgSolid,
      bgGradType,
      bgGradRotation,
      bgGradC1,
      bgGradC2,
      margin,
      logoDataUrl,
      logoSize,
      qrShape,
    }),
    [
      dotsType,
      cornersSquare,
      cornersDot,
      dotsColorMode,
      dotsSolid,
      dotsGradType,
      dotsGradRotation,
      dotsGradC1,
      dotsGradC2,
      cornerSquareColor,
      cornerDotColor,
      bgMode,
      bgSolid,
      bgGradType,
      bgGradRotation,
      bgGradC1,
      bgGradC2,
      margin,
      logoDataUrl,
      logoSize,
      qrShape,
    ]
  );

  useEffect(() => {
    if (!open || !trackingUrl) return;
    const el = containerRef.current;
    if (!el) return;
    QRCodeStyling._clearContainer(el);
    const opts = buildOptions(trackingUrl, styleState);
    const qr = new QRCodeStyling(opts);
    qr.append(el);
    qrRef.current = qr;
    return () => {
      QRCodeStyling._clearContainer(el);
      qrRef.current = null;
    };
  }, [open, trackingUrl, styleState]);

  const onLogoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!/^image\/(png|jpeg|webp)$/i.test(f.type)) {
      void Swal.fire({
        icon: "warning",
        title: "Formato no válido",
        text: "Usa PNG, JPEG o WEBP para el logo.",
        confirmButtonColor: "#7c3aed",
      });
      return;
    }
    const r = new FileReader();
    r.onload = () => {
      if (typeof r.result === "string") setLogoDataUrl(r.result);
    };
    r.readAsDataURL(f);
  };

  const clearLogo = () => setLogoDataUrl(null);

  const handleApply = useCallback(async () => {
    const qr = qrRef.current;
    if (!qr) return;
    setApplying(true);
    try {
      const blob = await qr.getRawData("png");
      if (!blob || !(blob instanceof Blob)) {
        throw new Error("No se pudo generar la imagen.");
      }
      const file = new File([blob], "qr-designed.png", { type: "image/png" });
      await uploadQrCodeCustomImage(qrCodeId, file);
      onApplied();
      onClose();
    } catch (e) {
      void Swal.fire({
        icon: "error",
        title: "No se pudo guardar",
        text: e instanceof Error ? e.message : "Error al guardar el diseño.",
        confirmButtonColor: "#7c3aed",
      });
    } finally {
      setApplying(false);
    }
  }, [onApplied, onClose, qrCodeId]);

  if (!open) return null;

  return (
    <Modal
      open={open}
      onClose={applying ? () => {} : onClose}
      title="Diseñar código QR"
      description="Vista previa en vivo. El código siempre apunta a la URL de escaneo (tracking); al guardar se sube esta imagen al servidor."
      size="2xl"
      titleId="qr-designer-title"
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            className="border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            disabled={applying}
            onClick={onClose}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            className="bg-indigo-600 hover:bg-indigo-700 text-white border-0"
            disabled={applying || !trackingUrl}
            onClick={() => void handleApply()}
          >
            {applying ? "Guardando…" : "Aplicar diseño al código"}
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-1 max-h-[min(70vh,640px)] overflow-y-auto">
        <div className="space-y-3 text-slate-800">
          <div>
            <label htmlFor="qr-dots-type" className="block text-xs font-medium text-slate-700 mb-1">
              Patrón (módulos)
            </label>
            <Select<QrDesignerSelectOption, false>
              inputId="qr-dots-type"
              instanceId="qr-dots-type"
              options={DOT_TYPES}
              value={DOT_TYPES.find((o) => o.value === dotsType) ?? null}
              onChange={(opt: SingleValue<QrDesignerSelectOption>) => {
                if (opt) setDotsType(opt.value as DotType);
              }}
              styles={qrDesignerSelectStyles}
              menuPortalTarget={selectMenuPortal}
              menuPosition="fixed"
              isSearchable={false}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="qr-corner-square" className="block text-xs font-medium text-slate-700 mb-1">
                Esquinas (marco finder)
              </label>
              <Select<QrDesignerSelectOption, false>
                inputId="qr-corner-square"
                instanceId="qr-corner-square"
                options={CORNER_SQUARE}
                value={CORNER_SQUARE.find((o) => o.value === cornersSquare) ?? null}
                onChange={(opt: SingleValue<QrDesignerSelectOption>) => {
                  if (opt) setCornersSquare(opt.value as CornerSquareType);
                }}
                styles={qrDesignerSelectStyles}
                menuPortalTarget={selectMenuPortal}
                menuPosition="fixed"
                isSearchable={false}
              />
            </div>
            <div>
              <label htmlFor="qr-corner-dot" className="block text-xs font-medium text-slate-700 mb-1">
                Esquinas (punto interior)
              </label>
              <Select<QrDesignerSelectOption, false>
                inputId="qr-corner-dot"
                instanceId="qr-corner-dot"
                options={CORNER_DOT}
                value={CORNER_DOT.find((o) => o.value === cornersDot) ?? null}
                onChange={(opt: SingleValue<QrDesignerSelectOption>) => {
                  if (opt) setCornersDot(opt.value as CornerDotType);
                }}
                styles={qrDesignerSelectStyles}
                menuPortalTarget={selectMenuPortal}
                menuPosition="fixed"
                isSearchable={false}
              />
            </div>
          </div>
          <div>
            <label htmlFor="qr-shape" className="block text-xs font-medium text-slate-700 mb-1">
              Forma del código
            </label>
            <Select<QrDesignerSelectOption, false>
              inputId="qr-shape"
              instanceId="qr-shape"
              options={QR_SHAPE_OPTIONS}
              value={QR_SHAPE_OPTIONS.find((o) => o.value === qrShape) ?? null}
              onChange={(opt: SingleValue<QrDesignerSelectOption>) => {
                if (opt) setQrShape(opt.value as "square" | "circle");
              }}
              styles={qrDesignerSelectStyles}
              menuPortalTarget={selectMenuPortal}
              menuPosition="fixed"
              isSearchable={false}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Margen (marco blanco alrededor)</label>
            <input
              type="range"
              min={4}
              max={32}
              value={margin}
              onChange={(e) => setMargin(Number(e.target.value))}
              className="w-full accent-indigo-600"
            />
            <span className="text-xs text-slate-600">{margin}px</span>
          </div>

          <div className="border-t border-slate-100 pt-3">
            <p className="text-xs font-semibold text-slate-800 mb-2">Color del patrón</p>
            <div className="flex flex-wrap gap-4 mb-2">
              <label className="flex items-center gap-2 text-sm text-slate-800 cursor-pointer">
                <input
                  type="radio"
                  name="dots-color-mode"
                  checked={dotsColorMode === "solid"}
                  onChange={() => setDotsColorMode("solid")}
                  className="h-4 w-4 border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                Un color
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-800 cursor-pointer">
                <input
                  type="radio"
                  name="dots-color-mode"
                  checked={dotsColorMode === "gradient"}
                  onChange={() => setDotsColorMode("gradient")}
                  className="h-4 w-4 border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                Degradado
              </label>
            </div>
            {dotsColorMode === "solid" ? (
              <input
                type="color"
                value={dotsSolid}
                onChange={(e) => setDotsSolid(e.target.value)}
                className="h-9 w-full rounded border border-slate-300 cursor-pointer"
              />
            ) : (
              <div className="space-y-2">
                <label htmlFor="qr-dots-grad-type" className="sr-only">
                  Tipo de degradado del patrón
                </label>
                <Select<QrDesignerSelectOption, false>
                  inputId="qr-dots-grad-type"
                  instanceId="qr-dots-grad-type"
                  options={GRADIENT_TYPE_OPTIONS}
                  value={GRADIENT_TYPE_OPTIONS.find((o) => o.value === dotsGradType) ?? null}
                  onChange={(opt: SingleValue<QrDesignerSelectOption>) => {
                    if (opt) setDotsGradType(opt.value as GradientType);
                  }}
                  styles={qrDesignerSelectStyles}
                  menuPortalTarget={selectMenuPortal}
                  menuPosition="fixed"
                  isSearchable={false}
                />
                <label className="block text-xs font-medium text-slate-700">Rotación del degradado</label>
                <input
                  type="range"
                  min={0}
                  max={360}
                  value={dotsGradRotation}
                  onChange={(e) => setDotsGradRotation(Number(e.target.value))}
                  className="w-full accent-indigo-600"
                />
                <span className="text-xs text-slate-600">{dotsGradRotation}°</span>
                <div className="flex gap-2">
                  <input type="color" value={dotsGradC1} onChange={(e) => setDotsGradC1(e.target.value)} className="h-8 flex-1 rounded border cursor-pointer" />
                  <input type="color" value={dotsGradC2} onChange={(e) => setDotsGradC2(e.target.value)} className="h-8 flex-1 rounded border cursor-pointer" />
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Color finder</label>
              <input
                type="color"
                value={cornerSquareColor}
                onChange={(e) => setCornerSquareColor(e.target.value)}
                className="h-9 w-full rounded border border-slate-300 cursor-pointer"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Color punto finder</label>
              <input
                type="color"
                value={cornerDotColor}
                onChange={(e) => setCornerDotColor(e.target.value)}
                className="h-9 w-full rounded border border-slate-300 cursor-pointer"
              />
            </div>
          </div>

          <div className="border-t border-slate-100 pt-3">
            <p className="text-xs font-semibold text-slate-800 mb-2">Fondo (detrás del QR)</p>
            <div className="flex flex-wrap gap-4 mb-2">
              <label className="flex items-center gap-2 text-sm text-slate-800 cursor-pointer">
                <input
                  type="radio"
                  name="bg-mode"
                  checked={bgMode === "solid"}
                  onChange={() => setBgMode("solid")}
                  className="h-4 w-4 border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                Un color
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-800 cursor-pointer">
                <input
                  type="radio"
                  name="bg-mode"
                  checked={bgMode === "gradient"}
                  onChange={() => setBgMode("gradient")}
                  className="h-4 w-4 border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                Degradado
              </label>
            </div>
            {bgMode === "solid" ? (
              <input
                type="color"
                value={bgSolid}
                onChange={(e) => setBgSolid(e.target.value)}
                className="h-9 w-full rounded border border-slate-300 cursor-pointer"
              />
            ) : (
              <div className="space-y-2">
                <label htmlFor="qr-bg-grad-type" className="sr-only">
                  Tipo de degradado del fondo
                </label>
                <Select<QrDesignerSelectOption, false>
                  inputId="qr-bg-grad-type"
                  instanceId="qr-bg-grad-type"
                  options={GRADIENT_TYPE_OPTIONS}
                  value={GRADIENT_TYPE_OPTIONS.find((o) => o.value === bgGradType) ?? null}
                  onChange={(opt: SingleValue<QrDesignerSelectOption>) => {
                    if (opt) setBgGradType(opt.value as GradientType);
                  }}
                  styles={qrDesignerSelectStyles}
                  menuPortalTarget={selectMenuPortal}
                  menuPosition="fixed"
                  isSearchable={false}
                />
                <label className="block text-xs font-medium text-slate-700">Rotación del degradado</label>
                <input
                  type="range"
                  min={0}
                  max={360}
                  value={bgGradRotation}
                  onChange={(e) => setBgGradRotation(Number(e.target.value))}
                  className="w-full accent-indigo-600"
                />
                <span className="text-xs text-slate-600">{bgGradRotation}°</span>
                <div className="flex gap-2">
                  <input type="color" value={bgGradC1} onChange={(e) => setBgGradC1(e.target.value)} className="h-8 flex-1 rounded border cursor-pointer" />
                  <input type="color" value={bgGradC2} onChange={(e) => setBgGradC2(e.target.value)} className="h-8 flex-1 rounded border cursor-pointer" />
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-slate-100 pt-3">
            <p className="text-xs font-semibold text-slate-800 mb-2">Logo central</p>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={onLogoFile}
            />
            <div className="flex flex-wrap gap-2 items-center">
              <Button
                type="button"
                variant="ghost"
                className="h-8 text-xs border border-slate-200 text-slate-700"
                onClick={() => logoInputRef.current?.click()}
              >
                Elegir imagen
              </Button>
              {logoDataUrl ? (
                <Button type="button" variant="ghost" className="h-8 text-xs text-rose-700 border border-rose-200" onClick={clearLogo}>
                  Quitar logo
                </Button>
              ) : null}
            </div>
            {logoDataUrl ? (
              <div className="mt-2">
                <label className="block text-xs font-medium text-slate-700 mb-1">Tamaño del logo (relativo)</label>
                <input
                  type="range"
                  min={18}
                  max={45}
                  value={Math.round(logoSize * 100)}
                  onChange={(e) => setLogoSize(Number(e.target.value) / 100)}
                  className="w-full"
                />
                <span className="text-xs text-slate-500">{Math.round(logoSize * 100)}%</span>
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col items-center justify-start gap-3">
          <p className="text-xs text-slate-500 text-center max-w-sm">
            URL codificada (tracking):{" "}
            <code className="break-all text-[10px] bg-slate-100 rounded px-1 py-0.5">{trackingUrl}</code>
          </p>
          <div
            className="rounded-2xl border border-slate-200 bg-slate-50 p-6 shadow-inner flex items-center justify-center min-h-[360px]"
          >
            <div ref={containerRef} className="inline-block" />
          </div>
        </div>
      </div>
    </Modal>
  );
}
