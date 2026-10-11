import { useEffect, useState } from "react";
import { useLocale } from "../i18n/LocaleProvider";
import { labHeroCopy } from "../i18n/labHeroCopy";
import { chainMomentCopy } from "../i18n/chainMomentCopy";
import { forecastFromDayId, loadWeather, WEATHER_BY_INDEX, weatherIndexForDay } from "../lib/weather";

export function ChainClocks() {
  const { language } = useLocale();
  const [text, setText] = useState(chainMomentCopy[language].weatherUnread);

  useEffect(() => {
    let cancelled = false;
    setText(chainMomentCopy[language].weatherUnread);
    fetchWeatherSnapshot().then((snapshot) => {
      if (cancelled) return;
      if (!snapshot || typeof snapshot.dayId !== "number" || snapshot.dayId <= 0 || !Number.isFinite(snapshot.ratePerHour)) {
        setText(chainMomentCopy[language].weatherUnread);
        return;
      }
      const tomorrow = forecastFromDayId(snapshot.dayId, 1)[0];
      const tomorrowIndex = weatherIndexForDay(tomorrow.dayId);
      const tomorrowMeta = WEATHER_BY_INDEX[tomorrowIndex];
      if (!tomorrowMeta) {
        setText(chainMomentCopy[language].weatherUnread);
        return;
      }
      const todayName = labHeroCopy[language].load[snapshot.type];
      const tomorrowName = labHeroCopy[language].load[tomorrowMeta.type];
      setText(chainMomentCopy[language].weatherLine(todayName, snapshot.ratePerHour, tomorrowName, tomorrowMeta.rate));
    }).catch(() => {
      if (!cancelled) setText(chainMomentCopy[language].weatherUnread);
    });
    return () => { cancelled = true; };
  }, [language]);

  return <p className="text-straw text-xs break-words">{text}</p>;
}
