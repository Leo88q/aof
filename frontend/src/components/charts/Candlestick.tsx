import { useEffect, useRef } from "react";
import { createChart, ColorType, IChartApi } from "lightweight-charts";

interface Candle {
  tsStart: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface CandlestickProps {
  candles: Candle[];
  height?: number;
}

export function Candlestick({ candles, height = 240 }: CandlestickProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Цвета из дизайн-системы: рост=травяной, падение=янтарный
    const chart = createChart(containerRef.current, {
      height,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#8890B0",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(61, 50, 38, 0.4)" },
        horzLines: { color: "rgba(61, 50, 38, 0.4)" },
      },
      timeScale: {
        timeVisible: true,
        borderColor: "#1A1A30",
      },
      rightPriceScale: {
        borderColor: "#1A1A30",
      },
      crosshair: {
        vertLine: { color: "#FFD700", labelBackgroundColor: "#00A8CC" },
        horzLine: { color: "#FFD700", labelBackgroundColor: "#00A8CC" },
      },
    });

    const series = chart.addCandlestickSeries({
      upColor: "#00E5A0",        // рост = тёплый травяной
      downColor: "#FF3366",      // падение = янтарно-охристый
      borderUpColor: "#00E5A0",
      borderDownColor: "#FF3366",
      wickUpColor: "#00C488",
      wickDownColor: "#FF3366",
    });

    const data = candles.map((c) => ({
      time: Math.floor(new Date(c.tsStart).getTime() / 1000) as any,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));
    series.setData(data as any);
    chart.timeScale().fitContent();

    chartRef.current = chart;

    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    };
    window.addEventListener("resize", handleResize);
    handleResize();

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, [candles, height]);

  return (
    <div className="relative">
      <div ref={containerRef} />
      {/* Легенда-метафора */}
      <div className="flex gap-4 mt-2 text-[10px] text-straw">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-sprout-500" /> колос растёт
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-wheat-700" /> колос никнет
        </span>
      </div>
    </div>
  );
}
