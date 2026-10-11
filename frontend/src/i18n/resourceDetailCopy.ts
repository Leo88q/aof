import type { Language } from './translations';
import type { ResourceId } from './homeDetail';
import { homeResourceNames } from './homeDetail';
import { LABORATORY_SEAL, WORKSHOP_RECIPES } from '../lib/workshopRecipes';

type Copy = {
  produces: string; uses: string; noRecipe: string; caution: string;
  related: string; catalog: string; recipe: string; seal: string; otherSources: string;
};

/** Editorial guide, not an inventory, market offer or wallet quote. */
export const resourceDetailCopy: Record<Language, Copy> = {
  ru: {
    produces: 'Рецепты, создающие ресурс', uses: 'Рецепты, расходующие ресурс',
    noRecipe: 'В проверенной таблице рецептов связей нет.',
    caution: 'Карточка описывает ресурс, а не ваш баланс. Доступность, цены и результаты проверяйте в игре, сети и кошельке перед подписью.',
    related: 'Связанные разделы', catalog: 'Весь каталог', recipe: 'Рецепт',
    seal: 'Печать',
    otherSources: 'Карточка показывает таблицу рецептов и печать лаборатории. Добыча, цены и ваш баланс здесь не подтверждаются.',
  },
  en: {
    produces: 'Recipes that produce this resource', uses: 'Recipes that consume this resource',
    noRecipe: 'No connection in the verified recipe table.',
    caution: 'This card describes a resource, not your balance. Check availability, prices and outcomes in the game, network and wallet before signing.',
    related: 'Related guides', catalog: 'Full catalog', recipe: 'Recipe',
    seal: 'Seal',
    otherSources: 'This card shows the recipe table and the laboratory seal. It does not confirm mining, prices or your balance.',
  },
  pt: {
    produces: 'Receitas que criam este recurso', uses: 'Receitas que consomem este recurso',
    noRecipe: 'Sem ligação na tabela verificada de receitas.',
    caution: 'Esta ficha descreve um recurso, não o seu saldo. Confira disponibilidade, preços e resultados no jogo, na rede e na carteira antes de assinar.',
    related: 'Guias relacionados', catalog: 'Catálogo completo', recipe: 'Receita',
    seal: 'Selo',
    otherSources: 'Esta ficha mostra a tabela de receitas e o selo do laboratório. Não confirma mineração, preços nem o seu saldo.',
  },
  es: {
    produces: 'Recetas que crean este recurso', uses: 'Recetas que consumen este recurso',
    noRecipe: 'Sin vínculo en la tabla de recetas verificada.',
    caution: 'Esta ficha describe un recurso, no tu saldo. Comprueba disponibilidad, precios y resultados en el juego, la red y la cartera antes de firmar.',
    related: 'Guías relacionadas', catalog: 'Catálogo completo', recipe: 'Receta',
    seal: 'Sello',
    otherSources: 'Esta ficha muestra la tabla de recetas y el sello del laboratorio. No confirma minería, precios ni tu saldo.',
  },
  vi: {
    produces: 'Công thức tạo ra tài nguyên này', uses: 'Công thức dùng tài nguyên này',
    noRecipe: 'Không có liên kết trong bảng công thức đã kiểm chứng.',
    caution: 'Thẻ này mô tả tài nguyên, không phải số dư của bạn. Hãy kiểm tra tính khả dụng, giá và kết quả trong trò chơi, trên mạng và ví trước khi ký.',
    related: 'Hướng dẫn liên quan', catalog: 'Toàn bộ danh mục', recipe: 'Công thức',
    seal: 'Niêm phong',
    otherSources: 'Thẻ này hiện bảng công thức và niêm phong phòng thí nghiệm. Nó không xác nhận việc khai thác, giá hay số dư của bạn.',
  },
  id: {
    produces: 'Resep yang menghasilkan sumber daya ini', uses: 'Resep yang memakai sumber daya ini',
    noRecipe: 'Tidak ada hubungan dalam tabel resep terverifikasi.',
    caution: 'Kartu ini menjelaskan sumber daya, bukan saldomu. Periksa ketersediaan, harga, dan hasil di game, jaringan, dan dompet sebelum menandatangani.',
    related: 'Panduan terkait', catalog: 'Seluruh katalog', recipe: 'Resep',
    seal: 'Segel',
    otherSources: 'Kartu ini menampilkan tabel resep dan segel laboratorium. Kartu ini tidak mengonfirmasi penambangan, harga, atau saldomu.',
  },
  fil: {
    produces: 'Mga resipeng lumilikha ng yamang ito', uses: 'Mga resipeng gumagamit ng yamang ito',
    noRecipe: 'Walang ugnayan sa napatunayang talaan ng mga resipe.',
    caution: 'Inilalarawan ng kard na ito ang yaman, hindi ang balanse mo. Suriin ang availability, presyo at resulta sa laro, network at wallet bago pumirma.',
    related: 'Kaugnay na gabay', catalog: 'Buong katalogo', recipe: 'Resipe',
    seal: 'Tatak',
    otherSources: 'Ipinapakita ng kard na ito ang talaan ng resipe at ang tatak ng laboratoryo. Hindi nito kinukumpirma ang pagmimina, presyo, o balanse mo.',
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
  const sealLine = `${resourceDetailCopy[language].seal}: ${LABORATORY_SEAL.inputs.map(name).join(' + ')} → ${name(LABORATORY_SEAL.output)}`;
  const sealRole = LABORATORY_SEAL.output.key === key ? 'output'
    : LABORATORY_SEAL.inputs.some(input => input.key === key) ? 'input' : null;
  return {
    produces: WORKSHOP_RECIPES.filter(recipe => recipe.output.key === key).map(line),
    uses: WORKSHOP_RECIPES.filter(recipe => recipe.inputs.some(input => input.key === key)).map(line),
    seal: sealRole ? [sealLine] : [],
    sealRole,
  };
}
