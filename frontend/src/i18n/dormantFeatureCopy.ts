import type { Language } from './translations';

type Copy = {
  premiumTitle: string; premiumPaused: string; premiumReason: string;
  rewardTitle: string; rewardPaused: string; rewardReason: string;
};

/** These retired, unmounted components never offer purchase or claim actions. */
export const dormantFeatureCopy: Record<Language, Copy> = {
  ru: {
    premiumTitle: 'Премиум-возможности', premiumPaused: 'Доступность не подтверждена',
    premiumReason: 'Эта функция не проверена для текущего сезона. Не покупайте пропуск ради неё; условия и состояние нужно сверить в сети.',
    rewardTitle: 'Награда', rewardPaused: 'Получение недоступно',
    rewardReason: 'Анимация не подтверждает выдачу награды. Проверьте доступность, историю кошелька и баланс в сети.',
  },
  en: {
    premiumTitle: 'Premium features', premiumPaused: 'Availability unverified',
    premiumReason: 'This feature has not been verified for the current season. Do not buy a pass for it; check the terms and on-chain state first.',
    rewardTitle: 'Reward', rewardPaused: 'Claim unavailable',
    rewardReason: 'An animation does not confirm that a reward was granted. Check availability, your wallet history and on-chain balance.',
  },
  pt: {
    premiumTitle: 'Funcionalidades Premium', premiumPaused: 'Disponibilidade não verificada',
    premiumReason: 'Esta funcionalidade não foi verificada para a época atual. Não compres um passe por causa dela; confirma primeiro as condições e o estado na rede.',
    rewardTitle: 'Recompensa', rewardPaused: 'Não é possível resgatar',
    rewardReason: 'Uma animação não confirma a entrega de uma recompensa. Verifica a disponibilidade, o histórico da carteira e o saldo na rede.',
  },
  es: {
    premiumTitle: 'Funciones Premium', premiumPaused: 'Disponibilidad no verificada',
    premiumReason: 'Esta función no se ha verificado para la temporada actual. No compres un pase por ella; comprueba primero las condiciones y el estado en la cadena.',
    rewardTitle: 'Recompensa', rewardPaused: 'No se puede reclamar',
    rewardReason: 'Una animación no confirma la entrega de una recompensa. Comprueba la disponibilidad, el historial de tu cartera y el saldo en la cadena.',
  },
  vi: {
    premiumTitle: 'Tính năng Premium', premiumPaused: 'Chưa xác minh khả năng sử dụng',
    premiumReason: 'Tính năng này chưa được xác minh cho mùa hiện tại. Đừng mua vé chỉ vì tính năng này; hãy kiểm tra điều kiện và trạng thái trên chuỗi trước.',
    rewardTitle: 'Phần thưởng', rewardPaused: 'Chưa thể nhận',
    rewardReason: 'Hiệu ứng không xác nhận phần thưởng đã được trao. Hãy kiểm tra khả năng nhận, lịch sử ví và số dư trên chuỗi.',
  },
  id: {
    premiumTitle: 'Fitur Premium', premiumPaused: 'Ketersediaan belum terverifikasi',
    premiumReason: 'Fitur ini belum diverifikasi untuk musim ini. Jangan membeli tiket demi fitur ini; periksa ketentuan dan status di blockchain terlebih dahulu.',
    rewardTitle: 'Hadiah', rewardPaused: 'Klaim tidak tersedia',
    rewardReason: 'Animasi tidak membuktikan hadiah telah diberikan. Periksa ketersediaan, riwayat dompet, dan saldo di blockchain.',
  },
  fil: {
    premiumTitle: 'Mga Premium na feature', premiumPaused: 'Hindi pa napatunayan ang availability',
    premiumReason: 'Hindi pa na-verify ang feature na ito para sa kasalukuyang season. Huwag bumili ng pass dahil dito; suriin muna ang mga kondisyon at on-chain na estado.',
    rewardTitle: 'Gantimpala', rewardPaused: 'Hindi maaaring kunin',
    rewardReason: 'Hindi patunay ng natanggap na gantimpala ang animation. Suriin ang availability, kasaysayan ng wallet, at on-chain na balanse.',
  },
};
