import type { Language } from './translations';

/** Validation text only. Never round a price, reinterpret a signature or
 * encourage retrying an unconfirmed payment. The guard/confirmation policy
 * lives in lib/amounts.ts and lib/confirmation.ts, not in this catalog. */
type Copy = {
  positiveU64: string;
  solPrecision: string;
  invalidSignature: string;
  executionFailed: string;
  confirmationUnknown: string;
};
export const transactionValidationCopy: Record<Language, Copy> = {
  ru: {
    positiveU64: 'Сумма должна быть точной положительной строкой u64',
    solPrecision: 'SOL: не более 9 знаков после точки',
    invalidSignature: 'Некорректная подпись транзакции',
    executionFailed: 'Транзакция не исполнена',
    confirmationUnknown: 'Статус неизвестен. Не повторяйте оплату до проверки транзакции',
  },
  en: {
    positiveU64: 'Enter an exact, positive u64 amount',
    solPrecision: 'SOL amounts can have at most 9 decimal places',
    invalidSignature: 'Invalid transaction signature',
    executionFailed: 'The transaction was not executed',
    confirmationUnknown: 'Confirmation is unknown. Do not pay again until you check the transaction',
  },
  pt: {
    positiveU64: 'Introduz um valor u64 positivo e exato',
    solPrecision: 'Valores em SOL admitem no máximo 9 casas decimais',
    invalidSignature: 'Assinatura de transação inválida',
    executionFailed: 'A transação não foi executada',
    confirmationUnknown: 'Não foi possível confirmar o estado. Não voltes a pagar sem verificar a transação',
  },
  es: {
    positiveU64: 'Introduce un importe u64 positivo y exacto',
    solPrecision: 'Los importes en SOL admiten como máximo 9 decimales',
    invalidSignature: 'Firma de transacción no válida',
    executionFailed: 'La transacción no se ejecutó',
    confirmationUnknown: 'Se desconoce el estado. No vuelvas a pagar hasta comprobar la transacción',
  },
  vi: {
    positiveU64: 'Hãy nhập lượng u64 dương và chính xác',
    solPrecision: 'Số SOL có tối đa 9 chữ số thập phân',
    invalidSignature: 'Chữ ký giao dịch không hợp lệ',
    executionFailed: 'Giao dịch chưa được thực hiện',
    confirmationUnknown: 'Chưa rõ trạng thái xác nhận. Đừng thanh toán lại trước khi kiểm tra giao dịch',
  },
  id: {
    positiveU64: 'Masukkan jumlah u64 positif yang tepat',
    solPrecision: 'Jumlah SOL boleh memiliki paling banyak 9 angka desimal',
    invalidSignature: 'Tanda tangan transaksi tidak valid',
    executionFailed: 'Transaksi tidak dieksekusi',
    confirmationUnknown: 'Status konfirmasi belum diketahui. Jangan membayar lagi sebelum memeriksa transaksi',
  },
  fil: {
    positiveU64: 'Maglagay ng eksaktong positibong halaga na u64',
    solPrecision: 'Hanggang 9 na decimal place lang ang halaga ng SOL',
    invalidSignature: 'Hindi wastong lagda ng transaksiyon',
    executionFailed: 'Hindi naisagawa ang transaksiyon',
    confirmationUnknown: 'Hindi pa alam ang status ng kumpirmasyon. Huwag magbayad muli bago suriin ang transaksiyon',
  },
};
