import type { Language } from './translations';

/** Shown while route chunks load, including after changing the selected language. */
export const routeLoadingCopy: Record<Language, { gallery: string; site: string }> = {
  ru: { gallery: 'Собираем приборы…', site: 'Открываем мастерскую…' },
  en: { gallery: 'Preparing the instruments…', site: 'Opening the workshop…' },
  pt: { gallery: 'Preparando os instrumentos…', site: 'Abrindo a oficina…' },
  es: { gallery: 'Preparando los instrumentos…', site: 'Abriendo el taller…' },
  vi: { gallery: 'Đang chuẩn bị thiết bị…', site: 'Đang mở xưởng…' },
  id: { gallery: 'Menyiapkan perangkat…', site: 'Membuka bengkel…' },
  fil: { gallery: 'Inihahanda ang mga kagamitan…', site: 'Binubuksan ang pagawaan…' },
};
