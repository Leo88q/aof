import type { Language } from "./translations";
import type { ToolLineKey } from "../lib/chainMoments";

type Copy = {
  weatherUnread: string;
  weatherLine: (today: string, todayRate: number, tomorrow: string, tomorrowRate: number) => string;
  drinkOrSeal: string;
  flaskLeavesSeal: (gain: number) => string;
  capsuleOnly: string;
  toolLine: Record<ToolLineKey, string>;
  unknownLine: string;
  seederBirth: string;
  fuseTitle: string;
  fuseNeed: string;
  fuseType: string;
  fuseAction: string;
  fuseBusy: string;
  explorationBet: string;
  clocksUnread: string;
  energyLine: (amount: number, cap: number) => string;
  energyMissing: string;
  signalReady: (when: string) => string;
  signalIdle: string;
  modelReady: (when: string) => string;
  modelIdle: string;
  soulSupply: (cores: number) => string;
  soulUnread: string;
  marketFee: string;
  durabilityNote: string;
};

export const chainMomentCopy: Record<Language, Copy> = {
  ru: {
    weatherUnread: "Погода дня не прочитана. Это не обычный день и не ноль силы.",
    weatherLine: (today, todayRate, tomorrow, tomorrowRate) =>
      `Сегодня станция: ${today}, ${todayRate} силы в час. Завтра: ${tomorrow}, ${tomorrowRate}. Сила нужна на сборку инструмента и обучение модели.`,
    drinkOrSeal: "Выпить флюид — ускорить лабораторию. Оставить — донести до печати. Квантовый флюид заполняет бак целиком.",
    flaskLeavesSeal: (gain) => `+${gain} энергии. После этого флюида нет в наборе печати.`,
    capsuleOnly: "Капсула открывает линию, не картинку. Из неё выходят только резак, экстрактор и сборщик данных. Легендарного нет. Сеятель и передатчик сюда не падают.",
    toolLine: {
      plasma_cutter: "Линия схемы: крио-флюид, био-флюид, квантовый флюид, янтарный сосуд и вычисления.",
      silicon_extractor: "Линия кремния: вольт-флюид. Без неё печать не закрывается.",
      data_harvester: "Линия набора данных: данные, разум, крио, нано, янтарь и вычисления.",
      quantum_transmitter: "Та же линия, что у сборщика данных. Из капсулы не выходит — только сборка или сплав.",
      neural_seeder: "Линия нейрона: био-флюид, нано-флюид, квантовый флюид и модель. Из капсулы не выходит.",
    },
    unknownLine: "Тип инструмента не из пяти линий. Какая печать от него открывается, здесь не называется.",
    seederBirth: "Сеятель рождается здесь: два инструмента одной редкости сгорают в следующий ранг выбранного типа. Капсула его не даёт, а без него нет нейрона.",
    fuseTitle: "Сплав в сеятель",
    fuseNeed: "Нужны два инструмента одной редкости, не легендарные. Сгорает набор мастерской следующей редкости, и газ-бак платит 0.06 SOL.",
    fuseType: "Тип, который получится",
    fuseAction: "Сжечь два и собрать",
    fuseBusy: "Собираем сплав…",
    explorationBet: "Поход сжигает 75 данных, 35 схем, 35 кремния и 50 наборов данных. Это сырьё крио, нано, янтаря и разума. Удача возвращает схемы и кремний сразу обоим. Неудача не возвращает ничего. Раскрытие может закрыть кто угодно.",
    clocksUnread: "Часы партии не прочитаны. Это не «готово» и не ноль.",
    energyLine: (amount, cap) => `Энергия ${amount} / ${cap}. Одна единица за 30 минут, либо одна единица данных, либо флюид.`,
    energyMissing: "Счёт энергии не прочитан. Это не пустой бак.",
    signalReady: (when) => `Сигнал будет готов: ${when}.`,
    signalIdle: "Сигнал сейчас не обрабатывается.",
    modelReady: (when) => `Модель будет готова: ${when}.`,
    modelIdle: "Модель сейчас не обучается.",
    soulSupply: (cores) => `Ядер души в обращении: ${cores}. Печать выпускает одно и сама его не сжигает. Это не личный счётчик.`,
    soulUnread: "Предложение ядра души не прочитано. Это не ноль.",
    marketFee: "При расчёте сделки казна забирает комиссию: листинг и оффер 8%, книга заявок 2% с мейкера и 6% с тейкера, заказ на сборку 8% надбавки, аукцион и аренда 10%. Выставление, снятие и ставка, которая не выиграла, комиссию не берут.",
    durabilityNote: "Прочность из кузницы входит в вычитание при сборе. Скорость сокращает ожидание той же сессии, награда считается по заказанным часам. Час всё равно остаётся.",
  },
  en: {
    weatherUnread: "Today's weather was not read. That is not a normal day and not zero power.",
    weatherLine: (today, todayRate, tomorrow, tomorrowRate) =>
      `Station today: ${today}, ${todayRate} power per hour. Tomorrow: ${tomorrow}, ${tomorrowRate}. Power is spent crafting a tool and training a model.`,
    drinkOrSeal: "Drink a fluid to rush the laboratory. Keep it to reach the seal. Quantum fluid fills the tank.",
    flaskLeavesSeal: (gain) => `+${gain} energy. That fluid is then missing from the seal.`,
    capsuleOnly: "A capsule opens a line, not a picture. It drops only the cutter, the extractor and the data harvester. Legendary never drops. The seeder and the transmitter never drop here.",
    toolLine: {
      plasma_cutter: "Circuit line: cryo fluid, bio fluid, quantum fluid, the amber vessel and compute.",
      silicon_extractor: "Silicon line: volt fluid. The seal does not close without it.",
      data_harvester: "Dataset line: data, mind, cryo, nano, amber and compute.",
      quantum_transmitter: "The same line as the data harvester. It never drops from a capsule — craft or fuse only.",
      neural_seeder: "Neuron line: bio fluid, nano fluid, quantum fluid and the model. It never drops from a capsule.",
    },
    unknownLine: "This tool type is not one of the five lines. This screen does not name a seal path for it.",
    seederBirth: "A seeder is born here: two tools of the same rarity burn into the next rarity of the type you choose. A capsule never gives one, and without it there is no neuron.",
    fuseTitle: "Fuse",
    fuseNeed: "Two tools of the same rarity are required, and neither may be legendary. The next rarity's workshop bundle is burned, and the gas tank pays 0.06 SOL.",
    fuseType: "Type to mint",
    fuseAction: "Burn both and forge",
    fuseBusy: "Assembling the fuse…",
    explorationBet: "A trip burns 75 data, 35 circuit, 35 silicon and 50 dataset. That is the raw material for cryo, nano, amber and mind. Success returns circuit and silicon together. Failure returns nothing. Anyone may settle the reveal.",
    clocksUnread: "The batch clock was not read. That is not ready, and it is not zero.",
    energyLine: (amount, cap) => `Energy ${amount} / ${cap}. One unit per 30 minutes, or one data, or a fluid.`,
    energyMissing: "The energy account was not read. That is not an empty tank.",
    signalReady: (when) => `Signal ready at: ${when}.`,
    signalIdle: "No signal is processing.",
    modelReady: (when) => `Model ready at: ${when}.`,
    modelIdle: "No model is training.",
    soulSupply: (cores) => `Soul cores in circulation: ${cores}. A seal mints one and does not burn it. This is not your personal counter.`,
    soulUnread: "Soul core supply was not read. That is not zero.",
    marketFee: "When a trade settles, the treasury takes the cut: listing and offer 8%, order book 2% maker and 6% taker, craft order 8% of the premium, auction and rental 10%. Listing, cancelling and a bid that does not win take no cut.",
    durabilityNote: "A forge durability level enters the subtraction at collection. Speed shortens the wait of that same session; the payout still follows the hours ordered. An hour still remains.",
  },
  pt: {
    weatherUnread: "O clima do dia não foi lido. Isso não é um dia normal nem potência zero.",
    weatherLine: (today, todayRate, tomorrow, tomorrowRate) =>
      `Estação hoje: ${today}, ${todayRate} de energia por hora. Amanhã: ${tomorrow}, ${tomorrowRate}. A energia entra na montagem da ferramenta e no treino do modelo.`,
    drinkOrSeal: "Beber um fluido acelera o laboratório. Guardá-lo chega ao selo. O fluido quântico enche o tanque.",
    flaskLeavesSeal: (gain) => `+${gain} de energia. Esse fluido sai do conjunto do selo.`,
    capsuleOnly: "A cápsula abre uma linha, não uma imagem. Só saem o cortador, o extrator e o coletor de dados. Lendário não sai. Semeador e transmissor não saem daqui.",
    toolLine: {
      plasma_cutter: "Linha do circuito: fluido criogênico, biofluido, fluido quântico, recipiente de âmbar e computação.",
      silicon_extractor: "Linha do silício: fluido elétrico. Sem ela o selo não fecha.",
      data_harvester: "Linha do conjunto de dados: dados, mente, crio, nano, âmbar e computação.",
      quantum_transmitter: "A mesma linha do coletor de dados. Não sai de cápsula — só montagem ou fusão.",
      neural_seeder: "Linha do neurônio: biofluido, nanofluido, fluido quântico e o modelo. Não sai de cápsula.",
    },
    unknownLine: "Este tipo não é uma das cinco linhas. Esta tela não nomeia um caminho de selo para ele.",
    seederBirth: "O semeador nasce aqui: duas ferramentas da mesma raridade queimam no próximo grau do tipo escolhido. A cápsula não o dá, e sem ele não há neurônio.",
    fuseTitle: "Fusão",
    fuseNeed: "São necessárias duas ferramentas da mesma raridade, nenhuma lendária. O conjunto da oficina da raridade seguinte queima, e o tanque de gás paga 0.06 SOL.",
    fuseType: "Tipo a emitir",
    fuseAction: "Queimar as duas e montar",
    fuseBusy: "Montando a fusão…",
    explorationBet: "A viagem queima 75 dados, 35 circuitos, 35 silício e 50 conjuntos de dados. É a matéria de crio, nano, âmbar e mente. O sucesso devolve circuito e silício juntos. A falha não devolve nada. Qualquer um pode fechar a revelação.",
    clocksUnread: "O relógio do lote não foi lido. Isso não é pronto e não é zero.",
    energyLine: (amount, cap) => `Energia ${amount} / ${cap}. Uma unidade a cada 30 minutos, ou um dado, ou um fluido.`,
    energyMissing: "A conta de energia não foi lida. Isso não é um tanque vazio.",
    signalReady: (when) => `Sinal pronto em: ${when}.`,
    signalIdle: "Nenhum sinal está em processamento.",
    modelReady: (when) => `Modelo pronto em: ${when}.`,
    modelIdle: "Nenhum modelo está em treino.",
    soulSupply: (cores) => `Núcleos da alma em circulação: ${cores}. O selo emite um e não o queima. Não é o seu contador pessoal.`,
    soulUnread: "A oferta do núcleo da alma não foi lida. Isso não é zero.",
    marketFee: "Quando a troca fecha, o tesouro fica com a taxa: anúncio e oferta 8%, livro 2% maker e 6% taker, encomenda de criação 8% do prêmio, leilão e aluguel 10%. Anunciar, cancelar e um lance que não ganha não pagam taxa.",
    durabilityNote: "A durabilidade da forja entra na subtração na coleta. A velocidade encurta a espera da mesma sessão; o pagamento segue as horas pedidas. Uma hora ainda fica.",
  },
  es: {
    weatherUnread: "No se leyó el clima del día. Eso no es un día normal ni potencia cero.",
    weatherLine: (today, todayRate, tomorrow, tomorrowRate) =>
      `Estación hoy: ${today}, ${todayRate} de energía por hora. Mañana: ${tomorrow}, ${tomorrowRate}. La energía se gasta al fabricar una herramienta y al entrenar el modelo.`,
    drinkOrSeal: "Beber un fluido acelera el laboratorio. Guardarlo llega al sello. El fluido cuántico llena el tanque.",
    flaskLeavesSeal: (gain) => `+${gain} de energía. Ese fluido sale del conjunto del sello.`,
    capsuleOnly: "La cápsula abre una línea, no una imagen. Solo salen el cortador, el extractor y el recolector de datos. Legendario no sale. Sembrador y transmisor no salen de aquí.",
    toolLine: {
      plasma_cutter: "Línea del circuito: fluido criogénico, biofluido, fluido cuántico, recipiente de ámbar y cómputo.",
      silicon_extractor: "Línea del silicio: fluido eléctrico. Sin ella el sello no cierra.",
      data_harvester: "Línea del conjunto de datos: datos, mente, crio, nano, ámbar y cómputo.",
      quantum_transmitter: "La misma línea que el recolector de datos. No sale de una cápsula: solo fabricación o fusión.",
      neural_seeder: "Línea de la neurona: biofluido, nanofluido, fluido cuántico y el modelo. No sale de una cápsula.",
    },
    unknownLine: "Este tipo no es una de las cinco líneas. Esta pantalla no nombra un camino de sello para él.",
    seederBirth: "El sembrador nace aquí: dos herramientas de la misma rareza se queman en el siguiente grado del tipo elegido. La cápsula no lo da, y sin él no hay neurona.",
    fuseTitle: "Fundir en un sembrador",
    fuseNeed: "Hacen falta dos herramientas de la misma rareza, ninguna legendaria. Se quema el lote del taller de la rareza siguiente, y el tanque de gas paga 0.06 SOL.",
    fuseType: "Tipo a emitir",
    fuseAction: "Quemar las dos y fabricar",
    fuseBusy: "Armando la fusión…",
    explorationBet: "El viaje quema 75 datos, 35 circuitos, 35 silicio y 50 conjuntos de datos. Es la materia de crio, nano, ámbar y mente. El éxito devuelve circuito y silicio juntos. El fallo no devuelve nada. Cualquiera puede cerrar la revelación.",
    clocksUnread: "No se leyó el reloj del lote. Eso no es listo y no es cero.",
    energyLine: (amount, cap) => `Energía ${amount} / ${cap}. Una unidad cada 30 minutos, o un dato, o un fluido.`,
    energyMissing: "No se leyó la cuenta de energía. Eso no es un tanque vacío.",
    signalReady: (when) => `Señal lista a las: ${when}.`,
    signalIdle: "No hay una señal en proceso.",
    modelReady: (when) => `Modelo listo a las: ${when}.`,
    modelIdle: "No hay un modelo en entrenamiento.",
    soulSupply: (cores) => `Núcleos del alma en circulación: ${cores}. El sello emite uno y no lo quema. No es tu contador personal.`,
    soulUnread: "No se leyó la oferta del núcleo del alma. Eso no es cero.",
    marketFee: "Cuando la operación se cierra, la tesorería se queda la comisión: anuncio y oferta 8%, libro 2% maker y 6% taker, encargo de fabricación 8% del sobreprecio, subasta y alquiler 10%. Publicar, cancelar y una puja que no gana no pagan comisión.",
    durabilityNote: "La durabilidad de la forja entra en la resta al recoger. La velocidad acorta la espera de la misma sesión; el pago sigue las horas pedidas. Una hora sigue quedando.",
  },
  vi: {
    weatherUnread: "Chưa đọc được thời tiết của ngày. Đó không phải ngày bình thường và cũng không phải công suất bằng không.",
    weatherLine: (today, todayRate, tomorrow, tomorrowRate) =>
      `Trạm hôm nay: ${today}, ${todayRate} năng lượng mỗi giờ. Ngày mai: ${tomorrow}, ${tomorrowRate}. Năng lượng dùng để chế công cụ và huấn luyện mô hình.`,
    drinkOrSeal: "Uống dung dịch để đẩy phòng thí nghiệm. Giữ lại để tới niêm phong. Dung dịch lượng tử làm đầy bình.",
    flaskLeavesSeal: (gain) => `+${gain} năng lượng. Dung dịch đó không còn trong bộ niêm phong.`,
    capsuleOnly: "Viên nang mở một tuyến, không phải một hình. Chỉ ra máy cắt, máy hút silic và máy thu dữ liệu. Không có hạng huyền thoại. Máy gieo và máy phát không rơi ở đây.",
    toolLine: {
      plasma_cutter: "Tuyến mạch: dung dịch lạnh, sinh học, lượng tử, bình hổ phách và tính toán.",
      silicon_extractor: "Tuyến silic: dung dịch điện. Không có nó thì không niêm được.",
      data_harvester: "Tuyến tập dữ liệu: dữ liệu, tâm trí, lạnh, nano, hổ phách và tính toán.",
      quantum_transmitter: "Cùng tuyến với máy thu dữ liệu. Không rơi từ viên nang — chỉ chế hoặc hợp.",
      neural_seeder: "Tuyến nơ-ron: dung dịch sinh học, nano, lượng tử và mô hình. Không rơi từ viên nang.",
    },
    unknownLine: "Loại này không thuộc năm tuyến. Màn hình không gọi tên đường niêm phong cho nó.",
    seederBirth: "Máy gieo sinh ra ở đây: hai công cụ cùng độ hiếm bị đốt thành bậc kế của loại bạn chọn. Viên nang không cho nó, và không có nó thì không có nơ-ron.",
    fuseTitle: "Hợp",
    fuseNeed: "Cần hai công cụ cùng độ hiếm, không cái nào là huyền thoại. Bộ xưởng của độ hiếm kế tiếp bị đốt, và bình gas trả 0.06 SOL.",
    fuseType: "Loại sẽ được đúc",
    fuseAction: "Đốt cả hai và chế",
    fuseBusy: "Đang hợp…",
    explorationBet: "Chuyến đi đốt 75 dữ liệu, 35 mạch, 35 silic và 50 tập dữ liệu. Đó là nguyên liệu của lạnh, nano, hổ phách và tâm trí. Thành công trả mạch và silic cùng lúc. Thất bại không trả gì. Ai cũng có thể đóng lần công bố.",
    clocksUnread: "Chưa đọc đồng hồ mẻ. Đó không phải là xong và không phải là không.",
    energyLine: (amount, cap) => `Năng lượng ${amount} / ${cap}. Một đơn vị mỗi 30 phút, hoặc một dữ liệu, hoặc một dung dịch.`,
    energyMissing: "Chưa đọc tài khoản năng lượng. Đó không phải bình rỗng.",
    signalReady: (when) => `Tín hiệu sẵn sàng lúc: ${when}.`,
    signalIdle: "Không có tín hiệu đang xử lý.",
    modelReady: (when) => `Mô hình sẵn sàng lúc: ${when}.`,
    modelIdle: "Không có mô hình đang huấn luyện.",
    soulSupply: (cores) => `Lõi linh hồn đang lưu hành: ${cores}. Niêm phong phát một lõi và không đốt nó. Đây không phải bộ đếm riêng của bạn.`,
    soulUnread: "Chưa đọc lượng lõi linh hồn. Đó không phải là không.",
    marketFee: "Khi giao dịch tất toán, kho quỹ lấy phí: niêm yết và đề nghị 8%, sổ lệnh 2% maker và 6% taker, đơn chế tạo 8% phần phụ trội, đấu giá và thuê 10%. Đăng, hủy và giá không thắng không bị tính phí.",
    durabilityNote: "Độ bền của lò rèn đi vào phép trừ khi thu. Tốc độ rút ngắn thời gian chờ của cùng phiên; phần thưởng vẫn theo số giờ đã chọn. Vẫn còn một giờ.",
  },
  id: {
    weatherUnread: "Cuaca hari ini tidak terbaca. Itu bukan hari biasa dan bukan daya nol.",
    weatherLine: (today, todayRate, tomorrow, tomorrowRate) =>
      `Stasiun hari ini: ${today}, ${todayRate} daya per jam. Besok: ${tomorrow}, ${tomorrowRate}. Daya dipakai untuk merakit peralatan dan melatih model.`,
    drinkOrSeal: "Minum cairan untuk mempercepat laboratorium. Simpan untuk sampai ke segel. Cairan kuantum mengisi tangki.",
    flaskLeavesSeal: (gain) => `+${gain} energi. Cairan itu lalu tidak ada di set segel.`,
    capsuleOnly: "Kapsul membuka jalur, bukan gambar. Yang keluar hanya pemotong, ekstraktor, dan pemanen data. Legendaris tidak keluar. Penyemai dan pemancar tidak keluar di sini.",
    toolLine: {
      plasma_cutter: "Jalur sirkuit: cairan kriogenik, bio, kuantum, wadah amber, dan komputasi.",
      silicon_extractor: "Jalur silikon: cairan volt. Tanpa jalur ini segel tidak tertutup.",
      data_harvester: "Jalur dataset: data, pikiran, krio, nano, amber, dan komputasi.",
      quantum_transmitter: "Jalur yang sama dengan pemanen data. Tidak keluar dari kapsul — hanya rakitan atau fusi.",
      neural_seeder: "Jalur neuron: cairan bio, nano, kuantum, dan model. Tidak keluar dari kapsul.",
    },
    unknownLine: "Jenis ini bukan salah satu dari lima jalur. Layar ini tidak menamai jalan segel untuknya.",
    seederBirth: "Penyemai lahir di sini: dua peralatan dengan kelangkaan sama terbakar menjadi tingkat berikutnya dari jenis yang dipilih. Kapsul tidak memberinya, dan tanpa dia tidak ada neuron.",
    fuseTitle: "Lelehkan menjadi penyemai",
    fuseNeed: "Perlu dua peralatan dengan kelangkaan sama, bukan legendaris. Bundel bengkel kelangkaan berikutnya terbakar, dan tangki gas membayar 0.06 SOL.",
    fuseType: "Jenis yang dicetak",
    fuseAction: "Bakar keduanya dan rakit",
    fuseBusy: "Menyusun fusi…",
    explorationBet: "Perjalanan membakar 75 data, 35 sirkuit, 35 silikon, dan 50 dataset. Itu bahan mentah krio, nano, amber, dan pikiran. Keberhasilan mengembalikan sirkuit dan silikon bersama. Kegagalan tidak mengembalikan apa pun. Siapa pun dapat menutup pengungkapan.",
    clocksUnread: "Jam batch tidak terbaca. Itu bukan siap dan bukan nol.",
    energyLine: (amount, cap) => `Energi ${amount} / ${cap}. Satu unit tiap 30 menit, atau satu data, atau satu cairan.`,
    energyMissing: "Akun energi tidak terbaca. Itu bukan tangki kosong.",
    signalReady: (when) => `Sinyal siap pada: ${when}.`,
    signalIdle: "Tidak ada sinyal yang diproses.",
    modelReady: (when) => `Model siap pada: ${when}.`,
    modelIdle: "Tidak ada model yang dilatih.",
    soulSupply: (cores) => `Inti jiwa yang beredar: ${cores}. Segel mencetak satu dan tidak membakarnya. Ini bukan penghitung pribadimu.`,
    soulUnread: "Pasokan inti jiwa tidak terbaca. Itu bukan nol.",
    marketFee: "Saat transaksi selesai, kas mengambil potongan: listing dan tawaran 8%, buku order 2% maker dan 6% taker, pesanan rakit 8% dari premi, lelang dan sewa 10%. Memasang, membatalkan, dan tawaran yang tidak menang tidak dipotong.",
    durabilityNote: "Daya tahan dari tungku masuk ke pengurangan saat panen. Kecepatan memendekkan tunggu sesi yang sama; bayaran tetap mengikuti jam yang dipesan. Satu jam tetap ada.",
  },
  fil: {
    weatherUnread: "Hindi nabasa ang panahon ng araw. Hindi iyon karaniwang araw at hindi zero na lakas.",
    weatherLine: (today, todayRate, tomorrow, tomorrowRate) =>
      `Istasyon ngayon: ${today}, ${todayRate} na lakas bawat oras. Bukas: ${tomorrow}, ${tomorrowRate}. Ginagamit ang lakas sa paggawa ng kagamitan at sa pagsasanay ng modelo.`,
    drinkOrSeal: "Inumin ang fluid para bilisan ang laboratoryo. Itago ito para umabot sa tatak. Pinupuno ng quantum fluid ang tangke.",
    flaskLeavesSeal: (gain) => `+${gain} na enerhiya. Wala na ang fluid na iyon sa set ng tatak.`,
    capsuleOnly: "Nagbubukas ang kapsula ng isang linya, hindi ng larawan. Cutter, extractor, at data harvester lang ang lumalabas. Walang legendary. Hindi lumalabas dito ang seeder at transmitter.",
    toolLine: {
      plasma_cutter: "Linya ng circuit: cryo fluid, bio fluid, quantum fluid, sisidlang amber, at compute.",
      silicon_extractor: "Linya ng silicon: volt fluid. Hindi nagtatapos ang tatak kung wala ito.",
      data_harvester: "Linya ng dataset: data, isip, cryo, nano, amber, at compute.",
      quantum_transmitter: "Kaparehong linya ng data harvester. Hindi lumalabas sa kapsula — gawa o fuse lang.",
      neural_seeder: "Linya ng neuron: bio fluid, nano fluid, quantum fluid, at modelo. Hindi lumalabas sa kapsula.",
    },
    unknownLine: "Hindi isa sa limang linya ang uring ito. Hindi pinangalanan ng screen na ito ang daan ng tatak para rito.",
    seederBirth: "Dito ipinapanganak ang seeder: dalawang kagamitan na magkapareho ang pambihira ang nasusunog tungo sa susunod na baitang ng piniling uri. Hindi ito ibinibigay ng kapsula, at wala itong neuron kung wala ito.",
    fuseTitle: "Fuse",
    fuseNeed: "Kailangan ang dalawang kagamitan na magkapareho ang pambihira, hindi legendary. Nasusunog ang bundle ng workshop ng susunod na pambihira, at ang gas tank ay nagbabayad ng 0.06 SOL.",
    fuseType: "Uring ilalabas",
    fuseAction: "Sunugin ang dalawa at gawin",
    fuseBusy: "Binubuo ang fuse…",
    explorationBet: "Nagsusunog ang biyahe ng 75 data, 35 circuit, 35 silicon, at 50 dataset. Iyan ang hilaw na sangkap ng cryo, nano, amber, at isip. Ang tagumpay ay nagbabalik ng circuit at silicon nang sabay. Ang pagkabigo ay walang ibinabalik. Sinuman ay maaaring magsara ng paghahayag.",
    clocksUnread: "Hindi nabasa ang orasan ng batch. Hindi iyon handa at hindi iyon zero.",
    energyLine: (amount, cap) => `Enerhiya ${amount} / ${cap}. Isang yunit bawat 30 minuto, o isang data, o isang fluid.`,
    energyMissing: "Hindi nabasa ang account ng enerhiya. Hindi iyon walang laman na tangke.",
    signalReady: (when) => `Handa ang signal sa: ${when}.`,
    signalIdle: "Walang sinyal na pinoproseso.",
    modelReady: (when) => `Handa ang modelo sa: ${when}.`,
    modelIdle: "Walang modelong sinasanay.",
    soulSupply: (cores) => `Mga soul core na umiikot: ${cores}. Naglalabas ang tatak ng isa at hindi ito sinusunog. Hindi ito ang personal mong bilang.`,
    soulUnread: "Hindi nabasa ang supply ng soul core. Hindi iyon zero.",
    marketFee: "Kapag natapos ang kalakalan, kinukuha ng kabang-yaman ang hiwa: listahan at alok 8%, order book 2% maker at 6% taker, craft order 8% ng premium, auction at renta 10%. Ang paglista, pagkansela, at taya na hindi nanalo ay walang hiwa.",
    durabilityNote: "Ang tibay mula sa forge ay pumapasok sa bawas sa pagkolekta. Pinaiikli ng bilis ang hintay ng parehong sesyon; ang bayad ay ayon pa rin sa oras na inorder. May natitira pang isang oras.",
  },
};
