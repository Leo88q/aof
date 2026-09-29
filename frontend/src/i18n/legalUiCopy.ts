import type { Language } from './translations';

// Local-storage controls and document-status navigation only; no published legal drafts.
const keys = ['nav', 'contacts', 'interLicense', 'monoLicense', 'playfairLicense', 'safety', 'choiceLabel', 'banner', 'accept', 'necessaryOnly', 'configure', 'settings', 'heading', 'details', 'storageLink', 'privacyLink', 'necessary', 'functional', 'analytics', 'gpc', 'decline', 'save', 'savedLocal', 'savedSession', 'savedMemory', 'choiceRecord', 'version', 'date', 'browserRecord'] as const;
type Key = typeof keys[number];
const copy = (values: readonly string[]): Record<Key, string> => {
  if (values.length !== keys.length || values.some(value => !value)) throw new Error('Incomplete privacy interface translation');
  return Object.fromEntries(keys.map((key, i) => [key, values[i]])) as Record<Key, string>;
};
export const legalUiCopy: Record<Language, Record<Key, string>> = {
  ru: copy([
    'Правовые документы','Контакты и оператор','Лицензия Inter','Лицензия JetBrains Mono','Лицензия Playfair Display',
    'Никогда не вводите seed-фразу или приватный ключ. Токены и NFT не гарантируют доход. Перед подписью проверяйте сумму, получателя, комиссию и разрешения.',
    'Выбор локального хранения','Необходимая запись хранит ваш выбор. Локальный журнал и настройки — только с вашего разрешения. Аналитики и рекламы нет. Отказ не закрывает доступ к игре.',
    'Принять функциональные','Только необходимое','Настроить','Настройки cookies','Ваш выбор хранения',
    'Необходимая запись сохраняет только ваш выбор. Необязательные настройки и журнал сайта — только с разрешения. Аналитика и реклама здесь не подключены. Отказ не закрывает доступ к сайту.',
    'Состав и сроки хранения','Конфиденциальность','Необходимое хранение выбора','Функциональные настройки и журнал','Аналитика: выключена. Маркетинг: выключен.','Получен Global Privacy Control: необязательное хранение выключено.',
    'Отклонить необязательные','Сохранить выбор','Выбор сохранён. Изменить или отозвать его можно здесь в любой момент.',
    'Браузер не разрешил постоянное хранение: выбор действует до закрытия вкладки, но полоса больше не появится.','Хранилище браузера недоступно: выбор действует, пока открыта страница.',
    'Запись выбора','Версия','Дата','Хранится в этом браузере, не является серверным журналом юридического согласия.'
  ]),
  en: copy([
    'Legal documents','Contacts and operator','Inter license','JetBrains Mono license','Playfair Display license',
    'Never enter your seed phrase or private key. Tokens and NFTs do not guarantee a return. Before signing, check the amount, recipient, fee and permissions.',
    'Local storage choice','A necessary record keeps your choice. The local journal and preferences are stored only with your permission. There is no analytics or advertising. Declining does not block the game.',
    'Allow functional storage','Necessary only','Choose settings','Cookie settings','Your storage choice',
    'The necessary record only stores your choice. Optional preferences and the site journal need your permission. Analytics and advertising are not connected. Declining does not block the site.',
    'Storage inventory and periods','Privacy','Necessary choice record','Functional preferences and journal','Analytics: off. Marketing: off.','Global Privacy Control detected: optional storage is off.',
    'Decline optional storage','Save choice','Choice saved. You can change or withdraw it here at any time.',
    'Your browser did not allow persistent storage: this choice lasts until the tab closes, but the banner will not reappear.','Browser storage is unavailable: this choice lasts while the page is open.',
    'Choice record','Version','Date','Stored in this browser; not a server record of legal consent.'
  ]),
  pt: copy([
    'Documentos legais','Contato e operador','Licença Inter','Licença JetBrains Mono','Licença Playfair Display',
    'Nunca digite sua frase de recuperação nem sua chave privada. Tokens e NFTs não garantem rendimentos. Antes de assinar, confira valor, destinatário, taxa e permissões.',
    'Escolha de armazenamento local','Um registro necessário guarda sua escolha. O diário local e as preferências só são guardados com sua autorização. Não há análise de dados nem publicidade. Recusar não impede o acesso ao jogo.',
    'Permitir armazenamento funcional','Somente o necessário','Configurar','Configurações de cookies','Sua escolha de armazenamento',
    'O registro necessário guarda apenas sua escolha. Preferências opcionais e o diário do site dependem da sua autorização. Análise de dados e publicidade não estão ativadas. Recusar não impede o acesso ao site.',
    'Dados armazenados e prazos','Privacidade','Registro necessário da escolha','Preferências e diário funcionais','Análise de dados: desativada. Marketing: desativado.','Global Privacy Control detectado: o armazenamento opcional está desativado.',
    'Recusar armazenamento opcional','Salvar escolha','Escolha salva. Você pode alterá-la ou revogá-la aqui a qualquer momento.',
    'O navegador não permitiu armazenamento permanente: a escolha vale até fechar a aba, mas o aviso não reaparecerá.','Armazenamento do navegador indisponível: a escolha vale enquanto a página estiver aberta.',
    'Registro da escolha','Versão','Data','Guardado neste navegador; não é um registro de consentimento legal no servidor.'
  ]),
  es: copy([
    'Documentos legales','Contacto y operador','Licencia Inter','Licencia JetBrains Mono','Licencia Playfair Display',
    'Nunca introduzcas tu frase semilla ni tu clave privada. Los tokens y NFT no garantizan ganancias. Antes de firmar, comprueba el importe, el destinatario, la comisión y los permisos.',
    'Elección de almacenamiento local','Un registro necesario guarda tu elección. El diario local y los ajustes solo se guardan con tu permiso. No hay análisis de datos ni publicidad. Rechazarlo no impide jugar.',
    'Permitir almacenamiento funcional','Solo lo necesario','Configurar','Configuración de cookies','Tu elección de almacenamiento',
    'El registro necesario solo conserva tu elección. Los ajustes opcionales y el diario del sitio requieren tu permiso. No se han conectado servicios de análisis ni publicidad. Rechazarlo no impide usar el sitio.',
    'Datos almacenados y plazos','Privacidad','Registro necesario de la elección','Ajustes y diario funcionales','Análisis: desactivado. Marketing: desactivado.','Global Privacy Control detectado: el almacenamiento opcional está desactivado.',
    'Rechazar almacenamiento opcional','Guardar elección','Elección guardada. Puedes cambiarla o retirarla aquí cuando quieras.',
    'El navegador no permitió guardar datos permanentemente: la elección dura hasta que cierres la pestaña, pero el aviso no reaparecerá.','Almacenamiento del navegador no disponible: la elección dura mientras la página esté abierta.',
    'Registro de elección','Versión','Fecha','Guardado en este navegador; no es un registro de consentimiento legal en el servidor.'
  ]),
  vi: copy([
    'Văn bản pháp lý','Liên hệ và đơn vị vận hành','Giấy phép Inter','Giấy phép JetBrains Mono','Giấy phép Playfair Display',
    'Đừng bao giờ nhập cụm từ khôi phục hoặc khóa riêng. Token và NFT không bảo đảm lợi nhuận. Trước khi ký, hãy kiểm tra số tiền, người nhận, phí và quyền được cấp.',
    'Lựa chọn lưu trữ cục bộ','Bản ghi cần thiết lưu lựa chọn của bạn. Nhật ký cục bộ và tùy chọn chỉ được lưu khi bạn cho phép. Không có công cụ phân tích hay quảng cáo. Từ chối không ngăn bạn chơi.',
    'Cho phép lưu trữ chức năng','Chỉ lưu phần cần thiết','Tùy chỉnh','Cài đặt cookie','Lựa chọn lưu trữ của bạn',
    'Bản ghi cần thiết chỉ lưu lựa chọn của bạn. Tùy chọn bổ sung và nhật ký trang cần bạn cho phép. Công cụ phân tích và quảng cáo chưa được kết nối. Từ chối không ngăn bạn dùng trang.',
    'Dữ liệu lưu trữ và thời hạn','Quyền riêng tư','Bản ghi lựa chọn cần thiết','Tùy chọn và nhật ký chức năng','Phân tích: tắt. Tiếp thị: tắt.','Đã nhận tín hiệu Global Privacy Control: tắt lưu trữ tùy chọn.',
    'Từ chối lưu trữ tùy chọn','Lưu lựa chọn','Đã lưu lựa chọn. Bạn có thể thay đổi hoặc rút lại tại đây bất cứ lúc nào.',
    'Trình duyệt không cho phép lưu lâu dài: lựa chọn có hiệu lực đến khi đóng thẻ, nhưng thông báo sẽ không xuất hiện lại.','Không thể dùng bộ nhớ trình duyệt: lựa chọn có hiệu lực khi trang còn mở.',
    'Bản ghi lựa chọn','Phiên bản','Ngày','Lưu trong trình duyệt này; không phải hồ sơ đồng ý pháp lý trên máy chủ.'
  ]),
  id: copy([
    'Dokumen hukum','Kontak dan operator','Lisensi Inter','Lisensi JetBrains Mono','Lisensi Playfair Display',
    'Jangan pernah memasukkan frasa pemulihan atau kunci privat. Token dan NFT tidak menjamin keuntungan. Sebelum menandatangani, periksa jumlah, penerima, biaya, dan izin.',
    'Pilihan penyimpanan lokal','Catatan wajib menyimpan pilihan Anda. Jurnal lokal dan preferensi hanya disimpan dengan izin Anda. Tidak ada analitik atau iklan. Menolak tidak menghalangi Anda bermain.',
    'Izinkan penyimpanan fungsional','Hanya yang diperlukan','Atur','Pengaturan cookie','Pilihan penyimpanan Anda',
    'Catatan wajib hanya menyimpan pilihan Anda. Preferensi opsional dan jurnal situs memerlukan izin Anda. Analitik dan iklan tidak terpasang. Menolak tidak menghalangi akses situs.',
    'Data yang tersimpan dan masa simpan','Privasi','Catatan pilihan yang diperlukan','Preferensi dan jurnal fungsional','Analitik: nonaktif. Pemasaran: nonaktif.','Global Privacy Control terdeteksi: penyimpanan opsional dinonaktifkan.',
    'Tolak penyimpanan opsional','Simpan pilihan','Pilihan disimpan. Anda dapat mengubah atau mencabutnya di sini kapan saja.',
    'Peramban tidak mengizinkan penyimpanan tetap: pilihan berlaku sampai tab ditutup, tetapi spanduk tidak akan muncul lagi.','Penyimpanan peramban tidak tersedia: pilihan berlaku selama halaman terbuka.',
    'Catatan pilihan','Versi','Tanggal','Disimpan di peramban ini; bukan catatan persetujuan hukum di server.'
  ]),
  fil: copy([
    'Mga legal na dokumento','Kontak at tagapagpatakbo','Lisensiya ng Inter','Lisensiya ng JetBrains Mono','Lisensiya ng Playfair Display',
    'Huwag kailanman ilagay ang seed phrase o pribadong susi. Hindi garantisadong kikita sa token o NFT. Bago pumirma, suriin ang halaga, tatanggap, bayarin, at mga pahintulot.',
    'Pagpili sa lokal na imbakan','Itinatala ng kinakailangang tala ang iyong pagpili. Sa pahintulot mo lang itinatago ang lokal na talaan at mga kagustuhan. Walang analytics o patalastas. Maaari ka pa ring maglaro kung tatanggi ka.',
    'Payagan ang functional na imbakan','Kinakailangan lang','Ayusin','Mga setting ng cookie','Ang iyong pinili sa imbakan',
    'Ang kinakailangang tala ay nagtatago lamang ng iyong pagpili. Kailangan ng pahintulot ang opsiyonal na mga kagustuhan at talaan ng site. Walang nakakabit na analytics o patalastas. Maaari ka pa ring gumamit ng site kung tatanggi ka.',
    'Nakatagong datos at mga panahon','Pagkapribado','Kinakailangang tala ng pagpili','Functional na mga kagustuhan at talaan','Analytics: naka-off. Marketing: naka-off.','Natukoy ang Global Privacy Control: naka-off ang opsiyonal na imbakan.',
    'Tanggihan ang opsiyonal na imbakan','I-save ang pagpili','Nai-save ang pagpili. Maaari mo itong baguhin o bawiin dito anumang oras.',
    'Hindi pinayagan ng browser ang pangmatagalang pag-imbak: hanggang isara ang tab ang pagpili, ngunit hindi na babalik ang paalala.','Hindi magamit ang imbakan ng browser: umiiral ang pagpili habang bukas ang pahina.',
    'Tala ng pagpili','Bersiyon','Petsa','Nakatago sa browser na ito; hindi ito talaan ng legal na pahintulot sa server.'
  ]),
};
