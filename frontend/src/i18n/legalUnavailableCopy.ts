import type { Language } from './translations';

/** No legal policy, contract, approval or privacy guarantee is implied here. */
export const legalUnavailableCopy: Record<Language, {
  title: string; notice: string; visibility: string; storage: string; archive: string; link: string;
}> = {
  ru: {
    title: 'Юридические документы не опубликованы',
    notice: 'Тексты юридических проектов и история редакций сняты с публикации. Здесь нет утверждённой политики конфиденциальности или условий использования. Это не разрешение на запуск сервиса.',
    visibility: 'Режим инкогнито не делает действия конфиденциальными: браузер, серверы и RPC могут получать технические данные, а подтверждённые операции в Solana публичны. Не отправляйте секретную фразу, личные данные или средства, если условия не проверены.',
    storage: 'Локальное хранение в этом браузере',
    archive: 'Архивные редакции больше не опубликованы.',
    link: 'Статус документов',
  },
  en: {
    title: 'Legal documents are not published',
    notice: 'Draft legal texts and revision history have been withdrawn. No approved privacy policy or terms of use are available here. This is not permission to launch the service.',
    visibility: 'Private browsing does not make actions confidential: browsers, servers and RPC providers may receive technical data, and confirmed Solana transactions are public. Do not submit a recovery phrase, personal data or funds before the terms have been reviewed.',
    storage: 'Local storage in this browser',
    archive: 'Archived editions are no longer published.',
    link: 'Document status',
  },
  pt: {
    title: 'Os documentos legais não estão publicados',
    notice: 'As minutas jurídicas e o histórico de versões foram retirados. Não há aqui política de privacidade nem termos de utilização aprovados. Isto não autoriza o lançamento do serviço.',
    visibility: 'A navegação privada não torna as ações confidenciais: navegador, servidores e provedores de RPC podem receber dados técnicos, e as transações confirmadas na Solana são públicas. Não forneças a frase de recuperação, dados pessoais ou fundos antes da revisão dos termos.',
    storage: 'Armazenamento local neste navegador',
    archive: 'As versões arquivadas deixaram de estar publicadas.',
    link: 'Estado dos documentos',
  },
  es: {
    title: 'Los documentos legales no están publicados',
    notice: 'Se han retirado los borradores legales y el historial de versiones. Aquí no hay una política de privacidad ni condiciones de uso aprobadas. Esto no autoriza el lanzamiento del servicio.',
    visibility: 'La navegación privada no hace confidenciales tus acciones: el navegador, los servidores y los proveedores de RPC pueden recibir datos técnicos, y las transacciones confirmadas en Solana son públicas. No facilites tu frase de recuperación, datos personales ni fondos antes de revisar las condiciones.',
    storage: 'Almacenamiento local en este navegador',
    archive: 'Las versiones archivadas ya no están publicadas.',
    link: 'Estado de los documentos',
  },
  vi: {
    title: 'Chưa công bố tài liệu pháp lý',
    notice: 'Các bản dự thảo pháp lý và lịch sử phiên bản đã được gỡ xuống. Ở đây chưa có chính sách quyền riêng tư hoặc điều khoản sử dụng được phê duyệt. Điều này không cho phép đưa dịch vụ vào hoạt động.',
    visibility: 'Chế độ duyệt web riêng tư không khiến hoạt động trở thành bí mật: trình duyệt, máy chủ và nhà cung cấp RPC có thể nhận dữ liệu kỹ thuật, còn giao dịch Solana đã xác nhận là công khai. Đừng gửi cụm từ khôi phục, dữ liệu cá nhân hoặc tiền trước khi các điều khoản được xem xét.',
    storage: 'Dữ liệu lưu cục bộ trong trình duyệt này',
    archive: 'Các phiên bản lưu trữ không còn được công bố.',
    link: 'Tình trạng tài liệu',
  },
  id: {
    title: 'Dokumen hukum belum diterbitkan',
    notice: 'Draf hukum dan riwayat revisinya telah ditarik. Tidak ada kebijakan privasi atau ketentuan penggunaan yang disetujui di sini. Ini bukan izin untuk meluncurkan layanan.',
    visibility: 'Mode penyamaran tidak membuat tindakan bersifat rahasia: peramban, server, dan penyedia RPC dapat menerima data teknis, sementara transaksi Solana yang terkonfirmasi bersifat publik. Jangan kirim frasa pemulihan, data pribadi, atau dana sebelum ketentuan ditinjau.',
    storage: 'Penyimpanan lokal di peramban ini',
    archive: 'Versi arsip tidak lagi diterbitkan.',
    link: 'Status dokumen',
  },
  fil: {
    title: 'Hindi nakalathala ang mga dokumentong legal',
    notice: 'Inalis ang mga burador na legal at kasaysayan ng rebisyon. Walang aprubadong patakaran sa privacy o mga tuntunin ng paggamit dito. Hindi ito pahintulot na ilunsad ang serbisyo.',
    visibility: 'Hindi nagiging kumpidensiyal ang mga gawain sa pribadong pag-browse: maaaring tumanggap ng teknikal na datos ang browser, mga server at tagapagbigay ng RPC, at pampubliko ang mga kumpirmadong transaksiyon sa Solana. Huwag magbigay ng parirala sa pagbawi, personal na datos o pondo bago masuri ang mga tuntunin.',
    storage: 'Lokal na imbakan sa browser na ito',
    archive: 'Hindi na nakalathala ang mga nakaarkibong bersiyon.',
    link: 'Kalagayan ng mga dokumento',
  },
};
