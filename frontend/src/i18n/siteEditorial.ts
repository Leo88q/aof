import type { Language } from './translations';

export type EditorialId = 'manifesto' | 'weather';
type Principle = { title: string; text: string };
type EditorialCopy = {
  manifesto: { lead: string; paragraphs: readonly string[]; heading: string; principles: readonly Principle[]; closing: string };
  weather: {
    lead: string; paragraphs: readonly string[]; heading: string; demoLegend: string;
    states: { drought: string; sun: string; rain: string; festival: string };
    statePrefix: string; stateSuffix: string; caution: string;
    steps: { heading: string; items: readonly { title: string; text: string }[] };
  };
};

// Editorial prose is kept separately from the Russian source material. A page
// is marked localized only when its main copy AND its special sections exist.
export const editorialPages: Record<Language, EditorialCopy> = {
  ru: {
    manifesto: {
      lead: 'Прозрачность вместо обещаний.',
      paragraphs: ['Каждое действие проверяемо. Ты видишь, что потратил, что создал и что передал другому оператору.', 'Условия действия — до подписи транзакции. Не после.', 'Сеть жива людьми. Репутация, сотрудничество и честная торговля делают лабораторию настоящей.'],
      heading: 'Четыре опоры', principles: [
        { title: 'Проверяемость', text: 'Сначала условия и запись в сети, потом доверие к результату. Хеш обязательства виден до раскрытия: ты проверяешь не слово мастера, а его запись.' },
        { title: 'Осознанность', text: 'Ты видишь расход, комиссию и разрешение до подписи. Игра не прячет цену за кнопкой: каждая транзакция читается как накладная.' },
        { title: 'Ремесло', text: 'Цепочка действий важнее обещания лёгкой награды. Модель рождается из образца, энергопотока и цикла — и никак иначе. Мы не продаём пропуск мимо работы.' },
        { title: 'Сообщество', text: 'Договорись о работе и выполни свою часть. Репутация в NeuroForge — это память о выполненных обещаниях, а не цветная рамка профиля.' },
      ],
      closing: 'Мы не обещаем заработка. Мы приглашаем к ремеслу: место живёт, пока ты можешь понять его правила и оставить после себя полезную вещь.',
    },
    weather: {
      lead: 'Четыре состояния — одна устойчивая сеть.',
      paragraphs: ['Блэкаут — сеть остановлена: сетевая станция не качает. 0 единиц в час.', 'Номинал — штатный режим: 5 единиц в час.', 'Скачок — напряжение выше обычного: 15 единиц в час.', 'Френзи — пиковая нагрузка: 20 единиц в час. Самая щедрая смена.'],
      heading: 'Четыре состояния неба', demoLegend: 'Демонстрация неба',
      states: { drought: 'Блэкаут', sun: 'Номинал', rain: 'Скачок', festival: 'Френзи' },
      statePrefix: 'Показано состояние: ', stateSuffix: ' — выбор для примера, сеть публикует своё.',
      caution: 'Демо меняет только картину на странице: настоящие модификаторы живут в игре и меняются вместе с балансом.',
      steps: { heading: 'Нагрузка сети · порядок действий', items: [
        { title: 'Посмотри состояние', text: 'Ориентируйся на актуальное состояние игры.' },
        { title: 'Прочитай модификаторы', text: 'Сверь доступность, стоимость и результат.' },
        { title: 'Планируй работу', text: 'Описание сайта не отправляет транзакцию.' },
      ] },
    },
  },
  en: {
    manifesto: {
      lead: 'Transparency, not empty promises.',
      paragraphs: ['Every action can be checked. You can see what you spent, what you made and what you passed on to another operator.', 'The terms come before you sign a transaction. Never after.', 'People keep the network alive. Reputation, collaboration and fair trade make this laboratory real.'],
      heading: 'Four foundations', principles: [
        { title: 'Verifiability', text: 'First come the terms and the on-chain record; trust in the outcome follows. The commitment hash is visible before the reveal: you verify a record, not someone’s word.' },
        { title: 'Informed decisions', text: 'You see the cost, fee and permissions before signing. The game does not hide the price behind a button: every transaction should read like an invoice.' },
        { title: 'Craft', text: 'The work matters more than promises of easy rewards. A model begins with a sample, power and a cycle. We do not sell shortcuts around the work.' },
        { title: 'Community', text: 'Agree on a task and do your part. At NeuroForge, reputation remembers promises kept; it is not a colorful border around your profile.' },
      ], closing: 'We do not promise earnings. We invite you to practice a craft: this place lives as long as you can understand its rules and leave something useful behind.',
    },
    weather: {
      lead: 'Four states, one resilient network.',
      paragraphs: ['Blackout: the network station stops producing. 0 units per hour.', 'Nominal: normal operation at 5 units per hour.', 'Surge: higher-than-usual load at 15 units per hour.', 'Frenzy: peak load at 20 units per hour. The most productive shift.'],
      heading: 'Four states of the network', demoLegend: 'Try the network display',
      states: { drought: 'Blackout', sun: 'Nominal', rain: 'Surge', festival: 'Frenzy' },
      statePrefix: 'Showing: ', stateSuffix: ' — a demonstration only; the network publishes its own state.',
      caution: 'This demonstration only changes the picture on this page. Actual modifiers live in the game and can change with the balance.',
      steps: { heading: 'Network load · step by step', items: [
        { title: 'Check the current state', text: 'Use the live state shown in the game.' },
        { title: 'Read the modifiers', text: 'Check the current effects, cost and expected result.' },
        { title: 'Plan your work', text: 'This guide does not submit transactions.' },
      ] },
    },
  },
  pt: {
    manifesto: {
      lead: 'Transparência em vez de promessas vazias.',
      paragraphs: ['Cada ação pode ser conferida. Você vê o que gastou, o que criou e o que entregou a outro operador.', 'As condições aparecem antes da assinatura da transação. Nunca depois.', 'São as pessoas que mantêm a rede viva. Reputação, colaboração e comércio justo dão vida ao laboratório.'],
      heading: 'Quatro pilares', principles: [
        { title: 'Verificabilidade', text: 'Primeiro vêm as condições e o registro na rede; a confiança no resultado vem depois. O hash do compromisso aparece antes da revelação: você confere o registro, não a palavra de alguém.' },
        { title: 'Escolhas conscientes', text: 'Você vê o gasto, a taxa e as permissões antes de assinar. O jogo não esconde o preço atrás de um botão: cada transação deve ser tão clara quanto uma nota fiscal.' },
        { title: 'Ofício', text: 'O trabalho importa mais que promessas de recompensas fáceis. Um modelo nasce de uma amostra, energia e um ciclo. Não vendemos atalhos para pular o trabalho.' },
        { title: 'Comunidade', text: 'Combine uma tarefa e cumpra sua parte. No NeuroForge, reputação é a memória de promessas cumpridas, não uma borda colorida no perfil.' },
      ], closing: 'Não prometemos ganhos. Convidamos você a praticar um ofício: este lugar vive enquanto suas regras puderem ser compreendidas e você puder deixar algo útil para os demais.',
    },
    weather: {
      lead: 'Quatro estados, uma rede resiliente.',
      paragraphs: ['Apagão: a estação de rede para de produzir. 0 unidades por hora.', 'Normal: operação estável, com 5 unidades por hora.', 'Pico: carga acima do normal, com 15 unidades por hora.', 'Frenesi: carga máxima, com 20 unidades por hora. O turno mais produtivo.'],
      heading: 'Quatro estados da rede', demoLegend: 'Experimente a visualização da rede',
      states: { drought: 'Apagão', sun: 'Normal', rain: 'Pico', festival: 'Frenesi' },
      statePrefix: 'Exibindo: ', stateSuffix: ' — apenas uma demonstração; a rede publica seu próprio estado.',
      caution: 'Esta demonstração só muda a imagem da página. Os modificadores reais estão no jogo e podem mudar com o balanceamento.',
      steps: { heading: 'Carga da rede · passo a passo', items: [
        { title: 'Confira o estado atual', text: 'Consulte o estado ao vivo no jogo.' },
        { title: 'Leia os modificadores', text: 'Confira os efeitos atuais, o custo e o resultado esperado.' },
        { title: 'Planeje o trabalho', text: 'Este guia não envia transações.' },
      ] },
    },
  },
  es: {
    manifesto: {
      lead: 'Transparencia en lugar de promesas vacías.',
      paragraphs: ['Cada acción puede verificarse. Ves lo que gastaste, lo que creaste y lo que entregaste a otro operador.', 'Las condiciones se muestran antes de firmar la transacción. Nunca después.', 'Las personas mantienen viva la red. La reputación, la colaboración y el comercio justo hacen que este laboratorio sea real.'],
      heading: 'Cuatro pilares', principles: [
        { title: 'Verificabilidad', text: 'Primero van las condiciones y el registro en la cadena; después llega la confianza en el resultado. El hash del compromiso es visible antes de revelarlo: verificas el registro, no la palabra de alguien.' },
        { title: 'Decisiones conscientes', text: 'Ves el gasto, la comisión y los permisos antes de firmar. El juego no esconde el precio tras un botón: cada transacción debe leerse como una factura.' },
        { title: 'Oficio', text: 'El trabajo importa más que las promesas de recompensas fáciles. Un modelo nace de una muestra, energía y un ciclo. No vendemos atajos para saltarse el trabajo.' },
        { title: 'Comunidad', text: 'Acuerda una tarea y cumple tu parte. En NeuroForge, la reputación recuerda las promesas cumplidas; no es un marco vistoso en el perfil.' },
      ], closing: 'No prometemos ganancias. Te invitamos a ejercer un oficio: este lugar vive mientras puedas entender sus reglas y dejar algo útil para los demás.',
    },
    weather: {
      lead: 'Cuatro estados, una red resistente.',
      paragraphs: ['Apagón: la estación de red deja de producir. 0 unidades por hora.', 'Normal: funcionamiento estable, 5 unidades por hora.', 'Pico: carga superior a la habitual, 15 unidades por hora.', 'Frenesí: carga máxima, 20 unidades por hora. El turno más productivo.'],
      heading: 'Cuatro estados de la red', demoLegend: 'Prueba la visualización de la red',
      states: { drought: 'Apagón', sun: 'Normal', rain: 'Pico', festival: 'Frenesí' },
      statePrefix: 'Mostrando: ', stateSuffix: ' — solo es una demostración; la red publica su propio estado.',
      caution: 'Esta demostración solo cambia la imagen de la página. Los modificadores reales están en el juego y pueden cambiar con el balance.',
      steps: { heading: 'Carga de la red · paso a paso', items: [
        { title: 'Comprueba el estado actual', text: 'Consulta el estado en tiempo real dentro del juego.' },
        { title: 'Lee los modificadores', text: 'Comprueba los efectos, el coste y el resultado esperado.' },
        { title: 'Planifica el trabajo', text: 'Esta guía no envía transacciones.' },
      ] },
    },
  },
  vi: {
    manifesto: {
      lead: 'Minh bạch thay cho lời hứa suông.',
      paragraphs: ['Mọi hành động đều có thể kiểm chứng. Bạn biết mình đã dùng gì, tạo ra gì và chuyển gì cho người vận hành khác.', 'Điều kiện phải rõ ràng trước khi ký giao dịch, không phải sau đó.', 'Con người giữ cho mạng lưới sống động. Uy tín, hợp tác và giao dịch công bằng tạo nên một phòng thí nghiệm thực sự.'],
      heading: 'Bốn nền tảng', principles: [
        { title: 'Có thể kiểm chứng', text: 'Trước tiên là điều kiện và bản ghi trên chuỗi; niềm tin vào kết quả đến sau. Mã băm cam kết hiển thị trước khi tiết lộ: bạn kiểm tra bản ghi, không phải lời ai nói.' },
        { title: 'Quyết định sáng suốt', text: 'Bạn thấy chi phí, phí giao dịch và quyền truy cập trước khi ký. Trò chơi không giấu giá sau một nút bấm: mỗi giao dịch phải rõ ràng như một hóa đơn.' },
        { title: 'Tay nghề', text: 'Quá trình làm việc quan trọng hơn lời hứa phần thưởng dễ dàng. Mô hình bắt đầu từ mẫu, năng lượng và một chu kỳ. Chúng tôi không bán lối tắt bỏ qua công sức.' },
        { title: 'Cộng đồng', text: 'Hãy nhận việc và làm tròn phần của mình. Ở NeuroForge, uy tín lưu giữ những lời hứa đã thực hiện, không phải khung màu quanh hồ sơ.' },
      ], closing: 'Chúng tôi không hứa hẹn thu nhập. Chúng tôi mời bạn rèn luyện tay nghề: nơi này tồn tại chừng nào bạn còn hiểu quy tắc và để lại điều có ích.',
    },
    weather: {
      lead: 'Bốn trạng thái, một mạng lưới bền vững.',
      paragraphs: ['Mất điện: trạm mạng ngừng sản xuất. 0 đơn vị mỗi giờ.', 'Bình thường: hoạt động ổn định, 5 đơn vị mỗi giờ.', 'Tăng vọt: tải cao hơn bình thường, 15 đơn vị mỗi giờ.', 'Cực đại: tải đạt đỉnh, 20 đơn vị mỗi giờ. Ca làm hiệu quả nhất.'],
      heading: 'Bốn trạng thái của mạng', demoLegend: 'Thử màn hình trạng thái mạng',
      states: { drought: 'Mất điện', sun: 'Bình thường', rain: 'Tăng vọt', festival: 'Cực đại' },
      statePrefix: 'Đang hiển thị: ', stateSuffix: ' — chỉ để minh họa; mạng tự công bố trạng thái thực tế.',
      caution: 'Bản minh họa này chỉ đổi hình ảnh trên trang. Các hệ số thực tế nằm trong trò chơi và có thể thay đổi theo cân bằng.',
      steps: { heading: 'Tải mạng · từng bước', items: [
        { title: 'Kiểm tra trạng thái hiện tại', text: 'Xem trạng thái trực tiếp trong trò chơi.' },
        { title: 'Đọc các hệ số', text: 'Kiểm tra hiệu ứng, chi phí và kết quả dự kiến.' },
        { title: 'Lên kế hoạch làm việc', text: 'Hướng dẫn này không gửi giao dịch.' },
      ] },
    },
  },
  id: {
    manifesto: {
      lead: 'Transparansi, bukan janji kosong.',
      paragraphs: ['Setiap tindakan dapat diperiksa. Kamu tahu apa yang dipakai, dibuat, dan diberikan kepada operator lain.', 'Ketentuan ditampilkan sebelum kamu menandatangani transaksi. Bukan sesudahnya.', 'Manusialah yang menjaga jaringan tetap hidup. Reputasi, kerja sama, dan perdagangan yang adil menghidupkan laboratorium ini.'],
      heading: 'Empat landasan', principles: [
        { title: 'Dapat diverifikasi', text: 'Ketentuan dan catatan di blockchain datang lebih dulu; kepercayaan pada hasil menyusul. Hash komitmen terlihat sebelum pengungkapan: yang kamu periksa adalah catatan, bukan sekadar kata-kata.' },
        { title: 'Keputusan sadar', text: 'Kamu melihat biaya, ongkos transaksi, dan izin sebelum menandatangani. Gim tidak menyembunyikan harga di balik tombol: setiap transaksi harus sejelas tagihan.' },
        { title: 'Keahlian', text: 'Proses berkarya lebih penting daripada janji hadiah mudah. Model lahir dari sampel, energi, dan satu siklus. Kami tidak menjual jalan pintas untuk melewati pekerjaan.' },
        { title: 'Komunitas', text: 'Sepakati tugas dan tunaikan bagianmu. Di NeuroForge, reputasi adalah ingatan akan janji yang ditepati, bukan bingkai berwarna pada profil.' },
      ], closing: 'Kami tidak menjanjikan penghasilan. Kami mengajakmu mengasah keahlian: tempat ini hidup selama kamu bisa memahami aturannya dan meninggalkan sesuatu yang berguna.',
    },
    weather: {
      lead: 'Empat kondisi, satu jaringan yang tangguh.',
      paragraphs: ['Padam: stasiun jaringan berhenti berproduksi. 0 unit per jam.', 'Normal: operasi stabil dengan 5 unit per jam.', 'Lonjakan: beban lebih tinggi dari biasanya, 15 unit per jam.', 'Puncak: beban tertinggi, 20 unit per jam. Giliran paling produktif.'],
      heading: 'Empat kondisi jaringan', demoLegend: 'Coba tampilan kondisi jaringan',
      states: { drought: 'Padam', sun: 'Normal', rain: 'Lonjakan', festival: 'Puncak' },
      statePrefix: 'Ditampilkan: ', stateSuffix: ' — hanya contoh; jaringan menerbitkan kondisinya sendiri.',
      caution: 'Demo ini hanya mengubah gambar di halaman. Efek sebenarnya ada dalam gim dan dapat berubah mengikuti penyeimbangan.',
      steps: { heading: 'Beban jaringan · langkah demi langkah', items: [
        { title: 'Periksa kondisi saat ini', text: 'Gunakan kondisi langsung yang ditampilkan dalam gim.' },
        { title: 'Baca efeknya', text: 'Periksa efek, biaya, dan hasil yang diharapkan.' },
        { title: 'Rencanakan pekerjaanmu', text: 'Panduan ini tidak mengirim transaksi.' },
      ] },
    },
  },
  fil: {
    manifesto: {
      lead: 'Kalinawan, hindi hungkag na pangako.',
      paragraphs: ['Maaaring suriin ang bawat gawain. Makikita mo ang ginastos, nilikha, at ipinasa mo sa ibang operator.', 'Malinaw ang mga kondisyon bago ka pumirma sa transaksiyon. Hindi pagkatapos.', 'Mga tao ang nagpapanatiling buhay sa network. Reputasyon, pagtutulungan, at patas na kalakalan ang nagbibigay-buhay sa laboratoryo.'],
      heading: 'Apat na pundasyon', principles: [
        { title: 'Nabeberipika', text: 'Nauuna ang mga kondisyon at tala sa blockchain; sumusunod ang tiwala sa resulta. Nakikita ang hash ng pangako bago ibunyag: ang tala ang sinusuri mo, hindi ang salita lamang.' },
        { title: 'Maingat na pagpapasya', text: 'Nakikita mo ang gastos, bayarin, at pahintulot bago pumirma. Hindi itinatago ng laro ang presyo sa likod ng pindutan: dapat malinaw ang bawat transaksiyon na parang resibo.' },
        { title: 'Husay sa paggawa', text: 'Mas mahalaga ang proseso kaysa pangako ng madaling gantimpala. Nagmumula ang modelo sa sample, enerhiya, at isang siklo. Hindi kami nagbebenta ng paraan para laktawan ang trabaho.' },
        { title: 'Komunidad', text: 'Magkasundo sa gawain at tuparin ang bahagi mo. Sa NeuroForge, ang reputasyon ay alaala ng mga pangakong natupad, hindi makulay na gilid ng profile.' },
      ], closing: 'Hindi kami nangangako ng kita. Inaanyayahan ka naming hasain ang iyong kakayahan: nabubuhay ang lugar na ito habang nauunawaan mo ang mga tuntunin at may naiiwan kang kapaki-pakinabang.',
    },
    weather: {
      lead: 'Apat na kondisyon, isang matatag na network.',
      paragraphs: ['Walang suplay: humihinto ang istasyon ng network. 0 yunit kada oras.', 'Normal: tuloy-tuloy na operasyon, 5 yunit kada oras.', 'Pagtaas: mas mabigat ang pasan kaysa karaniwan, 15 yunit kada oras.', 'Sukdulan: pinakamabigat na pasan, 20 yunit kada oras. Ang pinakamasaganang turno.'],
      heading: 'Apat na kondisyon ng network', demoLegend: 'Subukan ang tanawin ng network',
      states: { drought: 'Walang suplay', sun: 'Normal', rain: 'Pagtaas', festival: 'Sukdulan' },
      statePrefix: 'Ipinapakita: ', stateSuffix: ' — halimbawa lamang; ang network ang naglalathala ng totoong kondisyon.',
      caution: 'Larawan lang sa pahinang ito ang binabago ng demo. Nasa laro ang totoong mga epekto at maaari silang magbago kasabay ng balanse.',
      steps: { heading: 'Pasanin ng network · bawat hakbang', items: [
        { title: 'Suriin ang kasalukuyang kondisyon', text: 'Gamitin ang aktuwal na kondisyon sa laro.' },
        { title: 'Basahin ang mga epekto', text: 'Suriin ang epekto, gastos, at inaasahang resulta.' },
        { title: 'Planuhin ang trabaho', text: 'Hindi nagpapadala ng transaksiyon ang gabay na ito.' },
      ] },
    },
  },
};
