import type { Language } from './translations';

export const pathIds = ['grower', 'maker', 'trader', 'explorer', 'community'] as const;
export const storyIds = ['bron', 'anna', 'gale', 'mira', 'tam', 'lin'] as const;
type Path = { id: typeof pathIds[number]; title: string; style: string; description: string; tips: readonly [string, string] };
type Story = { id: typeof storyIds[number]; character: string; quote: string; context: string };
type Copy = {
  lead: string; paragraphs: readonly [string, string]; heading: string; paths: readonly Path[];
  voicesHeading: string; voicesNotice: string; stories: readonly Story[];
};

/** Optional play styles and fiction; not live guild benefits, returns, mining or rebirth. */
export const siteStrategies: Record<Language, Copy> = {
  ru: {
    lead: 'Пять способов выбирать следующий шаг, не обещая награды.',
    paragraphs: ['Путь здесь — привычка мастера, а не класс с гарантированной выгодой. Сначала сверяй условия игры и кошелька: рынок, добыча и задания могут быть ограничены или недоступны.', 'Голоса внизу — художественные зарисовки. Герои и их опыт не подтверждают статистику, статус эпохи, права гильдии или результаты в сети.'],
    heading: 'Пять путей мастерской',
    paths: [
      { id: 'grower', title: 'Путь культиватора', style: 'Терпеливое наблюдение', description: 'Следи за лунками и запасом энергии, а не за вымышленной ценой урожая. Время созревания проверяй по состоянию игры.', tips: ['Если лунка не читается, не считай её свободной.', 'Сигнал и модель требуют отдельных подтверждённых этапов.'] },
      { id: 'maker', title: 'Путь инженера', style: 'Сверка материалов и сметы', description: 'Инструмент рождается из подтверждённого рецепта, а ремонт требует актуальной стоимости. Изображение редкости не говорит о доходе.', tips: ['Читай свежую смету до подписи.', 'Не предполагай скидку или свойство инструмента по старой статье.'] },
      { id: 'trader', title: 'Путь торговца', style: 'Осторожное сравнение', description: 'Сравни условия конкретного листинга с подписью кошелька. Новые заявки и сведение в книге заявок временно закрыты.', tips: ['Не считай сбой чтения пустым рынком.', 'Не размещай заявку через старую форму цены.'] },
      { id: 'explorer', title: 'Путь исследователя', style: 'Поход с известными затратами', description: 'Экспедиция имеет собственные условия и неопределённый результат. Добыча инструментом в текущем интерфейсе выключена по умолчанию.', tips: ['Сверяй расход и инструмент перед походом.', 'Отправленный запрос не означает подтверждённую добычу или возврат.'] },
      { id: 'community', title: 'Путь сообщества', style: 'Разговор и взаимопомощь', description: 'Работать рядом можно и без обещаний сетевых гильдейских наград. Индекс заданий ещё не подтверждён.', tips: ['Договаривайся о правилах до совместного действия.', 'Никому не передавай секреты кошелька ради вступления.'] },
    ],
    voicesHeading: 'Голоса мастерской · художественный вымысел', voicesNotice: 'Эти персонажи придуманы для атмосферы. Их реплики не описывают доступные награды, цены или действия контракта.',
    stories: [
      { id: 'bron', character: 'Мастер Брон', quote: 'Металл не любит спешки. Я сперва смотрю на смету, а уже потом беру молот.', context: 'У верстака' },
      { id: 'anna', character: 'Мастер Анна', quote: 'У каждой лунки свой час. Запись сети говорит тише барабана, зато точнее.', context: 'У стойки образцов' },
      { id: 'gale', character: 'Путник Гейл', quote: 'Карта зовёт в дорогу; цену пути я считаю до первого шага.', context: 'Над картой экспедиций' },
      { id: 'mira', character: 'Торговка Мира', quote: 'Площадь громка, но цифра в кошельке должна оставаться ясной.', context: 'У прилавка' },
      { id: 'tam', character: 'Хранитель Тэм', quote: 'Не верь нарисованной награде. Сначала проверь, существует ли запись.', context: 'Совет у костра' },
      { id: 'lin', character: 'Стеклодув Лин', quote: 'Стекло просит одного верного дыхания, а рука — времени на проверку.', context: 'У холодной печи' },
    ],
  },
  en: {
    lead: 'Five ways to choose your next step, without promising a reward.',
    paragraphs: ['A path here is a maker’s habit, not a class with guaranteed returns. Check the game and wallet first: trading, mining and quests may be limited or unavailable.', 'The voices below are fictional vignettes. These characters do not verify statistics, a season’s status, guild privileges or any on-chain outcome.'],
    heading: 'Five workshop paths',
    paths: [
      { id: 'grower', title: 'The grower’s path', style: 'Patient observation', description: 'Watch the wells and your energy, not an imagined crop price. Check the game for the actual time to harvest.', tips: ['An unreadable well is not a free well.', 'Signal and model require separate confirmed stages.'] },
      { id: 'maker', title: 'The maker’s path', style: 'Materials and quotes', description: 'A tool calls for a verified recipe; repair calls for a current quote. Rarity art cannot tell you the return.', tips: ['Read a fresh quote before signing.', 'Do not infer a discount or tool property from an old article.'] },
      { id: 'trader', title: 'The trader’s path', style: 'Careful comparison', description: 'Compare a specific listing with your wallet request. New order-book placement and matching are paused.', tips: ['A failed read is not an empty market.', 'Do not place orders using the old price form.'] },
      { id: 'explorer', title: 'The explorer’s path', style: 'A journey with known costs', description: 'Each expedition has its own terms and uncertain result. Tool mining is disabled by default in the current client.', tips: ['Check the cost and tool before setting out.', 'A submitted request is not a confirmed find or refund.'] },
      { id: 'community', title: 'The community path', style: 'Conversation and mutual help', description: 'Work alongside others without promises of on-chain guild rewards. The quest index is not yet verified.', tips: ['Agree on the rules before acting together.', 'Never hand over wallet secrets to join a group.'] },
    ],
    voicesHeading: 'Workshop voices · fiction', voicesNotice: 'These characters were created for atmosphere. Their words do not describe available rewards, prices or contract actions.',
    stories: [
      { id: 'bron', character: 'Maker Bron', quote: 'Metal dislikes haste. I read the quote before I lift the hammer.', context: 'At the workbench' },
      { id: 'anna', character: 'Maker Anna', quote: 'Every well keeps its own hour. The network record speaks more softly than a drum, but more precisely.', context: 'Beside the sample rack' },
      { id: 'gale', character: 'Wanderer Gale', quote: 'The map beckons; I count the cost of the road before the first step.', context: 'Over the expedition map' },
      { id: 'mira', character: 'Trader Mira', quote: 'The square is loud, but the number in my wallet must stay clear.', context: 'At the market stall' },
      { id: 'tam', character: 'Keeper Tam', quote: 'Do not trust a painted reward. First make sure there is a record.', context: 'Advice by the fire' },
      { id: 'lin', character: 'Glassblower Lin', quote: 'Glass asks for one true breath, and my hands ask for time to check.', context: 'By the cold furnace' },
    ],
  },
  pt: {
    lead: 'Cinco maneiras de escolher o próximo passo, sem prometer prêmios.',
    paragraphs: ['Um caminho é um hábito do artesão, não uma classe de rendimento garantido. Confere primeiro o jogo e a carteira: negociação, extração e missões podem estar limitadas ou indisponíveis.', 'As vozes abaixo são pequenas histórias fictícias. Estas personagens não confirmam estatísticas, o estado da época, direitos de guilda nem resultados na rede.'],
    heading: 'Cinco caminhos da oficina',
    paths: [
      { id: 'grower', title: 'O caminho de quem cultiva', style: 'Observação paciente', description: 'Observa os poços e a energia, não um preço imaginário da colheita. Confere no jogo o tempo real até colher.', tips: ['Um poço ilegível não é um poço livre.', 'Sinal e modelo exigem etapas confirmadas em separado.'] },
      { id: 'maker', title: 'O caminho de quem cria', style: 'Materiais e orçamentos', description: 'Uma ferramenta pede uma receita verificada; o reparo exige um orçamento atual. O desenho da raridade não mostra rendimentos.', tips: ['Lê um orçamento recente antes de assinar.', 'Não deduzas descontos nem atributos de artigos antigos.'] },
      { id: 'trader', title: 'O caminho de quem negocia', style: 'Comparação cuidadosa', description: 'Compara o anúncio concreto com o pedido da carteira. Novas ordens e cruzamentos no livro estão suspensos.', tips: ['Falha de leitura não é mercado vazio.', 'Não uses o formulário de preços antigo para criar ordens.'] },
      { id: 'explorer', title: 'O caminho de quem explora', style: 'Viagem com custos conhecidos', description: 'Cada expedição tem condições próprias e um resultado incerto. A extração com ferramentas está desativada por padrão no cliente atual.', tips: ['Confere custo e ferramenta antes de partir.', 'Enviar um pedido não confirma uma descoberta nem um reembolso.'] },
      { id: 'community', title: 'O caminho da comunidade', style: 'Conversa e entreajuda', description: 'Trabalha com outros sem promessas de prêmios de guilda na rede. O índice de missões ainda não foi verificado.', tips: ['Combina as regras antes de agir em conjunto.', 'Nunca entregues os segredos da carteira para entrar num grupo.'] },
    ],
    voicesHeading: 'Vozes da oficina · ficção', voicesNotice: 'Estas personagens foram criadas para a atmosfera. As suas palavras não descrevem prêmios disponíveis, preços nem ações do contrato.',
    stories: [
      { id: 'bron', character: 'Mestre Bron', quote: 'O metal não gosta de pressa. Leio o orçamento antes de erguer o martelo.', context: 'Junto à bancada' },
      { id: 'anna', character: 'Mestra Anna', quote: 'Cada poço tem a sua hora. O registo da rede fala mais baixo que o tambor, mas com mais rigor.', context: 'Ao lado da estante de amostras' },
      { id: 'gale', character: 'Viajante Gale', quote: 'O mapa chama; conto o custo do caminho antes do primeiro passo.', context: 'Sobre o mapa das expedições' },
      { id: 'mira', character: 'Mercadora Mira', quote: 'A praça é barulhenta, mas o número na carteira tem de continuar claro.', context: 'Na banca do mercado' },
      { id: 'tam', character: 'Guardião Tam', quote: 'Não confies num prêmio pintado. Primeiro confirma que existe um registo.', context: 'Conselho à fogueira' },
      { id: 'lin', character: 'Vidreira Lin', quote: 'O vidro pede um só fôlego certo; as minhas mãos pedem tempo para verificar.', context: 'Junto ao forno frio' },
    ],
  },
  es: {
    lead: 'Cinco maneras de elegir el siguiente paso sin prometer recompensas.',
    paragraphs: ['Un camino es un hábito del artesano, no una clase con ingresos garantizados. Comprueba primero el juego y la cartera: el comercio, la extracción y las misiones pueden estar limitados o no disponibles.', 'Las voces de abajo son escenas de ficción. Sus personajes no confirman estadísticas, el estado de una época, derechos de gremio ni resultados en la cadena.'],
    heading: 'Cinco caminos del taller',
    paths: [
      { id: 'grower', title: 'El camino del cultivador', style: 'Observación paciente', description: 'Vigila los pozos y tu energía, no un precio inventado de la cosecha. Comprueba en el juego el tiempo real hasta cosechar.', tips: ['Un pozo que no se puede leer no está libre.', 'Señal y modelo necesitan etapas confirmadas por separado.'] },
      { id: 'maker', title: 'El camino del artesano', style: 'Materiales y presupuestos', description: 'Una herramienta necesita una receta verificada; reparar exige un presupuesto actual. La ilustración de rareza no muestra beneficios.', tips: ['Lee un presupuesto nuevo antes de firmar.', 'No supongas descuentos ni atributos por un artículo antiguo.'] },
      { id: 'trader', title: 'El camino del comerciante', style: 'Comparación atenta', description: 'Compara cada anuncio con la petición de tu cartera. Las nuevas órdenes y los cruces del libro están suspendidos.', tips: ['Un fallo de lectura no significa mercado vacío.', 'No uses el antiguo formulario de precios para crear órdenes.'] },
      { id: 'explorer', title: 'El camino del explorador', style: 'Viaje con costes conocidos', description: 'Cada expedición tiene condiciones propias y resultado incierto. La extracción con herramientas está desactivada por defecto en el cliente actual.', tips: ['Comprueba el coste y la herramienta antes de partir.', 'Enviar una solicitud no confirma un hallazgo o reembolso.'] },
      { id: 'community', title: 'El camino de la comunidad', style: 'Diálogo y ayuda mutua', description: 'Trabaja con otros sin prometer recompensas de gremio en la cadena. El índice de misiones aún no está verificado.', tips: ['Acordad las reglas antes de actuar juntos.', 'Nunca entregues los secretos de tu cartera para entrar en un grupo.'] },
    ],
    voicesHeading: 'Voces del taller · ficción', voicesNotice: 'Estos personajes se crearon para dar ambiente. Sus palabras no describen recompensas disponibles, precios ni acciones del contrato.',
    stories: [
      { id: 'bron', character: 'Maestro Bron', quote: 'Al metal no le gustan las prisas. Leo el presupuesto antes de alzar el martillo.', context: 'Ante el banco de trabajo' },
      { id: 'anna', character: 'Maestra Anna', quote: 'Cada pozo guarda su hora. El registro de la cadena habla más bajo que un tambor, pero con más precisión.', context: 'Junto a la estantería de muestras' },
      { id: 'gale', character: 'Viajero Gale', quote: 'El mapa llama; cuento el coste del camino antes de dar el primer paso.', context: 'Sobre el mapa de expediciones' },
      { id: 'mira', character: 'Mercader Mira', quote: 'La plaza es ruidosa, pero la cifra de mi cartera debe seguir siendo clara.', context: 'En el puesto del mercado' },
      { id: 'tam', character: 'Guardián Tam', quote: 'No te fíes de una recompensa pintada. Comprueba primero que exista un registro.', context: 'Consejo junto al fuego' },
      { id: 'lin', character: 'Sopladora Lin', quote: 'El vidrio pide un único aliento certero; mis manos piden tiempo para revisar.', context: 'Ante el horno frío' },
    ],
  },
  vi: {
    lead: 'Năm cách chọn bước tiếp theo mà không hứa hẹn phần thưởng.',
    paragraphs: ['Con đường ở đây là thói quen của người thợ, không phải lớp nhân vật có lợi nhuận bảo đảm. Hãy kiểm tra trò chơi và ví trước: giao dịch, khai thác và nhiệm vụ có thể bị hạn chế hoặc không khả dụng.', 'Những tiếng nói bên dưới là truyện hư cấu. Nhân vật không xác nhận số liệu, trạng thái mùa giải, quyền lợi bang hội hay kết quả trên chuỗi.'],
    heading: 'Năm con đường của xưởng',
    paths: [
      { id: 'grower', title: 'Đường của người nuôi cấy', style: 'Quan sát kiên nhẫn', description: 'Theo dõi ô nuôi cấy và năng lượng, đừng tin giá thu hoạch tưởng tượng. Kiểm tra thời gian thu hoạch thật trong trò chơi.', tips: ['Không đọc được ô không có nghĩa là ô đang trống.', 'Tín hiệu và mô hình cần xác nhận ở từng giai đoạn riêng.'] },
      { id: 'maker', title: 'Đường của người chế tạo', style: 'Vật liệu và báo giá', description: 'Công cụ cần công thức đã xác minh; sửa chữa cần báo giá hiện tại. Hình độ hiếm không thể hiện lợi nhuận.', tips: ['Đọc báo giá mới trước khi ký.', 'Đừng đoán ưu đãi hay thuộc tính từ bài viết cũ.'] },
      { id: 'trader', title: 'Đường của người giao thương', style: 'So sánh cẩn thận', description: 'So sánh từng tin rao với yêu cầu trong ví. Lệnh mới và khớp lệnh trong sổ lệnh đang tạm dừng.', tips: ['Lỗi đọc mạng không có nghĩa chợ trống.', 'Đừng dùng biểu mẫu giá cũ để đặt lệnh.'] },
      { id: 'explorer', title: 'Đường của người thám hiểm', style: 'Chuyến đi biết rõ chi phí', description: 'Mỗi chuyến thám hiểm có điều kiện riêng và kết quả bất định. Khai thác bằng công cụ mặc định bị tắt trong ứng dụng hiện tại.', tips: ['Kiểm tra chi phí và công cụ trước khi lên đường.', 'Gửi yêu cầu chưa phải là xác nhận tìm thấy vật phẩm hay được hoàn tiền.'] },
      { id: 'community', title: 'Đường của cộng đồng', style: 'Trò chuyện và giúp đỡ', description: 'Làm việc với nhau mà không hứa thưởng bang hội trên chuỗi. Chỉ mục nhiệm vụ chưa được xác minh.', tips: ['Thống nhất quy tắc trước khi cùng hành động.', 'Đừng đưa bí mật ví để được vào nhóm.'] },
    ],
    voicesHeading: 'Tiếng nói trong xưởng · hư cấu', voicesNotice: 'Các nhân vật được sáng tạo để kể chuyện. Lời họ không nói về phần thưởng sẵn có, giá cả hay hành động hợp đồng.',
    stories: [
      { id: 'bron', character: 'Thợ Bron', quote: 'Kim loại không ưa vội vàng. Tôi đọc báo giá trước khi nhấc búa.', context: 'Bên bàn làm việc' },
      { id: 'anna', character: 'Thợ Anna', quote: 'Mỗi ô có nhịp giờ riêng. Bản ghi trên chuỗi nói khẽ hơn tiếng trống, nhưng chính xác hơn.', context: 'Bên giá mẫu vật' },
      { id: 'gale', character: 'Lữ khách Gale', quote: 'Bản đồ gọi mời; tôi tính giá chuyến đi trước bước chân đầu tiên.', context: 'Bên bản đồ thám hiểm' },
      { id: 'mira', character: 'Thương nhân Mira', quote: 'Quảng trường ồn ào, nhưng con số trong ví phải luôn rõ ràng.', context: 'Bên quầy hàng' },
      { id: 'tam', character: 'Người giữ Tam', quote: 'Đừng tin phần thưởng được vẽ ra. Trước hết hãy tìm bản ghi.', context: 'Lời khuyên bên lửa' },
      { id: 'lin', character: 'Thợ thổi kính Lin', quote: 'Thủy tinh cần một hơi thở đúng, còn bàn tay tôi cần thời gian kiểm tra.', context: 'Bên lò đã nguội' },
    ],
  },
  id: {
    lead: 'Lima cara memilih langkah berikutnya, tanpa menjanjikan hadiah.',
    paragraphs: ['Jalur di sini adalah kebiasaan seorang perajin, bukan kelas dengan keuntungan terjamin. Periksa permainan dan dompet lebih dulu: perdagangan, penambangan, dan misi bisa terbatas atau tidak tersedia.', 'Suara di bawah adalah kisah fiksi. Tokohnya tidak membuktikan statistik, status musim, hak serikat, atau hasil di blockchain.'],
    heading: 'Lima jalur bengkel',
    paths: [
      { id: 'grower', title: 'Jalur pekebun', style: 'Mengamati dengan sabar', description: 'Awasi wadah dan energimu, bukan harga panen khayalan. Periksa waktu panen sebenarnya di permainan.', tips: ['Wadah yang tidak terbaca bukan wadah kosong.', 'Sinyal dan model memerlukan tahap terkonfirmasi yang terpisah.'] },
      { id: 'maker', title: 'Jalur perakit', style: 'Bahan dan rincian harga', description: 'Peralatan membutuhkan resep terverifikasi; perbaikan memerlukan harga terbaru. Gambar kelangkaan tidak menunjukkan keuntungan.', tips: ['Baca rincian harga baru sebelum tanda tangan.', 'Jangan mengira ada diskon atau sifat peralatan dari artikel lama.'] },
      { id: 'trader', title: 'Jalur pedagang', style: 'Membandingkan dengan cermat', description: 'Bandingkan sebuah lapak dengan permintaan di dompet. Pesanan baru dan pencocokan buku pesanan sedang ditunda.', tips: ['Gagal membaca bukan berarti pasar kosong.', 'Jangan buat pesanan memakai formulir harga lama.'] },
      { id: 'explorer', title: 'Jalur penjelajah', style: 'Perjalanan dengan biaya diketahui', description: 'Setiap ekspedisi punya ketentuan sendiri dan hasil yang tidak pasti. Penambangan peralatan dimatikan secara bawaan dalam aplikasi saat ini.', tips: ['Periksa biaya dan peralatan sebelum berangkat.', 'Mengirim permintaan belum membuktikan temuan atau pengembalian dana.'] },
      { id: 'community', title: 'Jalur komunitas', style: 'Percakapan dan saling membantu', description: 'Bekerja bersama tanpa janji hadiah serikat di blockchain. Indeks misi belum diverifikasi.', tips: ['Sepakati aturan sebelum bertindak bersama.', 'Jangan pernah memberikan rahasia dompet demi masuk ke kelompok.'] },
    ],
    voicesHeading: 'Suara bengkel · fiksi', voicesNotice: 'Tokoh-tokoh ini diciptakan sebagai cerita. Kata-katanya tidak menggambarkan hadiah tersedia, harga, atau tindakan kontrak.',
    stories: [
      { id: 'bron', character: 'Perajin Bron', quote: 'Logam tidak menyukai tergesa-gesa. Aku membaca harga sebelum mengangkat palu.', context: 'Di meja kerja' },
      { id: 'anna', character: 'Perajin Anna', quote: 'Setiap wadah punya waktunya sendiri. Catatan jaringan berbicara lebih pelan dari genderang, tetapi lebih tepat.', context: 'Di samping rak sampel' },
      { id: 'gale', character: 'Pengelana Gale', quote: 'Peta memanggil; aku menghitung biaya jalan sebelum melangkah.', context: 'Di atas peta ekspedisi' },
      { id: 'mira', character: 'Pedagang Mira', quote: 'Alun-alun ramai, tetapi angka di dompetku harus tetap jelas.', context: 'Di lapak pasar' },
      { id: 'tam', character: 'Penjaga Tam', quote: 'Jangan percaya hadiah yang dilukis. Pastikan ada catatannya lebih dulu.', context: 'Nasihat di dekat api' },
      { id: 'lin', character: 'Peniup kaca Lin', quote: 'Kaca meminta satu embusan yang tepat, tanganku meminta waktu untuk memeriksa.', context: 'Di dekat tungku dingin' },
    ],
  },
  fil: {
    lead: 'Limang paraan ng pagpili ng susunod na hakbang, nang walang pangakong gantimpala.',
    paragraphs: ['Gawi ng manggagawa ang landas dito, hindi klaseng may garantisadong kita. Suriin muna ang laro at wallet: maaaring limitado o hindi available ang kalakalan, pagmimina, at quest.', 'Kathang-isip na tagpo ang mga tinig sa ibaba. Hindi pinatutunayan ng mga tauhan ang estadistika, katayuan ng panahon, pribilehiyo sa guild, o resulta sa blockchain.'],
    heading: 'Limang landas sa pagawaan',
    paths: [
      { id: 'grower', title: 'Landas ng tagapagtanim', style: 'Matiyagang pagmamasid', description: 'Bantayan ang mga puwesto at enerhiya, hindi ang inimbentong presyo ng ani. Tingnan sa laro ang tunay na oras ng anihan.', tips: ['Hindi ibig sabihing bakante ang puwestong hindi mabasa.', 'Magkahiwalay na kumpirmadong yugto ang kailangan ng signal at modelo.'] },
      { id: 'maker', title: 'Landas ng manggagawa', style: 'Materyales at presyong malinaw', description: 'Kailangan ng beripikadong resipe ang kagamitan; kailangan ng bagong presyo ang pagkukumpuni. Hindi ipinapakita ng larawan ng antas ang kita.', tips: ['Basahin ang bagong presyo bago lumagda.', 'Huwag umasa sa diskuwento o katangian batay sa lumang artikulo.'] },
      { id: 'trader', title: 'Landas ng mangangalakal', style: 'Maingat na paghahambing', description: 'Ihambing ang partikular na listahan sa hinihingi ng wallet. Nakatigil ang bagong order at pagtutugma sa talaan.', tips: ['Hindi ibig sabihin ng bigong pagbasa na walang alok.', 'Huwag gumawa ng order gamit ang lumang pormularyo ng presyo.'] },
      { id: 'explorer', title: 'Landas ng manlalakbay', style: 'Paglalakbay na alam ang gastos', description: 'May sariling kundisyon at hindi tiyak na bunga ang bawat ekspedisyon. Nakatigil bilang default ang pagmimina gamit ang kagamitan sa kasalukuyang app.', tips: ['Tingnan ang gastos at kagamitan bago umalis.', 'Hindi pa kumpirmadong natagpuan o na-refund ang naipadalang kahilingan.'] },
      { id: 'community', title: 'Landas ng pamayanan', style: 'Usapan at pagtutulungan', description: 'Makipagtulungan nang walang pangakong gantimpala mula sa guild sa blockchain. Hindi pa beripikado ang index ng quest.', tips: ['Magkasundo sa mga tuntunin bago kumilos nang sama-sama.', 'Huwag ibigay ang lihim ng wallet para makasali sa grupo.'] },
    ],
    voicesHeading: 'Mga tinig sa pagawaan · kathang-isip', voicesNotice: 'Mga tauhang likha para sa kuwento ang mga ito. Hindi inilalarawan ng kanilang pananalita ang kasalukuyang gantimpala, presyo, o kilos ng kontrata.',
    stories: [
      { id: 'bron', character: 'Panday Bron', quote: 'Ayaw ng metal sa pagmamadali. Binabasa ko muna ang presyo bago itaas ang martilyo.', context: 'Sa mesa ng paggawa' },
      { id: 'anna', character: 'Manggagawang Anna', quote: 'May sariling oras ang bawat puwesto. Mas mahina ang tinig ng tala sa network kaysa tambol, ngunit mas tiyak.', context: 'Sa tabi ng mga sample' },
      { id: 'gale', character: 'Manlalakbay Gale', quote: 'Tinatawag ako ng mapa; binibilang ko muna ang gastos bago lumakad.', context: 'Sa ibabaw ng mapa ng ekspedisyon' },
      { id: 'mira', character: 'Mangangalakal Mira', quote: 'Maingay ang liwasan, pero kailangang malinaw ang bilang sa wallet ko.', context: 'Sa puwesto sa pamilihan' },
      { id: 'tam', character: 'Tagapag-ingat Tam', quote: 'Huwag magtiwala sa iginuhit na gantimpala. Hanapin muna ang tala.', context: 'Payo sa tabi ng apoy' },
      { id: 'lin', character: 'Tagaihip ng salamin Lin', quote: 'Isang tamang hininga ang hinihingi ng salamin; oras sa pagsuri ang hinihingi ng kamay ko.', context: 'Sa tabi ng malamig na pugon' },
    ],
  },
};
