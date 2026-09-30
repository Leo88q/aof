import type { Language } from './translations';

type Copy = {
  title: string; intro: string; paused: string; pausedWhatWorks: string; unitWarning: string; select: string; selected: string;
  registryUnavailable: string; loading: string; unavailable: string; refresh: string; empty: string;
  bestBid: string; bestAsk: string; depth: string; orders: string; noAsks: string; noBids: string;
  asks: string; bids: string; spread: string; priceUnit: string; amountUnit: string;
  you: string; cancel: string; exhausted: string; exhaustedInfo: string; noWallet: string;
  cancelling: string; cancelled: string; uncertain: string; retry: string;
  formTitle: string; formInfo: string; priceLabel: string; amountLabel: string;
  quoteLine: (total: string, escrow: string) => string; placeBuyAction: string; placeSellAction: string;
  matchAction: string; matchInfo: string; v2Badge: string; escrowLabel: string;
  formInvalid: string; formWorking: string; formPending: string; formFailed: string;
};
/** Trades stay paused until atomic price semantics and wallet-bound quote checks are implemented. Existing maker orders can still be cancelled. */
export const orderbookCopy: Record<Language, Copy> = {
  ru: {
    title: 'Книга заявок', intro: 'Заявки на ресурсы, прочитанные из сети. Исполнение заявки не гарантировано.',
    paused: 'Новые заявки и сведение приостановлены: контракт умножает цену на количество в атомарных единицах, а прежняя форма показывала цену за целый ресурс. До исправления нельзя безопасно подтвердить расход.',    pausedWhatWorks: 'Что работает сейчас: чтение книги и отмена своих заявок — залог и аренда аккаунта возвращаются.',
    unitWarning: 'Показанная цена — SOL за один целый ресурс (10⁹ атомарных единиц), а не за одну атомарную единицу. Это пересчёт записи контракта, не рыночная оценка.',
    select: 'Ресурс', selected: 'Выбран', registryUnavailable: 'Не удалось проверить реестр ресурсов в сети. Заявки недоступны.', loading: 'Загружаем заявки…', unavailable: 'Не удалось проверить заявки в сети. Пустой стакан не подтверждён.', refresh: 'Обновить', empty: 'Подтверждено: активных заявок нет.',
    bestBid: 'Лучшая покупка', bestAsk: 'Лучшая продажа', depth: 'Глубина заявок', orders: 'Активные заявки', noAsks: 'Нет предложений о продаже', noBids: 'Нет предложений о покупке', asks: 'Продажа', bids: 'Покупка', spread: 'спред', priceUnit: 'SOL / ресурс', amountUnit: 'рес.', you: 'вы', cancel: 'Отменить', exhausted: 'Заявки без остатка', exhaustedInfo: 'Закройте свою исполненную заявку, чтобы вернуть остаток залога и аренду аккаунта.', noWallet: 'Подключите кошелёк для отмены собственных заявок.', cancelling: 'Отменяем заявку…', cancelled: 'Отмена подтверждена. Обновляем книгу заявок.', uncertain: 'Отмену нельзя подтвердить. Проверьте историю кошелька и обновите книгу перед повторной попыткой.', retry: 'Отмена не отправлена; проверьте кошелёк и попробуйте позже.',
    formTitle: 'Новая заявка (v2)', formInfo: 'Цена указывается за ЦЕЛЫЙ ресурс, а не за атомарную единицу. Кошелёк подписывает ровно тот итог, который показан ниже: программа округляет эскроу вверх и не спишет больше.',
    priceLabel: 'Цена, SOL за ресурс', amountLabel: 'Количество, ресурсов', quoteLine: (total, escrow) => `Итог: ${total} SOL. В залог уйдёт ${escrow} SOL с подушкой комиссии; остаток вернётся при отмене.`,
    placeBuyAction: 'Разместить покупку', placeSellAction: 'Разместить продажу', matchAction: 'Свести лучшую пару', matchInfo: 'Сведение доступно любому кошельку: программа сама проверит, что цены пересекаются, и откажет, если залог покупателя не покрывает сделку.',
    v2Badge: 'v2: цена за целый ресурс', escrowLabel: 'Залог',
    formInvalid: 'Цена и количество должны быть числами: до 9 знаков после точки у количества и у цены, обе больше нуля.',
    formWorking: 'Готовим транзакцию для кошелька…', formPending: 'Транзакция отправлена, подтверждение неизвестно. Проверьте кошелёк и книгу перед повтором.', formFailed: 'Заявка не подтверждена. Проверьте кошелёк и состояние книги.',
  },
  en: {
    title: 'Order book', intro: 'On-chain resource orders. An order is not guaranteed to fill.',
    paused: 'New orders and matching are paused: the contract multiplies price by the atomic token quantity, but the old form quoted a whole resource. Spending cannot be confirmed safely until this is fixed.',    pausedWhatWorks: 'What still works now: reading the book and cancelling your own orders — escrow and account rent are returned.',
    unitWarning: 'Displayed prices are SOL per full resource (10⁹ atomic units), not per atomic unit. This is a conversion of the contract record, not a market valuation.',
    select: 'Resource', selected: 'Selected', registryUnavailable: 'Could not verify the resource registry on-chain. Orders are unavailable.', loading: 'Loading orders…', unavailable: 'Could not verify orders on-chain. An empty book has not been confirmed.', refresh: 'Refresh', empty: 'Confirmed: no active orders.',
    bestBid: 'Best bid', bestAsk: 'Best ask', depth: 'Order depth', orders: 'Active orders', noAsks: 'No sell orders', noBids: 'No buy orders', asks: 'Sell', bids: 'Buy', spread: 'spread', priceUnit: 'SOL / resource', amountUnit: 'units', you: 'you', cancel: 'Cancel', exhausted: 'Exhausted orders', exhaustedInfo: 'Close your filled order to reclaim the remaining escrow and account rent.', noWallet: 'Connect your wallet to cancel your own orders.', cancelling: 'Cancelling order…', cancelled: 'Cancellation confirmed. Refreshing the book.', uncertain: 'Could not confirm cancellation. Check your wallet history and refresh the book before trying again.', retry: 'Cancellation was not submitted. Check your wallet and try later.',
    formTitle: 'New order (v2)', formInfo: 'The price is quoted for a WHOLE resource, not per atomic unit. The wallet signs exactly the total shown below: the program rounds escrow up and never charges more.',
    priceLabel: 'Price, SOL per resource', amountLabel: 'Amount, resources', quoteLine: (total, escrow) => `Total: ${total} SOL. Escrow takes ${escrow} SOL including the fee buffer; the remainder returns on cancel.`,
    placeBuyAction: 'Place buy order', placeSellAction: 'Place sell order', matchAction: 'Match best pair', matchInfo: 'Matching is open to any wallet: the program itself requires the prices to cross and refuses a fill the buyer\'s escrow cannot cover.',
    v2Badge: 'v2: price per whole resource', escrowLabel: 'Escrow',
    formInvalid: 'Price and amount must be numbers: up to 9 decimals for each, both above zero.',
    formWorking: 'Preparing the wallet transaction…', formPending: 'Transaction submitted, confirmation unknown. Check your wallet and the book before retrying.', formFailed: 'Order not confirmed. Check your wallet and the book state.',
  },
  pt: {
    title: 'Livro de ofertas', intro: 'Ordens de recursos registradas na rede. Não há garantia de execução.',
    paused: 'Novas ordens e cruzamentos estão suspensos: o contrato multiplica o preço pela quantidade atômica, mas o formulário antigo mostrava o preço por recurso inteiro. Não é seguro confirmar gastos até corrigirmos isso.',    pausedWhatWorks: 'O que ainda funciona: ler o livro e cancelar suas próprias ordens — o depósito e o aluguel da conta são devolvidos.',
    unitWarning: 'Os preços são em SOL por recurso inteiro (10⁹ unidades atômicas), não por unidade atômica. É uma conversão do registro do contrato, não uma avaliação de mercado.',
    select: 'Recurso', selected: 'Selecionado', registryUnavailable: 'Não foi possível verificar o registro de recursos na rede. Ordens indisponíveis.', loading: 'Carregando ordens…', unavailable: 'Não foi possível verificar as ordens na rede. O livro vazio não foi confirmado.', refresh: 'Atualizar', empty: 'Confirmado: não há ordens ativas.',
    bestBid: 'Melhor compra', bestAsk: 'Melhor venda', depth: 'Profundidade das ordens', orders: 'Ordens ativas', noAsks: 'Sem ordens de venda', noBids: 'Sem ordens de compra', asks: 'Venda', bids: 'Compra', spread: 'diferença', priceUnit: 'SOL / recurso', amountUnit: 'unid.', you: 'você', cancel: 'Cancelar', exhausted: 'Ordens esgotadas', exhaustedInfo: 'Feche sua ordem executada para recuperar o saldo do depósito e o aluguel da conta.', noWallet: 'Conecte a carteira para cancelar suas ordens.', cancelling: 'Cancelando ordem…', cancelled: 'Cancelamento confirmado. Atualizando o livro.', uncertain: 'Não foi possível confirmar o cancelamento. Confira o histórico da carteira e atualize o livro antes de tentar novamente.', retry: 'Cancelamento não enviado. Verifique a carteira e tente mais tarde.',
    formTitle: 'Nova ordem (v2)', formInfo: 'O preço é por recurso INTEIRO, não por unidade atômica. A carteira assina exatamente o total abaixo: o programa arredonda o depósito para cima e nunca cobra mais.',
    priceLabel: 'Preço, SOL por recurso', amountLabel: 'Quantidade, recursos', quoteLine: (total, escrow) => `Total: ${total} SOL. O depósito usa ${escrow} SOL com margem de taxa; o restante volta ao cancelar.`,
    placeBuyAction: 'Colocar ordem de compra', placeSellAction: 'Colocar ordem de venda', matchAction: 'Cruzar o melhor par', matchInfo: 'O cruzamento é aberto a qualquer carteira: o próprio programa exige que os preços se cruzem e recusa execução sem depósito suficiente.',
    v2Badge: 'v2: preço por recurso inteiro', escrowLabel: 'Depósito',
    formInvalid: 'Preço e quantidade devem ser números: até 9 casas decimais em cada, ambos acima de zero.',
    formWorking: 'Preparando a transação da carteira…', formPending: 'Transação enviada, confirmação desconhecida. Verifique a carteira e o livro antes de repetir.', formFailed: 'Ordem não confirmada. Verifique a carteira e o estado do livro.',
  },
  es: {
    title: 'Libro de órdenes', intro: 'Órdenes de recursos leídas de la cadena. No se garantiza su ejecución.',
    paused: 'Se han pausado las órdenes nuevas y el cruce: el contrato multiplica el precio por la cantidad atómica, pero el formulario anterior mostraba el precio por recurso entero. No se puede confirmar el gasto con seguridad hasta corregirlo.',    pausedWhatWorks: 'Lo que sigue funcionando: leer el libro y cancelar tus propias órdenes — se devuelven el depósito y el alquiler de la cuenta.',
    unitWarning: 'Los precios mostrados son SOL por recurso entero (10⁹ unidades atómicas), no por unidad atómica. Es una conversión del registro del contrato, no una valoración de mercado.',
    select: 'Recurso', selected: 'Elegido', registryUnavailable: 'No se pudo verificar el registro de recursos en la cadena. Órdenes no disponibles.', loading: 'Cargando órdenes…', unavailable: 'No se pudieron verificar las órdenes en la cadena. No se ha confirmado un libro vacío.', refresh: 'Actualizar', empty: 'Confirmado: no hay órdenes activas.',
    bestBid: 'Mejor compra', bestAsk: 'Mejor venta', depth: 'Profundidad de órdenes', orders: 'Órdenes activas', noAsks: 'Sin órdenes de venta', noBids: 'Sin órdenes de compra', asks: 'Venta', bids: 'Compra', spread: 'diferencia', priceUnit: 'SOL / recurso', amountUnit: 'unid.', you: 'tú', cancel: 'Cancelar', exhausted: 'Órdenes agotadas', exhaustedInfo: 'Cierra tu orden ejecutada para recuperar el depósito restante y el alquiler de la cuenta.', noWallet: 'Conecta tu cartera para cancelar tus órdenes.', cancelling: 'Cancelando orden…', cancelled: 'Cancelación confirmada. Actualizando el libro.', uncertain: 'No se pudo confirmar la cancelación. Revisa el historial de tu cartera y actualiza el libro antes de reintentarlo.', retry: 'No se envió la cancelación. Revisa tu cartera e inténtalo más tarde.',
    formTitle: 'Nueva orden (v2)', formInfo: 'El precio es por recurso ENTERO, no por unidad atómica. La cartera firma exactamente el total mostrado: el programa redondea el depósito hacia arriba y nunca cobra más.',
    priceLabel: 'Precio, SOL por recurso', amountLabel: 'Cantidad, recursos', quoteLine: (total, escrow) => `Total: ${total} SOL. El depósito toma ${escrow} SOL con margen de comisión; el resto vuelve al cancelar.`,
    placeBuyAction: 'Publicar compra', placeSellAction: 'Publicar venta', matchAction: 'Cruzar la mejor pareja', matchInfo: 'El cruce está abierto a cualquier cartera: el propio programa exige que los precios se crucen y rechaza una ejecución sin depósito suficiente.',
    v2Badge: 'v2: precio por recurso entero', escrowLabel: 'Depósito',
    formInvalid: 'El precio y la cantidad deben ser números: hasta 9 decimales en cada uno, ambos mayores que cero.',
    formWorking: 'Preparando la transacción de la cartera…', formPending: 'Transacción enviada, confirmación desconocida. Revisa la cartera y el libro antes de reintentar.', formFailed: 'Orden no confirmada. Revisa la cartera y el estado del libro.',
  },
  vi: {
    title: 'Sổ lệnh', intro: 'Lệnh tài nguyên được đọc từ chuỗi. Không đảm bảo lệnh sẽ khớp.',
    paused: 'Tạm dừng tạo lệnh và khớp lệnh: hợp đồng nhân giá với số đơn vị nguyên tử, trong khi biểu mẫu cũ báo giá cho cả một tài nguyên. Chưa thể xác nhận chi phí an toàn trước khi khắc phục.',    pausedWhatWorks: 'Những gì vẫn hoạt động: xem sổ lệnh và hủy lệnh của chính bạn — tiền ký quỹ và phí thuê tài khoản được hoàn trả.',
    unitWarning: 'Giá hiển thị là SOL cho một tài nguyên hoàn chỉnh (10⁹ đơn vị nguyên tử), không phải một đơn vị nguyên tử. Đây là phép quy đổi bản ghi hợp đồng, không phải định giá thị trường.',
    select: 'Tài nguyên', selected: 'Đã chọn', registryUnavailable: 'Không thể xác minh danh mục tài nguyên trên chuỗi. Không có lệnh để xem.', loading: 'Đang tải lệnh…', unavailable: 'Không thể xác minh lệnh trên chuỗi. Chưa thể kết luận sổ lệnh trống.', refresh: 'Tải lại', empty: 'Đã xác nhận: không có lệnh đang hoạt động.',
    bestBid: 'Giá mua cao nhất', bestAsk: 'Giá bán thấp nhất', depth: 'Độ sâu lệnh', orders: 'Lệnh đang hoạt động', noAsks: 'Không có lệnh bán', noBids: 'Không có lệnh mua', asks: 'Bán', bids: 'Mua', spread: 'chênh lệch', priceUnit: 'SOL / tài nguyên', amountUnit: 'đơn vị', you: 'bạn', cancel: 'Hủy', exhausted: 'Lệnh đã hết', exhaustedInfo: 'Đóng lệnh đã khớp để nhận lại tiền ký quỹ còn dư và phí thuê tài khoản.', noWallet: 'Kết nối ví để hủy lệnh của bạn.', cancelling: 'Đang hủy lệnh…', cancelled: 'Đã xác nhận hủy. Đang tải lại sổ lệnh.', uncertain: 'Không thể xác nhận việc hủy. Kiểm tra lịch sử ví và tải lại sổ lệnh trước khi thử tiếp.', retry: 'Chưa gửi yêu cầu hủy. Kiểm tra ví rồi thử lại sau.',
    formTitle: 'Lệnh mới (v2)', formInfo: 'Giá tính cho MỘT tài nguyên hoàn chỉnh, không phải mỗi đơn vị nguyên tử. Ví ký đúng tổng hiển thị bên dưới: chương trình làm tròn ký quỹ lên và không thu thêm.',
    priceLabel: 'Giá, SOL mỗi tài nguyên', amountLabel: 'Số lượng, tài nguyên', quoteLine: (total, escrow) => `Tổng: ${total} SOL. Ký quỹ giữ ${escrow} SOL gồm dự phòng phí; phần còn lại trả về khi hủy.`,
    placeBuyAction: 'Đặt lệnh mua', placeSellAction: 'Đặt lệnh bán', matchAction: 'Khớp cặp tốt nhất', matchInfo: 'Khớp lệnh mở cho mọi ví: chương trình tự kiểm tra giá giao nhau và từ chối nếu ký quỹ của người mua không đủ.',
    v2Badge: 'v2: giá mỗi tài nguyên hoàn chỉnh', escrowLabel: 'Ký quỹ',
    formInvalid: 'Giá và số lượng phải là số: tối đa 9 chữ số thập phân, cả hai lớn hơn không.',
    formWorking: 'Đang chuẩn bị giao dịch cho ví…', formPending: 'Đã gửi giao dịch, chưa rõ xác nhận. Kiểm tra ví và sổ lệnh trước khi thử lại.', formFailed: 'Lệnh chưa được xác nhận. Kiểm tra ví và trạng thái sổ lệnh.',
  },
  id: {
    title: 'Buku pesanan', intro: 'Pesanan sumber daya yang dibaca dari blockchain. Eksekusi tidak dijamin.',
    paused: 'Pesanan baru dan pencocokan ditunda: kontrak mengalikan harga dengan jumlah unit atom, sementara formulir lama menampilkan harga per sumber daya utuh. Pengeluaran belum dapat dikonfirmasi dengan aman sebelum diperbaiki.',    pausedWhatWorks: 'Yang masih berfungsi: membaca buku dan membatalkan pesanan Anda sendiri — dana titipan dan sewa akun dikembalikan.',
    unitWarning: 'Harga ditampilkan dalam SOL per sumber daya utuh (10⁹ unit atom), bukan per unit atom. Ini konversi catatan kontrak, bukan penilaian pasar.',
    select: 'Sumber daya', selected: 'Dipilih', registryUnavailable: 'Daftar sumber daya tidak dapat diverifikasi di blockchain. Pesanan tidak tersedia.', loading: 'Memuat pesanan…', unavailable: 'Pesanan tidak dapat diverifikasi di blockchain. Buku kosong belum terkonfirmasi.', refresh: 'Muat ulang', empty: 'Terkonfirmasi: tidak ada pesanan aktif.',
    bestBid: 'Harga beli tertinggi', bestAsk: 'Harga jual terendah', depth: 'Kedalaman pesanan', orders: 'Pesanan aktif', noAsks: 'Tidak ada pesanan jual', noBids: 'Tidak ada pesanan beli', asks: 'Jual', bids: 'Beli', spread: 'selisih', priceUnit: 'SOL / sumber daya', amountUnit: 'unit', you: 'kamu', cancel: 'Batalkan', exhausted: 'Pesanan habis', exhaustedInfo: 'Tutup pesanan yang sudah cocok untuk menarik sisa dana titipan dan sewa akun.', noWallet: 'Hubungkan dompet untuk membatalkan pesanan sendiri.', cancelling: 'Membatalkan pesanan…', cancelled: 'Pembatalan dikonfirmasi. Memperbarui buku.', uncertain: 'Tidak dapat mengonfirmasi pembatalan. Periksa riwayat dompet dan muat ulang buku sebelum mencoba lagi.', retry: 'Pembatalan belum dikirim. Periksa dompet dan coba lagi nanti.',
    formTitle: 'Pesanan baru (v2)', formInfo: 'Harga dihitung per sumber daya UTUH, bukan per unit atom. Dompet menandatangani tepat total di bawah: program membulatkan escrow ke atas dan tidak pernah menagih lebih.',
    priceLabel: 'Harga, SOL per sumber daya', amountLabel: 'Jumlah, sumber daya', quoteLine: (total, escrow) => `Total: ${total} SOL. Escrow mengambil ${escrow} SOL termasuk penyangga biaya; sisanya kembali saat dibatalkan.`,
    placeBuyAction: 'Pasang pesanan beli', placeSellAction: 'Pasang pesanan jual', matchAction: 'Cocokkan pasangan terbaik', matchInfo: 'Pencocokan terbuka untuk dompet mana pun: program sendiri memastikan harga bersilangan dan menolak bila escrow pembeli tidak mencukupi.',
    v2Badge: 'v2: harga per sumber daya utuh', escrowLabel: 'Escrow',
    formInvalid: 'Harga dan jumlah harus berupa angka: maksimal 9 desimal, keduanya di atas nol.',
    formWorking: 'Menyiapkan transaksi dompet…', formPending: 'Transaksi terkirim, konfirmasi belum diketahui. Periksa dompet dan buku sebelum mengulang.', formFailed: 'Pesanan tidak terkonfirmasi. Periksa dompet dan status buku.',
  },
  fil: {
    title: 'Talaan ng order', intro: 'Mga order sa yaman na nabasa sa blockchain. Hindi tiyak na matutupad ang order.',
    paused: 'Pansamantalang hindi maaaring gumawa o magtugma ng order: minumultiply ng kontrata ang presyo sa bilang ng maliliit na yunit, ngunit ipinapakita ng lumang form ang presyo para sa isang buong yaman. Hindi pa ligtas na kumpirmahin ang gastos hangga’t hindi ito naaayos.',    pausedWhatWorks: 'Ang gumagana pa: pagbasa ng talaan at pagkansela ng sarili mong mga order — ibinabalik ang nakalagak na halaga at upa sa account.',
    unitWarning: 'SOL kada buong yaman (10⁹ maliliit na yunit) ang ipinapakitang presyo, hindi kada maliit na yunit. Pagkuwenta lamang ito mula sa tala ng kontrata, hindi pagtataya ng presyo sa merkado.',
    select: 'Yaman', selected: 'Napili', registryUnavailable: 'Hindi ma-verify sa blockchain ang talaan ng yaman. Hindi makuha ang mga order.', loading: 'Kinukuha ang mga order…', unavailable: 'Hindi ma-verify sa blockchain ang mga order. Hindi kumpirmadong walang laman ang talaan.', refresh: 'I-refresh', empty: 'Kumpirmado: walang aktibong order.',
    bestBid: 'Pinakamataas na bili', bestAsk: 'Pinakamababang benta', depth: 'Lalim ng mga order', orders: 'Aktibong mga order', noAsks: 'Walang nagbebenta', noBids: 'Walang bumibili', asks: 'Benta', bids: 'Bili', spread: 'agwat', priceUnit: 'SOL / yaman', amountUnit: 'yunit', you: 'ikaw', cancel: 'Kanselahin', exhausted: 'Naubos na mga order', exhaustedInfo: 'Isara ang natupad mong order upang mabawi ang natirang nakalagak na halaga at upa sa account.', noWallet: 'Ikonekta ang wallet para makansela ang sarili mong order.', cancelling: 'Kinakansela ang order…', cancelled: 'Kumpirmado ang pagkansela. Ina-update ang talaan.', uncertain: 'Hindi makumpirma ang pagkansela. Suriin ang kasaysayan ng wallet at i-refresh ang talaan bago subukan muli.', retry: 'Hindi naipadala ang pagkansela. Suriin ang wallet at subukan muli mamaya.',
    formTitle: 'Bagong order (v2)', formInfo: 'Ang presyo ay para sa ISANG buong yaman, hindi kada atomikong yunit. Ang wallet ang pipirma ng eksaktong total sa ibaba: ang programa ay nag-round up ng escrow at hindi sumisingil ng higit.',
    priceLabel: 'Presyo, SOL kada yaman', amountLabel: 'Dami, yaman', quoteLine: (total, escrow) => `Kabuuan: ${total} SOL. Ang escrow ay ${escrow} SOL kasama ang buffer ng bayad; ibabalik ang natira kapag kinansela.`,
    placeBuyAction: 'Maglagay ng order na bili', placeSellAction: 'Maglagay ng order na benta', matchAction: 'Itugma ang pinakamahusay na pares', matchInfo: 'Bukas sa lahat ng wallet ang pagtutugma: ang programa mismo ang nagpapatunay na nagkakrus ang presyo at tumatanggi kung hindi sapat ang escrow ng mamimili.',
    v2Badge: 'v2: presyo kada buong yaman', escrowLabel: 'Escrow',
    formInvalid: 'Ang presyo at dami ay dapat numero: hanggang 9 na desimal, parehong higit sa zero.',
    formWorking: 'Inihahanda ang transaksyon ng wallet…', formPending: 'Naipadala ang transaksyon, hindi pa alam ang kumpirmasyon. Suriin ang wallet at talaan bago ulitin.', formFailed: 'Hindi nakumpirma ang order. Suriin ang wallet at estado ng talaan.',
  },
};
