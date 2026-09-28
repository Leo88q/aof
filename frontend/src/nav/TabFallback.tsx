import React from "react";

// Заглушка на время подгрузки чанка вкладки. Раньше вкладки грузились
// целиком в стартовом бандле, и игрок сразу видел экран; теперь показываем
// силуэт страницы, чтобы переход не выглядел пустым.
export function TabFallback({ label }: { label: string }) {
  return (
    <div className="page flex flex-col gap-3 p-3 sm:p-4" role="status" aria-live="polite">
      <span className="sr-only">{label}: загружаем экран…</span>
      <div className="h-9 w-2/3 rounded-xl bg-soil-800/70 animate-pulse" aria-hidden="true" />
      <div className="h-24 w-full rounded-2xl bg-soil-800/70 animate-pulse" aria-hidden="true" />
      <div className="h-24 w-full rounded-2xl bg-soil-800/70 animate-pulse" aria-hidden="true" />
    </div>
  );
}
