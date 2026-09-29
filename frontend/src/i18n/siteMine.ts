import type { Language } from './translations';

type Step = { title: string; text: string };
type MineArticle = {
  lead: string; paragraphs: readonly [string, string]; heading: string; steps: readonly [Step, Step, Step];
  expedition: string; note: string;
};

/** Editorial guide only: mining is disabled by default in the current client. */
export const siteMine: Record<Language, MineArticle> = {
  ru: {
    lead: 'Инструмент ждёт проверки условий, а не обещает добычу.',
    paragraphs: ['Добыча инструментом и экспедиции — разные действия. В этой версии игры запуск и сбор добычи отключены по умолчанию, пока правила в сети не будут проверены. Иллюстрация инструмента не означает, что цикл доступен.', 'Экспедиция — отдельный путь с расходом ресурсов и неопределённым исходом. Перед любым действием сверяй актуальные данные игры, состояние кошелька и условия подписи; эта страница не читает сеть и не запускает работу.'],
    heading: 'Перед новым циклом', steps: [
      { title: 'Проверь состояние в игре', text: 'Не считай отсутствие предупреждения на сайте разрешением на подпись. Убедись, что действие открыто именно в игре и сети.' },
      { title: 'Сверь инструмент и стоимость', text: 'Проверь владение, прочность, ресурсы и сумму списания в кошельке. Неполные данные — повод остановиться.' },
      { title: 'Не угадывай результат', text: 'Отправленная транзакция ещё не подтверждает добычу. Проверяй запись и баланс после завершения.' },
    ],
    expedition: 'Экспедиции не включаются запуском добычи инструментом; их требования и подтверждение результата проверяются отдельно в игре.',
    note: 'Эта страница — справка, не подтверждение доступности, дохода или возврата. Старые клиенты и прямые вызовы программы не блокируются отключённой кнопкой в игре.',
  },
  en: {
    lead: 'A tool awaits verified conditions; it does not promise a harvest.',
    paragraphs: ['Tool mining and expeditions are different actions. In this version, starting and collecting mined output are disabled by default until the on-chain rules are verified. A tool illustration does not mean a cycle is available.', 'An expedition is a separate route with resource costs and an uncertain outcome. Before any action, check current game data, your wallet and the signature details; this page neither reads the network nor starts a job.'],
    heading: 'Before a new cycle', steps: [
      { title: 'Check the game status', text: 'Do not take the absence of a website warning as permission to sign. Check that the action is actually available in the game and on-chain.' },
      { title: 'Verify your tool and costs', text: 'Check ownership, durability, resources and the amount to be spent in your wallet. If the data is incomplete, stop.' },
      { title: 'Do not guess the outcome', text: 'A submitted transaction does not yet confirm mined output. Check the record and balance after settlement.' },
    ],
    expedition: 'Expeditions do not start when tool mining starts; check their requirements and outcome separately in the game.',
    note: 'This is a guide, not proof of availability, earnings or a refund. Disabled buttons in the game do not prevent older clients or direct calls to the program.',
  },
  pt: {
    lead: 'A ferramenta espera condições verificadas, não promete uma colheita.',
    paragraphs: ['A extração com ferramentas e as expedições são ações diferentes. Nesta versão, iniciar e recolher o material extraído estão desativados por padrão até à verificação das regras na rede. Uma imagem da ferramenta não significa que o ciclo esteja disponível.', 'Uma expedição é um caminho separado, com custos de recursos e resultado incerto. Antes de agir, confere os dados atuais no jogo, a carteira e os detalhes da assinatura; esta página não consulta a rede nem inicia trabalhos.'],
    heading: 'Antes de um novo ciclo', steps: [
      { title: 'Confere o estado no jogo', text: 'A ausência de um aviso no site não autoriza a assinatura. Confirma que a ação está disponível no jogo e na rede.' },
      { title: 'Verifica ferramenta e custos', text: 'Confere posse, durabilidade, recursos e o montante a gastar na carteira. Se faltarem dados, para.' },
      { title: 'Não adivinhes o resultado', text: 'Uma transação enviada ainda não confirma a extração. Consulta o registo e o saldo após a conclusão.' },
    ],
    expedition: 'As expedições não começam quando se inicia a extração com ferramentas; verifica as condições e o resultado delas em separado no jogo.',
    note: 'Esta página é uma referência, não uma prova de disponibilidade, rendimento ou reembolso. Botões desativados no jogo não impedem clientes antigos nem chamadas diretas ao programa.',
  },
  es: {
    lead: 'La herramienta espera condiciones verificadas; no promete cosecha.',
    paragraphs: ['La extracción con herramientas y las expediciones son acciones diferentes. En esta versión, iniciar y recoger la extracción están desactivados por defecto hasta comprobar las reglas en la cadena. Una imagen de la herramienta no significa que el ciclo esté disponible.', 'Una expedición es un camino distinto, con costes de recursos y resultado incierto. Antes de actuar, revisa los datos actuales del juego, tu cartera y los detalles de la firma; esta página no consulta la red ni inicia trabajos.'],
    heading: 'Antes de un nuevo ciclo', steps: [
      { title: 'Comprueba el estado en el juego', text: 'La ausencia de avisos en la web no autoriza a firmar. Confirma que la acción está disponible en el juego y en la cadena.' },
      { title: 'Revisa herramienta y costes', text: 'Comprueba propiedad, durabilidad, recursos e importe a gastar en tu cartera. Si faltan datos, detente.' },
      { title: 'No adivines el resultado', text: 'Enviar una transacción aún no confirma la extracción. Comprueba el registro y el saldo tras finalizar.' },
    ],
    expedition: 'Las expediciones no se inician al comenzar la extracción con herramientas; revisa sus requisitos y resultados por separado en el juego.',
    note: 'Esta página es una guía, no una prueba de disponibilidad, ganancias o reembolso. Un botón desactivado en el juego no impide el uso de clientes antiguos ni las llamadas directas al programa.',
  },
  vi: {
    lead: 'Công cụ cần điều kiện đã xác minh, chứ không hứa hẹn thu hoạch.',
    paragraphs: ['Khai thác bằng công cụ và thám hiểm là hai hành động khác nhau. Trong phiên bản này, việc bắt đầu và thu sản phẩm khai thác mặc định bị tắt cho đến khi quy tắc trên chuỗi được xác minh. Hình công cụ không chứng minh có thể bắt đầu chu kỳ.', 'Thám hiểm là một hoạt động riêng, tốn tài nguyên và có kết quả không chắc chắn. Trước khi hành động, hãy kiểm tra dữ liệu hiện tại trong trò chơi, ví và thông tin cần ký; trang này không đọc mạng hay khởi động công việc.'],
    heading: 'Trước một chu kỳ mới', steps: [
      { title: 'Kiểm tra trạng thái trong trò chơi', text: 'Trang web không cảnh báo không có nghĩa là bạn được phép ký. Hãy xác nhận hành động thực sự khả dụng trong trò chơi và trên chuỗi.' },
      { title: 'Kiểm tra công cụ và chi phí', text: 'Kiểm tra quyền sở hữu, độ bền, tài nguyên và số tiền chi trong ví. Nếu thiếu dữ liệu, hãy dừng lại.' },
      { title: 'Đừng đoán kết quả', text: 'Gửi giao dịch chưa xác nhận có sản phẩm khai thác. Hãy kiểm tra bản ghi và số dư sau khi hoàn tất.' },
    ],
    expedition: 'Thám hiểm không tự bắt đầu khi bạn khai thác bằng công cụ; hãy kiểm tra riêng yêu cầu và kết quả trong trò chơi.',
    note: 'Đây chỉ là hướng dẫn, không chứng minh tính khả dụng, lợi nhuận hay việc hoàn tiền. Nút bị tắt trong trò chơi không ngăn ứng dụng cũ hoặc lệnh gọi trực tiếp đến chương trình.',
  },
  id: {
    lead: 'Peralatan menunggu ketentuan yang terverifikasi, bukan menjanjikan hasil.',
    paragraphs: ['Penambangan dengan peralatan dan ekspedisi adalah tindakan berbeda. Dalam versi ini, memulai dan mengambil hasil tambang dinonaktifkan secara bawaan hingga aturan di blockchain diverifikasi. Gambar peralatan tidak berarti siklus tersedia.', 'Ekspedisi adalah kegiatan terpisah yang memakai sumber daya dan hasilnya tidak pasti. Sebelum bertindak, periksa data terbaru di permainan, dompetmu, dan rincian tanda tangan; halaman ini tidak membaca jaringan atau memulai pekerjaan.'],
    heading: 'Sebelum siklus baru', steps: [
      { title: 'Periksa status di permainan', text: 'Tidak adanya peringatan di situs bukan izin untuk menandatangani. Pastikan tindakan tersedia dalam permainan dan blockchain.' },
      { title: 'Periksa peralatan dan biaya', text: 'Cek kepemilikan, daya tahan, sumber daya, dan jumlah yang akan dibelanjakan di dompet. Jika datanya tidak lengkap, berhenti.' },
      { title: 'Jangan tebak hasilnya', text: 'Transaksi yang dikirim belum mengonfirmasi hasil tambang. Periksa catatan dan saldo setelah selesai.' },
    ],
    expedition: 'Ekspedisi tidak dimulai bersama penambangan peralatan; periksa persyaratan dan hasilnya secara terpisah di permainan.',
    note: 'Ini panduan, bukan bukti ketersediaan, penghasilan, atau pengembalian dana. Tombol yang mati di permainan tidak menghentikan klien lama atau pemanggilan program secara langsung.',
  },
  fil: {
    lead: 'Naghihintay ng beripikadong kondisyon ang kagamitan, hindi nangangako ng ani.',
    paragraphs: ['Magkaiba ang pagmimina gamit ang kagamitan at ang ekspedisyon. Sa bersiyong ito, nakapatay bilang default ang pagsisimula at pagkuha ng namina habang hindi pa nasusuri ang mga tuntunin sa blockchain. Hindi patunay ang larawan ng kagamitan na magagamit ang siklo.', 'Hiwalay ang ekspedisyon: gumagamit ito ng yaman at hindi tiyak ang kalalabasan. Bago kumilos, tingnan ang kasalukuyang datos sa laro, wallet, at detalyeng pipirmahan; hindi nagbabasa ng network o nagsisimula ng gawain ang pahinang ito.'],
    heading: 'Bago ang bagong siklo', steps: [
      { title: 'Tingnan ang katayuan sa laro', text: 'Hindi pahintulot sa pagpirma ang kawalan ng babala sa site. Tiyaking magagamit ang gawain sa laro at sa blockchain.' },
      { title: 'Suriin ang kagamitan at halaga', text: 'Tingnan ang pagmamay-ari, tibay, mga yaman, at halagang gagastusin sa wallet. Kung kulang ang datos, huminto.' },
      { title: 'Huwag hulaan ang resulta', text: 'Hindi pa patunay ng namina ang naipadalang transaksyon. Tingnan ang tala at balanse matapos itong matapos.' },
    ],
    expedition: 'Hindi nagsisimula ang ekspedisyon kasabay ng pagmimina gamit ang kagamitan; hiwalay na suriin ang mga kailangan at resulta nito sa laro.',
    note: 'Gabay lamang ito, hindi katibayan ng availability, kita, o refund. Hindi napipigilan ng nakapatay na buton sa laro ang lumang client o direktang tawag sa program.',
  },
};
