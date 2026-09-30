import type { Language } from './translations';

export type DisabledMechanicKey = 'collectors' | 'session' | 'tools_repair';
type Explanation = { title: string; reason: string };
type NoticeCopy = { explanations: Record<DisabledMechanicKey, Explanation>; noCharge: string; supportCode: string };

// Guard identifiers and feature flags remain in FeatureDisabledNotice.
// Player-facing copy cannot change their availability.
export const disabledMechanicCopy: Record<Language, NoticeCopy> = {
  ru: {
    explanations: {
      collectors: { title: 'Коллекции временно недоступны', reason: 'Стейкинг коллекций включим, когда в сети будут прописаны адреса коллекционных наборов. До этого награду за коллекцию нельзя начислить корректно.' },
      session: { title: 'Сессионные ключи временно недоступны', reason: 'Ключи сессии требуют привязки к вашему кошельку в сети. Пока её нет, игра подписывает каждое действие обычным подтверждением в кошельке.' },
      tools_repair: { title: 'Ремонт инструментов временно недоступен', reason: 'Ремонт списывает Кремний и Схему одним действием вместе с восстановлением прочности. Пока в сети не прописаны адреса этих ресурсов, кнопка заблокирована: починить инструмент всё равно не получится, а ресурсы не должны списываться зря.' },
    },
    noCharge: 'Ничего не отправляется и не списывается, пока механика отключена.', supportCode: 'Код для поддержки',
  },
  en: {
    explanations: {
      collectors: { title: 'Collections temporarily unavailable', reason: 'Collection staking will open once the collection set addresses are configured on the network. Until then, collection rewards cannot be awarded correctly.' },
      session: { title: 'Session keys temporarily unavailable', reason: 'Session keys must be bound to your wallet on-chain. Until then, every action uses a normal wallet confirmation.' },
      tools_repair: { title: 'Tool repair temporarily unavailable', reason: 'Repair must consume Silicon and Circuit in the same action that restores durability. Their resource addresses are not yet configured on-chain, so the button remains locked to prevent an incomplete repair or an unnecessary charge.' },
    },
    noCharge: 'Nothing is sent or charged while this feature is disabled.', supportCode: 'Support code',
  },
  pt: {
    explanations: {
      collectors: { title: 'Coleções temporariamente indisponíveis', reason: 'O staking de coleções será liberado quando os endereços dos conjuntos estiverem configurados na rede. Antes disso, não é possível conceder a recompensa corretamente.' },
      session: { title: 'Chaves de sessão temporariamente indisponíveis', reason: 'As chaves de sessão precisam estar vinculadas à sua carteira na rede. Até lá, cada ação exige a confirmação habitual na carteira.' },
      tools_repair: { title: 'Reparo de ferramentas temporariamente indisponível', reason: 'O reparo deve consumir Silício e Circuito na mesma ação em que restaura a durabilidade. Os endereços desses recursos ainda não estão configurados na rede; o botão permanece bloqueado para evitar reparos incompletos ou cobranças indevidas.' },
    },
    noCharge: 'Nada é enviado ou cobrado enquanto este recurso estiver desativado.', supportCode: 'Código para o suporte',
  },
  es: {
    explanations: {
      collectors: { title: 'Colecciones temporalmente no disponibles', reason: 'El staking de colecciones se habilitará cuando las direcciones de sus conjuntos estén configuradas en la red. Antes de eso, no se puede asignar la recompensa correctamente.' },
      session: { title: 'Claves de sesión temporalmente no disponibles', reason: 'Las claves de sesión deben estar vinculadas a tu cartera en la red. Mientras tanto, cada acción requiere una confirmación normal de la cartera.' },
      tools_repair: { title: 'Reparación de herramientas temporalmente no disponible', reason: 'Reparar debe consumir Silicio y Circuito en la misma acción que restaura la durabilidad. Sus direcciones aún no están configuradas en la red; el botón sigue bloqueado para evitar reparaciones incompletas o cargos indebidos.' },
    },
    noCharge: 'No se envía ni se cobra nada mientras esta función esté desactivada.', supportCode: 'Código para asistencia',
  },
  vi: {
    explanations: {
      collectors: { title: 'Bộ sưu tập tạm thời chưa khả dụng', reason: 'Chỉ có thể đặt cọc bộ sưu tập khi địa chỉ của các bộ đã được cấu hình trên mạng. Trước đó, không thể trao thưởng chính xác.' },
      session: { title: 'Khóa phiên tạm thời chưa khả dụng', reason: 'Khóa phiên phải được liên kết với ví của bạn trên chuỗi. Trước lúc đó, mỗi thao tác vẫn cần xác nhận thông thường trong ví.' },
      tools_repair: { title: 'Tạm thời chưa thể sửa công cụ', reason: 'Sửa chữa phải tiêu hao Silic và Mạch trong cùng thao tác khôi phục độ bền. Địa chỉ các tài nguyên này chưa được cấu hình trên mạng, nên nút vẫn bị khóa để tránh sửa chữa thiếu bước hoặc trừ phí vô ích.' },
    },
    noCharge: 'Không có giao dịch hay khoản trừ nào khi tính năng bị tắt.', supportCode: 'Mã hỗ trợ',
  },
  id: {
    explanations: {
      collectors: { title: 'Koleksi sementara tidak tersedia', reason: 'Staking koleksi akan dibuka setelah alamat set koleksi dikonfigurasi di jaringan. Sebelum itu, hadiah koleksi tidak dapat diberikan dengan benar.' },
      session: { title: 'Kunci sesi sementara tidak tersedia', reason: 'Kunci sesi harus ditautkan ke dompetmu di blockchain. Sampai saat itu, setiap tindakan memerlukan konfirmasi biasa di dompet.' },
      tools_repair: { title: 'Perbaikan peralatan sementara tidak tersedia', reason: 'Perbaikan harus menghabiskan Silikon dan Sirkuit dalam satu tindakan bersama pemulihan daya tahan. Alamat sumber daya tersebut belum dikonfigurasi di jaringan, jadi tombol tetap dikunci agar tidak terjadi perbaikan sebagian atau tagihan yang sia-sia.' },
    },
    noCharge: 'Tidak ada transaksi atau biaya saat fitur ini dinonaktifkan.', supportCode: 'Kode dukungan',
  },
  fil: {
    explanations: {
      collectors: { title: 'Pansamantalang hindi magamit ang mga koleksiyon', reason: 'Magbubukas ang staking ng koleksiyon kapag naitakda na sa network ang mga address ng mga set. Bago iyon, hindi maibibigay nang tama ang gantimpala.' },
      session: { title: 'Pansamantalang hindi magamit ang mga session key', reason: 'Kailangang maiugnay sa wallet mo sa blockchain ang mga session key. Hangga’t hindi pa, karaniwang pagkumpirma sa wallet ang kailangan sa bawat hakbang.' },
      tools_repair: { title: 'Pansamantalang hindi magamit ang pagkukumpuni', reason: 'Kailangang sabay na gamitin ang Silikon at Sirkito sa pagpapanumbalik ng tibay. Hindi pa nakatakda sa network ang mga address ng mga ito, kaya naka-lock ang pindutan upang maiwasan ang hindi kumpletong kumpuni o walang saysay na singil.' },
    },
    noCharge: 'Walang ipinapadalang transaksyon o sinisingil habang nakasara ang tampok na ito.', supportCode: 'Kodigo para sa suporta',
  },
};
