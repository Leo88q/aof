import type { Language } from './translations';

type Copy = {
  line: (items: string) => string;
  unnamed: string;
  have: string;
  need: string;
  energy: string;
  gas: string;
};

export const resourceShortageCopy: Record<Language, Copy> = {
  ru: {
    line: items => `Недостаточно для запуска: ${items}. Запуск не отправлен.`,
    unnamed: 'Недостаточно ресурсов для запуска. Запуск не отправлен.',
    have: 'есть', need: 'нужно', energy: 'Энергия', gas: 'SOL в газ-баке',
  },
  en: {
    line: items => `Not enough to start: ${items}. The start was not sent.`,
    unnamed: 'Not enough resources to start. The start was not sent.',
    have: 'have', need: 'need', energy: 'Energy', gas: 'Gas-tank SOL',
  },
  pt: {
    line: items => `Recursos insuficientes para iniciar: ${items}. O início não foi enviado.`,
    unnamed: 'Recursos insuficientes para iniciar. O início não foi enviado.',
    have: 'há', need: 'é preciso', energy: 'Energia', gas: 'SOL no tanque de gás',
  },
  es: {
    line: items => `No alcanza para iniciar: ${items}. El inicio no se envió.`,
    unnamed: 'No hay recursos suficientes para iniciar. El inicio no se envió.',
    have: 'hay', need: 'se necesitan', energy: 'Energía', gas: 'SOL en el depósito de gas',
  },
  vi: {
    line: items => `Không đủ để bắt đầu: ${items}. Lượt bắt đầu không được gửi.`,
    unnamed: 'Không đủ tài nguyên để bắt đầu. Lượt bắt đầu không được gửi.',
    have: 'hiện có', need: 'cần', energy: 'Năng lượng', gas: 'SOL trong bình gas',
  },
  id: {
    line: items => `Tidak cukup untuk memulai: ${items}. Permintaan mulai tidak dikirim.`,
    unnamed: 'Sumber daya tidak cukup untuk memulai. Permintaan mulai tidak dikirim.',
    have: 'tersedia', need: 'dibutuhkan', energy: 'Energi', gas: 'SOL di tangki gas',
  },
  fil: {
    line: items => `Kulang para magsimula: ${items}. Hindi ipinadala ang pagsisimula.`,
    unnamed: 'Kulang ang yaman para magsimula. Hindi ipinadala ang pagsisimula.',
    have: 'mayroon', need: 'kailangan', energy: 'Enerhiya', gas: 'SOL sa tangke ng gas',
  },
};
