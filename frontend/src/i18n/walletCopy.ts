import { legalUnavailableCopy } from './legalUnavailableCopy';
import type { Language } from './translations';

type Copy = {
  connecting: string; connect: string; disconnect: string; phantom: string; failed: string;
  safetyTitle: string; seedWarning: string; signatureWarning: string;
  acknowledge: string; disclaimer: string;
  continue: string; cancel: string;
};

/** Informational wallet warning, not consent or a contractual document.
 * The former terms, privacy policy and risk disclosure are not published. */
export const walletCopy: Record<Language, Copy> = {
  ru: {
    connecting: 'Подключение…', connect: 'Подключить кошелёк', disconnect: 'Отключить кошелёк', phantom: 'Нет кошелька? Открыть в Phantom', failed: 'Не удалось выполнить действие с кошельком. Проверьте приложение и его разрешения.',
    safetyTitle: 'Перед подключением кошелька', seedWarning: 'Никогда не вводите seed-фразу или приватный ключ. Подключение раскрывает приложению публичный адрес; последующие запросы могут передать его серверу и RPC.',
    signatureWarning: 'Подключение не разрешает произвольные списания. Перед каждой подписью проверьте сеть, сумму, получателя, комиссии и разрешения. Непонятный запрос отклоните.',
    acknowledge: 'Я понимаю предупреждение и хочу запросить подключение кошелька.',
    disclaimer: `Это не согласие на маркетинг и не подпись транзакции. ${legalUnavailableCopy.ru.notice}`,
    continue: 'Продолжить в кошельке', cancel: 'Отмена',
  },
  en: {
    connecting: 'Connecting…', connect: 'Connect wallet', disconnect: 'Disconnect wallet', phantom: 'No wallet? Open in Phantom', failed: 'Wallet action failed. Check your wallet app and its permissions.',
    safetyTitle: 'Before connecting your wallet', seedWarning: 'Never enter your recovery phrase or private key. Connecting reveals your public address to this app; later requests may share it with the server and RPC provider.',
    signatureWarning: 'Connecting does not authorize arbitrary payments. Before signing, check the network, amount, recipient, fees and permissions. Reject any request you do not understand.',
    acknowledge: 'I understand this warning and want to request a wallet connection.',
    disclaimer: `This is not marketing consent or a transaction signature. ${legalUnavailableCopy.en.notice}`,
    continue: 'Continue in wallet', cancel: 'Cancel',
  },
  pt: {
    connecting: 'A ligar…', connect: 'Ligar carteira', disconnect: 'Desligar carteira', phantom: 'Sem carteira? Abrir no Phantom', failed: 'Não foi possível realizar a ação na carteira. Verifica a aplicação e as permissões.',
    safetyTitle: 'Antes de ligar a carteira', seedWarning: 'Nunca introduzas a frase de recuperação nem a chave privada. Ao ligares a carteira, revelas o endereço público à aplicação; pedidos posteriores podem partilhá-lo com o servidor e o fornecedor RPC.',
    signatureWarning: 'Ligar a carteira não autoriza pagamentos arbitrários. Antes de assinar, verifica a rede, o valor, o destinatário, as taxas e as permissões. Rejeita pedidos que não compreendas.',
    acknowledge: 'Compreendo este aviso e quero pedir a ligação da carteira.',
    disclaimer: `Isto não é consentimento para publicidade nem uma assinatura de transação. ${legalUnavailableCopy.pt.notice}`,
    continue: 'Continuar na carteira', cancel: 'Cancelar',
  },
  es: {
    connecting: 'Conectando…', connect: 'Conectar cartera', disconnect: 'Desconectar cartera', phantom: '¿No tienes cartera? Abrir en Phantom', failed: 'No se pudo completar la acción en la cartera. Comprueba la aplicación y sus permisos.',
    safetyTitle: 'Antes de conectar tu cartera', seedWarning: 'Nunca introduzcas tu frase de recuperación ni tu clave privada. Al conectar la cartera, revelas tu dirección pública a la aplicación; otras solicitudes podrían compartirla con el servidor y el proveedor RPC.',
    signatureWarning: 'Conectar la cartera no autoriza pagos arbitrarios. Antes de firmar, comprueba la red, el importe, el destinatario, las comisiones y los permisos. Rechaza cualquier solicitud que no entiendas.',
    acknowledge: 'Entiendo este aviso y quiero solicitar la conexión de mi cartera.',
    disclaimer: `Esto no es consentimiento publicitario ni una firma de transacción. ${legalUnavailableCopy.es.notice}`,
    continue: 'Continuar en la cartera', cancel: 'Cancelar',
  },
  vi: {
    connecting: 'Đang kết nối…', connect: 'Kết nối ví', disconnect: 'Ngắt kết nối ví', phantom: 'Chưa có ví? Mở bằng Phantom', failed: 'Không thể thực hiện thao tác với ví. Hãy kiểm tra ứng dụng và quyền truy cập.',
    safetyTitle: 'Trước khi kết nối ví', seedWarning: 'Đừng bao giờ nhập cụm từ khôi phục hoặc khóa riêng. Khi kết nối, ứng dụng sẽ thấy địa chỉ công khai của bạn; các yêu cầu sau đó có thể gửi địa chỉ này đến máy chủ và nhà cung cấp RPC.',
    signatureWarning: 'Kết nối ví không cho phép tự ý trừ tiền. Trước khi ký, hãy kiểm tra mạng, số tiền, người nhận, phí và các quyền được cấp. Từ chối yêu cầu mà bạn không hiểu.',
    acknowledge: 'Tôi đã hiểu cảnh báo này và muốn yêu cầu kết nối ví.',
    disclaimer: `Đây không phải sự đồng ý nhận quảng cáo hay chữ ký giao dịch. ${legalUnavailableCopy.vi.notice}`,
    continue: 'Tiếp tục trong ví', cancel: 'Hủy',
  },
  id: {
    connecting: 'Menghubungkan…', connect: 'Hubungkan dompet', disconnect: 'Putuskan dompet', phantom: 'Belum punya dompet? Buka di Phantom', failed: 'Tindakan pada dompet gagal. Periksa aplikasi dompet dan izinnya.',
    safetyTitle: 'Sebelum menghubungkan dompet', seedWarning: 'Jangan pernah masukkan frasa pemulihan atau kunci privat. Saat terhubung, alamat publikmu terlihat oleh aplikasi; permintaan berikutnya dapat mengirimkannya ke server dan penyedia RPC.',
    signatureWarning: 'Menghubungkan dompet tidak mengizinkan pembayaran sembarangan. Sebelum menandatangani, periksa jaringan, jumlah, penerima, biaya, dan izin. Tolak permintaan yang tidak kamu pahami.',
    acknowledge: 'Saya memahami peringatan ini dan ingin menghubungkan dompet.',
    disclaimer: `Ini bukan persetujuan pemasaran atau tanda tangan transaksi. ${legalUnavailableCopy.id.notice}`,
    continue: 'Lanjutkan di dompet', cancel: 'Batal',
  },
  fil: {
    connecting: 'Kumokonekta…', connect: 'Ikonekta ang wallet', disconnect: 'Idiskonekta ang wallet', phantom: 'Walang wallet? Buksan sa Phantom', failed: 'Hindi natuloy ang kilos sa wallet. Suriin ang wallet app at mga pahintulot nito.',
    safetyTitle: 'Bago ikonekta ang wallet', seedWarning: 'Huwag kailanman ilagay ang recovery phrase o private key. Makikita ng app ang pampublikong address mo kapag kumonekta; maaari itong maipadala sa server at RPC provider sa mga susunod na kahilingan.',
    signatureWarning: 'Hindi pahintulot sa kahit anong singil ang pagkonekta ng wallet. Bago pumirma, suriin ang network, halaga, tatanggap, bayarin, at mga pahintulot. Tanggihan ang hindi malinaw na kahilingan.',
    acknowledge: 'Nauunawaan ko ang babalang ito at gusto kong ikonekta ang wallet.',
    disclaimer: `Hindi ito pahintulot sa marketing o lagda sa transaksiyon. ${legalUnavailableCopy.fil.notice}`,
    continue: 'Magpatuloy sa wallet', cancel: 'Kanselahin',
  },
};
