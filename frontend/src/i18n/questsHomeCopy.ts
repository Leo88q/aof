import type { Language } from './translations';

type Copy = {
  title: string; daily: string; challenges: string; achievements: string;
  sticker: string; meta: string; panelTitle: string; panelSub: string;
  cardTitle: string; placeholder: string; connect: string;
  challengeTitle: string; challengeReason: string; challengeProgress: string; challengeDisabled: string;
  achievementNote: string;
};

/** The canonical quest and achievement indexes currently return 503. No rewards are offered here. */
export const questsHomeCopy: Record<Language, Copy> = {
  ru: {
    title: 'Задания', daily: 'Задания', challenges: 'Челленджи', achievements: 'Достижения',
    sticker: 'ЗАДАНИЯ', meta: 'НЕТ ДАННЫХ', panelTitle: 'Перфокарта заданий', panelSub: 'образец прибора, не прогресс игрока',
    cardTitle: 'ПРОГРЕСС НЕДОСТУПЕН', placeholder: 'неизвестно', connect: 'Подключите кошелёк, чтобы проверять задания, когда их архив появится.',
    challengeTitle: 'Недельный челлендж', challengeReason: 'Вклады отключены: сеть пока не умеет проверяемо списывать медали и выдавать итоговые награды.',
    challengeProgress: 'Прогресс недели неизвестен — проверяемого источника пока нет.', challengeDisabled: 'Временно отключено',
    achievementNote: 'Достижения нельзя проверить, пока не заработает архив заданий. Пустой список не означает, что их нет.',
  },
  en: {
    title: 'Quests', daily: 'Quests', challenges: 'Challenges', achievements: 'Achievements',
    sticker: 'QUESTS', meta: 'NO DATA', panelTitle: 'Quest punch card', panelSub: 'device preview, not your progress',
    cardTitle: 'PROGRESS UNAVAILABLE', placeholder: 'unknown', connect: 'Connect your wallet to check quests when the history becomes available.',
    challengeTitle: 'Weekly challenge', challengeReason: 'Contributions are disabled: the network cannot yet verifiably deduct medals and settle rewards.',
    challengeProgress: 'Weekly progress is unknown; there is no verified source yet.', challengeDisabled: 'Temporarily disabled',
    achievementNote: 'Achievements cannot be checked until quest history is available. An unknown list does not mean there are none.',
  },
  pt: {
    title: 'Missões', daily: 'Missões', challenges: 'Desafios', achievements: 'Conquistas',
    sticker: 'MISSÕES', meta: 'SEM DADOS', panelTitle: 'Cartão perfurado de missões', panelSub: 'demonstração do aparelho, não seu progresso',
    cardTitle: 'PROGRESSO INDISPONÍVEL', placeholder: 'desconhecido', connect: 'Conecte a carteira para consultar as missões quando o histórico estiver disponível.',
    challengeTitle: 'Desafio semanal', challengeReason: 'As contribuições estão desativadas: a rede ainda não consegue descontar medalhas e distribuir recompensas de modo verificável.',
    challengeProgress: 'O progresso da semana é desconhecido; ainda não há fonte verificada.', challengeDisabled: 'Temporariamente desativado',
    achievementNote: 'Não é possível conferir as conquistas até que o histórico de missões esteja disponível. Uma lista desconhecida não significa que não existam.',
  },
  es: {
    title: 'Misiones', daily: 'Misiones', challenges: 'Desafíos', achievements: 'Logros',
    sticker: 'MISIONES', meta: 'SIN DATOS', panelTitle: 'Tarjeta perforada de misiones', panelSub: 'muestra del dispositivo, no tu progreso',
    cardTitle: 'PROGRESO NO DISPONIBLE', placeholder: 'desconocido', connect: 'Conecta tu cartera para consultar las misiones cuando esté disponible su historial.',
    challengeTitle: 'Desafío semanal', challengeReason: 'Las contribuciones están desactivadas: la cadena aún no puede descontar medallas y liquidar premios de forma verificable.',
    challengeProgress: 'Se desconoce el progreso semanal; aún no hay una fuente verificada.', challengeDisabled: 'Desactivado temporalmente',
    achievementNote: 'No se pueden comprobar los logros hasta que esté disponible el historial de misiones. Una lista desconocida no significa que no existan.',
  },
  vi: {
    title: 'Nhiệm vụ', daily: 'Nhiệm vụ', challenges: 'Thử thách', achievements: 'Thành tựu',
    sticker: 'NHIỆM VỤ', meta: 'CHƯA CÓ DỮ LIỆU', panelTitle: 'Thẻ đục lỗ nhiệm vụ', panelSub: 'minh họa thiết bị, không phải tiến độ của bạn',
    cardTitle: 'CHƯA CÓ TIẾN ĐỘ', placeholder: 'chưa rõ', connect: 'Kết nối ví để kiểm tra nhiệm vụ khi có lịch sử.',
    challengeTitle: 'Thử thách hằng tuần', challengeReason: 'Chưa thể đóng góp: mạng chưa hỗ trợ trừ huy chương và phân phát phần thưởng theo cách có thể xác minh.',
    challengeProgress: 'Chưa rõ tiến độ tuần; hiện chưa có nguồn dữ liệu được xác minh.', challengeDisabled: 'Tạm thời không khả dụng',
    achievementNote: 'Chưa thể kiểm tra thành tựu trước khi có lịch sử nhiệm vụ. Không rõ dữ liệu không có nghĩa là chưa đạt thành tựu nào.',
  },
  id: {
    title: 'Misi', daily: 'Misi', challenges: 'Tantangan', achievements: 'Pencapaian',
    sticker: 'MISI', meta: 'BELUM ADA DATA', panelTitle: 'Kartu berlubang misi', panelSub: 'pratinjau alat, bukan progresmu',
    cardTitle: 'PROGRES BELUM TERSEDIA', placeholder: 'belum diketahui', connect: 'Hubungkan dompet untuk memeriksa misi saat riwayat tersedia.',
    challengeTitle: 'Tantangan mingguan', challengeReason: 'Kontribusi dinonaktifkan: jaringan belum dapat memotong medali dan menyelesaikan hadiah secara terverifikasi.',
    challengeProgress: 'Progres mingguan belum diketahui; belum ada sumber terverifikasi.', challengeDisabled: 'Dinonaktifkan sementara',
    achievementNote: 'Pencapaian belum dapat diperiksa sampai riwayat misi tersedia. Data yang belum diketahui bukan berarti tidak ada pencapaian.',
  },
  fil: {
    title: 'Mga gawain', daily: 'Mga gawain', challenges: 'Mga hamon', achievements: 'Mga tagumpay',
    sticker: 'MGA GAWAIN', meta: 'WALANG DATOS', panelTitle: 'Punch card ng mga gawain', panelSub: 'halimbawa ng aparato, hindi ang iyong progreso',
    cardTitle: 'HINDI MAKUHA ANG PROGRESO', placeholder: 'hindi pa alam', connect: 'Ikonekta ang wallet para masuri ang mga gawain kapag available na ang kasaysayan.',
    challengeTitle: 'Lingguhang hamon', challengeReason: 'Nakasara ang mga ambag: hindi pa kayang ibawas ng network ang mga medalya at ipamahagi ang gantimpala sa paraang nave-verify.',
    challengeProgress: 'Hindi pa alam ang lingguhang progreso; wala pang na-verify na pinagmulan.', challengeDisabled: 'Pansamantalang nakasara',
    achievementNote: 'Hindi pa masuri ang mga tagumpay hangga’t walang kasaysayan ng gawain. Hindi ibig sabihin ng di-matiyak na listahan na wala kang tagumpay.',
  },
};
