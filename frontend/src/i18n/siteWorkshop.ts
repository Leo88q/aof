import type { Language } from './translations';

export const farmStageIds = ['state', 'cultivate', 'harvest', 'verify'] as const;
export const processStageIds = ['ingredients', 'separate', 'collect', 'train'] as const;
export const craftStageIds = ['inventory', 'quote', 'sign', 'confirm'] as const;
type Step<Id extends string> = { id: Id; title: string; text: string };
type Group<Id extends string> = { heading: string; steps: readonly Step<Id>[] };
type Copy = {
  farm: {
    lead: string; paragraphs: readonly [string, string]; cultivation: Group<typeof farmStageIds[number]>;
    processing: Group<typeof processStageIds[number]>; note: string;
  };
  craft: {
    lead: string; paragraphs: readonly [string, string]; steps: Group<typeof craftStageIds[number]>; note: string;
  };
};

/** Editorial guidance only: game/network state determines availability, cost and outcome. */
export const siteWorkshop: Record<Language, Copy> = {
  ru: {
    farm: {
      lead: 'Путь от образца к модели состоит из отдельных подтверждаемых шагов.',
      paragraphs: ['Культивация, сепарация и обучение — не одна кнопка. У каждой стадии собственные материалы, условия, время и запись в сети. Проверяй актуальное состояние лаборатории, а не расчёт из старой статьи.', 'Сайт показывает последовательность для понимания, но не читает лунки или балансы и не отправляет транзакций. Начало цикла не означает, что результат уже получен.'],
      cultivation: { heading: 'Лунка · от образца к съёму', steps: [
        { id: 'state', title: 'Осмотри лунку', text: 'Сверь кошелёк, энергию и состояние выбранной лунки в игре. Ошибка чтения не означает, что место свободно.' },
        { id: 'cultivate', title: 'Проверь расход перед посевом', text: 'Сравни материалы и запрос кошелька. Не подписывай, если цена или получатель непонятны.' },
        { id: 'harvest', title: 'Дождись готовности', text: 'Сверь текущие условия сбора. Повторная отправка запроса не ускоряет рост и может стоить комиссии.' },
        { id: 'verify', title: 'Убедись в результате', text: 'Подтверди запись сбора и новый баланс в сети, прежде чем планировать следующую стадию.' },
      ] },
      processing: { heading: 'Сигнал · путь к модели', steps: [
        { id: 'ingredients', title: 'Сверь входные ресурсы', text: 'Посмотри доступный баланс и актуальные партии сепарации в игровом модуле.' },
        { id: 'separate', title: 'Начни сепарацию', text: 'Сравни параметры выбранной партии с запросом кошелька; отправка ещё не даёт сигнал.' },
        { id: 'collect', title: 'Забери подтверждённый сигнал', text: 'После готовности проверь сетевое состояние цикла и отдельно получи результат.' },
        { id: 'train', title: 'Обучи модель отдельным действием', text: 'Выбери фактическое топливо, проверь состав и выход новой партии. Завершение обучения требует отдельного подтверждения.' },
      ] },
      note: 'Ни сроки, ни количество выхода на этой странице не являются живой сметой. При сбое чтения сети остановись и проверь состояние в игре и кошельке.',
    },
    craft: {
      lead: 'Инструмент собирают по проверенной смете, а не по иллюстрации редкости.',
      paragraphs: ['Перед созданием инструмента проверь инвентарь и получи свежую смету для выбранного типа и редкости. Цена может зависеть от сетевого состояния; рисунок и старая статья её не подтверждают.', 'Рецепты ресурсов и создание NFT-инструмента — разные действия. Состав восьми ресурсных рецептов смотри в книге рецептов; стоимость инструмента узнавай в игровой мастерской.'],
      steps: { heading: 'От сметы к подтверждению', steps: [
        { id: 'inventory', title: 'Проверь инвентарь', text: 'Без полного ответа сети нельзя считать запас пустым или достаточным. Уточни тип инструмента и выбранную редкость.' },
        { id: 'quote', title: 'Получить новую смету', text: 'Сравни все материалы, токены и комиссии с текущим предложением игры. При изменении цены подтверди выбор заново.' },
        { id: 'sign', title: 'Сверь запрос кошелька', text: 'Проверь программу, получателя, расход и пределы операции до подписи. Не соглашайся на действие, которого не выбирал.' },
        { id: 'confirm', title: 'Проверь результат в сети', text: 'Отправленный запрос не доказывает создание NFT. Проверь подтверждение и свой инвентарь перед повторной попыткой.' },
      ] },
      note: 'Сайт не создаёт инструменты и не обещает скидку, доход или свойства по одной картинке. Если данные недоступны, не угадывай стоимость.',
    },
  },
  en: {
    farm: {
      lead: 'From sample to model: separate steps, each with its own confirmation.',
      paragraphs: ['Cultivation, separation and training are not a single click. Every stage has its own materials, terms, timing and network record. Check the laboratory’s current state, not an old article’s estimate.', 'This page explains the sequence but neither reads wells or balances nor submits transactions. Starting a cycle does not mean its output has arrived.'],
      cultivation: { heading: 'The well · from sample to harvest', steps: [
        { id: 'state', title: 'Inspect the well', text: 'Check your wallet, energy and the selected well in the game. A failed read does not mean a free slot.' },
        { id: 'cultivate', title: 'Check the cost before sowing', text: 'Compare materials with the wallet request. Do not sign if the cost or recipient is unclear.' },
        { id: 'harvest', title: 'Wait until ready', text: 'Check the current collection conditions. Sending another request will not speed growth and may incur a fee.' },
        { id: 'verify', title: 'Verify the output', text: 'Confirm the harvest record and new balance on the network before planning the next stage.' },
      ] },
      processing: { heading: 'Signal · toward the model', steps: [
        { id: 'ingredients', title: 'Check the inputs', text: 'Read your available balance and current separation batches in the game module.' },
        { id: 'separate', title: 'Start separation', text: 'Compare your chosen batch with the wallet request; submitting does not deliver a signal.' },
        { id: 'collect', title: 'Collect a confirmed signal', text: 'When ready, verify the cycle’s network state and collect the output separately.' },
        { id: 'train', title: 'Train the model separately', text: 'Choose the actual fuel and check the inputs and output of the new batch. Training completion needs its own confirmation.' },
      ] },
      note: 'Neither timings nor output quantities on this page are a live quote. If a network read fails, stop and check the game and wallet.',
    },
    craft: {
      lead: 'Build a tool from a verified quote, not from a rarity illustration.',
      paragraphs: ['Before building, check your inventory and obtain a fresh quote for the selected type and rarity. The cost can depend on network state; neither artwork nor an old article confirms it.', 'Resource recipes and crafting an NFT tool are different actions. See the recipe book for the eight resource recipes; check the game workshop for tool costs.'],
      steps: { heading: 'From quote to confirmation', steps: [
        { id: 'inventory', title: 'Check your inventory', text: 'Without a complete network response, you cannot treat stock as empty or sufficient. Confirm the tool type and chosen rarity.' },
        { id: 'quote', title: 'Get a fresh quote', text: 'Compare all materials, tokens and fees with the game’s current quote. If the cost changes, confirm your choice again.' },
        { id: 'sign', title: 'Inspect the wallet request', text: 'Check program, recipient, debit and limits before signing. Decline an action you did not choose.' },
        { id: 'confirm', title: 'Verify the network result', text: 'A submitted request is not proof that an NFT was minted. Check confirmation and inventory before trying again.' },
      ] },
      note: 'This site cannot build tools and promises no discount, return or property based on a picture. If data is unavailable, do not guess the cost.',
    },
  },
  pt: {
    farm: {
      lead: 'Da amostra ao modelo: etapas distintas, cada uma a confirmar.',
      paragraphs: ['Cultivo, separação e treino não são um só clique. Cada fase tem materiais, condições, prazos e registo na rede. Confere o estado atual do laboratório, não um cálculo de um artigo antigo.', 'Esta página explica a sequência, mas não consulta poços nem saldos e não envia transações. Iniciar um ciclo não significa receber o resultado.'],
      cultivation: { heading: 'O poço · da amostra à colheita', steps: [
        { id: 'state', title: 'Observa o poço', text: 'Confere a carteira, energia e estado do poço escolhido no jogo. Uma falha de leitura não significa que esteja livre.' },
        { id: 'cultivate', title: 'Confere o custo antes de cultivar', text: 'Compara os materiais com o pedido da carteira. Não assines se o custo ou destinatário não for claro.' },
        { id: 'harvest', title: 'Espera até estar pronto', text: 'Confere as condições atuais da colheita. Enviar outro pedido não acelera o crescimento e pode custar taxas.' },
        { id: 'verify', title: 'Verifica o resultado', text: 'Confirma o registo da colheita e o novo saldo na rede antes de planear a próxima fase.' },
      ] },
      processing: { heading: 'Sinal · a caminho do modelo', steps: [
        { id: 'ingredients', title: 'Confere os materiais de entrada', text: 'Consulta o saldo disponível e as opções atuais de separação no módulo do jogo.' },
        { id: 'separate', title: 'Inicia a separação', text: 'Compara o lote escolhido com o pedido da carteira; enviar ainda não entrega um sinal.' },
        { id: 'collect', title: 'Recolhe um sinal confirmado', text: 'Quando estiver pronto, verifica o estado do ciclo na rede e recolhe o resultado separadamente.' },
        { id: 'train', title: 'Treina o modelo em separado', text: 'Escolhe o combustível real e confere entradas e saída do novo lote. A conclusão do treino precisa de confirmação própria.' },
      ] },
      note: 'Nem prazos nem quantidades nesta página são um orçamento em tempo real. Se a rede falhar, para e verifica o jogo e a carteira.',
    },
    craft: {
      lead: 'Cria uma ferramenta com orçamento confirmado, não com uma imagem de raridade.',
      paragraphs: ['Antes de criar, confere o inventário e pede um orçamento novo para tipo e raridade escolhidos. O custo pode depender da rede; imagem e artigo antigo não o confirmam.', 'Receitas de recursos e criação de ferramenta NFT são ações diferentes. Consulta o livro para as oito receitas de recursos; vê os custos de ferramentas na oficina do jogo.'],
      steps: { heading: 'Do orçamento à confirmação', steps: [
        { id: 'inventory', title: 'Confere o inventário', text: 'Sem uma resposta completa da rede, não consideres o estoque vazio ou suficiente. Confirma o tipo e a raridade da ferramenta.' },
        { id: 'quote', title: 'Pede um orçamento recente', text: 'Compara todos os materiais, tokens e taxas com o orçamento atual no jogo. Se o custo mudar, confirma de novo a escolha.' },
        { id: 'sign', title: 'Examina o pedido da carteira', text: 'Confere programa, destinatário, gastos e limites antes de assinar. Recusa uma ação que não escolheste.' },
        { id: 'confirm', title: 'Confirma o resultado na rede', text: 'Enviar um pedido não prova que um NFT foi criado. Verifica confirmação e inventário antes de repetir.' },
      ] },
      note: 'Este site não cria ferramentas nem promete descontos, rendimentos ou atributos com base numa imagem. Se não houver dados, não adivinhes o custo.',
    },
  },
  es: {
    farm: {
      lead: 'De la muestra al modelo: pasos distintos que deben confirmarse.',
      paragraphs: ['Cultivo, separación y entrenamiento no son un solo clic. Cada fase tiene materiales, condiciones, plazos y registro en la red. Comprueba el estado actual del laboratorio, no las estimaciones de un artículo antiguo.', 'Esta web explica la secuencia, pero no consulta pozos ni saldos y no envía transacciones. Iniciar un ciclo no significa haber obtenido su resultado.'],
      cultivation: { heading: 'El pozo · de la muestra a la cosecha', steps: [
        { id: 'state', title: 'Inspecciona el pozo', text: 'Revisa tu cartera, energía y el pozo elegido en el juego. Un fallo de lectura no significa que esté libre.' },
        { id: 'cultivate', title: 'Comprueba el coste antes de cultivar', text: 'Compara los materiales con la solicitud de tu cartera. No firmes si el coste o destinatario no está claro.' },
        { id: 'harvest', title: 'Espera a que esté listo', text: 'Consulta las condiciones actuales de recogida. Volver a enviar una solicitud no acelera el crecimiento y puede costar una comisión.' },
        { id: 'verify', title: 'Verifica el resultado', text: 'Confirma el registro de la cosecha y el saldo nuevo en la red antes de planear la siguiente fase.' },
      ] },
      processing: { heading: 'Señal · camino al modelo', steps: [
        { id: 'ingredients', title: 'Comprueba los ingredientes', text: 'Consulta tu saldo disponible y los lotes actuales de separación en el juego.' },
        { id: 'separate', title: 'Inicia la separación', text: 'Compara el lote elegido con la solicitud de tu cartera; enviarla no entrega una señal.' },
        { id: 'collect', title: 'Recoge una señal confirmada', text: 'Cuando esté listo, verifica el estado del ciclo en la red y recoge el resultado por separado.' },
        { id: 'train', title: 'Entrena el modelo por separado', text: 'Elige el combustible real y comprueba materiales y salida del lote nuevo. La finalización del entrenamiento requiere otra confirmación.' },
      ] },
      note: 'Ni plazos ni cantidades de esta página son un presupuesto en directo. Si falla la red, detente y comprueba el juego y tu cartera.',
    },
    craft: {
      lead: 'Fabrica herramientas según un presupuesto comprobado, no una imagen de rareza.',
      paragraphs: ['Antes de fabricar, comprueba el inventario y obtén un presupuesto nuevo para el tipo y rareza elegidos. El coste puede depender de la red; ni la imagen ni un artículo antiguo lo confirman.', 'Las recetas de recursos y la fabricación de herramientas NFT son acciones distintas. Consulta el libro para las ocho recetas; averigua el coste de herramientas en el taller del juego.'],
      steps: { heading: 'Del presupuesto a la confirmación', steps: [
        { id: 'inventory', title: 'Comprueba el inventario', text: 'Sin una respuesta completa de la red, no supongas que el inventario está vacío o es suficiente. Confirma tipo y rareza.' },
        { id: 'quote', title: 'Obtén un presupuesto nuevo', text: 'Compara materiales, tokens y comisiones con la oferta actual del juego. Si cambia el coste, confirma de nuevo tu elección.' },
        { id: 'sign', title: 'Revisa la solicitud de la cartera', text: 'Comprueba programa, destinatario, importe y límites antes de firmar. Rechaza acciones que no elegiste.' },
        { id: 'confirm', title: 'Verifica el resultado en la red', text: 'Una solicitud enviada no prueba que se acuñó un NFT. Comprueba la confirmación y tu inventario antes de repetir.' },
      ] },
      note: 'La web no fabrica herramientas ni promete descuentos, ganancias o atributos por una imagen. Si faltan datos, no adivines el coste.',
    },
  },
  vi: {
    farm: {
      lead: 'Từ mẫu đến mô hình: từng bước riêng, từng bước cần xác nhận.',
      paragraphs: ['Nuôi cấy, tách mẫu và huấn luyện không phải một cú nhấp. Mỗi giai đoạn có nguyên liệu, điều kiện, thời gian và bản ghi mạng riêng. Hãy xem tình trạng phòng thí nghiệm hiện tại, không dựa vào ước tính trong bài cũ.', 'Trang này giải thích trình tự nhưng không đọc trạng thái ô hay số dư và không gửi giao dịch. Bắt đầu chu kỳ chưa có nghĩa đã nhận kết quả.'],
      cultivation: { heading: 'Ô nuôi cấy · từ mẫu đến thu hoạch', steps: [
        { id: 'state', title: 'Kiểm tra ô', text: 'Xem ví, năng lượng và ô đã chọn trong trò chơi. Lỗi đọc không có nghĩa ô còn trống.' },
        { id: 'cultivate', title: 'Kiểm tra chi phí trước khi gieo', text: 'Đối chiếu nguyên liệu với yêu cầu trong ví. Đừng ký nếu chưa rõ chi phí hoặc người nhận.' },
        { id: 'harvest', title: 'Đợi đến khi sẵn sàng', text: 'Xem điều kiện thu hoạch hiện tại. Gửi lại yêu cầu không giúp mẫu lớn nhanh hơn và có thể tốn phí.' },
        { id: 'verify', title: 'Xác minh sản phẩm', text: 'Kiểm tra bản ghi thu hoạch và số dư mới trên mạng trước khi lên kế hoạch cho giai đoạn kế tiếp.' },
      ] },
      processing: { heading: 'Tín hiệu · đến với mô hình', steps: [
        { id: 'ingredients', title: 'Kiểm tra đầu vào', text: 'Xem số dư hiện có và lựa chọn tách mẫu mới nhất trong trò chơi.' },
        { id: 'separate', title: 'Bắt đầu tách mẫu', text: 'Đối chiếu lô đã chọn với yêu cầu trong ví; gửi yêu cầu chưa tạo ra tín hiệu.' },
        { id: 'collect', title: 'Nhận tín hiệu đã xác nhận', text: 'Khi sẵn sàng, xác minh trạng thái chu kỳ trên mạng rồi nhận kết quả qua bước riêng.' },
        { id: 'train', title: 'Huấn luyện mô hình riêng', text: 'Chọn nhiên liệu thật và kiểm tra đầu vào, đầu ra của lô mới. Việc hoàn tất huấn luyện cần xác nhận riêng.' },
      ] },
      note: 'Thời gian và số lượng trên trang này không phải báo giá trực tiếp. Nếu không đọc được mạng, hãy dừng và kiểm tra trò chơi cùng ví.',
    },
    craft: {
      lead: 'Chế tạo công cụ theo báo giá đã kiểm tra, không theo hình độ hiếm.',
      paragraphs: ['Trước khi chế tạo, hãy xem kho đồ và lấy báo giá mới cho loại, độ hiếm đã chọn. Chi phí có thể phụ thuộc trạng thái mạng; hình ảnh hay bài cũ không chứng minh giá.', 'Công thức tài nguyên và chế tạo công cụ NFT là hai hành động khác nhau. Xem tám công thức tài nguyên trong sách; kiểm tra chi phí công cụ ở xưởng trong trò chơi.'],
      steps: { heading: 'Từ báo giá đến xác nhận', steps: [
        { id: 'inventory', title: 'Kiểm tra kho đồ', text: 'Không có phản hồi mạng đầy đủ thì không thể coi kho đồ trống hay đủ. Xác nhận loại công cụ và độ hiếm đã chọn.' },
        { id: 'quote', title: 'Lấy báo giá mới', text: 'So sánh mọi nguyên liệu, token và phí với báo giá hiện tại của trò chơi. Nếu giá thay đổi, hãy xác nhận lựa chọn lại.' },
        { id: 'sign', title: 'Xem yêu cầu trong ví', text: 'Kiểm tra chương trình, người nhận, khoản chi và giới hạn trước khi ký. Từ chối hành động bạn không chọn.' },
        { id: 'confirm', title: 'Xác minh kết quả trên mạng', text: 'Gửi yêu cầu chưa chứng minh đã tạo NFT. Kiểm tra xác nhận và kho đồ trước khi thử lại.' },
      ] },
      note: 'Trang web không chế tạo công cụ và không hứa giảm giá, lợi nhuận hay thuộc tính dựa trên hình ảnh. Nếu không có dữ liệu, đừng đoán chi phí.',
    },
  },
  id: {
    farm: {
      lead: 'Dari sampel ke model: langkah terpisah, masing-masing perlu konfirmasi.',
      paragraphs: ['Kultivasi, pemisahan, dan pelatihan bukan satu klik. Setiap tahap punya bahan, ketentuan, waktu, dan catatan jaringan sendiri. Periksa keadaan laboratorium sekarang, bukan perkiraan artikel lama.', 'Halaman ini menjelaskan urutan, tetapi tidak membaca wadah atau saldo dan tidak mengirim transaksi. Memulai siklus bukan berarti hasilnya sudah diterima.'],
      cultivation: { heading: 'Wadah · dari sampel ke panen', steps: [
        { id: 'state', title: 'Periksa wadah', text: 'Periksa dompet, energi, dan wadah terpilih di permainan. Gagal membaca bukan berarti wadah kosong.' },
        { id: 'cultivate', title: 'Periksa biaya sebelum menanam', text: 'Bandingkan bahan dengan permintaan dompet. Jangan tanda tangan jika biaya atau penerimanya tidak jelas.' },
        { id: 'harvest', title: 'Tunggu sampai siap', text: 'Lihat ketentuan panen saat ini. Mengirim permintaan lagi tidak mempercepat pertumbuhan dan mungkin dikenai biaya.' },
        { id: 'verify', title: 'Verifikasi hasil', text: 'Konfirmasi catatan panen dan saldo baru di jaringan sebelum merencanakan tahap berikutnya.' },
      ] },
      processing: { heading: 'Sinyal · menuju model', steps: [
        { id: 'ingredients', title: 'Periksa bahan masukan', text: 'Lihat saldo tersedia dan pilihan batch pemisahan terbaru di permainan.' },
        { id: 'separate', title: 'Mulai pemisahan', text: 'Bandingkan batch pilihanmu dengan permintaan dompet; mengirimnya belum menghasilkan sinyal.' },
        { id: 'collect', title: 'Ambil sinyal terkonfirmasi', text: 'Saat siap, periksa status siklus di jaringan dan ambil hasil melalui langkah terpisah.' },
        { id: 'train', title: 'Latih model secara terpisah', text: 'Pilih bahan bakar sebenarnya dan periksa masukan dan hasil batch baru. Penyelesaian pelatihan perlu konfirmasi tersendiri.' },
      ] },
      note: 'Waktu dan jumlah hasil di halaman ini bukan rincian biaya langsung. Jika pembacaan jaringan gagal, berhenti dan periksa permainan serta dompet.',
    },
    craft: {
      lead: 'Rakit peralatan berdasarkan rincian harga terverifikasi, bukan gambar kelangkaan.',
      paragraphs: ['Sebelum merakit, periksa inventaris dan minta rincian biaya terbaru untuk jenis serta tingkat kelangkaan pilihanmu. Biaya bisa bergantung pada kondisi jaringan; gambar dan artikel lama tidak membuktikannya.', 'Resep sumber daya dan perakitan alat NFT adalah tindakan berbeda. Lihat delapan resep sumber daya di buku; periksa biaya peralatan di bengkel permainan.'],
      steps: { heading: 'Dari rincian harga hingga konfirmasi', steps: [
        { id: 'inventory', title: 'Periksa inventaris', text: 'Tanpa respons jaringan lengkap, inventaris tidak bisa dianggap kosong atau cukup. Pastikan jenis alat dan tingkat kelangkaan pilihanmu.' },
        { id: 'quote', title: 'Minta rincian harga baru', text: 'Bandingkan semua bahan, token, dan biaya dengan rincian terbaru di permainan. Jika harga berubah, konfirmasi pilihanmu lagi.' },
        { id: 'sign', title: 'Periksa permintaan dompet', text: 'Periksa program, penerima, biaya, dan batasan sebelum tanda tangan. Tolak tindakan yang tidak kamu pilih.' },
        { id: 'confirm', title: 'Verifikasi hasil di jaringan', text: 'Permintaan terkirim bukan bukti NFT dibuat. Periksa konfirmasi dan inventaris sebelum mengulang.' },
      ] },
      note: 'Situs ini tidak merakit peralatan dan tidak menjanjikan diskon, keuntungan, atau sifat berdasarkan gambar. Jika data tidak ada, jangan tebak biayanya.',
    },
  },
  fil: {
    farm: {
      lead: 'Mula sample hanggang modelo: magkakahiwalay na hakbang na kailangang kumpirmahin.',
      paragraphs: ['Hindi iisang pindot ang pagpapalaki, paghihiwalay, at pagsasanay. May sariling sangkap, kondisyon, oras, at tala sa network ang bawat yugto. Suriin ang kasalukuyang laboratoryo, hindi tantiya sa lumang artikulo.', 'Ipinapaliwanag ng pahinang ito ang daloy ngunit hindi binabasa ang mga puwesto o balanse at hindi nagpapadala ng transaksyon. Ang pagsisimula ng siklo ay hindi pagtanggap ng resulta.'],
      cultivation: { heading: 'Puwesto · mula sample hanggang ani', steps: [
        { id: 'state', title: 'Suriin ang puwesto', text: 'Tingnan ang wallet, enerhiya, at piniling puwesto sa laro. Hindi ibig sabihing bakante kapag hindi mabasa.' },
        { id: 'cultivate', title: 'Suriin ang gastos bago magtanim', text: 'Ihambing ang sangkap sa hiling ng wallet. Huwag lumagda kung malabo ang gastos o tatanggap.' },
        { id: 'harvest', title: 'Hintaying maging handa', text: 'Tingnan ang kasalukuyang kondisyon ng pag-ani. Hindi mapapabilis ang paglago sa pag-ulit ng hiling at maaari itong magdulot ng bayarin.' },
        { id: 'verify', title: 'Kumpirmahin ang bunga', text: 'Suriin ang tala ng ani at bagong balanse sa network bago magplano ng susunod na yugto.' },
      ] },
      processing: { heading: 'Signal · patungo sa modelo', steps: [
        { id: 'ingredients', title: 'Suriin ang mga sangkap', text: 'Tingnan ang available na balanse at mga kasalukuyang batch ng paghihiwalay sa laro.' },
        { id: 'separate', title: 'Simulan ang paghihiwalay', text: 'Ihambing ang piniling batch sa hiling ng wallet; hindi pa nagbibigay ng signal ang pagpapadala.' },
        { id: 'collect', title: 'Kunin ang kumpirmadong signal', text: 'Kapag handa na, suriin ang estado ng siklo sa network at kunin ang resulta sa hiwalay na hakbang.' },
        { id: 'train', title: 'Sanayin ang modelo nang hiwalay', text: 'Piliin ang totoong panggatong at suriin ang sangkap at bunga ng bagong batch. Kailangang kumpirmahin din ang pagtatapos ng pagsasanay.' },
      ] },
      note: 'Hindi kasalukuyang presyo ang oras o dami ng produkto sa pahinang ito. Kapag hindi mabasa ang network, huminto at suriin ang laro at wallet.',
    },
    craft: {
      lead: 'Gumawa ng kagamitan ayon sa beripikadong presyo, hindi sa larawan ng pambihira.',
      paragraphs: ['Bago gumawa, suriin ang imbentaryo at kumuha ng bagong presyo para sa piniling uri at antas. Maaaring nakadepende sa network ang gastos; hindi ito kinukumpirma ng larawan o lumang artikulo.', 'Magkaibang gawain ang resipe ng yaman at paggawa ng NFT na kagamitan. Tingnan ang walong resipe sa aklat; sa pagawaan ng laro suriin ang gastos sa kagamitan.'],
      steps: { heading: 'Mula presyo hanggang kumpirmasyon', steps: [
        { id: 'inventory', title: 'Suriin ang imbentaryo', text: 'Kung hindi kumpleto ang tugon ng network, hindi maituturing na walang laman o sapat ang imbentaryo. Kumpirmahin ang uri at antas ng kagamitan.' },
        { id: 'quote', title: 'Kumuha ng bagong presyo', text: 'Ihambing ang lahat ng materyales, token, at bayarin sa kasalukuyang tantiya ng laro. Kung magbago ang presyo, kumpirmahin muli ang pasya.' },
        { id: 'sign', title: 'Tingnan ang hiling ng wallet', text: 'Suriin ang programa, tatanggap, gastos, at limitasyon bago lumagda. Tanggihan ang hindi mo piniling gawain.' },
        { id: 'confirm', title: 'Kumpirmahin ang resulta sa network', text: 'Hindi patunay ng nalikhang NFT ang naipadalang hiling. Tingnan ang kumpirmasyon at imbentaryo bago umulit.' },
      ] },
      note: 'Hindi gumagawa ng kagamitan ang site at hindi nangangako ng diskuwento, kita, o katangian batay sa larawan. Kung walang datos, huwag hulaan ang gastos.',
    },
  },
};
