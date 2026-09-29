import type { Language } from './translations';

const tabKeys = ['farm','tools','economy','market','quests','profile'] as const;
export type GameTab = typeof tabKeys[number];
const rows = (full: readonly string[], short: readonly string[]) => {
  if (full.length !== tabKeys.length || short.length !== tabKeys.length) throw new Error('Incomplete game navigation');
  return Object.fromEntries(tabKeys.map((key, index) => [key, { full: full[index], short: short[index] }])) as Record<GameTab, { full: string; short: string }>;
};
export const gameTabs: Record<Language, Record<GameTab, { full: string; short: string }>> = {
  ru: rows(['Лаборатория','Мастерская','Экономика','Рынок','Задания','Профиль'], ['Лаб','Мастер','Эконом','Рынок','Задания','Профиль']),
  en: rows(['Laboratory','Workshop','Economy','Market','Quests','Profile'], ['Lab','Craft','Economy','Market','Quests','Profile']),
  pt: rows(['Laboratório','Oficina','Economia','Mercado','Missões','Perfil'], ['Lab','Oficina','Economia','Mercado','Missões','Perfil']),
  es: rows(['Laboratorio','Taller','Economía','Mercado','Misiones','Perfil'], ['Lab','Taller','Economía','Mercado','Misiones','Perfil']),
  vi: rows(['Phòng thí nghiệm','Xưởng chế tạo','Kinh tế','Chợ','Nhiệm vụ','Hồ sơ'], ['Phòng TN','Xưởng','Kinh tế','Chợ','Nhiệm vụ','Hồ sơ']),
  id: rows(['Laboratorium','Bengkel','Ekonomi','Pasar','Misi','Profil'], ['Lab','Bengkel','Ekonomi','Pasar','Misi','Profil']),
  fil: rows(['Laboratoryo','Pagawaan','Ekono','Pamil','Mga gawain','Propayl'], ['Lab','Gawaan','Ekono','Pamil','Gawain','Propayl']),
};
