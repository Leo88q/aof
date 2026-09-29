import type { Language } from './translations';

type Copy = { title: string; paused: string; explanation: string; apiNote: string };

/** Admin-only, unmounted page. V1/V2 are legacy synthetic POTATO/SEEDS models. */
export const sandboxAdminCopy: Record<Language, Copy> = {
  ru: {
    title: 'Экономическая симуляция', paused: 'Устаревшая модель не отображается',
    explanation: 'Прежние сценарии используют синтетические ресурсы и правила, которые не подтверждают состояние нынешней игры. Их прогнозы не следует принимать за цены, балансы или проверку изменений перед выпуском.',
    apiNote: 'Администраторские API симуляции остаются отдельно доступными; этот экран не запускает их, пока модель и источники данных не будут сверены.',
  },
  en: {
    title: 'Economy simulation', paused: 'Legacy model not shown',
    explanation: 'The old scenarios use synthetic resources and rules that do not establish the current game state. Their forecasts must not be treated as prices, balances or a pre-release validation of changes.',
    apiNote: 'Admin simulation APIs remain available separately; this screen does not run them until the model and data sources have been reviewed.',
  },
  pt: {
    title: 'Simulação da economia', paused: 'O modelo antigo não é apresentado',
    explanation: 'Os cenários antigos usam recursos e regras sintéticos que não comprovam o estado atual do jogo. As projeções não são preços, saldos nem uma validação das alterações antes do lançamento.',
    apiNote: 'As API de simulação para administradores continuam disponíveis em separado; este ecrã não as executa até que o modelo e as fontes de dados sejam verificados.',
  },
  es: {
    title: 'Simulación económica', paused: 'El modelo antiguo no se muestra',
    explanation: 'Los escenarios antiguos usan recursos y reglas sintéticos que no demuestran el estado actual del juego. Sus proyecciones no son precios, saldos ni una validación de los cambios antes del lanzamiento.',
    apiNote: 'Las API de simulación para administradores siguen disponibles por separado; esta pantalla no las ejecuta hasta que se revisen el modelo y las fuentes de datos.',
  },
  vi: {
    title: 'Mô phỏng kinh tế', paused: 'Không hiển thị mô hình cũ',
    explanation: 'Các kịch bản cũ dùng tài nguyên và quy tắc giả lập, không xác nhận trạng thái hiện tại của trò chơi. Dự báo của chúng không phải giá, số dư hay kết quả kiểm định thay đổi trước khi phát hành.',
    apiNote: 'API mô phỏng dành cho quản trị viên vẫn tồn tại riêng; màn hình này không chạy chúng cho đến khi mô hình và nguồn dữ liệu được rà soát.',
  },
  id: {
    title: 'Simulasi ekonomi', paused: 'Model lama tidak ditampilkan',
    explanation: 'Skenario lama memakai sumber daya dan aturan sintetis yang tidak membuktikan kondisi gim saat ini. Proyeksinya bukan harga, saldo, atau hasil validasi perubahan sebelum rilis.',
    apiNote: 'API simulasi admin tetap tersedia secara terpisah; layar ini tidak menjalankannya sebelum model dan sumber datanya ditinjau.',
  },
  fil: {
    title: 'Simulasyon ng ekonomiya', paused: 'Hindi ipinapakita ang lumang modelo',
    explanation: 'Gumagamit ang mga dating senaryo ng gawa-gawang yaman at panuntunan na hindi nagpapatunay sa kasalukuyang estado ng laro. Hindi tunay na presyo, balanse, o pag-validate bago ang release ang mga hula nito.',
    apiNote: 'Hiwalay pa ring magagamit ang mga admin simulation API; hindi pinapatakbo ng pahinang ito ang mga iyon hangga’t hindi nasusuri ang modelo at mga pinagmumulan ng datos.',
  },
};
