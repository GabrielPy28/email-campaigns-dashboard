import { useEffect, useRef } from "react";
import {
  Chart as ChartJS,
  Tooltip,
  Legend,
  ChartConfiguration,
} from "chart.js";
import {
  FunnelController,
  TrapezoidElement,
} from "chartjs-chart-funnel";

ChartJS.register(Tooltip, Legend, FunnelController, TrapezoidElement);

export interface EmailFunnelProps {
  sent: number;
  opens: number;
  clicks: number;
}

export function EmailFunnel({ sent, opens, clicks }: EmailFunnelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<ChartJS<"funnel"> | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const conversionOpen = sent ? (opens / sent) * 100 : 0;
    const conversionClick = opens ? (clicks / opens) * 100 : 0;

    const data = {
      labels: [
        "Sent",
        `Opens (${conversionOpen.toFixed(1)}%)`,
        `Clicks (${conversionClick.toFixed(1)}%)`,
      ],
      datasets: [
        {
          label: "Email Funnel",
          data: [sent, opens, clicks],
          backgroundColor: ["#2563eb", "#4f46e5", "#22c55e"],
          borderColor: "#ffffff",
          borderWidth: 2,
        },
      ],
    };

    const config: ChartConfiguration<"funnel"> = {
      type: "funnel",
      data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 900,
          easing: "easeOutQuart",
        },
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            backgroundColor: "#0f172a",
            titleColor: "#fff",
            bodyColor: "#e2e8f0",
            padding: 10,
            cornerRadius: 6,
            callbacks: {
              title: (ctx) => ctx[0]?.label ?? "",
              label: (ctx) => {
                const value = (ctx.raw as number) || 0;
                const pct = sent ? ((value / sent) * 100).toFixed(1) : "0.0";
                return `Recipients: ${value.toLocaleString()} (${pct}%)`;
              },
            },
          },
        },
      },
    };

    if (chartRef.current) {
      chartRef.current.destroy();
    }
    chartRef.current = new ChartJS(canvasRef.current, config);

    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [sent, opens, clicks]);

  return (
    <div className="w-full h-[260px]">
      <canvas ref={canvasRef} />
    </div>
  );
}

