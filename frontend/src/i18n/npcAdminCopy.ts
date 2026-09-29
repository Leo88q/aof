import type { Language } from './translations';

type Copy = { title: string; unavailable: string; reason: string };

/** Admin-only stub. GET /npc/stats returns enabled:false, POST /npc/run returns 503. */
export const npcAdminCopy: Record<Language, Copy> = {
  ru: { title: 'Торговый агент', unavailable: 'Торговый агент недоступен', reason: 'Сервер не предоставляет подтверждённую статистику или возможность запуска. Торговля NPC будет недоступна, пока не появятся расчёты по канонической книге заявок.' },
  en: { title: 'Trading agent', unavailable: 'Trading agent unavailable', reason: 'The server provides neither verified trade statistics nor a way to start the agent. NPC trading is unavailable until canonical order-book settlement is deployed.' },
  pt: { title: 'Agente de negociação', unavailable: 'Agente de negociação indisponível', reason: 'O servidor não disponibiliza estatísticas de negociação verificadas nem permite iniciar o agente. As negociações do NPC estão indisponíveis até à implementação da liquidação pelo livro de ordens canónico.' },
  es: { title: 'Agente comercial', unavailable: 'Agente comercial no disponible', reason: 'El servidor no ofrece estadísticas de operaciones verificadas ni permite iniciar el agente. Las operaciones del NPC no estarán disponibles hasta que se implemente la liquidación del libro de órdenes canónico.' },
  vi: { title: 'Tác nhân giao dịch', unavailable: 'Tác nhân giao dịch chưa khả dụng', reason: 'Máy chủ không cung cấp thống kê giao dịch đã xác minh hoặc khả năng khởi chạy tác nhân. NPC chưa thể giao dịch cho đến khi triển khai thanh toán bằng sổ lệnh chuẩn.' },
  id: { title: 'Agen perdagangan', unavailable: 'Agen perdagangan tidak tersedia', reason: 'Server tidak menyediakan statistik perdagangan terverifikasi atau cara menjalankan agen. Perdagangan NPC tidak tersedia sampai penyelesaian buku pesanan kanonis diterapkan.' },
  fil: { title: 'Ahente sa kalakalan', unavailable: 'Hindi magamit ang ahente sa kalakalan', reason: 'Walang ibinibigay ang server na na-verify na estadistika ng kalakalan o paraan para patakbuhin ang ahente. Hindi magagamit ang NPC trading hangga’t wala pang canonical na settlement para sa talaan ng order.' },
};
