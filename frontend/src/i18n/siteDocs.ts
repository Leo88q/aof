import type { Language } from './translations';

/** Exact source identifiers in aof-core/src/lib.rs. Not evidence of deployment or availability. */
export const instructionGroups = [
  { id: 'lab', instructions: ['plant_neuron', 'harvest_synapse', 'start_signal_processing', 'collect_signal', 'start_model_training', 'collect_model'] },
  { id: 'tools', instructions: ['repair'] },
  { id: 'capsules', instructions: ['pack_open_commit', 'pack_open_reveal', 'pack_open_expire'] },
  { id: 'market', instructions: ['marketplace_buy_bounded', 'cancel_buy_order', 'cancel_sell_order'] },
  { id: 'lottery', instructions: ['claim_lottery_prize', 'refund_lottery_ticket'] },
] as const;
export type InstructionGroupId = typeof instructionGroups[number]['id'];
type Group = { title: string; description: string };
type Copy = {
  lead: string; paragraphs: readonly [string, string]; heading: string;
  groups: Record<InstructionGroupId, Group>; codeNote: string; caution: string;
};

/** A readable index of code names; never a transaction interface or a contract audit. */
export const siteDocs: Record<Language, Copy> = {
  ru: {
    lead: 'Карта имён в исходном коде — не подтверждение их доступности в сети.',
    paragraphs: ['Ниже — выборка точных названий инструкций из исходного кода игры. Имена оставлены на языке программы, а пояснения написаны для читателя. Это не полный перечень и не инструкция к отправке транзакции.', 'Исходный код, опубликованная программа и текущий интерфейс могут различаться. Проверяй адрес программы, состояние функции, расходы и запрос подписи в игре и кошельке.'],
    heading: 'Имена по этапам',
    groups: {
      lab: { title: 'Работа лаборатории', description: 'Интерфейс и контракты используют образцы и сигналы; название не доказывает состав рецепта или завершение цикла.' },
      tools: { title: 'Уход за инструментом', description: 'Ремонт зависит от состояния инструмента и актуальной сметы. Само имя не говорит о стоимости или готовности действия.' },
      capsules: { title: 'Капсула: запрос, результат, истечение', description: 'Три отдельных этапа. Оплата открытия не подтверждает получение инструмента; сверяй запись сети и условия возврата.' },
      market: { title: 'Покупка и закрытие старых заявок', description: 'Покупка листинга требует ограничения цены в кошельке. Новые заявки и их сведение в книге заявок приостановлены; здесь указана только отмена.' },
      lottery: { title: 'Ранее выданные билеты', description: 'Получение приза или возврат допускаются только при выполнении условий раунда и билета. Покупка новых билетов приостановлена.' },
    },
    codeNote: 'Имена в моноширинном наборе — точные идентификаторы, их не переводят и не вводят в форму.',
    caution: 'Этот индекс не подтверждает развёртывание, доступность, успешное исполнение или аудит контрактов. Не подписывай действие только по этой странице.',
  },
  en: {
    lead: 'A map of source-code names, not proof of on-chain availability.',
    paragraphs: ['Below is a selection of exact instruction names from the game source. The identifiers retain their code spelling; the explanations are for readers. This is neither a complete index nor a transaction guide.', 'The source, deployed program and current client may differ. Check the program address, feature status, costs and signature request in the game and wallet.'],
    heading: 'Names by stage',
    groups: {
      lab: { title: 'Laboratory work', description: 'The client speaks of samples and signals; a name does not establish a recipe or a completed cycle.' },
      tools: { title: 'Tool upkeep', description: 'Repair depends on the tool’s state and a current quote. An instruction name alone gives neither a price nor an availability check.' },
      capsules: { title: 'Capsule: request, result, expiry', description: 'Three separate stages. Paying to open does not confirm receiving a tool; check the network record and refund conditions.' },
      market: { title: 'Purchase and closing old orders', description: 'A listing purchase needs a wallet-enforced price bound. New order-book placement and matching are paused; only cancellation is listed here.' },
      lottery: { title: 'Existing tickets', description: 'A prize or refund requires the round and ticket to meet their conditions. New ticket purchases are paused.' },
    },
    codeNote: 'Monospaced names are exact identifiers; do not translate them or type them into a form.',
    caution: 'This index does not verify deployment, availability, successful execution or a contract audit. Do not sign an action on the strength of this page alone.',
  },
  pt: {
    lead: 'Um mapa de nomes no código, não prova de disponibilidade na rede.',
    paragraphs: ['Segue uma seleção dos nomes exatos das instruções no código do jogo. Os identificadores mantêm a grafia original; as explicações são para quem lê. Não é uma lista completa nem um guia de transações.', 'O código, o programa publicado e a interface atual podem ser diferentes. Confere o endereço do programa, o estado da função, os custos e o pedido de assinatura no jogo e na carteira.'],
    heading: 'Nomes por etapa',
    groups: {
      lab: { title: 'Trabalho de laboratório', description: 'A interface fala de amostras e sinais; um nome não comprova receita nem ciclo concluído.' },
      tools: { title: 'Cuidado com ferramentas', description: 'Reparar depende do estado da ferramenta e de um orçamento atual. O nome da instrução não informa o preço nem a disponibilidade.' },
      capsules: { title: 'Cápsula: pedido, resultado, prazo', description: 'São três etapas distintas. Pagar a abertura não confirma a entrega da ferramenta; confere o registo na rede e as condições de reembolso.' },
      market: { title: 'Compra e cancelamento de ordens antigas', description: 'A compra de um anúncio exige um limite de preço imposto pela carteira. Novas ordens e cruzamentos estão suspensos; aqui figura apenas o cancelamento.' },
      lottery: { title: 'Bilhetes já emitidos', description: 'O prêmio ou reembolso depende das condições do sorteio e do bilhete. A compra de bilhetes novos está suspensa.' },
    },
    codeNote: 'Os nomes monoespaçados são identificadores exatos: não os traduzas nem os introduzas num formulário.',
    caution: 'Este índice não confirma publicação, disponibilidade, execução bem-sucedida ou auditoria dos contratos. Não assines nada apenas por causa desta página.',
  },
  es: {
    lead: 'Un mapa de nombres del código, no una prueba de disponibilidad en la red.',
    paragraphs: ['Aquí tienes una selección de nombres exactos de instrucciones del código del juego. Se conserva su escritura técnica; las explicaciones son para lectores. No es un índice completo ni una guía para enviar transacciones.', 'El código, el programa desplegado y la interfaz actual pueden diferir. Comprueba la dirección del programa, el estado de la función, los costes y la solicitud de firma en el juego y en tu cartera.'],
    heading: 'Nombres por etapa',
    groups: {
      lab: { title: 'Trabajo de laboratorio', description: 'La interfaz habla de muestras y señales; un nombre no acredita la receta ni un ciclo terminado.' },
      tools: { title: 'Cuidado de herramientas', description: 'Reparar depende del estado de la herramienta y de un presupuesto actualizado. El nombre no indica el precio ni la disponibilidad.' },
      capsules: { title: 'Cápsula: solicitud, resultado, vencimiento', description: 'Son tres etapas distintas. Pagar por abrirla no confirma la recepción de una herramienta; consulta el registro de la red y las condiciones de devolución.' },
      market: { title: 'Compra y cancelación de órdenes antiguas', description: 'Una compra de anuncio necesita un límite de precio impuesto por la cartera. Las nuevas órdenes y sus cruces están suspendidos; aquí solo figura la cancelación.' },
      lottery: { title: 'Boletos ya emitidos', description: 'Premio o reembolso requieren cumplir las condiciones del sorteo y del boleto. La compra de boletos nuevos está suspendida.' },
    },
    codeNote: 'Los nombres monoespaciados son identificadores exactos: no los traduzcas ni los introduzcas en un formulario.',
    caution: 'Este índice no confirma el despliegue, la disponibilidad, el éxito de una operación ni una auditoría de contratos. No firmes solo porque esta página lo mencione.',
  },
  vi: {
    lead: 'Bản đồ tên trong mã nguồn, không phải bằng chứng tính năng đang có trên chuỗi.',
    paragraphs: ['Dưới đây là một số tên lệnh chính xác trong mã nguồn trò chơi. Tên mã giữ nguyên, còn lời giải thích dành cho người đọc. Đây không phải danh sách đầy đủ hay hướng dẫn gửi giao dịch.', 'Mã nguồn, chương trình đã triển khai và ứng dụng hiện tại có thể khác nhau. Kiểm tra địa chỉ chương trình, trạng thái tính năng, chi phí và yêu cầu ký trong trò chơi và ví.'],
    heading: 'Tên lệnh theo giai đoạn',
    groups: {
      lab: { title: 'Công việc phòng thí nghiệm', description: 'Ứng dụng dùng mẫu vật và tín hiệu; một cái tên không xác nhận công thức hay chu kỳ đã hoàn thành.' },
      tools: { title: 'Chăm sóc công cụ', description: 'Sửa chữa phụ thuộc tình trạng công cụ và báo giá mới. Tên lệnh không cho biết giá hay tính khả dụng.' },
      capsules: { title: 'Viên nang: yêu cầu, kết quả, hết hạn', description: 'Ba giai đoạn riêng biệt. Trả tiền mở hộp chưa xác nhận đã nhận công cụ; hãy kiểm tra bản ghi mạng và điều kiện hoàn tiền.' },
      market: { title: 'Mua và hủy lệnh cũ', description: 'Mua từ tin rao cần giới hạn giá do ví áp dụng. Lệnh mới và khớp lệnh đang tạm dừng; ở đây chỉ liệt kê thao tác hủy.' },
      lottery: { title: 'Vé đã phát hành', description: 'Nhận thưởng hoặc hoàn tiền phải đáp ứng điều kiện của vòng quay và vé. Việc mua vé mới đang tạm dừng.' },
    },
    codeNote: 'Tên chữ đơn cách là mã định danh chính xác: đừng dịch hoặc nhập chúng vào biểu mẫu.',
    caution: 'Danh mục này không chứng minh chương trình đã triển khai, tính năng khả dụng, giao dịch thành công hay hợp đồng đã được kiểm toán. Đừng ký chỉ dựa vào trang này.',
  },
  id: {
    lead: 'Peta nama dalam kode sumber, bukan bukti fitur tersedia di jaringan.',
    paragraphs: ['Berikut pilihan nama instruksi persis dari kode permainan. Nama kodenya tetap sama, sedangkan penjelasannya untuk pembaca. Ini bukan daftar lengkap ataupun panduan mengirim transaksi.', 'Kode sumber, program yang diterapkan, dan aplikasi saat ini bisa berbeda. Periksa alamat program, status fitur, biaya, serta permintaan tanda tangan di permainan dan dompet.'],
    heading: 'Nama menurut tahapan',
    groups: {
      lab: { title: 'Pekerjaan laboratorium', description: 'Aplikasi menyebut sampel dan sinyal; nama saja tidak membuktikan resep atau siklus yang selesai.' },
      tools: { title: 'Perawatan peralatan', description: 'Perbaikan bergantung pada keadaan alat dan rincian harga terbaru. Nama instruksi tidak menunjukkan harga atau ketersediaan.' },
      capsules: { title: 'Kapsul: permintaan, hasil, kedaluwarsa', description: 'Tiga tahap terpisah. Membayar pembukaan belum membuktikan alat diterima; periksa catatan jaringan dan ketentuan pengembalian dana.' },
      market: { title: 'Pembelian dan pembatalan pesanan lama', description: 'Pembelian lapak memerlukan batas harga yang ditegakkan dompet. Pesanan baru dan pencocokannya ditunda; di sini hanya ada pembatalan.' },
      lottery: { title: 'Tiket yang telah diterbitkan', description: 'Hadiah atau pengembalian dana mensyaratkan terpenuhinya ketentuan ronde dan tiket. Pembelian tiket baru ditunda.' },
    },
    codeNote: 'Nama berhuruf sama lebar adalah pengenal persis; jangan diterjemahkan atau dimasukkan ke formulir.',
    caution: 'Daftar ini tidak membuktikan penerapan program, ketersediaan, keberhasilan transaksi, atau audit kontrak. Jangan menandatangani tindakan hanya berdasarkan halaman ini.',
  },
  fil: {
    lead: 'Mapa ng mga pangalan sa source code, hindi patunay na available ang mga ito sa network.',
    paragraphs: ['Narito ang piling eksaktong pangalan ng instruksyon sa code ng laro. Hindi binabago ang mga pangalan sa code; ang paliwanag ay para sa mambabasa. Hindi ito kumpletong talaan o gabay sa pagpapadala ng transaksyon.', 'Maaaring magkaiba ang source code, na-deploy na programa, at kasalukuyang app. Suriin ang address ng programa, katayuan ng feature, gastos, at hiling na lumagda sa laro at wallet.'],
    heading: 'Mga pangalan ayon sa yugto',
    groups: {
      lab: { title: 'Gawain sa laboratoryo', description: 'Sample at signal ang gamit ng app; hindi pinatutunayan ng pangalan ang resipe o natapos na siklo.' },
      tools: { title: 'Pag-aalaga ng kagamitan', description: 'Nakasalalay ang pagkukumpuni sa kondisyon ng kagamitan at bagong presyo. Hindi sinasabi ng pangalan ng instruksyon ang gastos o availability.' },
      capsules: { title: 'Kapsula: hiling, resulta, paglipas', description: 'Tatlong magkahiwalay na yugto. Ang pagbabayad sa pagbubukas ay hindi patunay na may natanggap na kagamitan; suriin ang tala ng network at mga kondisyon ng refund.' },
      market: { title: 'Pagbili at pagkansela ng lumang order', description: 'Kailangan ng pagbili sa listahan ang limitasyon sa presyong ipinapatupad ng wallet. Nakatigil ang bagong order at pagtutugma; pagkansela lang ang nakalista rito.' },
      lottery: { title: 'Mga naunang tiket', description: 'May kondisyon sa round at tiket bago makuha ang premyo o refund. Nakatigil ang pagbili ng bagong tiket.' },
    },
    codeNote: 'Eksaktong pagkakakilanlan ang mga pangalang monospaced; huwag isalin o ilagay sa pormularyo.',
    caution: 'Hindi pinatutunayan ng talaang ito ang deployment, availability, tagumpay ng transaksyon, o audit ng kontrata. Huwag lumagda dahil lang nabanggit ito rito.',
  },
};
