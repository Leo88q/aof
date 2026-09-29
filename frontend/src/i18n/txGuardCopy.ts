import type { Language } from './translations';

/** Transaction guard text, not the policy. Every rejection stays a rejection. */
type Copy = {
  payer: string; payerWarning: string;
  blockedProgram: string; suspiciousProgram: string;
  blockedAddress: string; blockedAddressWarning: string;
  highCost: (sol: string, limit: string) => string;
  tokenNoLimit: string; highTokenSpend: (mint: string, amount: number, limit: number) => string;
  unknownPrograms: string; checkFailed: string; feeFailed: string; simulationError: string;
};
export const txGuardCopy: Record<Language, Copy> = {
  ru: {
    payer: 'Плательщик транзакции не совпадает с подключённым кошельком', payerWarning: 'Неожиданный fee payer',
    blockedProgram: '🚨 Обнаружена заблокированная программа:', suspiciousProgram: 'Попытка взаимодействия с подозрительной программой',
    blockedAddress: '🚨 Обнаружен заблокированный адрес:', blockedAddressWarning: 'Транзакция содержит заблокированный аккаунт',
    highCost: (sol, limit) => `⚠️ Высокая стоимость: ${sol} SOL (лимит ${limit})`,
    tokenNoLimit: '⚠️ Исходящий SPL-токен без настроенного лимита:',
    highTokenSpend: (mint, amount, limit) => `⚠️ Большое списание токена ${mint}: ${amount} (лимит ${limit})`,
    unknownPrograms: '⚠️ Неизвестные программы:', checkFailed: 'Не удалось проверить транзакцию. Подпись заблокирована.', feeFailed: 'Не удалось проверить network fee; подпись заблокирована.',
    simulationError: 'Ошибка проверки транзакции',
  },
  en: {
    payer: 'The transaction fee payer does not match the connected wallet', payerWarning: 'Unexpected fee payer',
    blockedProgram: '🚨 Blocked program detected:', suspiciousProgram: 'Attempt to interact with a blocked program',
    blockedAddress: '🚨 Blocked address detected:', blockedAddressWarning: 'Transaction contains a blocked account',
    highCost: (sol, limit) => `⚠️ High outgoing SOL amount: ${sol} SOL (limit ${limit})`,
    tokenNoLimit: '⚠️ Outgoing SPL token without a configured limit:',
    highTokenSpend: (mint, amount, limit) => `⚠️ Token outflow exceeds the limit ${mint}: ${amount} (limit ${limit})`,
    unknownPrograms: '⚠️ Unrecognized programs:', checkFailed: 'Could not verify the transaction. Signing was blocked.', feeFailed: 'Could not verify the network fee or its limit. Signing was blocked.',
    simulationError: 'Transaction verification error',
  },
  pt: {
    payer: 'Quem paga as taxas não corresponde à carteira conectada', payerWarning: 'Pagador de taxas inesperado',
    blockedProgram: '🚨 Programa bloqueado detectado:', suspiciousProgram: 'Tentativa de usar um programa bloqueado',
    blockedAddress: '🚨 Endereço bloqueado detectado:', blockedAddressWarning: 'A transação contém uma conta bloqueada',
    highCost: (sol, limit) => `⚠️ Saída elevada de SOL: ${sol} SOL (limite ${limit})`,
    tokenNoLimit: '⚠️ Token SPL de saída sem limite configurado:',
    highTokenSpend: (mint, amount, limit) => `⚠️ Saída de token acima do limite ${mint}: ${amount} (limite ${limit})`,
    unknownPrograms: '⚠️ Programas não reconhecidos:', checkFailed: 'Não foi possível verificar a transação. A assinatura foi bloqueada.', feeFailed: 'Não foi possível verificar a taxa de rede ou seu limite. A assinatura foi bloqueada.',
    simulationError: 'Erro na verificação da transação',
  },
  es: {
    payer: 'Quien paga las comisiones no coincide con la cartera conectada', payerWarning: 'Pagador de comisiones inesperado',
    blockedProgram: '🚨 Programa bloqueado detectado:', suspiciousProgram: 'Intento de usar un programa bloqueado',
    blockedAddress: '🚨 Dirección bloqueada detectada:', blockedAddressWarning: 'La transacción contiene una cuenta bloqueada',
    highCost: (sol, limit) => `⚠️ Salida elevada de SOL: ${sol} SOL (límite ${limit})`,
    tokenNoLimit: '⚠️ Token SPL saliente sin límite configurado:',
    highTokenSpend: (mint, amount, limit) => `⚠️ Salida de token superior al límite ${mint}: ${amount} (límite ${limit})`,
    unknownPrograms: '⚠️ Programas no reconocidos:', checkFailed: 'No se pudo verificar la transacción. Se ha bloqueado la firma.', feeFailed: 'No se pudo verificar la comisión de red o su límite. Se ha bloqueado la firma.',
    simulationError: 'Error al verificar la transacción',
  },
  vi: {
    payer: 'Tài khoản trả phí không khớp với ví đang kết nối', payerWarning: 'Tài khoản trả phí không hợp lệ',
    blockedProgram: '🚨 Phát hiện chương trình bị chặn:', suspiciousProgram: 'Đã thử tương tác với chương trình bị chặn',
    blockedAddress: '🚨 Phát hiện địa chỉ bị chặn:', blockedAddressWarning: 'Giao dịch có tài khoản bị chặn',
    highCost: (sol, limit) => `⚠️ Số SOL chuyển đi lớn: ${sol} SOL (giới hạn ${limit})`,
    tokenNoLimit: '⚠️ Token SPL chuyển đi chưa có giới hạn:',
    highTokenSpend: (mint, amount, limit) => `⚠️ Số token chuyển đi vượt giới hạn ${mint}: ${amount} (giới hạn ${limit})`,
    unknownPrograms: '⚠️ Chương trình không xác định:', checkFailed: 'Không thể xác minh giao dịch. Đã chặn việc ký.', feeFailed: 'Không thể xác minh phí mạng hoặc giới hạn phí. Đã chặn việc ký.',
    simulationError: 'Lỗi xác minh giao dịch',
  },
  id: {
    payer: 'Pembayar biaya transaksi tidak cocok dengan dompet yang terhubung', payerWarning: 'Pembayar biaya tidak terduga',
    blockedProgram: '🚨 Program yang diblokir terdeteksi:', suspiciousProgram: 'Upaya memakai program yang diblokir',
    blockedAddress: '🚨 Alamat yang diblokir terdeteksi:', blockedAddressWarning: 'Transaksi memuat akun yang diblokir',
    highCost: (sol, limit) => `⚠️ Jumlah SOL keluar terlalu besar: ${sol} SOL (batas ${limit})`,
    tokenNoLimit: '⚠️ Token SPL keluar tanpa batas yang ditetapkan:',
    highTokenSpend: (mint, amount, limit) => `⚠️ Token keluar melebihi batas ${mint}: ${amount} (batas ${limit})`,
    unknownPrograms: '⚠️ Program tak dikenal:', checkFailed: 'Transaksi tidak dapat diverifikasi. Penandatanganan diblokir.', feeFailed: 'Biaya jaringan atau batasnya tidak dapat diverifikasi. Penandatanganan diblokir.',
    simulationError: 'Kesalahan verifikasi transaksi',
  },
  fil: {
    payer: 'Hindi tugma sa konektadong wallet ang magbabayad ng fee', payerWarning: 'Hindi inaasahang magbabayad ng fee',
    blockedProgram: '🚨 May nakitang naka-block na programa:', suspiciousProgram: 'Sinubukang gumamit ng naka-block na programa',
    blockedAddress: '🚨 May nakitang naka-block na address:', blockedAddressWarning: 'May naka-block na account sa transaksiyon',
    highCost: (sol, limit) => `⚠️ Mataas ang SOL na palabas: ${sol} SOL (limitasyon ${limit})`,
    tokenNoLimit: '⚠️ Papalabas na SPL token na walang itinakdang limitasyon:',
    highTokenSpend: (mint, amount, limit) => `⚠️ Lumampas sa limitasyon ang token ${mint}: ${amount} (limitasyon ${limit})`,
    unknownPrograms: '⚠️ Hindi kilalang mga programa:', checkFailed: 'Hindi ma-verify ang transaksiyon. Na-block ang pagpirma.', feeFailed: 'Hindi ma-verify ang network fee o limitasyon nito. Na-block ang pagpirma.',
    simulationError: 'May error sa pag-verify ng transaksiyon',
  },
};
