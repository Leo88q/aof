import type { Language } from './translations';

type Copy = {
  title: string; heading: string; intro: string; cost: string; reward: string; rewardInfo: string;
  requirements: string; tool: string; resources: string; limits: string;
  connect: string; checking: string; unavailable: string; missingTool: string;
  sending: string; send: string; waiting: string; pending: string; unknown: string;
  selfSettle: string; settling: string; submitted: string; uncertain: string;
  how: string; commit: string; reveal: string; outcome: string;
};

/** No success or refund can be inferred from the exploration status API: after the PDA closes it returns `unknown`. */
export const explorationCopy: Record<Language, Copy> = {
  ru: {
    title: 'Исследование', heading: 'Глубокое обучение', intro: 'Отправьте квантовый передатчик за редкими ресурсами. Результат зависит от оракула.',
    cost: 'Стоимость похода', reward: 'При удачном исходе', rewardInfo: 'Количество Схем и Кремния определяется в сети по уровню, зафиксированному при отправке. Награда не гарантирована.',
    requirements: 'Требования', tool: 'Инструмент: квантовый передатчик', resources: 'Ресурсы: Данные, Схема, Кремний, Датасет', limits: 'Время ожидания и дневной лимит зависят от уровня в программе.',
    connect: 'Подключите кошелёк', checking: 'Проверяем инструмент и экспедицию…', unavailable: 'Не удалось проверить инструмент или экспедицию в сети. Отправка приостановлена.', missingTool: 'Нужен передатчик в инвентаре',
    sending: 'Отправляем…', send: 'Отправить в экспедицию', waiting: 'Транзакция подтверждена. Ожидаем раскрытия оракула.', pending: 'Экспедиция ещё не раскрыта. Не отправляйте её повторно.', unknown: 'Запись экспедиции закрыта. Этот экран не может подтвердить награду или возврат; проверьте историю кошелька и балансы.',
    selfSettle: 'Раскрыть или вернуть экспедицию самостоятельно', settling: 'Отправляем раскрытие или возврат…', submitted: 'Транзакция раскрытия или возврата подтверждена. Проверьте историю кошелька и балансы: результат здесь не определяется.', uncertain: 'Статус операции не удалось подтвердить. Проверьте историю кошелька и экспедицию перед повторной отправкой.',
    how: 'Как это работает', commit: 'Отправка: ресурсы сжигаются, запись фиксируется в сети.', reveal: 'Раскрытие: оракул раскрывает случайный результат; позже возможен возврат.', outcome: 'Итог: при успехе программа начисляет Схему и Кремний; при неудаче награды нет.',
  },
  en: {
    title: 'Exploration', heading: 'Deep learning', intro: 'Send a quantum transmitter in search of rare resources. The outcome depends on the oracle.',
    cost: 'Trip cost', reward: 'If successful', rewardInfo: 'The on-chain tier recorded at departure determines the Circuit and Silicon amounts. A reward is not guaranteed.',
    requirements: 'Requirements', tool: 'Tool: quantum transmitter', resources: 'Resources: Data, Circuit, Silicon, Dataset', limits: 'Cooldown and daily limit depend on the on-chain tier.',
    connect: 'Connect your wallet', checking: 'Checking your tool and trip…', unavailable: 'Could not verify your tool or trip on-chain. Departure is paused.', missingTool: 'Quantum transmitter required in inventory',
    sending: 'Sending…', send: 'Start an expedition', waiting: 'Transaction confirmed. Waiting for the oracle to reveal the outcome.', pending: 'This trip has not been revealed yet. Do not send it again.', unknown: 'The trip record has closed. This screen cannot confirm a reward or refund; check your wallet history and balances.',
    selfSettle: 'Reveal or refund this trip yourself', settling: 'Submitting reveal or refund…', submitted: 'Reveal or refund transaction confirmed. Check your wallet history and balances; this screen cannot determine the outcome.', uncertain: 'Could not confirm the operation. Check your wallet history and trip before trying again.',
    how: 'How it works', commit: 'Departure: resources are burned and the trip is recorded on-chain.', reveal: 'Reveal: the oracle discloses a random outcome; a refund may be available later.', outcome: 'Outcome: on success, the program awards Circuit and Silicon. Otherwise there is no reward.',
  },
  pt: {
    title: 'Exploração', heading: 'Aprendizado profundo', intro: 'Envie um transmissor quântico em busca de recursos raros. O resultado depende do oráculo.',
    cost: 'Custo da expedição', reward: 'Em caso de sucesso', rewardInfo: 'O nível registrado na rede na partida determina as quantidades de Circuito e Silício. A recompensa não é garantida.',
    requirements: 'Requisitos', tool: 'Ferramenta: transmissor quântico', resources: 'Recursos: Dados, Circuito, Silício, Conjunto de dados', limits: 'O intervalo de espera e o limite diário dependem do nível na rede.',
    connect: 'Conecte a carteira', checking: 'Verificando ferramenta e expedição…', unavailable: 'Não foi possível verificar a ferramenta ou expedição na rede. A partida está suspensa.', missingTool: 'É preciso ter um transmissor quântico',
    sending: 'Enviando…', send: 'Iniciar expedição', waiting: 'Transação confirmada. Aguardando a revelação do oráculo.', pending: 'A expedição ainda não foi revelada. Não a envie novamente.', unknown: 'O registro da expedição foi encerrado. Esta tela não confirma recompensa nem reembolso; confira o histórico e os saldos da carteira.',
    selfSettle: 'Revelar ou recuperar esta expedição', settling: 'Enviando revelação ou reembolso…', submitted: 'Transação confirmada. Confira o histórico e os saldos da carteira para verificar o resultado.', uncertain: 'Não foi possível confirmar a operação. Confira a carteira e a expedição antes de tentar novamente.',
    how: 'Como funciona', commit: 'Partida: os recursos são consumidos e a expedição é registrada na rede.', reveal: 'Revelação: o oráculo divulga um resultado aleatório; mais tarde pode haver reembolso.', outcome: 'Resultado: em caso de sucesso, você recebe Circuito e Silício; caso contrário, não há recompensa.',
  },
  es: {
    title: 'Exploración', heading: 'Aprendizaje profundo', intro: 'Envía un transmisor cuántico en busca de recursos raros. El resultado depende del oráculo.',
    cost: 'Coste de la expedición', reward: 'Si tienes éxito', rewardInfo: 'El nivel registrado en la cadena al partir determina las cantidades de Circuito y Silicio. La recompensa no está garantizada.',
    requirements: 'Requisitos', tool: 'Herramienta: transmisor cuántico', resources: 'Recursos: Datos, Circuito, Silicio, Conjunto de datos', limits: 'La espera y el límite diario dependen del nivel en la cadena.',
    connect: 'Conecta tu cartera', checking: 'Comprobando herramienta y expedición…', unavailable: 'No se pudieron verificar la herramienta o la expedición en la cadena. La salida está pausada.', missingTool: 'Necesitas un transmisor cuántico',
    sending: 'Enviando…', send: 'Iniciar expedición', waiting: 'Transacción confirmada. Esperando el resultado del oráculo.', pending: 'Esta expedición aún no se ha revelado. No vuelvas a enviarla.', unknown: 'El registro de la expedición se cerró. Esta pantalla no puede confirmar premios ni reembolsos; comprueba el historial y los saldos de tu cartera.',
    selfSettle: 'Revelar o recuperar la expedición', settling: 'Enviando revelación o reembolso…', submitted: 'Transacción confirmada. Comprueba el historial y los saldos de tu cartera para conocer el resultado.', uncertain: 'No se pudo confirmar la operación. Revisa tu cartera y la expedición antes de reintentarlo.',
    how: 'Cómo funciona', commit: 'Salida: se consumen los recursos y se registra la expedición en la cadena.', reveal: 'Revelación: el oráculo muestra un resultado aleatorio; más tarde puede haber reembolso.', outcome: 'Resultado: si tienes éxito, recibes Circuito y Silicio; si no, no hay premio.',
  },
  vi: {
    title: 'Thám hiểm', heading: 'Học sâu', intro: 'Đưa thiết bị phát lượng tử đi tìm tài nguyên hiếm. Kết quả phụ thuộc vào hệ thống tiên tri.',
    cost: 'Chi phí chuyến đi', reward: 'Nếu thành công', rewardInfo: 'Cấp độ được ghi trên chuỗi lúc khởi hành quyết định lượng Mạch và Silic. Không đảm bảo có thưởng.',
    requirements: 'Điều kiện', tool: 'Công cụ: thiết bị phát lượng tử', resources: 'Tài nguyên: Dữ liệu, Mạch, Silic, Tập dữ liệu', limits: 'Thời gian chờ và giới hạn mỗi ngày tùy thuộc cấp độ trên chuỗi.',
    connect: 'Kết nối ví', checking: 'Đang kiểm tra công cụ và chuyến đi…', unavailable: 'Không thể xác minh công cụ hoặc chuyến đi trên chuỗi. Tạm dừng khởi hành.', missingTool: 'Cần có thiết bị phát lượng tử trong kho',
    sending: 'Đang gửi…', send: 'Bắt đầu thám hiểm', waiting: 'Giao dịch đã xác nhận. Đang chờ hệ thống tiên tri công bố kết quả.', pending: 'Chuyến đi chưa được công bố. Đừng gửi lại.', unknown: 'Bản ghi chuyến đi đã đóng. Màn hình này không thể xác nhận phần thưởng hay hoàn trả; hãy kiểm tra lịch sử và số dư ví.',
    selfSettle: 'Tự công bố hoặc hoàn trả chuyến đi', settling: 'Đang gửi yêu cầu công bố hoặc hoàn trả…', submitted: 'Giao dịch đã xác nhận. Hãy kiểm tra lịch sử và số dư ví để biết kết quả.', uncertain: 'Không thể xác nhận giao dịch. Hãy kiểm tra ví và chuyến đi trước khi thử lại.',
    how: 'Cách hoạt động', commit: 'Khởi hành: tài nguyên bị tiêu hao và chuyến đi được ghi trên chuỗi.', reveal: 'Công bố: hệ thống tiên tri tiết lộ kết quả ngẫu nhiên; có thể hoàn trả sau đó.', outcome: 'Kết quả: nếu thành công, nhận Mạch và Silic; nếu không, sẽ không có thưởng.',
  },
  id: {
    title: 'Penjelajahan', heading: 'Pembelajaran mendalam', intro: 'Kirim pemancar kuantum untuk mencari sumber daya langka. Hasilnya ditentukan oracle.',
    cost: 'Biaya perjalanan', reward: 'Jika berhasil', rewardInfo: 'Tingkat yang dicatat di blockchain saat berangkat menentukan jumlah Sirkuit dan Silikon. Hadiah tidak dijamin.',
    requirements: 'Persyaratan', tool: 'Alat: pemancar kuantum', resources: 'Sumber daya: Data, Sirkuit, Silikon, Kumpulan data', limits: 'Waktu tunggu dan batas harian bergantung pada tingkat di blockchain.',
    connect: 'Hubungkan dompet', checking: 'Memeriksa alat dan perjalanan…', unavailable: 'Alat atau perjalanan tidak dapat diverifikasi di blockchain. Keberangkatan dihentikan sementara.', missingTool: 'Pemancar kuantum harus ada di inventaris',
    sending: 'Mengirim…', send: 'Mulai penjelajahan', waiting: 'Transaksi dikonfirmasi. Menunggu hasil dari oracle.', pending: 'Perjalanan ini belum diungkap. Jangan kirim lagi.', unknown: 'Catatan perjalanan sudah ditutup. Layar ini tidak dapat memastikan hadiah atau pengembalian; periksa riwayat dan saldo dompet.',
    selfSettle: 'Ungkap atau kembalikan perjalanan sendiri', settling: 'Mengirim pengungkapan atau pengembalian…', submitted: 'Transaksi dikonfirmasi. Periksa riwayat dan saldo dompet untuk mengetahui hasilnya.', uncertain: 'Operasi tidak dapat dikonfirmasi. Periksa dompet dan perjalanan sebelum mencoba lagi.',
    how: 'Cara kerjanya', commit: 'Berangkat: sumber daya dihabiskan dan perjalanan dicatat di blockchain.', reveal: 'Ungkap: oracle mengungkap hasil acak; pengembalian mungkin tersedia kemudian.', outcome: 'Hasil: jika berhasil, program memberi Sirkuit dan Silikon; jika tidak, tak ada hadiah.',
  },
  fil: {
    title: 'Paggalugad', heading: 'Malalim na pag-aaral', intro: 'Ipadala ang quantum transmitter para maghanap ng pambihirang yaman. Nakasalalay sa oracle ang kalalabasan.',
    cost: 'Gastos sa paglalakbay', reward: 'Kung magtagumpay', rewardInfo: 'Ang antas na naitala sa blockchain sa pag-alis ang magtatakda ng dami ng Sirkito at Silikon. Hindi tiyak ang gantimpala.',
    requirements: 'Mga kailangan', tool: 'Kasangkapan: quantum transmitter', resources: 'Yaman: Data, Sirkito, Silikon, Kalipunan ng datos', limits: 'Depende sa antas sa blockchain ang panahon ng paghihintay at arawang limitasyon.',
    connect: 'Ikonekta ang wallet', checking: 'Sinusuri ang kagamitan at paglalakbay…', unavailable: 'Hindi ma-verify sa blockchain ang kagamitan o paglalakbay. Pansamantalang hindi maaaring umalis.', missingTool: 'Kailangan ng quantum transmitter sa imbentaryo',
    sending: 'Ipinapadala…', send: 'Simulan ang paggalugad', waiting: 'Kumpirmado ang transaksiyon. Hinihintay ang resulta ng oracle.', pending: 'Hindi pa inihahayag ang paglalakbay. Huwag itong ipadala muli.', unknown: 'Sarado na ang tala ng paglalakbay. Hindi matitiyak dito ang gantimpala o balik-bayad; tingnan ang kasaysayan at balanse ng wallet.',
    selfSettle: 'Ikaw mismo ang maghayag o magbalik ng paglalakbay', settling: 'Ipinapadala ang paghayag o pagbabalik…', submitted: 'Kumpirmado ang transaksiyon. Tingnan ang kasaysayan at balanse ng wallet upang malaman ang resulta.', uncertain: 'Hindi makumpirma ang operasyon. Suriin ang wallet at paglalakbay bago subukan muli.',
    how: 'Paano ito gumagana', commit: 'Pag-alis: gagastusin ang yaman at itatala sa blockchain ang paglalakbay.', reveal: 'Paghayag: inilalabas ng oracle ang sapalarang resulta; maaari itong maibalik sa ibang pagkakataon.', outcome: 'Kalalabasan: kung matagumpay, may Sirkito at Silikon; kung hindi, walang gantimpala.',
  },
};
