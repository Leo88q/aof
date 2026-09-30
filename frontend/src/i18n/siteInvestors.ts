import type { Language } from './translations';

type InvestorArticle = {
  lead: string; paragraphs: readonly [string, string];
  cyclesHeading: string; flowsHeading: string; questionsHeading: string;
  questions: readonly [string, string, string, string, string]; note: string;
};

/** Due-diligence questions, not investment advice, live metrics or an offering. */
export const siteInvestors: Record<Language, InvestorArticle> = {
  ru: {
    lead: 'Сначала доказательства, затем выводы об экономике.',
    paragraphs: ['Это редакционный разбор возможных потоков, не предложение инвестировать. Он не показывает текущую эмиссию, объём торгов, выручку или число пользователей: за этими числами нужны проверяемые записи и методика расчёта.', 'Некоторые действия ещё отключены или не имеют подтверждённого индекса. Добыча инструментами выключена по умолчанию; новые заявки и сведение в книге заявок приостановлены; перерождение теперь платное и сбрасывает прогресс сезона, но подтверждённого экономического цикла из него ещё нет.'],
    cyclesHeading: 'Четыре схемы, а не прогноз дохода', flowsHeading: 'Возможные потоки, а не отчёт о выручке', questionsHeading: 'Пять вопросов для проверки',
    questions: [
      'Какие полномочия есть у операторских ключей в развёрнутой программе и кто может их менять?',
      'Откуда взяты цифры оборота и эмиссии, каким образом исключены повторные записи и ошибки чтения?',
      'Какие торговые площадки принимают новые операции именно сейчас, а какие остаются доступными лишь для просмотра и отмены?',
      'Какие суммы, комиссии и условия возврата видны в кошельке до подписи конкретной операции?',
      'Какие награды и токены действительно доступны в сети, а какие описаны только в планах или художественном тексте?',
    ],
    note: 'Ни эта страница, ни схема потоков не подтверждают прибыль, ликвидность, ценность токена или право на награду. Сверяй исходные записи и риски самостоятельно. Это не инвестиционная рекомендация.',
  },
  en: {
    lead: 'Begin with evidence, then draw conclusions about the economy.',
    paragraphs: ['This is an editorial look at possible flows, not an investment offer. It shows no current issuance, trading volume, revenue or user count: those figures require verifiable records and a stated methodology.', 'Some actions are disabled or lack a verified index. Tool mining is off by default; new order-book placement and matching are paused; rebirth now charges a price and resets season progress, but it is not an established economic cycle yet.'],
    cyclesHeading: 'Four diagrams, not a return forecast', flowsHeading: 'Possible flows, not a revenue report', questionsHeading: 'Five questions to investigate',
    questions: [
      'What powers do operator keys have in the deployed program, and who can change them?',
      'Where do issuance and trading figures come from, and how are duplicates and failed reads excluded?',
      'Which venues accept new transactions right now, and which only permit viewing or cancellation?',
      'What amounts, fees and refund terms does your wallet show before signing a particular action?',
      'Which rewards and tokens are actually available on-chain, and which exist only in plans or fictional stories?',
    ],
    note: 'Neither this page nor the flow diagrams confirm profit, liquidity, token value or entitlement to rewards. Verify primary records and risks yourself. This is not investment advice.',
  },
  pt: {
    lead: 'Primeiro as provas, depois as conclusões sobre a economia.',
    paragraphs: ['Este é um olhar editorial sobre possíveis fluxos, não uma oferta de investimento. Não mostra emissão atual, volume negociado, receita nem número de utilizadores: são necessárias fontes verificáveis e uma metodologia definida.', 'Algumas ações estão desativadas ou não têm um índice verificado. A extração com ferramentas está desligada por padrão; novas ordens e cruzamentos no livro estão suspensos; o renascimento já cobra preço e reinicia o progresso da temporada, mas ainda não é um ciclo económico confirmado.'],
    cyclesHeading: 'Quatro esquemas, não previsões de rendimento', flowsHeading: 'Fluxos possíveis, não um relatório de receitas', questionsHeading: 'Cinco perguntas a investigar',
    questions: [
      'Que poderes têm as chaves do operador no programa publicado, e quem os pode alterar?',
      'De onde vêm os números de emissão e negociação, e como se excluem duplicações e falhas de leitura?',
      'Que mercados aceitam novas transações agora, e quais permitem apenas consultar ou cancelar?',
      'Que valores, taxas e condições de reembolso mostra a carteira antes de assinares uma operação?',
      'Que prêmios e tokens estão realmente disponíveis na rede, e quais constam apenas de planos ou histórias?',
    ],
    note: 'Nem esta página nem os esquemas garantem lucros, liquidez, valor do token ou direito a prêmios. Confere as fontes e os riscos por ti próprio. Isto não é aconselhamento de investimento.',
  },
  es: {
    lead: 'Primero las pruebas; luego, las conclusiones sobre la economía.',
    paragraphs: ['Este es un análisis editorial de posibles flujos, no una oferta de inversión. No muestra emisión actual, volumen de operaciones, ingresos ni usuarios: esas cifras requieren registros verificables y una metodología explícita.', 'Algunas acciones están desactivadas o carecen de un índice verificado. La extracción con herramientas está apagada por defecto; las nuevas órdenes y cruces del libro están suspendidos; el renacimiento ya cobra un precio y reinicia el progreso de la temporada, pero aún no es un ciclo económico confirmado.'],
    cyclesHeading: 'Cuatro esquemas, no previsiones de ganancias', flowsHeading: 'Flujos posibles, no un informe de ingresos', questionsHeading: 'Cinco preguntas para investigar',
    questions: [
      '¿Qué facultades tienen las claves del operador en el programa desplegado y quién puede cambiarlas?',
      '¿De dónde salen las cifras de emisión y operaciones, y cómo se excluyen duplicados y errores de lectura?',
      '¿Qué mercados admiten nuevas operaciones ahora y cuáles solo permiten consultar o cancelar?',
      '¿Qué importes, tasas y condiciones de reembolso muestra tu cartera antes de firmar una operación concreta?',
      '¿Qué recompensas y tokens están disponibles realmente en la cadena y cuáles solo figuran en planes o relatos?',
    ],
    note: 'Ni esta página ni los esquemas confirman beneficios, liquidez, valor de tokens o derecho a recompensas. Comprueba las fuentes y los riesgos por tu cuenta. Esto no es asesoramiento de inversión.',
  },
  vi: {
    lead: 'Bắt đầu từ bằng chứng, rồi mới kết luận về kinh tế.',
    paragraphs: ['Đây là bài phân tích biên tập về các dòng tài nguyên có thể có, không phải lời mời đầu tư. Bài viết không hiển thị lượng phát hành, khối lượng giao dịch, doanh thu hay số người dùng hiện tại: các số liệu ấy cần bản ghi xác minh được và phương pháp tính rõ ràng.', 'Một số hành động đã bị tắt hoặc chưa có chỉ mục xác minh. Khai thác bằng công cụ mặc định bị tắt; đặt và khớp lệnh mới trong sổ lệnh bị tạm dừng; tái sinh đã thu phí và đặt lại tiến trình mùa, nhưng vẫn chưa là một chu kỳ kinh tế đã xác nhận.'],
    cyclesHeading: 'Bốn sơ đồ, không phải dự báo lợi nhuận', flowsHeading: 'Dòng chảy có thể có, không phải báo cáo doanh thu', questionsHeading: 'Năm câu hỏi cần tìm hiểu',
    questions: [
      'Khóa vận hành có những quyền gì trong chương trình đã triển khai, và ai có thể thay đổi chúng?',
      'Số liệu phát hành và giao dịch lấy từ đâu, làm sao loại bỏ bản ghi trùng và lỗi đọc?',
      'Chợ nào đang nhận giao dịch mới, chợ nào chỉ cho xem hoặc hủy lệnh?',
      'Trước khi ký một hành động cụ thể, ví hiển thị số tiền, phí và điều kiện hoàn tiền nào?',
      'Phần thưởng và token nào thực sự có trên chuỗi, cái nào chỉ xuất hiện trong kế hoạch hoặc câu chuyện?',
    ],
    note: 'Trang này và sơ đồ không xác nhận lợi nhuận, thanh khoản, giá trị token hay quyền nhận thưởng. Hãy tự kiểm tra bản ghi gốc và rủi ro. Đây không phải lời khuyên đầu tư.',
  },
  id: {
    lead: 'Mulailah dari bukti sebelum menarik kesimpulan tentang ekonomi.',
    paragraphs: ['Ini ulasan editorial tentang kemungkinan aliran sumber daya, bukan tawaran investasi. Halaman ini tidak menampilkan penerbitan, volume perdagangan, pendapatan, atau jumlah pengguna terkini: angka itu memerlukan catatan terverifikasi dan metode perhitungan yang jelas.', 'Sebagian tindakan dimatikan atau belum memiliki indeks yang terverifikasi. Penambangan peralatan mati secara bawaan; penempatan dan pencocokan pesanan baru ditunda; kelahiran kembali kini memungut biaya dan mengatur ulang kemajuan musim, tetapi belum menjadi siklus ekonomi yang terkonfirmasi.'],
    cyclesHeading: 'Empat diagram, bukan ramalan keuntungan', flowsHeading: 'Kemungkinan aliran, bukan laporan pendapatan', questionsHeading: 'Lima pertanyaan untuk diperiksa',
    questions: [
      'Apa wewenang kunci operator dalam program yang telah diterapkan, dan siapa yang dapat mengubahnya?',
      'Dari mana angka penerbitan dan perdagangan berasal, dan bagaimana duplikat serta kesalahan pembacaan disaring?',
      'Pasar mana menerima transaksi baru sekarang, dan mana yang hanya memungkinkan melihat atau membatalkan?',
      'Jumlah, biaya, dan ketentuan pengembalian apa yang ditampilkan dompet sebelum menandatangani tindakan tertentu?',
      'Hadiah dan token mana yang benar-benar tersedia di blockchain, dan mana yang hanya ada dalam rencana atau kisah?',
    ],
    note: 'Halaman dan diagram ini tidak memastikan laba, likuiditas, nilai token, atau hak atas hadiah. Periksa catatan utama dan risikonya sendiri. Ini bukan nasihat investasi.',
  },
  fil: {
    lead: 'Magsimula sa ebidensiya bago humusga sa ekonomiya.',
    paragraphs: ['Editoryal na pagtingin ito sa maaaring daloy ng yaman, hindi alok ng pamumuhunan. Wala itong kasalukuyang datos sa pag-isyu, dami ng kalakalan, kita, o bilang ng gumagamit: kailangan dito ang nabeberipikang tala at malinaw na paraan ng pagbibilang.', 'May mga gawaing nakapatay o wala pang beripikadong index. Nakatigil bilang default ang pagmimina gamit ang kagamitan; nakahinto ang paglalagay at pagtutugma ng bagong order; may bayad na ngayon ang muling pagsilang at ni-reset ang progreso ng panahon, ngunit hindi pa ito kumpirmadong siklo ng ekonomiya.'],
    cyclesHeading: 'Apat na diagram, hindi tantiya ng kita', flowsHeading: 'Maaaring daloy, hindi ulat ng kinita', questionsHeading: 'Limang tanong na dapat siyasatin',
    questions: [
      'Anong kapangyarihan ang taglay ng operator key sa nakalathalang program, at sino ang makapagbabago nito?',
      'Saan nagmula ang bilang ng pag-isyu at kalakalan, at paano inalis ang dobleng tala at maling pagbasa?',
      'Aling pamilihan ang tumatanggap ng bagong transaksyon ngayon, at alin ang para lamang sa pagtingin o pagkansela?',
      'Anong halaga, bayarin, at kondisyon sa refund ang ipinapakita ng wallet bago pumirma sa isang gawain?',
      'Aling gantimpala at token ang tunay na nasa blockchain, at alin ang nasa plano o kathang-isip na kuwento pa lamang?',
    ],
    note: 'Hindi kinukumpirma ng pahina o mga diagram ang kita, liquidity, halaga ng token, o karapatan sa gantimpala. Suriin ang pangunahing tala at panganib nang mag-isa. Hindi ito payo sa pamumuhunan.',
  },
};
