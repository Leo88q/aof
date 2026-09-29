import type { Language } from './translations';

/** Keep the pattern order in lib/vrfErrors.ts aligned with these seven slots.
 * The text describes an error; it cannot prove whether a charge settled or
 * promise a refund. Check the signature and the canonical round/opening. */
export const vrfCopy: Record<Language, readonly [string, string, string, string, string, string, string]> = {
  ru: [
    'Каналы оракула заняты. Перед повтором проверьте статус уже отправленного запроса.',
    'Пул оракула пуст; функция пока недоступна.',
    'Оракулы Switchboard недоступны. Перед повтором проверьте статус операции и кошелёк.',
    'Оракул задерживает раскрытие; новые открытия приостановлены. Проверьте статус уже оплаченных запросов по их подписям. Не оплачивайте повторно, пока результат неизвестен.',
    'Цена изменилась. Получите новую котировку и проверьте сумму перед подписью.',
    'Окно раскрытия закрыто. Проверьте в сети статус запроса и условия возврата.',
    'Продажи билетов на этот раунд закрыты. Проверьте его состояние в сети.',
  ],
  en: [
    'All oracle channels are busy. Check the status of any submitted request before trying again.',
    'The oracle pool is empty; this feature is not available yet.',
    'The Switchboard oracles are unavailable. Check the operation and your wallet before retrying.',
    'The oracle is slow to reveal results; new openings are paused. Check the signatures of paid requests. Do not pay again while the outcome is unknown.',
    'The price has changed. Request a new quote and check the amount before signing.',
    'The reveal window has closed. Check the request status and refund conditions on-chain.',
    'Ticket sales for this round have closed. Check the round status on-chain.',
  ],
  pt: [
    'Os canais do oráculo estão ocupados. Confere o estado de pedidos já enviados antes de tentares novamente.',
    'O grupo de oráculos está vazio; esta função ainda não está disponível.',
    'Os oráculos Switchboard estão indisponíveis. Confere a operação e a carteira antes de tentar novamente.',
    'O oráculo está a demorar a revelar os resultados; novas aberturas estão suspensas. Confere as assinaturas dos pedidos pagos. Não pagues novamente enquanto o resultado for desconhecido.',
    'O preço mudou. Pede uma nova cotação e confere o valor antes de assinar.',
    'O prazo de revelação terminou. Confere na rede o estado do pedido e as condições de reembolso.',
    'As vendas de bilhetes desta rodada terminaram. Confere o estado da rodada na rede.',
  ],
  es: [
    'Los canales del oráculo están ocupados. Comprueba el estado de los pedidos ya enviados antes de reintentar.',
    'No hay oráculos en el grupo; esta función aún no está disponible.',
    'Los oráculos Switchboard no están disponibles. Comprueba la operación y tu cartera antes de reintentar.',
    'El oráculo tarda en revelar resultados; las nuevas aperturas están en pausa. Comprueba las firmas de los pedidos pagados. No vuelvas a pagar mientras se desconozca el resultado.',
    'El precio ha cambiado. Solicita una nueva cotización y comprueba el importe antes de firmar.',
    'El plazo de revelación ha terminado. Comprueba en la red el estado de la solicitud y las condiciones de reembolso.',
    'La venta de boletos de esta ronda ha terminado. Comprueba su estado en la red.',
  ],
  vi: [
    'Các kênh oracle đang bận. Hãy kiểm tra trạng thái yêu cầu đã gửi trước khi thử lại.',
    'Nhóm oracle đang trống; tính năng này chưa khả dụng.',
    'Các oracle Switchboard chưa khả dụng. Kiểm tra giao dịch và ví trước khi thử lại.',
    'Oracle chậm công bố kết quả; tạm dừng mở hộp mới. Hãy kiểm tra chữ ký của yêu cầu đã thanh toán. Đừng trả tiền lần nữa khi chưa rõ kết quả.',
    'Giá đã đổi. Hãy lấy báo giá mới và kiểm tra số tiền trước khi ký.',
    'Đã hết hạn công bố. Kiểm tra trên chuỗi trạng thái yêu cầu và điều kiện hoàn tiền.',
    'Đã ngừng bán vé vòng này. Hãy kiểm tra trạng thái vòng trên chuỗi.',
  ],
  id: [
    'Saluran oracle sedang sibuk. Periksa status permintaan yang telah dikirim sebelum mencoba lagi.',
    'Kumpulan oracle masih kosong; fitur ini belum tersedia.',
    'Oracle Switchboard tidak tersedia. Periksa tindakan dan dompet sebelum mencoba lagi.',
    'Oracle terlambat mengungkap hasil; pembukaan baru ditunda. Periksa tanda tangan permintaan berbayar. Jangan membayar lagi selama hasil belum diketahui.',
    'Harga berubah. Minta penawaran baru dan periksa jumlahnya sebelum menandatangani.',
    'Jendela pengungkapan telah ditutup. Periksa status permintaan dan syarat pengembalian dana di blockchain.',
    'Penjualan tiket putaran ini telah ditutup. Periksa status putaran di blockchain.',
  ],
  fil: [
    'Abala ang mga channel ng oracle. Suriin ang status ng naipadalang kahilingan bago sumubok muli.',
    'Walang laman ang pool ng oracle; hindi pa magagamit ang tampok na ito.',
    'Hindi magamit ang mga Switchboard oracle. Suriin ang gawain at wallet bago sumubok muli.',
    'Mabagal maghayag ng resulta ang oracle; pansamantalang sarado ang bagong pagbubukas. Suriin ang mga lagda ng nabayarang kahilingan. Huwag magbayad muli habang hindi tiyak ang resulta.',
    'Nagbago ang presyo. Kumuha ng bagong presyo at suriin ang halaga bago pumirma.',
    'Sarado na ang panahon ng paghayag. Suriin sa blockchain ang status ng kahilingan at mga kundisyon sa pagbawi ng bayad.',
    'Sarado na ang bentahan ng tiket para sa round na ito. Suriin sa blockchain ang status ng round.',
  ],
};

/** Old backend Russian prose is recognized as input, never displayed as the
 * new explanation. Keep this alias list until backend returns stable codes. */
export const legacyVrfRussian: readonly string[] = [
  'Все каналы оракула сейчас заняты. Повторите через несколько секунд.',
  'Механика ещё не запущена: пул оракула пуст.',
  'Оракулы Switchboard сейчас недоступны. Повторите через минуту, средства не списаны.',
  'Оракул временно не успевает раскрывать результаты, поэтому новые открытия приостановлены. Уже оплаченные будут раскрыты или возвращены.',
  'Цена изменилась. Обновите страницу и подтвердите новую цену.',
  'Окно раскрытия закрыто, теперь доступен возврат.',
  'Продажи этого раунда закрыты: идёт розыгрыш.',
];
