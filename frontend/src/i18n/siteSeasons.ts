import type { Language } from './translations';

type SeasonCopy = {
  lead: string;
  paragraphs: readonly [string, string];
  wheelTitle: string;
  wheelHint: string;
  wheelLabel: string;
  wheelAction: string;
  phases: readonly [string, string, string, string];
  wheelStatus: (phase: string) => string;
  disclaimer: string;
};

/** The wheel is decorative. Neither pass ownership nor season status is read here. */
export const siteSeasons: Record<Language, SeasonCopy> = {
  ru: {
    lead: 'Эпохи задают ритм; их состояние определяет сеть, а не рисунок.',
    paragraphs: [
      'Колесо ниже иллюстрирует смену фаз. Оно не показывает текущую эпоху, длительность сезона, прогресс или награды твоего пропуска.',
      'В игре можно проверить активность эпохи и состояние пропуска по сетевым данным. Перед покупкой сверяй цену в кошельке; перечисленные преимущества нельзя считать действующими без проверки в игре.',
    ],
    wheelTitle: 'Колесо эпох — иллюстрация', wheelHint: 'Нажатие меняет только рисунок. Эпоха в игре не меняется.',
    wheelLabel: 'Иллюстрация эпохи', wheelAction: 'Показать следующую фазу',
    phases: ['Фаза I', 'Фаза II', 'Фаза III', 'Завершение цикла'],
    wheelStatus: phase => `${phase} · иллюстрация, не состояние игры`,
    disclaimer: 'Не считай фазу на колесе подтверждением активной эпохи, доступной покупки, опыта или награды.',
  },
  en: {
    lead: 'Seasons set the rhythm; the network, not an illustration, determines their status.',
    paragraphs: [
      'The wheel below illustrates a changing cycle. It does not show the current season, its duration, your pass progress or any rewards.',
      'You can check season activity and pass status against on-chain data in the game. Verify the price in your wallet before buying; listed benefits should not be treated as active without in-game confirmation.',
    ],
    wheelTitle: 'Season wheel · illustration', wheelHint: 'Pressing the wheel changes only the picture. It does not change the game season.',
    wheelLabel: 'Season illustration', wheelAction: 'Show the next phase',
    phases: ['Phase I', 'Phase II', 'Phase III', 'End of cycle'],
    wheelStatus: phase => `${phase} · illustration, not game status`,
    disclaimer: 'A phase on this wheel does not confirm an active season, an available purchase, experience or a reward.',
  },
  pt: {
    lead: 'As temporadas ditam o ritmo; quem define o estado delas é a rede, não uma ilustração.',
    paragraphs: [
      'A roda abaixo ilustra a passagem das fases. Ela não mostra a temporada atual, sua duração, o progresso do passe nem prêmios.',
      'No jogo, é possível conferir a atividade da temporada e o estado do passe pelos dados da rede. Confirme o preço na carteira antes de comprar; benefícios anunciados não devem ser considerados ativos sem confirmação no jogo.',
    ],
    wheelTitle: 'Roda das temporadas · ilustração', wheelHint: 'Clicar na roda muda apenas o desenho. A temporada no jogo não se altera.',
    wheelLabel: 'Ilustração da temporada', wheelAction: 'Mostrar a próxima fase',
    phases: ['Fase I', 'Fase II', 'Fase III', 'Fim do ciclo'],
    wheelStatus: phase => `${phase} · ilustração, não o estado do jogo`,
    disclaimer: 'A fase desta roda não confirma uma temporada ativa, uma compra disponível, experiência nem prêmios.',
  },
  es: {
    lead: 'Las temporadas marcan el ritmo; la red, no una ilustración, determina su estado.',
    paragraphs: [
      'La rueda de abajo ilustra el paso de las fases. No muestra la temporada actual, su duración, el progreso de tu pase ni premios.',
      'En el juego puedes comprobar la actividad de la temporada y el estado del pase mediante datos de la cadena. Comprueba el precio en tu cartera antes de comprar; no des por vigentes las ventajas anunciadas sin confirmación en el juego.',
    ],
    wheelTitle: 'Rueda de temporadas · ilustración', wheelHint: 'Pulsar la rueda solo cambia el dibujo. No cambia la temporada del juego.',
    wheelLabel: 'Ilustración de la temporada', wheelAction: 'Mostrar la siguiente fase',
    phases: ['Fase I', 'Fase II', 'Fase III', 'Fin del ciclo'],
    wheelStatus: phase => `${phase} · ilustración, no el estado del juego`,
    disclaimer: 'La fase de esta rueda no confirma una temporada activa, una compra disponible, experiencia ni premios.',
  },
  vi: {
    lead: 'Mùa giải tạo nên nhịp điệu; trạng thái của chúng do mạng lưới quyết định, không phải hình vẽ.',
    paragraphs: [
      'Vòng quay dưới đây chỉ minh họa các giai đoạn thay đổi. Nó không hiển thị mùa giải hiện tại, thời lượng, tiến độ thẻ hay phần thưởng của bạn.',
      'Trong trò chơi, bạn có thể kiểm tra mùa giải có hoạt động hay không và trạng thái thẻ từ dữ liệu trên chuỗi. Hãy xác nhận giá trong ví trước khi mua; đừng coi các quyền lợi được liệt kê là đang có hiệu lực nếu chưa kiểm tra trong trò chơi.',
    ],
    wheelTitle: 'Vòng quay mùa giải · hình minh họa', wheelHint: 'Nhấn vào vòng quay chỉ đổi hình vẽ, không đổi mùa giải trong trò chơi.',
    wheelLabel: 'Hình minh họa mùa giải', wheelAction: 'Xem giai đoạn tiếp theo',
    phases: ['Giai đoạn I', 'Giai đoạn II', 'Giai đoạn III', 'Kết thúc chu kỳ'],
    wheelStatus: phase => `${phase} · hình minh họa, không phải trạng thái trò chơi`,
    disclaimer: 'Giai đoạn trên vòng quay không xác nhận mùa giải đang hoạt động, quyền mua, kinh nghiệm hay phần thưởng.',
  },
  id: {
    lead: 'Musim menentukan irama; jaringan, bukan ilustrasi, yang menentukan statusnya.',
    paragraphs: [
      'Roda di bawah ini hanya menggambarkan pergantian fase. Ini tidak menunjukkan musim saat ini, durasinya, progres pass, atau hadiahmu.',
      'Dalam permainan, kamu dapat memeriksa aktivitas musim dan status pass lewat data di blockchain. Pastikan harga di dompet sebelum membeli; jangan menganggap manfaat yang tercantum sudah aktif tanpa konfirmasi dalam permainan.',
    ],
    wheelTitle: 'Roda musim · ilustrasi', wheelHint: 'Menekan roda hanya mengubah gambar, bukan musim dalam permainan.',
    wheelLabel: 'Ilustrasi musim', wheelAction: 'Tampilkan fase berikutnya',
    phases: ['Fase I', 'Fase II', 'Fase III', 'Akhir siklus'],
    wheelStatus: phase => `${phase} · ilustrasi, bukan status permainan`,
    disclaimer: 'Fase pada roda ini tidak memastikan musim aktif, pembelian tersedia, pengalaman, atau hadiah.',
  },
  fil: {
    lead: 'Mga season ang nagbibigay ng ritmo; ang network, hindi larawan, ang nagtatakda ng katayuan nila.',
    paragraphs: [
      'Ipinapakita lamang ng gulong sa ibaba ang pag-ikot ng mga yugto. Hindi nito ipinapakita ang kasalukuyang season, tagal nito, progreso ng pass, o mga gantimpala mo.',
      'Sa laro, maaari mong suriin ang aktibidad ng season at status ng pass gamit ang datos sa blockchain. Tingnan ang presyo sa wallet bago bumili; huwag ipagpalagay na aktibo ang mga nakalistang benepisyo kung hindi pa nakumpirma sa laro.',
    ],
    wheelTitle: 'Gulong ng season · larawan', wheelHint: 'Larawan lang ang nababago kapag pinindot ang gulong; hindi nito binabago ang season ng laro.',
    wheelLabel: 'Larawan ng season', wheelAction: 'Ipakita ang susunod na yugto',
    phases: ['Yugto I', 'Yugto II', 'Yugto III', 'Katapusan ng siklo'],
    wheelStatus: phase => `${phase} · larawan, hindi status ng laro`,
    disclaimer: 'Hindi pinatutunayan ng yugto sa gulong na aktibo ang season, puwedeng bumili, may karanasan, o may gantimpala.',
  },
};
