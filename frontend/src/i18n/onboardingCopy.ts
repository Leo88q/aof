import type { Language } from './translations';

type OnboardingStep = { text: string; action: string };
type OnboardingCopy = { speaker: string; skip: string; progress: (current: number, total: number) => string; steps: readonly OnboardingStep[] };

const make = (speaker: string, skip: string, progressLabel: string, steps: readonly OnboardingStep[]): OnboardingCopy => ({
  speaker, skip, progress: (current, total) => `${progressLabel} ${current}/${total}`, steps,
});

// The first-run dialogue is available before the laboratory is unlocked. It
// deliberately describes gameplay without implying that a click buys anything.
export const onboardingCopy: Record<Language, OnboardingCopy> = {
  ru: make('Архивариус', 'Пропустить', 'Шаг', [
    { text: 'Здравствуй, оператор! Я — Архивариус, хранитель этой нейро-лаборатории. Системы долго спали, но ядро помнит всё.', action: 'Начать' },
    { text: 'Сначала собери материалы. Данные и другие компоненты пригодятся для первых циклов.', action: 'Узнать о ресурсах' },
    { text: 'Инструменты открывают новые задачи: резчик добывает схемы, экстрактор — кремний, сборщик данных — датасеты. Следи за прочностью.', action: 'Узнать об инструментах' },
    { text: 'На рынке цены меняются. Перед покупкой проверь стоимость и комиссию; нагрузка сети влияет на работу станции.', action: 'Узнать о рынке' },
    { text: 'Теперь за дело. Выращивай образцы, обучай модели и проверяй условия перед подписью. Я буду рядом.', action: 'Войти в лабораторию' },
  ]),
  en: make('The Archivist', 'Skip introduction', 'Step', [
    { text: 'Welcome, operator. I am the Archivist, keeper of this neural laboratory. Its systems have slept for ages, but the core remembers.', action: 'Begin' },
    { text: 'First, gather materials. Data and other components will help you run your first cycles.', action: 'Explore resources' },
    { text: 'Tools open up new tasks: the cutter mines circuits, the extractor mines silicon, and the harvester gathers datasets. Watch their durability.', action: 'Explore tools' },
    { text: 'Market prices change. Check the price and fee before buying; network load affects the station’s output.', action: 'Explore the market' },
    { text: 'Now get to work. Grow samples, train models, and read the terms before you sign. I will be here.', action: 'Enter the laboratory' },
  ]),
  pt: make('O Arquivista', 'Pular introdução', 'Etapa', [
    { text: 'Boas-vindas, operador! Sou o Arquivista, guardião deste laboratório neural. Os sistemas dormiram por muito tempo, mas o núcleo se lembra de tudo.', action: 'Começar' },
    { text: 'Primeiro, reúna materiais. Dados e outros componentes vão ajudar nos primeiros ciclos.', action: 'Conhecer os recursos' },
    { text: 'As ferramentas abrem novas tarefas: o cortador extrai circuitos, o extrator obtém silício e o coletor reúne datasets. Fique de olho na durabilidade.', action: 'Conhecer as ferramentas' },
    { text: 'Os preços do mercado mudam. Confira preço e taxa antes de comprar; a carga da rede afeta a produção da estação.', action: 'Conhecer o mercado' },
    { text: 'Agora, mãos à obra. Cultive amostras, treine modelos e leia as condições antes de assinar. Estarei por aqui.', action: 'Entrar no laboratório' },
  ]),
  es: make('El Archivista', 'Saltar introducción', 'Paso', [
    { text: '¡Bienvenido, operador! Soy el Archivista, guardián de este laboratorio neuronal. Sus sistemas llevan mucho tiempo dormidos, pero el núcleo lo recuerda todo.', action: 'Empezar' },
    { text: 'Primero, reúne materiales. Los datos y otros componentes te ayudarán con los primeros ciclos.', action: 'Conocer los recursos' },
    { text: 'Las herramientas abren nuevas tareas: el cortador extrae circuitos, el extractor obtiene silicio y el recolector reúne conjuntos de datos. Vigila su durabilidad.', action: 'Conocer las herramientas' },
    { text: 'Los precios del mercado cambian. Revisa precio y comisión antes de comprar; la carga de la red afecta a la producción de la estación.', action: 'Conocer el mercado' },
    { text: 'Ahora, manos a la obra. Cultiva muestras, entrena modelos y lee las condiciones antes de firmar. Aquí estaré.', action: 'Entrar al laboratorio' },
  ]),
  vi: make('Người Lưu Trữ', 'Bỏ qua phần giới thiệu', 'Bước', [
    { text: 'Chào mừng, người vận hành! Tôi là Người Lưu Trữ, trông coi phòng thí nghiệm thần kinh này. Hệ thống đã ngủ quên từ lâu, nhưng lõi vẫn nhớ mọi thứ.', action: 'Bắt đầu' },
    { text: 'Trước hết, hãy thu thập vật liệu. Dữ liệu và các thành phần khác sẽ giúp bạn thực hiện những chu kỳ đầu tiên.', action: 'Tìm hiểu tài nguyên' },
    { text: 'Công cụ mở ra việc mới: máy cắt khai thác mạch, máy chiết lấy silic, máy thu thập gom bộ dữ liệu. Hãy theo dõi độ bền.', action: 'Tìm hiểu công cụ' },
    { text: 'Giá trên thị trường thay đổi. Kiểm tra giá và phí trước khi mua; tải mạng ảnh hưởng đến sản lượng trạm.', action: 'Tìm hiểu thị trường' },
    { text: 'Giờ hãy bắt tay vào việc. Nuôi cấy mẫu, huấn luyện mô hình và đọc điều kiện trước khi ký. Tôi sẽ ở đây.', action: 'Vào phòng thí nghiệm' },
  ]),
  id: make('Sang Arsiparis', 'Lewati pengantar', 'Langkah', [
    { text: 'Selamat datang, operator! Aku Sang Arsiparis, penjaga laboratorium saraf ini. Sistemnya telah lama tertidur, tetapi intinya masih mengingat segalanya.', action: 'Mulai' },
    { text: 'Pertama, kumpulkan bahan. Data dan komponen lain akan membantu siklus-siklus awalmu.', action: 'Kenali sumber daya' },
    { text: 'Peralatan membuka tugas baru: pemotong menambang sirkuit, ekstraktor mengambil silikon, dan pengumpul menghimpun kumpulan data. Perhatikan daya tahannya.', action: 'Kenali peralatan' },
    { text: 'Harga pasar berubah. Periksa harga dan biaya sebelum membeli; beban jaringan memengaruhi hasil stasiun.', action: 'Kenali pasar' },
    { text: 'Sekarang saatnya bekerja. Kembangkan sampel, latih model, dan baca ketentuan sebelum menandatangani. Aku akan mendampingi.', action: 'Masuk ke laboratorium' },
  ]),
  fil: make('Ang Tagapangalaga ng Tala', 'Laktawan ang panimula', 'Hakbang', [
    { text: 'Maligayang pagdating, operator! Ako ang Tagapangalaga ng Tala sa laboratoryong ito. Matagal nang natutulog ang mga sistema, ngunit naaalala pa ng ubod ang lahat.', action: 'Magsimula' },
    { text: 'Una, mag-ipon ng materyales. Makakatulong ang datos at iba pang sangkap sa mga unang siklo mo.', action: 'Kilalanin ang mga yaman' },
    { text: 'Nagbubukas ng bagong gawain ang mga kagamitan: ang pamutol ay kumukuha ng sirkito, ang pangkuha ay kumukuha ng silikon, at ang pang-ani ay nagtitipon ng dataset. Bantayan ang tibay.', action: 'Kilalanin ang kagamitan' },
    { text: 'Nagbabago ang presyo sa pamilihan. Suriin ang presyo at bayarin bago bumili; naaapektuhan ng pasan ng network ang produksyon ng istasyon.', action: 'Kilalanin ang pamilihan' },
    { text: 'Ngayon, simulan ang gawain. Magpalago ng sample, sanayin ang mga modelo, at basahin ang kondisyon bago pumirma. Nandito lang ako.', action: 'Pumasok sa laboratoryo' },
  ]),
};
