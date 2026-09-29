import type { Language } from './translations';

type Copy = {
  gems: string; flasks: string; transformations: string; timed: string;
  ingredients: string; craft: string; crafting: string; balance: string;
  connect: string; loading: string; unavailable: string; insufficient: string;
  missingRecipe: string; missingRegistry: string; walletChanged: string;
  submitting: string; crafted: string; failed: string;
  elsewhereTitle: string; elsewhere: string; lab: string; processing: string;
  training: string; station: string; cultivation: string;
};
export const recipeWorkshopCopy: Record<Language, Copy> = {
  ru: {
    gems: 'Гемы', flasks: 'Флюиды', transformations: 'Превращения', timed: 'Циклы',
    ingredients: 'Ингредиенты', craft: 'Создать', crafting: 'Создаём…', balance: 'В запасе',
    connect: 'Подключите кошелёк, чтобы создать ресурс', loading: 'Читаем балансы ресурсов из сети…', unavailable: 'Балансы ресурсов недоступны из сети. Рецепты пока нельзя запустить.', insufficient: 'Недостаточно ресурсов для этого рецепта.',
    missingRecipe: 'Рецепт не найден в таблице сети.', missingRegistry: 'Реестр ресурсов недоступен из сети. Создание отменено.', walletChanged: 'Кошелёк изменился. Повторите действие с новым кошельком.',
    submitting: 'Готовим операцию…', crafted: 'Ресурс создан', failed: 'Не удалось создать ресурс',
    elsewhereTitle: 'Эти циклы теперь в лаборатории', elsewhere: 'Откройте лабораторию: переработка сигнала и обучение модели запускаются там же, где находится сетевая станция и посев нейронов.',
    lab: 'Нейро-лаборатория', processing: 'Переработка', training: 'Тренировка', station: 'Сетевая станция', cultivation: 'Посев нейронов',
  },
  en: {
    gems: 'Gems', flasks: 'Fluids', transformations: 'Transformations', timed: 'Production cycles',
    ingredients: 'Ingredients', craft: 'Craft', crafting: 'Crafting…', balance: 'In stock',
    connect: 'Connect a wallet to craft resources', loading: 'Reading resource balances from the network…', unavailable: 'Resource balances are unavailable from the network. Recipes cannot be started yet.', insufficient: 'Not enough resources for this recipe.',
    missingRecipe: 'Recipe not found in the network’s table.', missingRegistry: 'The resource registry is unavailable from the network. Crafting was cancelled.', walletChanged: 'The wallet changed. Please try again with the new wallet.',
    submitting: 'Preparing the transaction…', crafted: 'Resource crafted', failed: 'Could not craft the resource',
    elsewhereTitle: 'These cycles now live in the laboratory', elsewhere: 'Open the laboratory to process signals and train models. The network station and neuron cultivation are there too.',
    lab: 'Neuro-laboratory', processing: 'Processing', training: 'Training', station: 'Network station', cultivation: 'Neuron cultivation',
  },
  pt: {
    gems: 'Gemas', flasks: 'Fluidos', transformations: 'Transformações', timed: 'Ciclos de produção',
    ingredients: 'Ingredientes', craft: 'Criar', crafting: 'Criando…', balance: 'No estoque',
    connect: 'Conecte a carteira para criar recursos', loading: 'Consultando saldos de recursos na rede…', unavailable: 'Os saldos de recursos estão indisponíveis na rede. Ainda não é possível executar as receitas.', insufficient: 'Recursos insuficientes para esta receita.',
    missingRecipe: 'Receita não encontrada na tabela da rede.', missingRegistry: 'O registro de recursos não está disponível na rede. A criação foi cancelada.', walletChanged: 'A carteira mudou. Tente novamente com a nova carteira.',
    submitting: 'Preparando a operação…', crafted: 'Recurso criado', failed: 'Não foi possível criar o recurso',
    elsewhereTitle: 'Estes ciclos agora ficam no laboratório', elsewhere: 'Abra o laboratório para processar sinais e treinar modelos. A estação de rede e o cultivo de neurônios também ficam lá.',
    lab: 'Neurolaboratório', processing: 'Processamento', training: 'Treinamento', station: 'Estação de rede', cultivation: 'Cultivo de neurônios',
  },
  es: {
    gems: 'Gemas', flasks: 'Fluidos', transformations: 'Transformaciones', timed: 'Ciclos de producción',
    ingredients: 'Ingredientes', craft: 'Fabricar', crafting: 'Fabricando…', balance: 'En reserva',
    connect: 'Conecta la cartera para fabricar recursos', loading: 'Consultando saldos de recursos en la red…', unavailable: 'Los saldos de recursos no están disponibles en la red. Todavía no se pueden ejecutar las recetas.', insufficient: 'No hay recursos suficientes para esta receta.',
    missingRecipe: 'Receta no encontrada en la tabla de la red.', missingRegistry: 'El registro de recursos no está disponible en la red. Se canceló la fabricación.', walletChanged: 'La cartera cambió. Inténtalo de nuevo con la nueva cartera.',
    submitting: 'Preparando la operación…', crafted: 'Recurso fabricado', failed: 'No se pudo fabricar el recurso',
    elsewhereTitle: 'Estos ciclos ahora están en el laboratorio', elsewhere: 'Abre el laboratorio para procesar señales y entrenar modelos. La estación de red y el cultivo de neuronas también están allí.',
    lab: 'Neurolaboratorio', processing: 'Procesamiento', training: 'Entrenamiento', station: 'Estación de red', cultivation: 'Cultivo de neuronas',
  },
  vi: {
    gems: 'Đá quý', flasks: 'Dung dịch', transformations: 'Chuyển đổi', timed: 'Chu kỳ sản xuất',
    ingredients: 'Nguyên liệu', craft: 'Chế tạo', crafting: 'Đang chế tạo…', balance: 'Hiện có',
    connect: 'Kết nối ví để chế tạo tài nguyên', loading: 'Đang đọc số dư tài nguyên trên mạng…', unavailable: 'Không thể tải số dư tài nguyên từ mạng. Chưa thể khởi chạy công thức.', insufficient: 'Không đủ tài nguyên cho công thức này.',
    missingRecipe: 'Không tìm thấy công thức trong bảng của mạng.', missingRegistry: 'Không thể tải danh mục tài nguyên từ mạng. Đã hủy chế tạo.', walletChanged: 'Ví đã thay đổi. Hãy thử lại với ví mới.',
    submitting: 'Đang chuẩn bị giao dịch…', crafted: 'Đã chế tạo tài nguyên', failed: 'Không thể chế tạo tài nguyên',
    elsewhereTitle: 'Các chu kỳ này đã chuyển sang phòng thí nghiệm', elsewhere: 'Mở phòng thí nghiệm để xử lý tín hiệu và huấn luyện mô hình. Trạm mạng và khu nuôi cấy nơron cũng ở đó.',
    lab: 'Phòng thí nghiệm thần kinh', processing: 'Xử lý', training: 'Huấn luyện', station: 'Trạm mạng', cultivation: 'Nuôi cấy nơron',
  },
  id: {
    gems: 'Permata', flasks: 'Cairan', transformations: 'Transformasi', timed: 'Siklus produksi',
    ingredients: 'Bahan', craft: 'Rakit', crafting: 'Merakit…', balance: 'Persediaan',
    connect: 'Hubungkan dompet untuk merakit sumber daya', loading: 'Membaca saldo sumber daya dari jaringan…', unavailable: 'Saldo sumber daya tidak tersedia dari jaringan. Resep belum dapat dijalankan.', insufficient: 'Sumber daya untuk resep ini tidak mencukupi.',
    missingRecipe: 'Resep tidak ditemukan dalam daftar jaringan.', missingRegistry: 'Daftar sumber daya tidak tersedia dari jaringan. Perakitan dibatalkan.', walletChanged: 'Dompet berubah. Coba lagi dengan dompet yang baru.',
    submitting: 'Menyiapkan transaksi…', crafted: 'Sumber daya berhasil dirakit', failed: 'Sumber daya gagal dirakit',
    elsewhereTitle: 'Siklus ini sekarang ada di laboratorium', elsewhere: 'Buka laboratorium untuk memproses sinyal dan melatih model. Stasiun jaringan dan budidaya neuron juga ada di sana.',
    lab: 'Laboratorium saraf', processing: 'Pemrosesan', training: 'Pelatihan', station: 'Stasiun jaringan', cultivation: 'Budidaya neuron',
  },
  fil: {
    gems: 'Mga hiyas', flasks: 'Mga fluid', transformations: 'Pagbabago', timed: 'Siklo ng paggawa',
    ingredients: 'Mga sangkap', craft: 'Gawin', crafting: 'Ginagawa…', balance: 'Nasa imbakan',
    connect: 'Ikonekta ang wallet para gumawa ng yaman', loading: 'Binabasa ang balanse ng yaman mula sa network…', unavailable: 'Hindi makuha ang balanse ng yaman mula sa network. Hindi pa masisimulan ang mga resipe.', insufficient: 'Kulang ang yaman para sa resipeng ito.',
    missingRecipe: 'Hindi nakita ang resipe sa talaan ng network.', missingRegistry: 'Hindi makuha ang talaan ng yaman mula sa network. Nakansela ang paggawa.', walletChanged: 'Nagbago ang wallet. Subukan muli gamit ang bagong wallet.',
    submitting: 'Inihahanda ang transaksyon…', crafted: 'Nagawa ang yaman', failed: 'Hindi nagawa ang yaman',
    elsewhereTitle: 'Nasa laboratoryo na ang mga siklong ito', elsewhere: 'Buksan ang laboratoryo para iproseso ang mga signal at sanayin ang mga modelo. Nandoon din ang istasyon ng network at pagpapalaki ng neuron.',
    lab: 'Neuro-laboratoryo', processing: 'Pagproseso', training: 'Pagsasanay', station: 'Istasyon ng network', cultivation: 'Pagpapalaki ng neuron',
  },
};
