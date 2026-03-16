import { useMemo, useRef, useEffect } from "react";
import {
  Chart as ChartJS,
  ChartConfiguration,
  registerables as registerChartJS,
} from "chart.js";
import {
  ChoroplethController,
  ProjectionScale,
  ColorScale,
  GeoFeature as GeoFeatureElement,
} from "chartjs-chart-geo";
import zoomPlugin from "chartjs-plugin-zoom";
import * as topojson from "topojson-client";
import type { LocationCount } from "../../lib/api";

interface GeoFeature {
  type: string;
  properties?: { name?: string };
  geometry?: unknown;
}

// Paleta tipo Stripe/Vercel: gradiente suave
const CHOROPLETH_COLORS = [
  "#eef2ff",
  "#dbeafe",
  "#bfdbfe",
  "#93c5fd",
  "#60a5fa",
  "#2563eb",
];

function getColorForValue(normalized: number): string {
  if (normalized <= 0 || !Number.isFinite(normalized)) return CHOROPLETH_COLORS[0];
  const index = Math.min(
    Math.floor(normalized * (CHOROPLETH_COLORS.length - 1)),
    CHOROPLETH_COLORS.length - 1
  );
  return CHOROPLETH_COLORS[Math.max(0, index)];
}

ChartJS.register(
  ...registerChartJS,
  ChoroplethController,
  ProjectionScale,
  ColorScale,
  GeoFeatureElement,
  zoomPlugin
);

const WORLD_ATLAS_URL =
  "https://unpkg.com/world-atlas@2/countries-50m.json";

let cachedTopology: unknown = null;
async function getWorldTopology(): Promise<unknown> {
  if (cachedTopology) return cachedTopology;
  const res = await fetch(WORLD_ATLAS_URL);
  cachedTopology = await res.json();
  return cachedTopology;
}

function normalizeName(name: string): string {
  return (name || "").toLowerCase().trim();
}

const NAME_ALIASES: Record<string, string> = {
  "united states": "united states of america",
  "united kingdom": "united kingdom of great britain and northern ireland",
  "russia": "russian federation",
  "south korea": "republic of korea",
  "north korea": "democratic people's republic of korea",
  "vietnam": "viet nam",
  "tanzania": "united republic of tanzania",
  "bolivia": "plurinational state of bolivia",
  "venezuela": "bolivarian republic of venezuela",
  "iran": "islamic republic of iran",
  "syria": "syrian arab republic",
  "laos": "lao people's democratic republic",
  "brunei": "brunei darussalam",
  "moldova": "republic of moldova",
  "ivory coast": "côte d'ivoire",
  "cote d'ivoire": "côte d'ivoire",
};

function getCountForFeature(
  featureName: string,
  countByNormalName: Map<string, number>
): number {
  const n = normalizeName(featureName);
  let count = countByNormalName.get(n) ?? 0;
  if (count === 0 && NAME_ALIASES[n] !== undefined) {
    count = countByNormalName.get(NAME_ALIASES[n]) ?? 0;
  }
  return count;
}

