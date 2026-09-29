import type { Language } from './translations';

type CountdownCopy = {
  finished: string;
  daysHours: (days: number, hours: number) => string;
  hoursMinutes: (hours: number, minutes: number) => string;
};

/** Compact countdowns used by market utilities. Seconds remain numeric in every locale. */
export const marketTimeCopy: Record<Language, CountdownCopy> = {
  ru: { finished: 'завершён', daysHours: (d, h) => `${d}д ${h}ч`, hoursMinutes: (h, m) => `${h}ч ${m}м` },
  en: { finished: 'ended', daysHours: (d, h) => `${d}d ${h}h`, hoursMinutes: (h, m) => `${h}h ${m}m` },
  pt: { finished: 'terminado', daysHours: (d, h) => `${d}d ${h}h`, hoursMinutes: (h, m) => `${h}h ${m}min` },
  es: { finished: 'finalizado', daysHours: (d, h) => `${d}d ${h}h`, hoursMinutes: (h, m) => `${h}h ${m}min` },
  vi: { finished: 'đã kết thúc', daysHours: (d, h) => `${d} ngày ${h} giờ`, hoursMinutes: (h, m) => `${h} giờ ${m} phút` },
  id: { finished: 'selesai', daysHours: (d, h) => `${d} hari ${h} jam`, hoursMinutes: (h, m) => `${h} jam ${m} menit` },
  fil: { finished: 'tapos na', daysHours: (d, h) => `${d} araw ${h} oras`, hoursMinutes: (h, m) => `${h} oras ${m} minuto` },
};
