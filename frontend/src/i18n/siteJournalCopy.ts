import type { Language } from './translations';
import type { SiteBadgeId } from '../site/siteJournal';

type Badge = { name: string; description: string };
type Copy = {
  lead: string; paragraphs: readonly string[]; heading: string; marks: string;
  visits: (count: number) => string; note: string; consent: string; reset: string;
  inspect: string; capsule: string; wheel: string; roadmap: string;
  badges: Record<SiteBadgeId, Badge>;
};
/** Local reading marks: not on-chain quests, verified achievements, or rewards. */
export const siteJournalCopy: Record<Language, Copy> = {
  ru: {
    lead: 'Шесть отметок читателя — без игровых наград.',
    paragraphs: ['Этот журнал отмечает только знакомство с сайтом. Сетевые задания и достижения сейчас нельзя проверить: их индекс недоступен.', 'При разрешении функционального хранения отметки остаются в этом браузере. Кошелёк не нужен.'],
    heading: 'Журнал знакомства', marks: 'Отметки', visits: n => `Открыто разделов: ${n}.`,
    note: 'Это местные отметки чтения, не прогресс заданий и не право на награду.', consent: 'Отметки отключены без согласия на функциональное хранение. Читать сайт можно и без него.', reset: 'Сбросить местные отметки',
    inspect: 'Осмотреть ресурс', capsule: 'Посмотреть капсулу', wheel: 'Послушать ритм', roadmap: 'Открыть карту развития',
    badges: {
      reader: { name: 'Читатель', description: 'Открой пять разных разделов сайта.' },
      resource: { name: 'Материаловед', description: 'Осмотри карточку ресурса.' },
      commit: { name: 'Проверяющий', description: 'Сверь локальную демонстрацию commit/reveal.' },
      pack: { name: 'Распаковщик', description: 'Открой демонстрационную капсулу.' },
      drum: { name: 'Ритм мастера', description: 'Попробуй демонстрационный барабан.' },
      chronicler: { name: 'Планировщик', description: 'Открой карту направлений развития.' },
    },
  },
  en: {
    lead: 'Six reading marks, no in-game rewards.',
    paragraphs: ['This journal only marks pages you explore on the website. On-chain quests and achievements cannot be checked yet: their index is unavailable.', 'With optional functional storage enabled, marks stay in this browser. No wallet is needed.'],
    heading: 'Exploration journal', marks: 'Reading marks', visits: n => `Sections visited: ${n}.`,
    note: 'These are local reading marks, not quest progress or a claim to rewards.', consent: 'Reading marks are off without consent for functional storage. You can still read the site.', reset: 'Clear local marks',
    inspect: 'Explore a resource', capsule: 'Try a capsule demo', wheel: 'Try the drum demo', roadmap: 'Open the development map',
    badges: {
      reader: { name: 'Reader', description: 'Visit five different sections of the site.' },
      resource: { name: 'Material explorer', description: 'Open a resource page.' },
      commit: { name: 'Verifier', description: 'Try the local commit/reveal demonstration.' },
      pack: { name: 'Unpacker', description: 'Open a demonstration capsule.' },
      drum: { name: 'Rhythm keeper', description: 'Try the demonstration drum.' },
      chronicler: { name: 'Planner', description: 'Open the development map.' },
    },
  },
  pt: {
    lead: 'Seis marcas de leitura, sem recompensas no jogo.',
    paragraphs: ['Este diário registra apenas sua visita às páginas do site. Ainda não é possível consultar missões e conquistas na rede: o índice não está disponível.', 'Com o armazenamento funcional opcional ativado, as marcas ficam neste navegador. Não é preciso conectar a carteira.'],
    heading: 'Diário de exploração', marks: 'Marcas de leitura', visits: n => `Seções visitadas: ${n}.`,
    note: 'São marcas de leitura locais, não progresso de missões nem direito a prêmios.', consent: 'As marcas ficam desativadas sem consentimento para o armazenamento funcional. O site continua disponível para leitura.', reset: 'Limpar marcas locais',
    inspect: 'Explorar um recurso', capsule: 'Ver cápsula de demonstração', wheel: 'Testar o tambor', roadmap: 'Abrir o mapa de desenvolvimento',
    badges: {
      reader: { name: 'Leitor', description: 'Visite cinco seções diferentes do site.' },
      resource: { name: 'Explorador de materiais', description: 'Abra a página de um recurso.' },
      commit: { name: 'Verificador', description: 'Teste a demonstração local de commit/reveal.' },
      pack: { name: 'Desbravador de cápsulas', description: 'Abra uma cápsula de demonstração.' },
      drum: { name: 'Guardião do ritmo', description: 'Teste o tambor de demonstração.' },
      chronicler: { name: 'Planejador', description: 'Abra o mapa de desenvolvimento.' },
    },
  },
  es: {
    lead: 'Seis marcas de lectura, sin premios en el juego.',
    paragraphs: ['Este diario solo registra las secciones del sitio que visitas. Todavía no se pueden comprobar misiones y logros en la cadena: su índice no está disponible.', 'Si autorizas el almacenamiento funcional opcional, las marcas quedan en este navegador. No necesitas conectar tu cartera.'],
    heading: 'Diario de exploración', marks: 'Marcas de lectura', visits: n => `Secciones visitadas: ${n}.`,
    note: 'Son marcas de lectura locales, no progreso de misiones ni derecho a premios.', consent: 'Las marcas están desactivadas sin consentimiento para el almacenamiento funcional. Puedes seguir leyendo el sitio.', reset: 'Borrar marcas locales',
    inspect: 'Explorar un recurso', capsule: 'Ver una cápsula de muestra', wheel: 'Probar el tambor', roadmap: 'Abrir el mapa de desarrollo',
    badges: {
      reader: { name: 'Lector', description: 'Visita cinco secciones diferentes del sitio.' },
      resource: { name: 'Explorador de materiales', description: 'Abre la página de un recurso.' },
      commit: { name: 'Verificador', description: 'Prueba la demostración local de commit/reveal.' },
      pack: { name: 'Descubridor de cápsulas', description: 'Abre una cápsula de muestra.' },
      drum: { name: 'Guardián del ritmo', description: 'Prueba el tambor de muestra.' },
      chronicler: { name: 'Planificador', description: 'Abre el mapa de desarrollo.' },
    },
  },
  vi: {
    lead: 'Sáu dấu đọc, không có thưởng trong trò chơi.',
    paragraphs: ['Nhật ký này chỉ đánh dấu những mục bạn đọc trên trang web. Chưa thể kiểm tra nhiệm vụ và thành tựu trên chuỗi vì chưa có dữ liệu chỉ mục.', 'Nếu bạn đồng ý lưu dữ liệu chức năng tùy chọn, dấu đọc sẽ ở lại trong trình duyệt này. Không cần kết nối ví.'],
    heading: 'Nhật ký khám phá', marks: 'Dấu đã đọc', visits: n => `Đã ghé ${n} mục.`,
    note: 'Đây chỉ là dấu đọc tại máy, không phải tiến độ nhiệm vụ hay quyền nhận thưởng.', consent: 'Dấu đọc sẽ tắt nếu bạn không đồng ý lưu dữ liệu chức năng. Bạn vẫn có thể đọc trang web.', reset: 'Xóa dấu đọc tại máy',
    inspect: 'Khám phá tài nguyên', capsule: 'Xem hộp minh họa', wheel: 'Thử trống minh họa', roadmap: 'Mở bản đồ phát triển',
    badges: {
      reader: { name: 'Người đọc', description: 'Ghé năm mục khác nhau trên trang web.' },
      resource: { name: 'Người khám phá vật liệu', description: 'Mở trang của một tài nguyên.' },
      commit: { name: 'Người kiểm chứng', description: 'Thử bản minh họa commit/reveal tại máy.' },
      pack: { name: 'Người mở hộp', description: 'Mở một hộp minh họa.' },
      drum: { name: 'Người giữ nhịp', description: 'Thử trống minh họa.' },
      chronicler: { name: 'Người lập kế hoạch', description: 'Mở bản đồ phát triển.' },
    },
  },
  id: {
    lead: 'Enam tanda baca, tanpa hadiah dalam game.',
    paragraphs: ['Jurnal ini hanya menandai bagian situs yang kamu kunjungi. Misi dan pencapaian di blockchain belum dapat diperiksa karena indeksnya tidak tersedia.', 'Jika kamu setuju pada penyimpanan fungsional opsional, tanda baca tetap berada di peramban ini. Tidak perlu menghubungkan dompet.'],
    heading: 'Jurnal penjelajahan', marks: 'Tanda baca', visits: n => `Bagian dikunjungi: ${n}.`,
    note: 'Ini hanya tanda baca setempat, bukan progres misi atau hak menerima hadiah.', consent: 'Tanda baca dinonaktifkan tanpa persetujuan penyimpanan fungsional. Kamu tetap bisa membaca situs.', reset: 'Hapus tanda setempat',
    inspect: 'Jelajahi sumber daya', capsule: 'Lihat demo kapsul', wheel: 'Coba demo genderang', roadmap: 'Buka peta pengembangan',
    badges: {
      reader: { name: 'Pembaca', description: 'Kunjungi lima bagian situs yang berbeda.' },
      resource: { name: 'Penjelajah bahan', description: 'Buka halaman sumber daya.' },
      commit: { name: 'Pemeriksa', description: 'Coba demonstrasi commit/reveal setempat.' },
      pack: { name: 'Pembuka kapsul', description: 'Buka kapsul demonstrasi.' },
      drum: { name: 'Penjaga irama', description: 'Coba genderang demonstrasi.' },
      chronicler: { name: 'Perencana', description: 'Buka peta pengembangan.' },
    },
  },
  fil: {
    lead: 'Anim na tanda ng pagbabasa, walang gantimpala sa laro.',
    paragraphs: ['Minamarkahan lang ng talaang ito ang mga pahinang binisita mo sa site. Hindi pa masuri ang mga gawain at tagumpay sa blockchain dahil hindi pa makuha ang talaan nito.', 'Kung papayagan mo ang opsiyonal na imbakan para sa mga tampok, sa browser na ito lamang mananatili ang mga tanda. Hindi kailangan ang wallet.'],
    heading: 'Talaan ng paggalugad', marks: 'Mga tanda ng pagbabasa', visits: n => `Nabisitang bahagi: ${n}.`,
    note: 'Mga tanda lang ito sa browser, hindi progreso sa gawain o karapatan sa gantimpala.', consent: 'Nakasara ang mga tanda kung hindi ka pumayag sa imbakan para sa mga tampok. Mababasa mo pa rin ang site.', reset: 'Burahin ang mga tanda sa browser',
    inspect: 'Suriin ang isang yaman', capsule: 'Tingnan ang demo ng kapsula', wheel: 'Subukan ang demo ng tambol', roadmap: 'Buksan ang mapa ng pag-unlad',
    badges: {
      reader: { name: 'Mambabasa', description: 'Bumisita sa limang magkakaibang bahagi ng site.' },
      resource: { name: 'Tagasaliksik ng materyales', description: 'Buksan ang pahina ng isang yaman.' },
      commit: { name: 'Tagasuri', description: 'Subukan ang lokal na demo ng commit/reveal.' },
      pack: { name: 'Tagabukas ng kapsula', description: 'Buksan ang demo ng kapsula.' },
      drum: { name: 'Tagapag-ingat ng ritmo', description: 'Subukan ang demo ng tambol.' },
      chronicler: { name: 'Tagaplano', description: 'Buksan ang mapa ng pag-unlad.' },
    },
  },
};
