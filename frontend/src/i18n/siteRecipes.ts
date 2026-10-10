import type { Language } from './translations';

type Copy = {
  lead: string; paragraphs: readonly [string, string]; heading: string;
  sourceLabel: string; inputLabel: string; outputLabel: string; note: string;
};
/** Workshop recipes share the exact resource/amount table with the in-game workshop. The laboratory seal is separate. */
export const siteRecipes: Record<Language, Copy> = {
  ru: {
    lead: 'Рецепты мастерской: состав из исходного кода, доступность — из игры.',
    paragraphs: ['В списке показана таблица craft_recipe целиком. Расходы и выходы взяты из того же источника, который использует игровая мастерская; на сайте нет кнопки создания.', 'Печать лаборатории показана отдельно и не входит в таблицу craft_recipe. Флюиды сгорают только там; других эффектов у них нет. Источник кода не подтверждает развёртывание и актуальные балансы: перед подписью проверь смету и содержимое кошелька.'],
    heading: 'Материалы и результат', sourceLabel: 'Таблица исходного кода · не живая смета', inputLabel: 'Нужно', outputLabel: 'Результат',
    note: 'Числа — количества ресурсов в рецепте, а не баланс кошелька или окончательная стоимость действия. Ошибка чтения сети не означает нулевой расход. Для создания открой игровую мастерскую и проверь сеть перед подписью.',
  },
  en: {
    lead: 'Workshop recipes: ingredients from source, availability from the game.',
    paragraphs: ['The full craft_recipe table appears here. Inputs and outputs use the same source as the in-game workshop; this page has no crafting button.', 'The laboratory seal is listed after the table and is not a workshop recipe. Fluids are burned there and have no other effect. Source code does not confirm deployment or your balance: check a fresh quote and your wallet before signing.'],
    heading: 'Materials and results', sourceLabel: 'Source-code table · not a live quote', inputLabel: 'Requires', outputLabel: 'Produces',
    note: 'These numbers are recipe quantities, not your balance or the final cost of an action. A network read failure does not mean zero cost. To craft, open the game workshop and check the network before signing.',
  },
  pt: {
    lead: 'Receitas da oficina: ingredientes do código, disponibilidade no jogo.',
    paragraphs: ['A tabela craft_recipe aparece inteira. Entradas e saídas vêm da mesma fonte usada pela oficina no jogo; esta página não tem botão de criação.', 'O selo do laboratório aparece depois da tabela e não é uma receita da oficina. Os fluidos são queimados ali e não têm outro efeito. O código não confirma a publicação nem o teu saldo: confere o orçamento atual e a carteira antes de assinar.'],
    heading: 'Materiais e resultados', sourceLabel: 'Tabela do código · não é orçamento em tempo real', inputLabel: 'Necessário', outputLabel: 'Resultado',
    note: 'Os números são quantidades da receita, não o saldo da tua carteira ou o custo final de uma ação. Uma falha de leitura não significa custo zero. Para criar, abre a oficina do jogo e confere a rede antes de assinar.',
  },
  es: {
    lead: 'Recetas del taller: ingredientes del código, disponibilidad en el juego.',
    paragraphs: ['Aparece la tabla craft_recipe completa. Ingredientes y resultados vienen de la misma fuente que usa el taller del juego; esta página no permite fabricar.', 'El sello del laboratorio aparece después de la tabla y no es una receta del taller. Los fluidos se queman allí y no tienen otro efecto. El código no confirma el despliegue ni tu saldo: comprueba un presupuesto actualizado y tu cartera antes de firmar.'],
    heading: 'Materiales y resultados', sourceLabel: 'Tabla del código · no es un presupuesto en directo', inputLabel: 'Necesita', outputLabel: 'Produce',
    note: 'Las cifras son cantidades de la receta, no tu saldo ni el coste final de la acción. Un fallo de lectura no significa coste cero. Para fabricar, abre el taller del juego y comprueba la red antes de firmar.',
  },
  vi: {
    lead: 'Công thức xưởng: nguyên liệu từ mã nguồn, tính khả dụng từ trò chơi.',
    paragraphs: ['Toàn bộ bảng craft_recipe xuất hiện ở đây. Nguyên liệu và thành phẩm lấy từ cùng nguồn mà xưởng trong trò chơi dùng; trang này không có nút chế tạo.', 'Niêm phong phòng thí nghiệm được liệt kê sau bảng và không phải công thức xưởng. Dung dịch bị đốt ở đó và không có tác dụng khác. Mã nguồn không xác nhận triển khai hay số dư của bạn: hãy kiểm tra báo giá mới và ví trước khi ký.'],
    heading: 'Nguyên liệu và thành phẩm', sourceLabel: 'Bảng trong mã nguồn · không phải báo giá trực tiếp', inputLabel: 'Cần', outputLabel: 'Tạo ra',
    note: 'Những con số này là lượng nguyên liệu trong công thức, không phải số dư hay toàn bộ chi phí hành động. Lỗi đọc mạng không có nghĩa chi phí bằng không. Để chế tạo, mở xưởng trong trò chơi và kiểm tra mạng trước khi ký.',
  },
  id: {
    lead: 'Resep bengkel: bahan dari kode sumber, ketersediaan dari permainan.',
    paragraphs: ['Seluruh tabel craft_recipe ditampilkan. Bahan dan hasil berasal dari sumber yang sama dengan bengkel dalam permainan; halaman ini tidak memiliki tombol merakit.', 'Segel laboratorium ditampilkan setelah tabel dan bukan resep bengkel. Cairan dibakar di sana dan tidak punya efek lain. Kode sumber tidak membuktikan penerapan atau saldomu: periksa rincian harga terbaru dan dompet sebelum tanda tangan.'],
    heading: 'Bahan dan hasil', sourceLabel: 'Tabel kode sumber · bukan harga langsung', inputLabel: 'Memerlukan', outputLabel: 'Menghasilkan',
    note: 'Angka ini jumlah bahan resep, bukan saldo atau total biaya tindakan. Gagal membaca jaringan bukan berarti biayanya nol. Untuk merakit, buka bengkel permainan dan periksa jaringan sebelum tanda tangan.',
  },
  fil: {
    lead: 'Mga resipe sa pagawaan: sangkap mula sa code, availability sa laro.',
    paragraphs: ['Buong talaang craft_recipe ang makikita rito. Mula sa kaparehong pinagkukunan ng pagawaan sa laro ang mga sangkap at resulta; walang pindutan ng paggawa sa pahinang ito.', 'Ang tatak ng laboratoryo ay nakalista pagkatapos ng talahanayan at hindi resipe ng pagawaan. Nasusunog doon ang mga fluid at wala silang ibang epekto. Hindi patunay ang source code ng deployment o balanse mo: suriin ang bagong presyo at wallet bago lumagda.'],
    heading: 'Mga sangkap at resulta', sourceLabel: 'Talaan sa source code · hindi kasalukuyang presyo', inputLabel: 'Kailangan', outputLabel: 'Nagbubunga',
    note: 'Bilang ng mga sangkap sa resipe ang mga ito, hindi ang balanse o kabuuang halaga ng gagawin. Hindi nangangahulugang sero ang gastos kapag hindi mabasa ang network. Para gumawa, buksan ang pagawaan sa laro at suriin ang network bago lumagda.',
  },
};
