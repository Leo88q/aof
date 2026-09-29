import type { Language } from './translations';

/** Local errors raised by our own adapter and response handler. Provider/RPC
 * errors are external data and must not be guessed into a successful state. */
type Copy = {
  missingAccount: string; cannotSignMessage: string; notConnected: string;
  missingSignature: string; cannotSend: string; missingTxSignature: string;
  notFound: string; notFoundShort: string; unavailable: string;
  invalidResponse: string; expectedTransaction: string; pending: string; connectWallet: string; unconfirmedResponse: string;
};
export const walletRuntimeCopy: Record<Language, Copy> = {
  ru: {
    missingAccount: 'Кошелёк не вернул аккаунт Solana', cannotSignMessage: 'Кошелёк не поддерживает подпись сообщений',
    notConnected: 'Кошелёк не подключён', missingSignature: 'Кошелёк не вернул подпись',
    cannotSend: 'Кошелёк не поддерживает отправку транзакций', missingTxSignature: 'Кошелёк не вернул подпись транзакции',
    notFound: 'Кошелёк не найден. Установите Phantom или откройте игру во встроенном браузере Phantom.',
    notFoundShort: 'Кошелёк не найден. Установите Phantom.', unavailable: 'Кошелёк недоступен',
    invalidResponse: 'Некорректный ответ сервера', expectedTransaction: 'Ответ сервера не содержит транзакцию для проверки перед подписью',
    pending: 'Ответ сервера: операция ожидает подтверждения. Проверьте кошелёк и сеть перед повтором.', connectWallet: 'Подключите кошелёк (кнопка вверху экрана)',
    unconfirmedResponse: 'Не удалось подтвердить результат операции. Проверьте кошелёк и сеть перед повтором.',
  },
  en: {
    missingAccount: 'The wallet did not return a Solana account', cannotSignMessage: 'The wallet cannot sign messages',
    notConnected: 'The wallet is not connected', missingSignature: 'The wallet did not return a signature',
    cannotSend: 'The wallet cannot send transactions', missingTxSignature: 'The wallet did not return a transaction signature',
    notFound: 'No wallet found. Install Phantom or open the game in Phantom’s in-app browser.',
    notFoundShort: 'No wallet found. Install Phantom.', unavailable: 'Wallet unavailable',
    invalidResponse: 'Invalid server response', expectedTransaction: 'The server response has no transaction to check before signing',
    pending: 'The server reports that the operation is pending. Check your wallet and network before trying again.', connectWallet: 'Connect your wallet using the button above',
    unconfirmedResponse: 'Could not confirm the outcome. Check your wallet and network before trying again.',
  },
  pt: {
    missingAccount: 'A carteira não devolveu uma conta Solana', cannotSignMessage: 'A carteira não pode assinar mensagens',
    notConnected: 'A carteira não está ligada', missingSignature: 'A carteira não devolveu uma assinatura',
    cannotSend: 'A carteira não pode enviar transações', missingTxSignature: 'A carteira não devolveu a assinatura da transação',
    notFound: 'Carteira não encontrada. Instala a Phantom ou abre o jogo no navegador da Phantom.',
    notFoundShort: 'Carteira não encontrada. Instala a Phantom.', unavailable: 'Carteira indisponível',
    invalidResponse: 'Resposta inválida do servidor', expectedTransaction: 'A resposta do servidor não contém uma transação para verificar antes da assinatura',
    pending: 'O servidor indica que a operação está pendente. Verifica a carteira e a rede antes de tentares novamente.', connectWallet: 'Liga a carteira com o botão acima',
    unconfirmedResponse: 'Não foi possível confirmar o resultado. Verifica a carteira e a rede antes de tentares novamente.',
  },
  es: {
    missingAccount: 'La cartera no devolvió una cuenta de Solana', cannotSignMessage: 'La cartera no puede firmar mensajes',
    notConnected: 'La cartera no está conectada', missingSignature: 'La cartera no devolvió una firma',
    cannotSend: 'La cartera no puede enviar transacciones', missingTxSignature: 'La cartera no devolvió la firma de la transacción',
    notFound: 'No se encontró ninguna cartera. Instala Phantom o abre el juego en su navegador integrado.',
    notFoundShort: 'No se encontró ninguna cartera. Instala Phantom.', unavailable: 'Cartera no disponible',
    invalidResponse: 'Respuesta no válida del servidor', expectedTransaction: 'La respuesta del servidor no contiene una transacción que verificar antes de firmar',
    pending: 'El servidor indica que la operación está pendiente. Comprueba tu cartera y la red antes de volver a intentarlo.', connectWallet: 'Conecta la cartera con el botón de arriba',
    unconfirmedResponse: 'No se pudo confirmar el resultado. Comprueba tu cartera y la red antes de volver a intentarlo.',
  },
  vi: {
    missingAccount: 'Ví không trả về tài khoản Solana', cannotSignMessage: 'Ví không hỗ trợ ký tin nhắn',
    notConnected: 'Ví chưa kết nối', missingSignature: 'Ví không trả về chữ ký',
    cannotSend: 'Ví không hỗ trợ gửi giao dịch', missingTxSignature: 'Ví không trả về chữ ký giao dịch',
    notFound: 'Không tìm thấy ví. Hãy cài Phantom hoặc mở trò chơi trong trình duyệt của Phantom.',
    notFoundShort: 'Không tìm thấy ví. Hãy cài Phantom.', unavailable: 'Ví chưa khả dụng',
    invalidResponse: 'Phản hồi từ máy chủ không hợp lệ', expectedTransaction: 'Phản hồi của máy chủ không có giao dịch để kiểm tra trước khi ký',
    pending: 'Máy chủ báo thao tác đang chờ xác nhận. Hãy kiểm tra ví và mạng trước khi thử lại.', connectWallet: 'Kết nối ví bằng nút phía trên',
    unconfirmedResponse: 'Không thể xác nhận kết quả. Hãy kiểm tra ví và mạng trước khi thử lại.',
  },
  id: {
    missingAccount: 'Dompet tidak mengembalikan akun Solana', cannotSignMessage: 'Dompet tidak dapat menandatangani pesan',
    notConnected: 'Dompet belum terhubung', missingSignature: 'Dompet tidak mengembalikan tanda tangan',
    cannotSend: 'Dompet tidak dapat mengirim transaksi', missingTxSignature: 'Dompet tidak mengembalikan tanda tangan transaksi',
    notFound: 'Dompet tidak ditemukan. Pasang Phantom atau buka gim di peramban bawaan Phantom.',
    notFoundShort: 'Dompet tidak ditemukan. Pasang Phantom.', unavailable: 'Dompet tidak tersedia',
    invalidResponse: 'Respons server tidak valid', expectedTransaction: 'Respons server tidak memuat transaksi untuk diperiksa sebelum ditandatangani',
    pending: 'Server menyatakan operasi masih tertunda. Periksa dompet dan jaringan sebelum mencoba lagi.', connectWallet: 'Hubungkan dompet dengan tombol di atas',
    unconfirmedResponse: 'Hasil operasi tidak dapat dikonfirmasi. Periksa dompet dan jaringan sebelum mencoba lagi.',
  },
  fil: {
    missingAccount: 'Walang ibinalik na Solana account ang wallet', cannotSignMessage: 'Hindi kayang pumirma ng mensahe ang wallet',
    notConnected: 'Hindi nakakonekta ang wallet', missingSignature: 'Walang ibinalik na lagda ang wallet',
    cannotSend: 'Hindi kayang magpadala ng transaksiyon ang wallet', missingTxSignature: 'Walang ibinalik na lagda ng transaksiyon ang wallet',
    notFound: 'Walang wallet. I-install ang Phantom o buksan ang laro sa browser nito.',
    notFoundShort: 'Walang wallet. I-install ang Phantom.', unavailable: 'Hindi magamit ang wallet',
    invalidResponse: 'Hindi wastong sagot mula sa server', expectedTransaction: 'Walang transaksiyon sa sagot ng server na masusuri bago pumirma',
    pending: 'Ayon sa server, nakabinbin pa ang operasyon. Suriin ang wallet at network bago subukang muli.', connectWallet: 'Ikonekta ang wallet gamit ang pindutan sa itaas',
    unconfirmedResponse: 'Hindi makumpirma ang resulta. Suriin ang wallet at network bago subukang muli.',
  },
};
