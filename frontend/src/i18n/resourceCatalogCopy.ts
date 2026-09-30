import type { Language } from './translations';
import type { ResourceCategory } from '../site/content/schema';

type Copy = {
  resources: string; categories: string; search: string; category: string; all: string; found: string; live: string; soon: string;
  labels: Record<ResourceCategory, string>;
  /** Короткое пояснение отдела: зачем этот ряд ресурсов в цепочке. */
  notes: Record<ResourceCategory, string>;
  /** Счётчик показанного: «Показаны все 27 ресурсов» / «Показано 8 из 27». */
  showing: (shown: number, total: number) => string;
  recipeMakes: (count: number) => string;
  recipeUses: (count: number) => string;
  linkedLabel: string;
  groupNote: string;
};
export const resourceCatalogCopy: Record<Language, Copy> = {
  ru: {
    resources: 'ресурсов', categories: 'категорий: от базовых материалов до гостевых токенов.', search: 'Поиск', category: 'Категория',
    all: 'Все', found: 'Найдено', live: 'Описано в спецификации', soon: 'Запланировано',
    labels: {  base: 'Базовые', chain: 'Модельная цепочка', material: 'Материалы', rare: 'Ядра и чипы', consumable: 'Флюиды', token: 'Токены', collab: 'Коллаборации', social: 'Особые'  },
    notes: {
      base: 'Материалы, с которых начинается почти любая операция: их добывают, тратят и закладывают в сборку.',
      chain: 'Производственная цепочка образца: от Neuron до готовой Model. Каждое звено ждёт предыдущее.',
      material: 'Промежуточные материалы, которые собираются из ядер и кварца и уходят в рецепты.',
      rare: 'Ядра, кварц и чипы: редкий ряд, где начинаются флюиды и продвинутые рецепты.',
      consumable: 'Флюиды — результат цветных цепочек. Ими закрываются рецепты продвинутого уровня.',
      token: 'Токены событий и награды вне базовой экономики.',
      collab: 'Совместные материалы: появляются, когда лаборатория работает с партнёрской программой.',
      social: 'Особые ресурсы для событий и особых операций.',
    },
    showing: (shown, total) => shown === total ? `Показаны все {total}`.replace('{total}', String(total)) : `Показано {shown} из {total}`.replace('{shown}', String(shown)).replace('{total}', String(total)),
    recipeMakes: (count) => `Собирается по рецептам: {count}`.replace('{count}', String(count)),
    recipeUses: (count) => `Расходуется в рецептах: {count}`.replace('{count}', String(count)),
    linkedLabel: 'Связанные',
    groupNote: 'Отдел показывает, как ресурс связан с остальными. Наличие и баланс проверяй в кошельке.',
  },
  en: {
    resources: 'resources', categories: 'categories: from base materials to event tokens.', search: 'Search', category: 'Category',
    all: 'All', found: 'Found', live: 'Documented in the specification', soon: 'Planned',
    labels: {  base: 'Base', chain: 'Model chain', material: 'Materials', rare: 'Cores & chips', consumable: 'Fluids', token: 'Tokens', collab: 'Collaborations', social: 'Special'  },
    notes: {
      base: 'The materials almost every operation starts with: mined, spent and built into crafting.',
      chain: 'The sample production chain: from Neuron to a finished Model. Each link waits for the previous one.',
      material: 'Intermediate materials assembled from cores and quartz and fed into recipes.',
      rare: 'Cores, quartz and chips: the rare row where fluids and advanced recipes begin.',
      consumable: 'Fluids are the result of the coloured chains. They close the advanced recipes.',
      token: 'Event tokens and rewards outside the base economy.',
      collab: 'Shared materials that appear when the laboratory works with a partner program.',
      social: 'Special resources for events and unusual operations.',
    },
    showing: (shown, total) => shown === total ? `Showing all {total}`.replace('{total}', String(total)) : `Showing {shown} of {total}`.replace('{shown}', String(shown)).replace('{total}', String(total)),
    recipeMakes: (count) => `Produced by recipes: {count}`.replace('{count}', String(count)),
    recipeUses: (count) => `Consumed by recipes: {count}`.replace('{count}', String(count)),
    linkedLabel: 'Related',
    groupNote: 'The department shows how a resource links to the others. Check ownership and balance in your wallet.',
  },
  pt: {
    resources: 'recursos', categories: 'categorias: de materiais básicos a tokens de eventos.', search: 'Buscar', category: 'Categoria',
    all: 'Todas', found: 'Encontrados', live: 'Descrito na especificação', soon: 'Planejado',
    labels: {  base: 'Básicos', chain: 'Cadeia de produção', material: 'Materiais', rare: 'Raros', consumable: 'Consumíveis', token: 'Tokens', collab: 'Colaborativos', social: 'Sociais'  },
    notes: {
      base: 'Os materiais com que quase toda operação começa: extraídos, gastos e usados na criação.',
      chain: 'A cadeia de produção da amostra: do Neuron ao Model pronto. Cada elo espera o anterior.',
      material: 'Materiais intermédios montados a partir de núcleos e quartzo e enviados para as receitas.',
      rare: 'Núcleos, quartzo e chips: a fila rara onde começam os fluidos e as receitas avançadas.',
      consumable: 'Os fluidos são o resultado das cadeias coloridas. Fecham as receitas avançadas.',
      token: 'Tokens de eventos e recompensas fora da economia base.',
      collab: 'Materiais conjuntos: surgem quando o laboratório trabalha com um programa parceiro.',
      social: 'Recursos especiais para eventos e operações invulgares.',
    },
    showing: (shown, total) => shown === total ? `Mostrando todos os {total}`.replace('{total}', String(total)) : `Mostrando {shown} de {total}`.replace('{shown}', String(shown)).replace('{total}', String(total)),
    recipeMakes: (count) => `Criado por receitas: {count}`.replace('{count}', String(count)),
    recipeUses: (count) => `Consumido por receitas: {count}`.replace('{count}', String(count)),
    linkedLabel: 'Relacionados',
    groupNote: 'A secção mostra como o recurso se liga aos outros. Confere a posse e o saldo na carteira.',
  },
  es: {
    resources: 'recursos', categories: 'categorías: desde materiales básicos hasta tokens de eventos.', search: 'Buscar', category: 'Categoría',
    all: 'Todas', found: 'Encontrados', live: 'Descrito en la especificación', soon: 'Previsto',
    labels: {  base: 'Básicos', chain: 'Cadena de producción', material: 'Materiales', rare: 'Raros', consumable: 'Consumibles', token: 'Tokens', collab: 'Colaborativos', social: 'Sociales'  },
    notes: {
      base: 'Los materiales con los que empieza casi cualquier operación: se extraen, se gastan y entran en la fabricación.',
      chain: 'La cadena de producción de la muestra: de Neuron a Model terminado. Cada eslabón espera al anterior.',
      material: 'Materiales intermedios montados con núcleos y cuarzo que entran en las recetas.',
      rare: 'Núcleos, cuarzo y chips: la fila rara donde empiezan los fluidos y las recetas avanzadas.',
      consumable: 'Los fluidos son el resultado de las cadenas de color. Cierran las recetas avanzadas.',
      token: 'Tokens de eventos y recompensas fuera de la economía base.',
      collab: 'Materiales conjuntos: aparecen cuando el laboratorio trabaja con un programa asociado.',
      social: 'Recursos especiales para eventos y operaciones poco comunes.',
    },
    showing: (shown, total) => shown === total ? `Se muestran los {total}`.replace('{total}', String(total)) : `Se muestran {shown} de {total}`.replace('{shown}', String(shown)).replace('{total}', String(total)),
    recipeMakes: (count) => `Creado por recetas: {count}`.replace('{count}', String(count)),
    recipeUses: (count) => `Consumido por recetas: {count}`.replace('{count}', String(count)),
    linkedLabel: 'Relacionados',
    groupNote: 'La sección muestra cómo se une el recurso con los demás. Comprueba la propiedad y el saldo en la cartera.',
  },
  vi: {
    resources: 'tài nguyên', categories: 'nhóm: từ vật liệu cơ bản đến token sự kiện.', search: 'Tìm kiếm', category: 'Nhóm',
    all: 'Tất cả', found: 'Tìm thấy', live: 'Có trong đặc tả', soon: 'Dự kiến',
    labels: {  base: 'Cơ bản', chain: 'Chuỗi sản xuất', material: 'Vật liệu', rare: 'Hiếm', consumable: 'Vật phẩm tiêu hao', token: 'Token', collab: 'Hợp tác', social: 'Cộng đồng'  },
    notes: {
      base: 'Vật liệu mở đầu cho hầu hết thao tác: được khai thác, tiêu hao và đưa vào chế tạo.',
      chain: 'Dây chuyền sản xuất mẫu: từ Neuron đến Model hoàn chỉnh. Mỗi mắt xích chờ mắt xích trước.',
      material: 'Vật liệu trung gian ghép từ lõi và thạch anh rồi đi vào công thức.',
      rare: 'Lõi, thạch anh và chip: hàng hiếm, nơi bắt đầu dung dịch và công thức cao cấp.',
      consumable: 'Dung dịch là kết quả của các chuỗi màu. Chúng khép lại công thức cao cấp.',
      token: 'Token sự kiện và phần thưởng ngoài nền kinh tế cơ bản.',
      collab: 'Vật liệu chung: xuất hiện khi phòng thí nghiệm làm việc cùng chương trình đối tác.',
      social: 'Tài nguyên đặc biệt cho sự kiện và thao tác hiếm.',
    },
    showing: (shown, total) => shown === total ? `Đang hiện tất cả {total}`.replace('{total}', String(total)) : `Đang hiện {shown} trong {total}`.replace('{shown}', String(shown)).replace('{total}', String(total)),
    recipeMakes: (count) => `Tạo bởi công thức: {count}`.replace('{count}', String(count)),
    recipeUses: (count) => `Tiêu thụ trong công thức: {count}`.replace('{count}', String(count)),
    linkedLabel: 'Liên quan',
    groupNote: 'Mục này cho thấy tài nguyên liên kết với những tài nguyên khác thế nào. Hãy kiểm tra quyền sở hữu và số dư trong ví.',
  },
  id: {
    resources: 'sumber daya', categories: 'kategori: dari bahan dasar hingga token acara.', search: 'Cari', category: 'Kategori',
    all: 'Semua', found: 'Ditemukan', live: 'Tercantum dalam spesifikasi', soon: 'Direncanakan',
    labels: {  base: 'Dasar', chain: 'Rangkaian produksi', material: 'Bahan', rare: 'Langka', consumable: 'Sekali pakai', token: 'Token', collab: 'Kolaborasi', social: 'Sosial'  },
    notes: {
      base: 'Bahan yang memulai hampir semua tindakan: ditambang, dipakai, dan masuk ke rakitan.',
      chain: 'Rangkaian produksi sampel: dari Neuron sampai Model jadi. Tiap mata rantai menunggu yang sebelumnya.',
      material: 'Bahan antara yang dirakit dari inti dan kuarsa lalu masuk ke resep.',
      rare: 'Inti, kuarsa, dan chip: baris langka tempat cairan dan resep lanjutan dimulai.',
      consumable: 'Cairan adalah hasil rangkaian berwarna. Mereka menutup resep lanjutan.',
      token: 'Token acara dan hadiah di luar ekonomi dasar.',
      collab: 'Bahan bersama: muncul saat laboratorium bekerja dengan program mitra.',
      social: 'Sumber daya khusus untuk acara dan tindakan tak biasa.',
    },
    showing: (shown, total) => shown === total ? `Menampilkan semua {total}`.replace('{total}', String(total)) : `Menampilkan {shown} dari {total}`.replace('{shown}', String(shown)).replace('{total}', String(total)),
    recipeMakes: (count) => `Dibuat oleh resep: {count}`.replace('{count}', String(count)),
    recipeUses: (count) => `Dipakai oleh resep: {count}`.replace('{count}', String(count)),
    linkedLabel: 'Terkait',
    groupNote: 'Bagian ini menunjukkan kaitan sumber daya dengan yang lain. Periksa kepemilikan dan saldo di dompetmu.',
  },
  fil: {
    resources: 'yaman', categories: 'kategorya: mula pangunahing materyales hanggang token ng event.', search: 'Maghanap', category: 'Kategorya',
    all: 'Lahat', found: 'Natagpuan', live: 'Nasa espesipikasyon', soon: 'Nakaplano',
    labels: {  base: 'Pangunahin', chain: 'Daloy ng paggawa', material: 'Materyales', rare: 'Bihira', consumable: 'Nagagamit', token: 'Token', collab: 'Sama-sama', social: 'Panlipunan'  },
    notes: {
      base: 'Mga materyales na pinagsisimulan ng halos lahat ng aksiyon: hinahango, ginagastos, at isinasama sa paggawa.',
      chain: 'Ang daloy ng paggawa: mula Neuron hanggang Model na tapos. Hinihintay ng bawat kawing ang nauna.',
      material: 'Mga materyales na binuo mula sa core at quartz at ipinapasok sa mga resipe.',
      rare: 'Mga core, quartz, at chip: ang bihirang hanay kung saan nagsisimula ang fluid at matataas na resipe.',
      consumable: 'Ang mga fluid ay bunga ng mga makukulay na daloy. Isinasara nila ang matataas na resipe.',
      token: 'Mga token ng event at gantimpala sa labas ng pangunahing ekonomiya.',
      collab: 'Mga pinagsamang materyales: lumilitaw kapag kasama ng programa ng katuwang ang laboratoryo.',
      social: 'Mga espesyal na yaman para sa event at pambihirang aksiyon.',
    },
    showing: (shown, total) => shown === total ? `Ipinapakita ang lahat ng {total}`.replace('{total}', String(total)) : `Ipinapakita ang {shown} sa {total}`.replace('{shown}', String(shown)).replace('{total}', String(total)),
    recipeMakes: (count) => `Ginawa ng resipe: {count}`.replace('{count}', String(count)),
    recipeUses: (count) => `Ginagamit ng resipe: {count}`.replace('{count}', String(count)),
    linkedLabel: 'Kaugnay',
    groupNote: 'Ipinapakita ng seksyon kung paano nauugnay ang yaman sa iba. Suriin ang pagmamay-ari at balanse sa wallet.',
  },
};
