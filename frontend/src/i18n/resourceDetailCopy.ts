import type { Language } from './translations';
import type { ResourceId } from './homeDetail';
import { homeResourceNames } from './homeDetail';
import { WORKSHOP_RECIPES } from '../lib/workshopRecipes';

type Copy = {
  produces: string; uses: string; noRecipe: string; caution: string;
  related: string; catalog: string; recipe: string; otherSources: string;
};

/** Editorial guide, not an inventory, market offer or wallet quote. */
export const resourceDetailCopy: Record<Language, Copy> = {
  ru: {
    produces: 'Рецепты, создающие ресурс', uses: 'Рецепты, расходующие ресурс',
    noRecipe: 'В проверенной таблице рецептов связей нет.',
    caution: 'Карточка описывает ресурс, а не ваш баланс. Доступность, цены и результаты проверяйте в игре, сети и кошельке перед подписью.',
    related: 'Связанные разделы', catalog: 'Весь каталог', recipe: 'Рецепт',
    otherSources: 'Здесь перечислены только связи из таблицы рецептов программы. Добыча, награды, торговля и применение вне рецептов не подтверждаются этой карточкой.',
  },
  en: {
    produces: 'Recipes that produce this resource', uses: 'Recipes that consume this resource',
    noRecipe: 'No connection in the verified recipe table.',
    caution: 'This card describes a resource, not your balance. Check availability, prices and outcomes in the game, network and wallet before signing.',
    related: 'Related guides', catalog: 'Full catalog', recipe: 'Recipe',
    otherSources: 'Only connections in the program’s recipe table are shown. This card does not confirm mining, rewards, trading or uses outside those recipes.',
  },
  pt: {
    produces: 'Receitas que criam este recurso', uses: 'Receitas que consomem este recurso',
    noRecipe: 'Sem ligação na tabela verificada de receitas.',
    caution: 'Esta ficha descreve um recurso, não o seu saldo. Confira disponibilidade, preços e resultados no jogo, na rede e na carteira antes de assinar.',
    related: 'Guias relacionados', catalog: 'Catálogo completo', recipe: 'Receita',
    otherSources: 'Apenas as ligações da tabela de receitas do programa aparecem aqui. Esta ficha não confirma mineração, recompensas, negociação ou usos fora dessas receitas.',
  },
  es: {
    produces: 'Recetas que crean este recurso', uses: 'Recetas que consumen este recurso',
    noRecipe: 'Sin vínculo en la tabla de recetas verificada.',
    caution: 'Esta ficha describe un recurso, no tu saldo. Comprueba disponibilidad, precios y resultados en el juego, la red y la cartera antes de firmar.',
    related: 'Guías relacionadas', catalog: 'Catálogo completo', recipe: 'Receta',
    otherSources: 'Solo se muestran vínculos de la tabla de recetas del programa. Esta ficha no confirma minería, recompensas, comercio ni usos fuera de esas recetas.',
  },
  vi: {
    produces: 'Công thức tạo ra tài nguyên này', uses: 'Công thức dùng tài nguyên này',
    noRecipe: 'Không có liên kết trong bảng công thức đã kiểm chứng.',
    caution: 'Thẻ này mô tả tài nguyên, không phải số dư của bạn. Hãy kiểm tra tính khả dụng, giá và kết quả trong trò chơi, trên mạng và ví trước khi ký.',
    related: 'Hướng dẫn liên quan', catalog: 'Toàn bộ danh mục', recipe: 'Công thức',
    otherSources: 'Chỉ hiển thị liên kết trong bảng công thức của chương trình. Thẻ này không xác nhận việc khai thác, phần thưởng, giao dịch hay cách dùng ngoài các công thức đó.',
  },
  id: {
    produces: 'Resep yang menghasilkan sumber daya ini', uses: 'Resep yang memakai sumber daya ini',
    noRecipe: 'Tidak ada hubungan dalam tabel resep terverifikasi.',
    caution: 'Kartu ini menjelaskan sumber daya, bukan saldomu. Periksa ketersediaan, harga, dan hasil di game, jaringan, dan dompet sebelum menandatangani.',
    related: 'Panduan terkait', catalog: 'Seluruh katalog', recipe: 'Resep',
    otherSources: 'Hanya hubungan dalam tabel resep program yang ditampilkan. Kartu ini tidak mengonfirmasi penambangan, hadiah, perdagangan, atau penggunaan di luar resep tersebut.',
  },
  fil: {
    produces: 'Mga resipeng lumilikha ng yamang ito', uses: 'Mga resipeng gumagamit ng yamang ito',
    noRecipe: 'Walang ugnayan sa napatunayang talaan ng mga resipe.',
    caution: 'Inilalarawan ng kard na ito ang yaman, hindi ang balanse mo. Suriin ang availability, presyo at resulta sa laro, network at wallet bago pumirma.',
    related: 'Kaugnay na gabay', catalog: 'Buong katalogo', recipe: 'Resipe',
    otherSources: 'Mga ugnayan lang mula sa talaan ng resipe ng programa ang ipinapakita. Hindi kinukumpirma ng kard na ito ang pagmimina, gantimpala, kalakalan o gamit sa labas ng mga resipeng iyon.',
  },
};

/** Same canonical resource keys and amounts used by the in-game workshop. */
export function resourceRecipes(id: ResourceId, language: Language) {
  const key = id.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase();
  const name = (input: { key: string; amount: number }) => {
    const match = (Object.keys(homeResourceNames[language]) as ResourceId[])
      .find(resourceId => resourceId.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase() === input.key);
    if (!match) throw new Error(`Missing resource label for ${input.key}`);
    return `${input.amount.toLocaleString(language)} ${homeResourceNames[language][match]}`;
  };
  const line = (recipe: typeof WORKSHOP_RECIPES[number]) =>
    `${resourceDetailCopy[language].recipe} ${recipe.id}: ${recipe.inputs.map(name).join(' + ')} → ${name(recipe.output)}`;
  return {
    produces: WORKSHOP_RECIPES.filter(recipe => recipe.output.key === key).map(line),
    uses: WORKSHOP_RECIPES.filter(recipe => recipe.inputs.some(input => input.key === key)).map(line),
  };
}
