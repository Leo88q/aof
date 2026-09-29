import type { Language } from './translations';

export const economyCycleIds = ['production', 'craft', 'exchange', 'season'] as const;
export type EconomyCycleId = typeof economyCycleIds[number];
type Cycle = { title: string; steps: readonly [string, string, string] };
type EconomyArticle = {
  lead: string; paragraphs: readonly [string, string];
  flowHeading: string; incoming: string; incomingItems: readonly [string, string, string];
  outgoing: string; outgoingItems: readonly [string, string, string];
  cyclesHeading: string; cycles: Record<EconomyCycleId, Cycle>; note: string;
};

/** Editorial flow diagram only, never balances, live yields or investment advice. */
export const siteEconomy: Record<Language, EconomyArticle> = {
  ru: {
    lead: 'Ресурс проходит путь от труда к расходу; цифры всегда проверяй в сети.',
    paragraphs: ['Ниже — схема возможных путей ресурсов, а не сводка кошельков или обещание прибыли. Производство, обмен и оплата действуют по разным правилам: перевод между игроками не создаёт новый ресурс.', 'Добыча инструментом в этой версии отключена по умолчанию; сетевые задания и награды не следует считать действующими без проверки. Перерождение пока не предлагается: описанный цикл эпохи не является планом получения бонусов.'],
    flowHeading: 'Откуда приходит и куда уходит', incoming: 'Возможные поступления',
    incomingItems: ['Культивация и последующие действия — только после подтверждения состояния лаборатории.', 'Экспедиции — отдельные затраты и неопределённый исход; сверяй условия в игре.', 'Покупка у другого игрока переносит актив, а не выпускает новый.'],
    outgoing: 'Возможные расходы',
    outgoingItems: ['Рецепты и сборка потребляют материалы по текущему подтверждённому составу.', 'Ремонт зависит от конкретного инструмента и цены, показанной до подписи.', 'Сетевые комиссии и переводы проверяются в кошельке; итог нельзя вычислить по этой схеме.'],
    cyclesHeading: 'Четыре схемы, не живые показатели',
    cycles: {
      production: { title: 'Цепочка модели', steps: ['Вырастить образец', 'Разделить полученное', 'Обучить модель по проверенному рецепту'] },
      craft: { title: 'Цепочка инструмента', steps: ['Сверить материалы', 'Собрать или починить', 'Проверить новую прочность в сети'] },
      exchange: { title: 'Цепочка обмена', steps: ['Проверить доступность площадки', 'Сравнить полный расход с кошельком', 'Проверить результат в сети'] },
      season: { title: 'Цепочка эпохи', steps: ['Прочитать действующий статус', 'Проверить пропуск и доступные действия', 'Не считать планируемые награды полученными'] },
    },
    note: 'Это иллюстрация потоков, не учёт эмиссии, оборота, доходности или владения. Сбой чтения сети не означает нулевой баланс.',
  },
  en: {
    lead: 'A resource travels from work to expenditure; always check the numbers on-chain.',
    paragraphs: ['The diagram below shows possible resource flows, not wallet balances or promised returns. Production, exchange and payment follow different rules: a transfer between players does not mint a new resource.', 'Tool mining is disabled by default in this version; do not assume on-chain quests or rewards are active without checking. Rebirth is not offered yet: the season cycle shown here is no plan for earning bonuses.'],
    flowHeading: 'Where resources come from and go', incoming: 'Possible inflows',
    incomingItems: ['Cultivation and later actions, only after checking the laboratory’s actual status.', 'Expeditions have their own costs and uncertain outcomes; check their terms in the game.', 'Buying from another player transfers an asset; it does not mint a new one.'],
    outgoing: 'Possible outflows',
    outgoingItems: ['Recipes and tool crafting consume materials according to the current verified requirements.', 'Repair depends on the particular tool and the cost shown before signing.', 'Check network fees and transfers in your wallet; this diagram cannot quote the total.'],
    cyclesHeading: 'Four diagrams, not live metrics',
    cycles: {
      production: { title: 'The model chain', steps: ['Grow a sample', 'Separate the harvest', 'Train a model with a verified recipe'] },
      craft: { title: 'The tool chain', steps: ['Check the materials', 'Craft or repair', 'Verify the new durability on-chain'] },
      exchange: { title: 'The trading chain', steps: ['Check if the venue is available', 'Compare the full cost in your wallet', 'Verify the outcome on-chain'] },
      season: { title: 'The season chain', steps: ['Read the current status', 'Check the pass and available actions', 'Do not count planned rewards as received'] },
    },
    note: 'This illustrates flows, not issuance, trading volume, returns or ownership. A failed network read is not a zero balance.',
  },
  pt: {
    lead: 'Um recurso segue do trabalho ao gasto; confirma sempre os números na rede.',
    paragraphs: ['O esquema abaixo mostra possíveis trajetos de recursos, não saldos de carteiras nem rendimentos prometidos. Produção, troca e pagamento seguem regras diferentes: uma transferência entre jogadores não cria novos recursos.', 'A extração com ferramentas está desativada por padrão nesta versão; não pressuponhas missões nem prêmios ativos sem verificar. O renascimento ainda não está disponível: o ciclo de épocas abaixo não é um plano para ganhar bônus.'],
    flowHeading: 'De onde vêm e para onde vão', incoming: 'Possíveis entradas',
    incomingItems: ['Cultivo e etapas seguintes, após confirmar o estado real do laboratório.', 'Expedições têm custos próprios e resultados incertos; confere as condições no jogo.', 'Comprar a outro jogador transfere um ativo, não cria um novo.'],
    outgoing: 'Possíveis saídas',
    outgoingItems: ['Receitas e criação de ferramentas consomem materiais segundo os requisitos atuais e verificados.', 'O reparo depende da ferramenta e do custo apresentado antes de assinar.', 'Confere taxas da rede e transferências na carteira; este esquema não calcula o total.'],
    cyclesHeading: 'Quatro esquemas, não indicadores em tempo real',
    cycles: {
      production: { title: 'Cadeia do modelo', steps: ['Cultivar uma amostra', 'Separar a colheita', 'Treinar um modelo com uma receita verificada'] },
      craft: { title: 'Cadeia da ferramenta', steps: ['Verificar os materiais', 'Criar ou reparar', 'Confirmar a nova durabilidade na rede'] },
      exchange: { title: 'Cadeia da troca', steps: ['Verificar se o mercado está disponível', 'Comparar o custo total na carteira', 'Confirmar o resultado na rede'] },
      season: { title: 'Cadeia da época', steps: ['Consultar o estado atual', 'Verificar o passe e as ações disponíveis', 'Não contar prêmios previstos como recebidos'] },
    },
    note: 'Isto ilustra fluxos, não emissão, volume negociado, rendimento ou posse. Uma falha na leitura da rede não equivale a saldo zero.',
  },
  es: {
    lead: 'Un recurso viaja del trabajo al gasto; comprueba siempre las cifras en la cadena.',
    paragraphs: ['El esquema de abajo muestra posibles flujos de recursos, no saldos de carteras ni beneficios prometidos. Producción, intercambio y pago siguen reglas distintas: transferir entre jugadores no crea un recurso nuevo.', 'La extracción con herramientas está desactivada por defecto en esta versión; no des por vigentes misiones o recompensas sin comprobarlo. El renacimiento aún no se ofrece: el ciclo de épocas no es un plan para obtener bonificaciones.'],
    flowHeading: 'De dónde vienen y adónde van', incoming: 'Posibles entradas',
    incomingItems: ['Cultivo y etapas posteriores, tras comprobar el estado real del laboratorio.', 'Las expediciones tienen costes propios y resultados inciertos; revisa sus condiciones en el juego.', 'Comprar a otro jugador traslada un activo, no crea uno nuevo.'],
    outgoing: 'Posibles salidas',
    outgoingItems: ['Las recetas y la fabricación de herramientas consumen materiales según los requisitos actuales y verificados.', 'Reparar depende de cada herramienta y del coste mostrado antes de firmar.', 'Comprueba tasas de red y transferencias en tu cartera; este esquema no calcula el total.'],
    cyclesHeading: 'Cuatro esquemas, no indicadores en directo',
    cycles: {
      production: { title: 'Cadena del modelo', steps: ['Cultivar una muestra', 'Separar la cosecha', 'Entrenar un modelo con una receta verificada'] },
      craft: { title: 'Cadena de la herramienta', steps: ['Comprobar los materiales', 'Fabricar o reparar', 'Verificar la nueva durabilidad en la cadena'] },
      exchange: { title: 'Cadena del intercambio', steps: ['Comprobar si el mercado está disponible', 'Comparar el coste total en tu cartera', 'Verificar el resultado en la cadena'] },
      season: { title: 'Cadena de la época', steps: ['Consultar el estado actual', 'Comprobar el pase y las acciones disponibles', 'No contar recompensas previstas como recibidas'] },
    },
    note: 'Esto ilustra flujos, no emisión, volumen de operaciones, rentabilidad o propiedad. Un fallo al leer la red no equivale a saldo cero.',
  },
  vi: {
    lead: 'Tài nguyên đi từ công sức đến chi tiêu; luôn kiểm tra con số trên chuỗi.',
    paragraphs: ['Sơ đồ dưới đây minh họa các dòng tài nguyên có thể có, không phải số dư ví hay lời hứa lợi nhuận. Sản xuất, trao đổi và thanh toán tuân theo những quy tắc khác nhau: chuyển tài sản giữa người chơi không tạo thêm tài nguyên.', 'Khai thác bằng công cụ mặc định bị tắt trong phiên bản này; đừng cho rằng nhiệm vụ hay phần thưởng đã mở khi chưa kiểm tra. Chưa thể tái sinh: chu kỳ mùa bên dưới không phải kế hoạch nhận thưởng.'],
    flowHeading: 'Tài nguyên đến và đi từ đâu', incoming: 'Nguồn có thể nhận',
    incomingItems: ['Nuôi cấy và các bước sau, chỉ khi đã kiểm tra trạng thái thực tế của phòng thí nghiệm.', 'Thám hiểm có chi phí riêng và kết quả không chắc chắn; kiểm tra điều kiện trong trò chơi.', 'Mua từ người khác là chuyển tài sản, không tạo tài sản mới.'],
    outgoing: 'Khoản có thể chi',
    outgoingItems: ['Công thức và chế tạo công cụ tiêu thụ vật liệu theo yêu cầu hiện hành đã xác minh.', 'Sửa chữa tùy vào từng công cụ và chi phí hiển thị trước khi ký.', 'Kiểm tra phí mạng và chuyển khoản trong ví; sơ đồ này không báo giá tổng.'],
    cyclesHeading: 'Bốn sơ đồ, không phải số liệu trực tiếp',
    cycles: {
      production: { title: 'Chuỗi mô hình', steps: ['Nuôi cấy mẫu', 'Tách sản phẩm thu hoạch', 'Huấn luyện mô hình bằng công thức đã xác minh'] },
      craft: { title: 'Chuỗi công cụ', steps: ['Kiểm tra vật liệu', 'Chế tạo hoặc sửa chữa', 'Xác minh độ bền mới trên chuỗi'] },
      exchange: { title: 'Chuỗi giao dịch', steps: ['Kiểm tra chợ có hoạt động không', 'So sánh tổng chi phí trong ví', 'Xác minh kết quả trên chuỗi'] },
      season: { title: 'Chuỗi mùa giải', steps: ['Đọc trạng thái hiện tại', 'Kiểm tra thẻ và các hành động khả dụng', 'Đừng tính thưởng dự kiến là đã nhận'] },
    },
    note: 'Đây là sơ đồ dòng chảy, không phải số liệu phát hành, doanh số, lợi nhuận hay quyền sở hữu. Lỗi đọc mạng không có nghĩa số dư bằng không.',
  },
  id: {
    lead: 'Sumber daya bergerak dari hasil kerja ke pengeluaran; selalu periksa angkanya di blockchain.',
    paragraphs: ['Diagram di bawah menunjukkan kemungkinan aliran sumber daya, bukan saldo dompet atau janji keuntungan. Produksi, pertukaran, dan pembayaran punya aturan berbeda: transfer antar pemain tidak mencetak sumber daya baru.', 'Penambangan dengan peralatan dimatikan secara bawaan dalam versi ini; jangan anggap misi atau hadiah sudah aktif tanpa memeriksa. Kelahiran kembali belum ditawarkan: siklus musim ini bukan rencana untuk meraih bonus.'],
    flowHeading: 'Dari mana datang dan ke mana pergi', incoming: 'Kemungkinan sumber',
    incomingItems: ['Kultivasi dan langkah berikutnya, setelah memeriksa kondisi laboratorium yang sesungguhnya.', 'Ekspedisi memiliki biaya dan hasil yang tidak pasti; periksa ketentuannya dalam permainan.', 'Membeli dari pemain lain memindahkan aset, bukan mencetak aset baru.'],
    outgoing: 'Kemungkinan pengeluaran',
    outgoingItems: ['Resep dan perakitan peralatan memakai bahan sesuai persyaratan terbaru yang terverifikasi.', 'Perbaikan bergantung pada peralatan tertentu dan biaya yang ditampilkan sebelum tanda tangan.', 'Periksa biaya jaringan dan transfer di dompet; diagram ini tidak menghitung totalnya.'],
    cyclesHeading: 'Empat diagram, bukan data langsung',
    cycles: {
      production: { title: 'Rangkaian model', steps: ['Kembangkan sampel', 'Pisahkan hasil panen', 'Latih model dengan resep yang terverifikasi'] },
      craft: { title: 'Rangkaian peralatan', steps: ['Periksa bahan', 'Rakit atau perbaiki', 'Verifikasi daya tahan baru di blockchain'] },
      exchange: { title: 'Rangkaian perdagangan', steps: ['Periksa apakah pasar tersedia', 'Bandingkan seluruh biaya di dompet', 'Verifikasi hasilnya di blockchain'] },
      season: { title: 'Rangkaian musim', steps: ['Baca status saat ini', 'Periksa pass dan tindakan yang tersedia', 'Jangan hitung hadiah rencana sebagai diterima'] },
    },
    note: 'Ini ilustrasi aliran, bukan data penerbitan, volume perdagangan, keuntungan, atau kepemilikan. Gagal membaca jaringan bukan berarti saldo nol.',
  },
  fil: {
    lead: 'Dumadaloy ang yaman mula paggawa hanggang gastos; laging suriin ang bilang sa blockchain.',
    paragraphs: ['Ipinapakita sa diagram ang maaaring daloy ng yaman, hindi balanse ng wallet o pangako ng kita. Magkaiba ang tuntunin ng paggawa, palitan, at bayad: hindi lumilikha ng bagong yaman ang paglipat sa ibang manlalaro.', 'Nakatigil bilang default ang pagmimina gamit ang kagamitan sa bersiyong ito; huwag ipagpalagay na bukas na ang quest o gantimpala nang walang pagsusuri. Hindi pa iniaalok ang muling pagsilang: hindi plano ng pagkuha ng bonus ang siklo ng panahon dito.'],
    flowHeading: 'Saan nagmumula at saan napupunta', incoming: 'Maaaring pagkunan',
    incomingItems: ['Pagpapalago at kasunod na hakbang, matapos tiyakin ang tunay na estado ng laboratoryo.', 'May sariling gastos at hindi tiyak na resulta ang ekspedisyon; suriin ang kundisyon sa laro.', 'Pagbili mula sa ibang manlalaro ay paglilipat ng asset, hindi paggawa ng bago.'],
    outgoing: 'Maaaring gastusin',
    outgoingItems: ['Gumagamit ng materyales ang mga resipe at paggawa ng kagamitan batay sa kasalukuyang beripikadong kailangan.', 'Nakasalalay ang pagkukumpuni sa mismong kagamitan at sa presyong ipinakita bago pumirma.', 'Suriin sa wallet ang bayarin sa network at mga transfer; hindi makapagbibigay ng kabuuang presyo ang diagram.'],
    cyclesHeading: 'Apat na diagram, hindi kasalukuyang datos',
    cycles: {
      production: { title: 'Daloy ng modelo', steps: ['Magpalago ng sample', 'Paghiwalayin ang ani', 'Sanayin ang modelo gamit ang beripikadong resipe'] },
      craft: { title: 'Daloy ng kagamitan', steps: ['Suriin ang materyales', 'Gumawa o magkumpuni', 'Tiyakin sa blockchain ang bagong tibay'] },
      exchange: { title: 'Daloy ng palitan', steps: ['Tingnan kung bukas ang pamilihan', 'Ihambing ang buong gastos sa wallet', 'Tiyakin ang resulta sa blockchain'] },
      season: { title: 'Daloy ng panahon', steps: ['Basahin ang kasalukuyang katayuan', 'Suriin ang pass at magagamit na gawain', 'Huwag ituring na nakuha na ang planong gantimpala'] },
    },
    note: 'Larawan ito ng daloy, hindi tala ng pag-isyu, dami ng kalakalan, kita, o pagmamay-ari. Hindi ibig sabihin ng bigong pagbasa sa network na zero ang balanse.',
  },
};
