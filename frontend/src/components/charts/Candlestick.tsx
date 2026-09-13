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
        textColor: "#9c8b7a",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(61, 50, 38, 0.4)" },
        horzLines: { color: "rgba(61, 50, 38, 0.4)" },
      },
      timeScale: {
        timeVisible: true,
        borderColor: "#3d3226",
      },
      rightPriceScale: {
        borderColor: "#3d3226",
      },
      crosshair: {
        vertLine: { color: "#e8a33d", labelBackgroundColor: "#d97941" },
        horzLine: { color: "#e8a33d", labelBackgroundColor: "#d97941" },
      },
    });

    const series = chart.addCandlestickSeries({
      upColor: "#6bbf59",        // рост = тёплый травяной
      downColor: "#c1703d",      // падение = янтарно-охристый
      borderUpColor: "#6bbf59",
      borderDownColor: "#c1703d",
      wickUpColor: "#4e9d42",
      wickDownColor: "#8b5a2b",
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
