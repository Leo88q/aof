import type { Language } from './translations';

export const mindCheckIds = ['identity', 'balance', 'quote', 'plans', 'risk'] as const;
export const mindSafetyIds = ['wallet', 'verification', 'signature'] as const;
export const mindVoiceIds = ['bron', 'anna'] as const;
type Check = { id: typeof mindCheckIds[number]; title: string; body: string };
type Safety = { id: typeof mindSafetyIds[number]; title: string; body: string };
type Voice = { id: typeof mindVoiceIds[number]; character: string; quote: string; context: string };
type Copy = {
  lead: string; paragraphs: readonly [string, string]; originHeading: string; origin: readonly [string, string];
  checksHeading: string; checks: readonly Check[]; voicesHeading: string; voicesNotice: string;
  voices: readonly Voice[]; safetyHeading: string; safety: readonly Safety[]; note: string;
};

/** Editorial guide; fictional voices are not statements about the token or its economics. */
export const siteMind: Record<Language, Copy> = {
  ru: {
    lead: 'У токена есть адрес выпуска, а у каждого действия — проверяемые условия.',
    paragraphs: ['MIND встречается в перечне ресурсов игры и в исходном коде некоторых действий. Это не обещание выпуска, дохода, обмена, бонусов или доступности функции в опубликованной программе.', 'Сайт не читает кошелёк и не показывает живую цену. Прежде чем что-либо подписать, проверь адрес выпуска из актуальной конфигурации сети, остаток и точную смету в игре и кошельке.'],
    originHeading: 'Гость у лабораторного порога',
    origin: ['Рецепт 16 мастерской выпускает MIND из набора данных. Создание и перековка инструментов его сжигают. Живая сеть может ещё быть на прежней программе; история сайта не подтверждает прошлые выдачи.', 'Отображаемое название или картинка не доказывают подлинность токена. Не покупай другой актив с тем же именем, полагаясь на эту статью.'],
    checksHeading: 'Пять вопросов перед действием',
    checks: [
      { id: 'identity', title: 'Какой адрес выпуска?', body: 'Сверь mint с текущей конфигурацией программы и операцией в кошельке. Похожее название или значок не заменяют проверку адреса.' },
      { id: 'balance', title: 'Подтверждён ли остаток?', body: 'Смотри данные своего кошелька и сети. Ошибка чтения — не ноль и не доказательство наличия MIND.' },
      { id: 'quote', title: 'Что именно тратится?', body: 'Для создания инструмента смета берётся заново перед подписью. Не рассчитывай расход по устаревшему примеру или числу из этой статьи.' },
      { id: 'plans', title: 'Работает ли задуманное?', body: 'Ускорение, косметика, билеты на события и обмен на SKR не подтверждены как доступные здесь действия. Не отправляй MIND ради обещанного обмена.' },
      { id: 'risk', title: 'Каков риск?', body: 'Сжигание токена может быть необратимым. Статья не обещает дохода, курса или возврата; остановись, если запрос кошелька непонятен.' },
    ],
    voicesHeading: 'Голоса мастерской · вымысел', voicesNotice: 'Реплики придуманы для атмосферы. Они не свидетельствуют о происхождении токена, наградах или работе контракта.',
    voices: [
      { id: 'bron', character: 'Мастер Брон', quote: 'Искра похожа на звезду, но я всё равно сверяю клеймо на металле.', context: 'У верстака' },
      { id: 'anna', character: 'Мастер Анна', quote: 'Гость входит через дверь. А дверь я открываю, лишь когда знаю, кто стучится.', context: 'У лабораторной стойки' },
    ],
    safetyHeading: 'Перед подписью в кошельке',
    safety: [
      { id: 'wallet', title: 'Кошелёк', body: 'Подключение само по себе не должно запрашивать секретную фразу. Не сообщай ключ или фразу никому, в том числе «поддержке».' },
      { id: 'verification', title: 'Сверка', body: 'Сравни сеть, адрес программы, mint, получателя, количество и комиссии с тем действием, которое ты выбрал.' },
      { id: 'signature', title: 'Результат', body: 'Отправленная транзакция ещё не подтверждена. Проверь её состояние и изменение баланса прежде, чем повторять действие.' },
    ],
    note: 'Это редакционный обзор, не обещание эмиссии, курса, возможности обмена или инвестиционная рекомендация. Для действующих условий нужны актуальные данные игры и сети.',
  },
  en: {
    lead: 'A token has a mint address; every action has terms to verify.',
    paragraphs: ['MIND appears in the game’s resource list and in source code for some actions. That is not a promise of issuance, returns, exchange, perks or availability in a deployed program.', 'The site neither reads your wallet nor shows a live price. Before signing anything, check the mint in current network configuration, your balance and a fresh quote in the game and wallet.'],
    originHeading: 'A visitor at the laboratory door',
    origin: ['Workshop recipe 16 mints MIND from dataset. Crafting and rerolling tools burn it. The live network may still be on the previous program; this page does not confirm past distributions.', 'A displayed name or picture is not proof of authenticity. Do not buy another asset with the same name on the strength of this article.'],
    checksHeading: 'Five questions before acting',
    checks: [
      { id: 'identity', title: 'Which mint?', body: 'Compare the mint with the program’s current configuration and your wallet request. A similar name or icon cannot replace an address check.' },
      { id: 'balance', title: 'Is the balance confirmed?', body: 'Read your wallet and network state. A failed read is neither zero nor proof that you own MIND.' },
      { id: 'quote', title: 'What will be spent?', body: 'A tool craft needs a fresh quote before signing. Do not estimate the debit from an outdated example or a number in this article.' },
      { id: 'plans', title: 'Is the proposed use available?', body: 'Speed-ups, cosmetics, event tickets and exchange for SKR are not verified as available actions here. Do not send MIND for a promised swap.' },
      { id: 'risk', title: 'What is the risk?', body: 'Burning a token may be irreversible. This article promises no returns, exchange rate or refund; stop if the wallet request is unclear.' },
    ],
    voicesHeading: 'Workshop voices · fiction', voicesNotice: 'These lines are written for atmosphere. They do not attest to the token’s origin, rewards or contract behavior.',
    voices: [
      { id: 'bron', character: 'Maker Bron', quote: 'A spark looks like a star. I still check the mark on the metal.', context: 'At the workbench' },
      { id: 'anna', character: 'Maker Anna', quote: 'A visitor comes through the door. I open it only when I know who is knocking.', context: 'At the laboratory counter' },
    ],
    safetyHeading: 'Before signing in your wallet',
    safety: [
      { id: 'wallet', title: 'Wallet', body: 'Connecting must not require a recovery phrase. Never share your keys or phrase with anyone, including “support”.' },
      { id: 'verification', title: 'Compare', body: 'Check the network, program address, mint, recipient, amount and fees against the action you chose.' },
      { id: 'signature', title: 'Outcome', body: 'A submitted transaction is not yet confirmed. Check its status and your balance before trying again.' },
    ],
    note: 'This is an editorial guide, not a promise of issuance, price, exchange availability or investment advice. Current terms require live game and network data.',
  },
  pt: {
    lead: 'Um token tem endereço de emissão; cada ação tem condições a verificar.',
    paragraphs: ['MIND aparece na lista de recursos do jogo e no código de algumas ações. Isso não promete emissão, rendimento, trocas, vantagens ou disponibilidade no programa publicado.', 'O site não consulta a carteira nem mostra preço em tempo real. Antes de assinar, confere o endereço de emissão na configuração atual da rede, o saldo e um orçamento recente no jogo e na carteira.'],
    originHeading: 'Um visitante à porta do laboratório',
    origin: ['A receita 16 da oficina emite MIND a partir do conjunto de dados. Criar e reforjar ferramentas o queima. A rede ativa pode ainda estar no programa anterior; esta página não confirma distribuições passadas.', 'O nome ou a imagem exibidos não comprovam autenticidade. Não compres outro ativo com o mesmo nome por causa deste artigo.'],
    checksHeading: 'Cinco perguntas antes de agir',
    checks: [
      { id: 'identity', title: 'Qual é o endereço de emissão?', body: 'Compara o mint com a configuração atual do programa e o pedido da carteira. Um nome ou símbolo parecido não substitui a verificação do endereço.' },
      { id: 'balance', title: 'O saldo está confirmado?', body: 'Consulta a carteira e a rede. Uma falha de leitura não significa saldo zero nem prova que tens MIND.' },
      { id: 'quote', title: 'O que será gasto?', body: 'Criar ferramentas exige um orçamento recente antes de assinar. Não calcules gastos a partir de exemplos antigos nem de números deste texto.' },
      { id: 'plans', title: 'O uso previsto está disponível?', body: 'Acelerações, visuais, bilhetes para eventos e troca por SKR não foram verificados como ações disponíveis aqui. Não envies MIND em troca de promessas.' },
      { id: 'risk', title: 'Qual é o risco?', body: 'Queimar tokens pode ser irreversível. Este artigo não promete rendimento, taxa de câmbio nem reembolso; detém-te se não percebes o pedido da carteira.' },
    ],
    voicesHeading: 'Vozes da oficina · ficção', voicesNotice: 'Estas frases dão ambiente à história. Não provam origem do token, recompensas nem funcionamento do contrato.',
    voices: [
      { id: 'bron', character: 'Artesão Bron', quote: 'Uma faísca parece uma estrela. Mesmo assim, confiro a marca no metal.', context: 'Junto à bancada' },
      { id: 'anna', character: 'Artesã Anna', quote: 'Um visitante entra pela porta. Só abro quando sei quem está a bater.', context: 'Ao balcão do laboratório' },
    ],
    safetyHeading: 'Antes de assinar na carteira',
    safety: [
      { id: 'wallet', title: 'Carteira', body: 'Ligar a carteira não deve exigir a frase de recuperação. Não partilhes chaves ou frase com ninguém, nem com o «suporte».' },
      { id: 'verification', title: 'Conferência', body: 'Compara rede, endereço do programa, mint, destinatário, quantidade e taxas com a ação que escolheste.' },
      { id: 'signature', title: 'Resultado', body: 'Uma transação enviada ainda não está confirmada. Verifica o estado e o saldo antes de tentar outra vez.' },
    ],
    note: 'Este guia editorial não promete emissão, cotação, possibilidade de troca nem aconselha investimentos. As condições atuais exigem dados do jogo e da rede.',
  },
  es: {
    lead: 'Un token tiene dirección de emisión; toda acción tiene condiciones que comprobar.',
    paragraphs: ['MIND aparece en la lista de recursos del juego y en el código de algunas acciones. Eso no promete emisión, ganancias, cambios, ventajas ni disponibilidad en el programa desplegado.', 'Esta web no consulta tu cartera ni muestra precios en directo. Antes de firmar, comprueba el mint en la configuración actual de la red, tu saldo y un presupuesto reciente en el juego y tu cartera.'],
    originHeading: 'Un visitante a la puerta del laboratorio',
    origin: ['La receta 16 del taller emite MIND a partir del conjunto de datos. Fabricar y reforjar herramientas lo quema. La red activa puede seguir en el programa anterior; esta página no confirma entregas anteriores.', 'El nombre o la imagen no prueban la autenticidad. No compres otro activo con el mismo nombre basándote en este artículo.'],
    checksHeading: 'Cinco preguntas antes de actuar',
    checks: [
      { id: 'identity', title: '¿Cuál es el mint?', body: 'Compara el mint con la configuración actual del programa y la solicitud de tu cartera. Un nombre o icono similar no reemplaza la comprobación de la dirección.' },
      { id: 'balance', title: '¿Está confirmado el saldo?', body: 'Consulta la cartera y la red. Un fallo de lectura no equivale a saldo cero ni demuestra que poseas MIND.' },
      { id: 'quote', title: '¿Qué se gastará?', body: 'Fabricar herramientas requiere un presupuesto nuevo antes de firmar. No calcules el gasto con ejemplos antiguos ni cifras de este artículo.' },
      { id: 'plans', title: '¿Está disponible ese uso?', body: 'Aceleradores, apariencias, entradas para eventos y cambio por SKR no están verificados aquí como acciones disponibles. No envíes MIND por una promesa de cambio.' },
      { id: 'risk', title: '¿Cuál es el riesgo?', body: 'Quemar un token puede ser irreversible. Este artículo no promete ganancias, tipo de cambio ni devolución; detente si no entiendes la solicitud de tu cartera.' },
    ],
    voicesHeading: 'Voces del taller · ficción', voicesNotice: 'Estas frases ambientan el relato. No acreditan el origen del token, recompensas ni el funcionamiento del contrato.',
    voices: [
      { id: 'bron', character: 'Artesano Bron', quote: 'Una chispa parece una estrella. Aun así, compruebo la marca del metal.', context: 'Junto al banco de trabajo' },
      { id: 'anna', character: 'Artesana Anna', quote: 'Un visitante entra por la puerta. Solo abro cuando sé quién llama.', context: 'En el mostrador del laboratorio' },
    ],
    safetyHeading: 'Antes de firmar en tu cartera',
    safety: [
      { id: 'wallet', title: 'Cartera', body: 'Conectar la cartera no debe exigir la frase de recuperación. No compartas tus claves ni tu frase con nadie, tampoco con «soporte».' },
      { id: 'verification', title: 'Comprobación', body: 'Compara red, dirección del programa, mint, destinatario, cantidad y comisiones con la acción elegida.' },
      { id: 'signature', title: 'Resultado', body: 'Una transacción enviada todavía no está confirmada. Comprueba su estado y tu saldo antes de intentarlo de nuevo.' },
    ],
    note: 'Esta guía editorial no promete emisión, cotización, disponibilidad de cambio ni es consejo de inversión. Las condiciones actuales requieren datos del juego y de la red.',
  },
  vi: {
    lead: 'Token có địa chỉ phát hành; mỗi hành động đều có điều kiện cần kiểm tra.',
    paragraphs: ['MIND xuất hiện trong danh sách tài nguyên và mã nguồn của một số hành động. Điều đó không hứa phát hành, lợi nhuận, trao đổi, quyền lợi hay tính khả dụng trong chương trình đã triển khai.', 'Trang web không đọc ví hay hiển thị giá trực tiếp. Trước khi ký, hãy kiểm tra mint trong cấu hình mạng hiện tại, số dư và báo giá mới trong trò chơi và ví.'],
    originHeading: 'Vị khách trước cửa phòng thí nghiệm',
    origin: ['Công thức 16 của xưởng tạo MIND từ dataset. Chế tạo và rèn lại công cụ sẽ đốt nó. Mạng đang chạy có thể vẫn ở chương trình cũ; trang này không xác nhận các đợt phát trước kia.', 'Tên hoặc hình ảnh không chứng minh token thật. Đừng mua tài sản khác chỉ vì trùng tên với bài viết này.'],
    checksHeading: 'Năm câu hỏi trước khi hành động',
    checks: [
      { id: 'identity', title: 'Địa chỉ mint nào?', body: 'Đối chiếu mint với cấu hình hiện tại của chương trình và yêu cầu trong ví. Tên hay biểu tượng giống nhau không thay cho việc kiểm tra địa chỉ.' },
      { id: 'balance', title: 'Số dư đã xác nhận chưa?', body: 'Xem dữ liệu ví và mạng. Lỗi đọc không có nghĩa số dư bằng không, cũng không chứng minh bạn sở hữu MIND.' },
      { id: 'quote', title: 'Sẽ tiêu những gì?', body: 'Chế tạo công cụ cần báo giá mới trước khi ký. Đừng tính chi phí theo ví dụ cũ hoặc con số trong bài này.' },
      { id: 'plans', title: 'Cách dùng dự kiến có sẵn không?', body: 'Tăng tốc, vật phẩm trang trí, vé sự kiện và đổi lấy SKR chưa được xác minh là hành động khả dụng ở đây. Đừng gửi MIND vì lời hứa trao đổi.' },
      { id: 'risk', title: 'Rủi ro là gì?', body: 'Đốt token có thể không thể đảo ngược. Bài viết không hứa lợi nhuận, tỷ giá hay hoàn tiền; hãy dừng nếu yêu cầu trong ví không rõ.' },
    ],
    voicesHeading: 'Tiếng nói trong xưởng · hư cấu', voicesNotice: 'Những lời này chỉ tạo không khí câu chuyện. Chúng không chứng minh nguồn gốc token, phần thưởng hay hoạt động hợp đồng.',
    voices: [
      { id: 'bron', character: 'Thợ Bron', quote: 'Tia lửa trông như ngôi sao. Tôi vẫn kiểm tra dấu khắc trên kim loại.', context: 'Bên bàn làm việc' },
      { id: 'anna', character: 'Thợ Anna', quote: 'Khách đến qua cánh cửa. Tôi chỉ mở khi biết ai đang gõ.', context: 'Bên quầy phòng thí nghiệm' },
    ],
    safetyHeading: 'Trước khi ký trong ví',
    safety: [
      { id: 'wallet', title: 'Ví', body: 'Kết nối ví không được đòi cụm từ khôi phục. Đừng đưa khóa hay cụm từ cho bất kỳ ai, kể cả “hỗ trợ”.' },
      { id: 'verification', title: 'Đối chiếu', body: 'Đối chiếu mạng, địa chỉ chương trình, mint, người nhận, số lượng và phí với hành động đã chọn.' },
      { id: 'signature', title: 'Kết quả', body: 'Gửi giao dịch chưa có nghĩa đã xác nhận. Kiểm tra trạng thái và số dư trước khi thử lại.' },
    ],
    note: 'Đây là hướng dẫn biên tập, không hứa phát hành, giá, khả năng trao đổi hay khuyến nghị đầu tư. Điều kiện thực tế phải lấy từ dữ liệu trò chơi và mạng hiện tại.',
  },
  id: {
    lead: 'Token memiliki alamat mint; setiap tindakan punya ketentuan untuk diperiksa.',
    paragraphs: ['MIND tercantum dalam daftar sumber daya dan kode beberapa tindakan dalam permainan. Itu bukan janji penerbitan, keuntungan, penukaran, manfaat, atau ketersediaan pada program yang diterapkan.', 'Situs tidak membaca dompet atau menampilkan harga langsung. Sebelum tanda tangan, periksa mint dalam konfigurasi jaringan saat ini, saldo, dan rincian biaya terbaru di permainan dan dompet.'],
    originHeading: 'Tamu di pintu laboratorium',
    origin: ['Resep 16 bengkel mencetak MIND dari dataset. Merakit dan mengulang alat membakarnya. Jaringan aktif mungkin masih memakai program sebelumnya; halaman ini tidak membuktikan pembagian sebelumnya.', 'Nama atau gambar bukan bukti keaslian. Jangan membeli aset lain bernama sama hanya berdasarkan artikel ini.'],
    checksHeading: 'Lima pertanyaan sebelum bertindak',
    checks: [
      { id: 'identity', title: 'Alamat mint yang mana?', body: 'Bandingkan mint dengan konfigurasi program saat ini dan permintaan dompet. Nama atau ikon mirip bukan pengganti pemeriksaan alamat.' },
      { id: 'balance', title: 'Apakah saldo terkonfirmasi?', body: 'Periksa dompet dan data jaringan. Gagal membaca bukan berarti saldo nol atau bukti kamu memiliki MIND.' },
      { id: 'quote', title: 'Apa yang akan dihabiskan?', body: 'Merakit peralatan memerlukan rincian biaya baru sebelum tanda tangan. Jangan menghitung biaya dari contoh lama atau angka di artikel ini.' },
      { id: 'plans', title: 'Apakah rencana itu tersedia?', body: 'Percepatan, kosmetik, tiket acara, dan penukaran dengan SKR belum terverifikasi sebagai tindakan yang tersedia di sini. Jangan kirim MIND demi janji penukaran.' },
      { id: 'risk', title: 'Apa risikonya?', body: 'Membakar token bisa tidak dapat dibatalkan. Artikel ini tidak menjanjikan keuntungan, kurs, atau pengembalian dana; berhenti jika permintaan dompet tidak jelas.' },
    ],
    voicesHeading: 'Suara bengkel · fiksi', voicesNotice: 'Ucapan ini hanya untuk suasana cerita. Bukan bukti asal token, hadiah, atau perilaku kontrak.',
    voices: [
      { id: 'bron', character: 'Perajin Bron', quote: 'Percikan tampak seperti bintang. Aku tetap memeriksa cap pada logam.', context: 'Di meja kerja' },
      { id: 'anna', character: 'Perajin Anna', quote: 'Tamu masuk lewat pintu. Aku membukanya hanya saat tahu siapa yang mengetuk.', context: 'Di meja laboratorium' },
    ],
    safetyHeading: 'Sebelum menandatangani di dompet',
    safety: [
      { id: 'wallet', title: 'Dompet', body: 'Menghubungkan dompet tidak boleh meminta frasa pemulihan. Jangan berikan kunci atau frasa kepada siapa pun, termasuk “dukungan”.' },
      { id: 'verification', title: 'Periksa lagi', body: 'Bandingkan jaringan, alamat program, mint, penerima, jumlah, dan biaya dengan tindakan yang kamu pilih.' },
      { id: 'signature', title: 'Hasil', body: 'Transaksi terkirim belum tentu terkonfirmasi. Periksa status dan saldo sebelum mencoba lagi.' },
    ],
    note: 'Ini panduan editorial, bukan janji penerbitan, harga, ketersediaan penukaran, atau nasihat investasi. Ketentuan saat ini harus diperiksa dalam data permainan dan jaringan.',
  },
  fil: {
    lead: 'May mint address ang token; may mga kondisyong dapat suriin sa bawat hakbang.',
    paragraphs: ['Nasa talaan ng yaman at sa code ng ilang gawain sa laro ang MIND. Hindi ito pangako ng paglabas ng token, kita, palitan, benepisyo, o availability sa na-deploy na programa.', 'Hindi binabasa ng site ang wallet mo o nagpapakita ng live na presyo. Bago lumagda, tingnan ang mint sa kasalukuyang configuration ng network, balanse, at bagong presyo sa laro at wallet.'],
    originHeading: 'Panauhin sa pintuan ng laboratoryo',
    origin: ['Ang resipe 16 ng pagawaan ay naglalabas ng MIND mula sa dataset. Nasusunog ito sa paggawa at muling pagpanday ng mga kasangkapan. Maaaring nasa dating programa pa ang live na network; hindi patunay ang pahinang ito ng dating pamamahagi.', 'Hindi patunay ng pagiging tunay ang ipinakitang pangalan o larawan. Huwag bumili ng ibang asset na kapangalan nito dahil lang sa artikulong ito.'],
    checksHeading: 'Limang tanong bago kumilos',
    checks: [
      { id: 'identity', title: 'Aling mint address?', body: 'Ihambing ang mint sa kasalukuyang configuration ng programa at hiling sa wallet. Hindi kapalit ng pagsusuri sa address ang magkahawig na pangalan o icon.' },
      { id: 'balance', title: 'Kumpirmado ba ang balanse?', body: 'Tingnan ang wallet at network. Hindi nangangahulugang sero ang bigong pagbasa at hindi rin ito patunay na may MIND ka.' },
      { id: 'quote', title: 'Ano ang magagastos?', body: 'Kailangan ng bagong tantiya bago lumagda sa paggawa ng kagamitan. Huwag magtantiya gamit ang lumang halimbawa o bilang sa artikulong ito.' },
      { id: 'plans', title: 'Available ba ang balak?', body: 'Hindi pa napapatunayang available rito ang pagpapabilis, pampaganda, tiket sa event, o palitan para sa SKR. Huwag magpadala ng MIND dahil sa pangakong palitan.' },
      { id: 'risk', title: 'Ano ang panganib?', body: 'Maaaring hindi mabawi ang nasunog na token. Walang pangakong kita, halaga ng palitan, o refund ang artikulo; huminto kung malabo ang hiling ng wallet.' },
    ],
    voicesHeading: 'Mga tinig sa pagawaan · kathang-isip', voicesNotice: 'Para sa kuwento lamang ang mga linyang ito. Hindi nila pinatutunayan ang pinagmulan ng token, gantimpala, o kilos ng kontrata.',
    voices: [
      { id: 'bron', character: 'Panday Bron', quote: 'Parang bituin ang isang kislap. Sinusuri ko pa rin ang tatak sa metal.', context: 'Sa mesa ng paggawa' },
      { id: 'anna', character: 'Manggagawang Anna', quote: 'Sa pintuan dumaraan ang panauhin. Binubuksan ko lang kapag alam ko kung sino ang kumakatok.', context: 'Sa mesa ng laboratoryo' },
    ],
    safetyHeading: 'Bago lumagda sa wallet',
    safety: [
      { id: 'wallet', title: 'Digital na pitaka', body: 'Hindi dapat hingin ang recovery phrase sa pagkonekta ng wallet. Huwag ibigay ang susi o parirala kaninuman, kahit sa “support”.' },
      { id: 'verification', title: 'Paghahambing', body: 'Ihambing ang network, address ng programa, mint, tatanggap, dami, at bayarin sa pinili mong hakbang.' },
      { id: 'signature', title: 'Resulta', body: 'Ang naipadalang transaksyon ay hindi pa kumpirmado. Tingnan ang status at balanse bago subukang muli.' },
    ],
    note: 'Gabay na pang-impormasyon ito, hindi pangako ng paglabas, presyo, posibilidad ng palitan, o payo sa pamumuhunan. Tingnan ang kasalukuyang laro at network para sa tunay na kondisyon.',
  },
};