// Plugin: dibuja burbujas de actividad encima del choropleth
const bubblesPlugin = {
  id: "choroplethBubbles",
  afterDatasetsDraw(chart: ChartJS) {
    const ctx = chart.ctx;
    const meta = chart.getDatasetMeta(0);
    const dataset = chart.data.datasets[0];
    if (!meta?.data?.length || !dataset?.data) return;

    const maxValue = Math.max(
      ...(dataset.data as { value?: number }[])
        .map((d) => d.value ?? 0)
        .filter((v) => v > 0),
      1
    );

    for (let i = 0; i < meta.data.length; i++) {
      const el = meta.data[i] as { x: number; y: number };
      const raw = dataset.data[i] as { value?: number | null; feature?: GeoFeature };
      const v = raw?.value;
      if (v == null || v <= 0) continue;

      const r = Math.min(22, Math.max(5, Math.sqrt(v / maxValue) * 18));
      ctx.save();
      ctx.beginPath();
      ctx.arc(el.x, el.y, r, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(37, 99, 235, 0.35)";
      ctx.fill();
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }
  },
};

export interface ChoroplethMapProps {
  locations: LocationCount[];
  height?: number;
  title?: string;
}

export function ChoroplethMap({ locations, height = 380, title }: ChoroplethMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<ChartJS<"choropleth"> | null>(null);
  const dblClickCleanupRef = useRef<(() => void) | null>(null);

  const countByNormalName = useMemo(() => {
    const m = new Map<string, number>();
    for (const loc of locations) {
      const key = normalizeName(loc.country_name || loc.country_code);
      m.set(key, (m.get(key) ?? 0) + loc.count);
    }
    return m;
  }, [locations]);

  useEffect(() => {
    if (!canvasRef.current) return;

    let cancelled = false;
    let chart: ChartJS<"choropleth"> | null = null;

    (async () => {
      const topology = await getWorldTopology();
      if (cancelled) return;

      const topo = topology as { objects: { countries: unknown } };
      const raw = topojson.feature(
        topo as unknown as Parameters<typeof topojson.feature>[0],
        topo.objects.countries as Parameters<typeof topojson.feature>[1]
      ) as unknown;
      const features: GeoFeature[] = Array.isArray((raw as { features?: GeoFeature[] }).features)
        ? (raw as { features: GeoFeature[] }).features
        : raw && typeof raw === "object" && "geometry" in (raw as object)
          ? [raw as GeoFeature]
          : [];

      const data = {
        labels: features.map((d) => d.properties?.name ?? ""),
        datasets: [
          {
            label: "Aperturas",
            borderColor: "#e2e8f0",
            borderWidth: 0.6,
            hoverBorderColor: "#1e293b",
            hoverBorderWidth: 1.4,
            hoverBackgroundColor: (ctx: { raw?: { value?: number | null } }) => {
              const v = ctx.raw?.value;
              if (v == null || v === 0) return "#f1f5f9";
              return "#1d4ed8";
            },
            backgroundColor: (ctx: { raw?: { value?: number | null } }) => {
              const v = ctx.raw?.value;
              return v == null || v === 0 ? "#f1f5f9" : undefined;
            },
            data: features.map((d) => {
              const name = d.properties?.name ?? "";
              const value = getCountForFeature(name, countByNormalName);
              return {
                feature: d,
                value: value === 0 ? null : value,
              };
            }),
          },
        ],
      } as ChartConfiguration<"choropleth">["data"];

      const config: ChartConfiguration<"choropleth"> = {
        type: "choropleth",
        data,
        plugins: [bubblesPlugin],
        options: {
          responsive: true,
          maintainAspectRatio: false,
          showOutline: true,
          showGraticule: false,
          layout: {
            padding: 8,
          },
          animation: {
            duration: 800,
          },
          transitions: {
            active: {
              animation: {
                duration: 400,
              },
            },
          },
          onHover: (event, elements) => {
            const canvas = event.native?.target as HTMLCanvasElement | undefined;
            if (canvas) canvas.style.cursor = elements.length ? "pointer" : "default";
          },
          scales: {
            projection: {
              axis: "x",
              projection: "naturalEarth1",
            },
            color: {
              axis: "x",
              quantize: 6,
              legend: {
                position: "bottom-right",
                align: "right",
              },
              interpolate: (v: number) => getColorForValue(v),
              missing: "#f1f5f9",
            },
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: "#0f172a",
              titleColor: "#fff",
              bodyColor: "#e2e8f0",
              padding: 10,
              cornerRadius: 6,
              callbacks: {
                title: (items) => {
                  const raw = items[0]?.raw as { feature?: { properties?: { name?: string } } };
                  return raw?.feature?.properties?.name ?? "";
                },
                label: (ctx) => {
                  const v = (ctx.raw as { value?: number | null })?.value ?? 0;
                  return `Aperturas: ${v.toLocaleString()}`;
                },
              },
            },
            zoom: {
              pan: {
                enabled: true,
                mode: "xy",
              },
              zoom: {
                wheel: { enabled: true },
                pinch: { enabled: true },
                mode: "xy",
              },
              limits: {
                x: { min: "original", max: "original" },
                y: { min: "original", max: "original" },
              },
            },
          },
        },
      };

      if (!canvasRef.current || cancelled) return;
      const canvas = canvasRef.current;
      const existing = ChartJS.getChart(canvas);
      if (existing) {
        existing.destroy();
        chartRef.current = null;
      }
      if (cancelled) return;
      chart = new ChartJS(canvas, config);
      chartRef.current = chart;

      const onDoubleClick = () => {
        chartRef.current?.resetZoom?.();
      };
      canvas.addEventListener("dblclick", onDoubleClick);
      dblClickCleanupRef.current = () => {
        canvas.removeEventListener("dblclick", onDoubleClick);
        dblClickCleanupRef.current = null;
      };
    })();

    return () => {
      cancelled = true;
      dblClickCleanupRef.current?.();
      dblClickCleanupRef.current = null;
      const existing = chartRef.current;
      if (existing) {
        existing.destroy();
        chartRef.current = null;
      }
    };
  }, [countByNormalName]);

  return (
    <div
      className="rounded-xl border border-slate-200 p-3 shadow-sm overflow-hidden w-full"
      style={{
        background: "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)",
      }}
    >
      {title && (
        <p className="text-xs font-medium text-sky-600 uppercase tracking-wider mb-2">
          {title}
        </p>
      )}
      <div style={{ height, minHeight: height }} className="relative w-full">
        <canvas ref={canvasRef} className="w-full block" />
      </div>
    </div>
  );
}
