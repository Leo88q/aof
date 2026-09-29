import type { Language } from './translations';

export const trustMedallionIds = ['stranger', 'neighbour', 'partner', 'guildsman', 'elder'] as const;
type Medallion = { id: typeof trustMedallionIds[number]; name: string; text: string };
type TrustCopy = {
  lead: string; paragraphs: readonly [string, string]; heading: string;
  tierLabel: (number: number) => string; note: string; medallions: readonly Medallion[];
};

/** Concept art, not player ranks. Verified trust history is currently unavailable. */
export const siteTrust: Record<Language, TrustCopy> = {
  ru: {
    lead: 'Доверие живёт в поступках; медальоны пока лишь история мира.',
    paragraphs: ['Пять медальонов ниже — редакционные образы, не уровни твоего аккаунта. Проверяемая история доверия сейчас недоступна.', 'Открывают ли поступки права и лимиты, можно узнать только из действующих правил игры и проверенного состояния сети. Сессионные ключи сейчас отключены.'],
    heading: 'Пять образов доверия', tierLabel: n => `Образ ${n}`, note: 'Медальоны не подтверждают статус, привилегии, сетевую репутацию или право на сделку.',
    medallions: [
      { id: 'stranger', name: 'Незнакомец', text: 'Каждая история начинается с пустой страницы: сначала знакомство, потом обещания.' },
      { id: 'neighbour', name: 'Сосед', text: 'Первая встреча состоялась, но доверие ещё нужно бережно растить.' },
      { id: 'partner', name: 'Соратник', text: 'Работать рядом — значит разделять усилие, а не обещать друг другу выгоду.' },
      { id: 'guildsman', name: 'Участник круга', text: 'Мастерская больше одного человека: общая работа требует общей ответственности.' },
      { id: 'elder', name: 'Хранитель памяти', text: 'Долгий путь оставляет след в рассказах, даже когда печати стираются.' },
    ],
  },
  en: {
    lead: 'Trust grows from actions; the medallions are still a story of the world.',
    paragraphs: ['The five medallions below are editorial illustrations, not your account levels. Verified trust history is currently unavailable.', 'Whether an action grants rights or limits can only be determined from the current game rules and verified network state. Session keys are currently disabled.'],
    heading: 'Five faces of trust', tierLabel: n => `Illustration ${n}`, note: 'These medallions do not verify status, privileges, on-chain reputation or the right to trade.',
    medallions: [
      { id: 'stranger', name: 'Stranger', text: 'Every story begins with a blank page: meet first, make promises later.' },
      { id: 'neighbour', name: 'Neighbor', text: 'A first meeting has happened, but trust still needs patient care.' },
      { id: 'partner', name: 'Companion', text: 'Working side by side means sharing effort, not promising each other profit.' },
      { id: 'guildsman', name: 'Guild member', text: 'A workshop is more than one person; shared work calls for shared responsibility.' },
      { id: 'elder', name: 'Keeper of memory', text: 'A long journey leaves a mark in stories, even when seals fade.' },
    ],
  },
  pt: {
    lead: 'A confiança nasce dos atos; os medalhões ainda contam apenas uma história deste mundo.',
    paragraphs: ['Os cinco medalhões abaixo são imagens editoriais, não níveis da tua conta. O histórico de confiança verificável ainda não está disponível.', 'Só as regras atuais do jogo e o estado confirmado na rede podem mostrar se uma ação abre direitos ou limites. As chaves de sessão estão desativadas.'],
    heading: 'Cinco faces da confiança', tierLabel: n => `Ilustração ${n}`, note: 'Estes medalhões não comprovam estatuto, privilégios, reputação na rede nem direito a negociar.',
    medallions: [
      { id: 'stranger', name: 'Desconhecido', text: 'Toda história começa numa página em branco: primeiro o encontro, depois a promessa.' },
      { id: 'neighbour', name: 'Vizinho', text: 'O primeiro encontro aconteceu, mas a confiança ainda precisa de cuidado.' },
      { id: 'partner', name: 'Companheiro', text: 'Trabalhar lado a lado é partilhar esforço, não prometer lucro.' },
      { id: 'guildsman', name: 'Membro do círculo', text: 'Uma oficina é maior que uma pessoa; o trabalho comum pede responsabilidade comum.' },
      { id: 'elder', name: 'Guardião da memória', text: 'Uma longa jornada deixa marcas nas histórias, mesmo quando os selos se apagam.' },
    ],
  },
  es: {
    lead: 'La confianza nace de los actos; los medallones aún son solo parte del relato.',
    paragraphs: ['Los cinco medallones de abajo son ilustraciones editoriales, no niveles de tu cuenta. Por ahora no se puede consultar un historial de confianza verificado.', 'Solo las reglas vigentes del juego y el estado comprobado en la cadena pueden indicar si una acción concede derechos o límites. Las claves de sesión están desactivadas.'],
    heading: 'Cinco rostros de la confianza', tierLabel: n => `Ilustración ${n}`, note: 'Estos medallones no acreditan estatus, privilegios, reputación en la cadena ni derecho a comerciar.',
    medallions: [
      { id: 'stranger', name: 'Desconocido', text: 'Toda historia empieza con una página en blanco: primero el encuentro, después las promesas.' },
      { id: 'neighbour', name: 'Vecino', text: 'Ya se produjo el primer encuentro, pero la confianza aún necesita cuidados.' },
      { id: 'partner', name: 'Compañero', text: 'Trabajar codo a codo es compartir esfuerzo, no prometer beneficios.' },
      { id: 'guildsman', name: 'Miembro del círculo', text: 'Un taller reúne a más de una persona; el trabajo común exige responsabilidad común.' },
      { id: 'elder', name: 'Guardián de la memoria', text: 'Un largo camino deja huella en los relatos, aun cuando los sellos se borran.' },
    ],
  },
  vi: {
    lead: 'Niềm tin đến từ hành động; những huy hiệu này chỉ kể chuyện về thế giới.',
    paragraphs: ['Năm huy hiệu bên dưới là hình minh họa biên tập, không phải cấp độ tài khoản của bạn. Hiện chưa có lịch sử tin cậy có thể kiểm chứng.', 'Chỉ quy tắc hiện hành của trò chơi và trạng thái đã xác minh trên chuỗi mới cho biết một hành động có mở quyền hay giới hạn nào không. Khóa phiên hiện đang bị tắt.'],
    heading: 'Năm gương mặt của niềm tin', tierLabel: n => `Hình minh họa ${n}`, note: 'Những huy hiệu này không chứng minh địa vị, đặc quyền, uy tín trên chuỗi hay quyền giao dịch.',
    medallions: [
      { id: 'stranger', name: 'Người lạ', text: 'Mỗi câu chuyện bắt đầu từ trang giấy trắng: gặp nhau trước, hứa hẹn sau.' },
      { id: 'neighbour', name: 'Người hàng xóm', text: 'Cuộc gặp đầu tiên đã qua, nhưng niềm tin vẫn cần được vun đắp.' },
      { id: 'partner', name: 'Người đồng hành', text: 'Làm việc bên nhau là chia sẻ công sức, không phải hứa hẹn lợi nhuận.' },
      { id: 'guildsman', name: 'Thành viên cộng đồng', text: 'Xưởng không chỉ có một người; cùng làm việc là cùng chịu trách nhiệm.' },
      { id: 'elder', name: 'Người giữ ký ức', text: 'Hành trình dài lưu dấu trong chuyện kể, kể cả khi dấu niêm phong phai nhạt.' },
    ],
  },
  id: {
    lead: 'Kepercayaan tumbuh dari tindakan; medali-medali ini masih sebatas kisah dunia.',
    paragraphs: ['Lima medali di bawah adalah gambaran editorial, bukan tingkatan akunmu. Riwayat kepercayaan yang dapat diverifikasi belum tersedia.', 'Hanya aturan permainan yang berlaku dan status terverifikasi di blockchain yang dapat menunjukkan apakah suatu tindakan memberi hak atau batasan. Kunci sesi saat ini dinonaktifkan.'],
    heading: 'Lima wajah kepercayaan', tierLabel: n => `Ilustrasi ${n}`, note: 'Medali ini tidak membuktikan status, hak istimewa, reputasi di blockchain, atau hak untuk berdagang.',
    medallions: [
      { id: 'stranger', name: 'Orang asing', text: 'Setiap kisah dimulai dari halaman kosong: berkenalan dulu, baru berjanji.' },
      { id: 'neighbour', name: 'Tetangga', text: 'Pertemuan pertama telah terjadi, tetapi kepercayaan masih harus dirawat.' },
      { id: 'partner', name: 'Rekan seperjalanan', text: 'Bekerja berdampingan berarti berbagi usaha, bukan menjanjikan laba.' },
      { id: 'guildsman', name: 'Anggota lingkaran', text: 'Bengkel tidak hanya berisi satu orang; kerja bersama menuntut tanggung jawab bersama.' },
      { id: 'elder', name: 'Penjaga ingatan', text: 'Perjalanan panjang meninggalkan jejak dalam cerita, bahkan saat segel memudar.' },
    ],
  },
  fil: {
    lead: 'Sa gawa nabubuo ang tiwala; kuwento pa lamang ng mundo ang mga medalyong ito.',
    paragraphs: ['Mga guhit na pangkuwento ang limang medalya sa ibaba, hindi mga antas ng iyong account. Hindi pa makuha ang nasusuring kasaysayan ng tiwala.', 'Ang umiiral na tuntunin ng laro at napatunayang kalagayan sa blockchain lang ang makapagsasabi kung may karapatan o hangganang dulot ang isang gawain. Kasalukuyang hindi magamit ang mga session key.'],
    heading: 'Limang mukha ng tiwala', tierLabel: n => `Larawan ${n}`, note: 'Hindi patunay ng katayuan, pribilehiyo, reputasyon sa blockchain, o karapatang makipagkalakalan ang mga medalyong ito.',
    medallions: [
      { id: 'stranger', name: 'Hindi kakilala', text: 'Nagsisimula ang bawat kuwento sa blangkong pahina: pagkakilala muna bago pangako.' },
      { id: 'neighbour', name: 'Kapitbahay', text: 'Naganap na ang unang pagkikita, ngunit kailangan pa ring alagaan ang tiwala.' },
      { id: 'partner', name: 'Katuwang', text: 'Ang pagtatrabaho nang magkatabi ay pagbabahagi ng pagsisikap, hindi pangako ng tubo.' },
      { id: 'guildsman', name: 'Kasapi ng samahan', text: 'Higit sa isang tao ang bumubuo sa pagawaan; kaakibat ng sama-samang gawain ang pananagutan.' },
      { id: 'elder', name: 'Tagapag-ingat ng alaala', text: 'Nag-iiwan ng bakas sa mga kuwento ang mahabang paglalakbay, kahit kumupas ang mga selyo.' },
    ],
  },
};
