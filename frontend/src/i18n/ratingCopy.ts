import type { Language } from './translations';

type Copy = {
  loading: string; unavailable: string; connect: string; emptyPlayer: string;
  leaderboardLoading: string; leaderboardUnavailable: string; leaderboardEmpty: string;
  leaderboard: string; leaderboardAbout: string; reviews: (count: number) => string;
  distribution: string; recent: string; by: string; communitySource: string;
  rateTitle: string; commentPlaceholder: string; sending: string; submit: string; submitted: string;
  submitUnavailable: string; chooseStar: (star: number) => string;
};

/** Community database reviews, NOT on-chain trust or wallet verification. */
export const ratingCopy: Record<Language, Copy> = {
  ru: {
    loading: 'Читаем оценки игрока…', unavailable: 'Оценки недоступны. Не удалось проверить ответ сервера — это не означает, что оценок нет.',
    connect: 'Подключите кошелёк, чтобы увидеть оценки сообщества.', emptyPlayer: 'У этого игрока пока нет оценок в базе сообщества.',
    leaderboardLoading: 'Читаем таблицу оценок…', leaderboardUnavailable: 'Таблица оценок недоступна. Не удалось проверить ответ сервера — это не пустой список.',
    leaderboardEmpty: 'Пока ни один игрок не набрал пять оценок.', leaderboard: 'Игроки с лучшими оценками',
    leaderboardAbout: 'Оценки сообщества из базы сервера; не сетевой рейтинг доверия. В таблицу попадают игроки минимум с пятью оценками.',
    reviews: count => `Оценок: ${count}`, distribution: 'Распределение оценок', recent: 'Недавние оценки', by: 'от',
    communitySource: 'Оценки из базы сообщества, не подтверждение личности в сети.',
    rateTitle: 'Оцените игрока', commentPlaceholder: 'Комментарий (необязательно)…', sending: 'Отправляем…', submit: 'Отправить оценку',
    submitted: 'Спасибо за оценку!', submitUnavailable: 'Не удалось отправить оценку. Проверьте соединение перед повтором.', chooseStar: star => `Оценка: ${star} из 5`,
  },
  en: {
    loading: 'Loading player reviews…', unavailable: 'Reviews unavailable. The server response could not be verified; this does not mean there are no reviews.',
    connect: 'Connect your wallet to see community reviews.', emptyPlayer: 'This player has no community reviews yet.',
    leaderboardLoading: 'Loading the review leaderboard…', leaderboardUnavailable: 'Leaderboard unavailable. The server response could not be verified; this is not an empty list.',
    leaderboardEmpty: 'No player has received five reviews yet.', leaderboard: 'Top-rated players',
    leaderboardAbout: 'Community reviews stored by the server, not an on-chain trust score. At least five reviews are needed to qualify.',
    reviews: count => `Reviews: ${count}`, distribution: 'Review breakdown', recent: 'Recent reviews', by: 'by',
    communitySource: 'Community database reviews, not on-chain identity verification.',
    rateTitle: 'Rate this player', commentPlaceholder: 'Comment (optional)…', sending: 'Sending…', submit: 'Submit review',
    submitted: 'Thanks for your review!', submitUnavailable: 'Could not submit the review. Check your connection before trying again.', chooseStar: star => `Rating: ${star} out of 5`,
  },
  pt: {
    loading: 'A carregar as avaliações do jogador…', unavailable: 'Avaliações indisponíveis. Não foi possível verificar a resposta do servidor; isso não significa que não existam avaliações.',
    connect: 'Liga a carteira para ver as avaliações da comunidade.', emptyPlayer: 'Este jogador ainda não tem avaliações da comunidade.',
    leaderboardLoading: 'A carregar a classificação por avaliações…', leaderboardUnavailable: 'Classificação indisponível. Não foi possível verificar a resposta do servidor; não se trata de uma lista vazia.',
    leaderboardEmpty: 'Ainda não há jogadores com cinco avaliações.', leaderboard: 'Jogadores mais bem avaliados',
    leaderboardAbout: 'Avaliações da comunidade guardadas no servidor, não uma pontuação de confiança na rede. São necessárias pelo menos cinco avaliações.',
    reviews: count => `Avaliações: ${count}`, distribution: 'Distribuição das avaliações', recent: 'Avaliações recentes', by: 'por',
    communitySource: 'Avaliações da base da comunidade; não são uma verificação de identidade na rede.',
    rateTitle: 'Avalia este jogador', commentPlaceholder: 'Comentário (opcional)…', sending: 'A enviar…', submit: 'Enviar avaliação',
    submitted: 'Obrigado pela avaliação!', submitUnavailable: 'Não foi possível enviar a avaliação. Verifica a ligação antes de tentares novamente.', chooseStar: star => `Nota: ${star} de 5`,
  },
  es: {
    loading: 'Cargando las valoraciones del jugador…', unavailable: 'Valoraciones no disponibles. No se pudo verificar la respuesta del servidor; eso no significa que no haya valoraciones.',
    connect: 'Conecta tu cartera para ver las valoraciones de la comunidad.', emptyPlayer: 'Este jugador aún no tiene valoraciones de la comunidad.',
    leaderboardLoading: 'Cargando la clasificación por valoraciones…', leaderboardUnavailable: 'Clasificación no disponible. No se pudo verificar la respuesta del servidor; no es una lista vacía.',
    leaderboardEmpty: 'Todavía no hay jugadores con cinco valoraciones.', leaderboard: 'Jugadores mejor valorados',
    leaderboardAbout: 'Valoraciones de la comunidad guardadas en el servidor; no son una puntuación de confianza en la cadena. Se necesitan al menos cinco valoraciones.',
    reviews: count => `Valoraciones: ${count}`, distribution: 'Distribución de valoraciones', recent: 'Valoraciones recientes', by: 'de',
    communitySource: 'Valoraciones de la comunidad, no una verificación de identidad en la cadena.',
    rateTitle: 'Valora a este jugador', commentPlaceholder: 'Comentario (opcional)…', sending: 'Enviando…', submit: 'Enviar valoración',
    submitted: '¡Gracias por tu valoración!', submitUnavailable: 'No se pudo enviar la valoración. Comprueba la conexión antes de intentarlo de nuevo.', chooseStar: star => `Puntuación: ${star} de 5`,
  },
  vi: {
    loading: 'Đang tải đánh giá của người chơi…', unavailable: 'Không thể tải đánh giá. Chưa xác minh được phản hồi máy chủ; điều đó không có nghĩa là chưa có đánh giá.',
    connect: 'Kết nối ví để xem đánh giá từ cộng đồng.', emptyPlayer: 'Người chơi này chưa có đánh giá từ cộng đồng.',
    leaderboardLoading: 'Đang tải bảng xếp hạng đánh giá…', leaderboardUnavailable: 'Không thể tải bảng xếp hạng. Chưa xác minh được phản hồi máy chủ; đây không phải danh sách trống.',
    leaderboardEmpty: 'Chưa có người chơi nào nhận được năm lượt đánh giá.', leaderboard: 'Người chơi được đánh giá cao nhất',
    leaderboardAbout: 'Đánh giá cộng đồng lưu trên máy chủ, không phải điểm tin cậy trên chuỗi. Cần ít nhất năm lượt đánh giá để vào bảng.',
    reviews: count => `Lượt đánh giá: ${count}`, distribution: 'Phân bố đánh giá', recent: 'Đánh giá gần đây', by: 'bởi',
    communitySource: 'Đánh giá từ cơ sở dữ liệu cộng đồng, không phải xác minh danh tính trên chuỗi.',
    rateTitle: 'Đánh giá người chơi này', commentPlaceholder: 'Bình luận (không bắt buộc)…', sending: 'Đang gửi…', submit: 'Gửi đánh giá',
    submitted: 'Cảm ơn bạn đã đánh giá!', submitUnavailable: 'Không thể gửi đánh giá. Hãy kiểm tra kết nối trước khi thử lại.', chooseStar: star => `Đánh giá: ${star} trên 5`,
  },
  id: {
    loading: 'Memuat ulasan pemain…', unavailable: 'Ulasan tidak tersedia. Respons server tidak dapat diverifikasi; ini bukan berarti belum ada ulasan.',
    connect: 'Hubungkan dompet untuk melihat ulasan komunitas.', emptyPlayer: 'Pemain ini belum memiliki ulasan komunitas.',
    leaderboardLoading: 'Memuat peringkat berdasarkan ulasan…', leaderboardUnavailable: 'Peringkat tidak tersedia. Respons server tidak dapat diverifikasi; ini bukan daftar kosong.',
    leaderboardEmpty: 'Belum ada pemain yang mendapat lima ulasan.', leaderboard: 'Pemain dengan ulasan terbaik',
    leaderboardAbout: 'Ulasan komunitas tersimpan di server, bukan skor kepercayaan di blockchain. Perlu setidaknya lima ulasan untuk masuk peringkat.',
    reviews: count => `Ulasan: ${count}`, distribution: 'Sebaran ulasan', recent: 'Ulasan terbaru', by: 'oleh',
    communitySource: 'Ulasan di basis data komunitas, bukan verifikasi identitas di blockchain.',
    rateTitle: 'Nilai pemain ini', commentPlaceholder: 'Komentar (opsional)…', sending: 'Mengirim…', submit: 'Kirim ulasan',
    submitted: 'Terima kasih atas ulasanmu!', submitUnavailable: 'Tidak dapat mengirim ulasan. Periksa koneksimu sebelum mencoba lagi.', chooseStar: star => `Nilai: ${star} dari 5`,
  },
  fil: {
    loading: 'Kinukuha ang mga review ng manlalaro…', unavailable: 'Hindi makuha ang mga review. Hindi ma-verify ang sagot ng server; hindi ito nangangahulugang walang review.',
    connect: 'Ikonekta ang wallet para makita ang mga review ng komunidad.', emptyPlayer: 'Wala pang review mula sa komunidad ang manlalarong ito.',
    leaderboardLoading: 'Kinukuha ang talaan ng mga review…', leaderboardUnavailable: 'Hindi makuha ang talaan. Hindi ma-verify ang sagot ng server; hindi ito nangangahulugang walang laman ang listahan.',
    leaderboardEmpty: 'Wala pang manlalarong nakakatanggap ng limang review.', leaderboard: 'Mga manlalarong may pinakamataas na review',
    leaderboardAbout: 'Mga review ng komunidad na nasa server, hindi on-chain na antas ng tiwala. Kailangan ng hindi bababa sa limang review para makapasok.',
    reviews: count => `Mga review: ${count}`, distribution: 'Bilang ng bawat rating', recent: 'Mga bagong review', by: 'mula kay',
    communitySource: 'Mga review sa talaan ng komunidad, hindi pag-verify ng pagkakakilanlan sa blockchain.',
    rateTitle: 'Bigyan ng rating ang manlalarong ito', commentPlaceholder: 'Komento (opsyonal)…', sending: 'Ipinapadala…', submit: 'Isumite ang review',
    submitted: 'Salamat sa review mo!', submitUnavailable: 'Hindi maipadala ang review. Suriin ang koneksiyon bago subukan muli.', chooseStar: star => `Rating: ${star} sa 5`,
  },
};
