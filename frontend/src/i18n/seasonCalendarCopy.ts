import type { Language } from './translations';

type Copy = {
  epoch: string; reading: string; unavailable: string; unavailableReason: string; retry: string;
  dayOfSeason: string; untilChange: string; days: string; today: string;
  stationToday: string; rate: string; source: string; fullSeason: string;
  schedule: string; networkStates: string;
};
export const seasonCalendarCopy: Record<Language, Copy> = {
  ru: {
    epoch: 'Эпоха', reading: 'Читаем состояние дня…', unavailable: 'Состояние дня недоступно', unavailableReason: 'Не удалось прочитать подтверждённый день и погоду из сети. Календарь намеренно пуст: без номера дня расписание нельзя построить достоверно.', retry: 'Прочитать ещё раз',
    dayOfSeason: 'День {day} из {total}', untilChange: 'до смены эпохи {days}', days: 'дн.', today: 'Сегодня',
    stationToday: 'Состояние станции сегодня', rate: '{rate} единиц ресурса в час', source: 'данные из аккаунта сети', fullSeason: 'Эпоха целиком',
    schedule: 'Погода дня определяется его номером, а не отдельным прогнозом: блэкаут — 10%, номинал — 50%, скачок — 30%, френзи — 10%. Это правило сети позволяет рассчитать и следующие дни.', networkStates: 'Состояния сети',
  },
  en: {
    epoch: 'Epoch', reading: 'Reading the day’s state…', unavailable: 'Day state unavailable', unavailableReason: 'The network did not provide a verified day number and weather state. The calendar is deliberately blank: without the day number, its schedule cannot be reconstructed reliably.', retry: 'Try reading again',
    dayOfSeason: 'Day {day} of {total}', untilChange: '{days} until the next epoch', days: 'days', today: 'Today',
    stationToday: 'Station conditions today', rate: '{rate} resource units per hour', source: 'read from the on-chain account', fullSeason: 'The entire epoch',
    schedule: 'The day number determines its weather; there is no separate forecast. Blackout: 10%, nominal: 50%, surge: 30%, frenzy: 10%. This on-chain rule also lets us calculate upcoming days.', networkStates: 'Network conditions',
  },
  pt: {
    epoch: 'Época', reading: 'Consultando o estado do dia…', unavailable: 'Estado do dia indisponível', unavailableReason: 'Não foi possível consultar o dia e o clima verificados na rede. O calendário fica vazio de propósito: sem o número do dia não se pode reconstruir a programação com segurança.', retry: 'Tentar consultar novamente',
    dayOfSeason: 'Dia {day} de {total}', untilChange: '{days} até a próxima época', days: 'dias', today: 'Hoje',
    stationToday: 'Condições da estação hoje', rate: '{rate} unidades de recurso por hora', source: 'leitura direta da conta na rede', fullSeason: 'Época completa',
    schedule: 'O clima de cada dia é determinado pelo seu número, não por uma previsão separada. Apagão: 10%, nominal: 50%, pico: 30%, frenesi: 10%. Essa regra da rede permite calcular os próximos dias.', networkStates: 'Condições da rede',
  },
  es: {
    epoch: 'Época', reading: 'Consultando el estado del día…', unavailable: 'Estado del día no disponible', unavailableReason: 'La red no proporcionó el día y las condiciones verificados. El calendario queda vacío deliberadamente: sin el número del día no puede reconstruirse el programa de forma fiable.', retry: 'Volver a consultar',
    dayOfSeason: 'Día {day} de {total}', untilChange: '{days} hasta la próxima época', days: 'días', today: 'Hoy',
    stationToday: 'Condiciones de la estación hoy', rate: '{rate} unidades de recurso por hora', source: 'lectura directa de la cuenta en la red', fullSeason: 'Época completa',
    schedule: 'El número de cada día determina sus condiciones; no existe un pronóstico aparte. Apagón: 10%, nominal: 50%, pico: 30%, frenesí: 10%. Esta regla de la red permite calcular los próximos días.', networkStates: 'Condiciones de la red',
  },
  vi: {
    epoch: 'Kỷ nguyên', reading: 'Đang đọc trạng thái ngày…', unavailable: 'Chưa có trạng thái ngày', unavailableReason: 'Không thể đọc ngày và tình trạng thời tiết đã được mạng xác nhận. Lịch được để trống có chủ ý: không có số ngày thì không thể dựng lại lịch trình đáng tin cậy.', retry: 'Đọc lại',
    dayOfSeason: 'Ngày {day} / {total}', untilChange: '{days} đến kỷ nguyên tiếp theo', days: 'ngày', today: 'Hôm nay',
    stationToday: 'Trạng thái trạm hôm nay', rate: '{rate} đơn vị tài nguyên mỗi giờ', source: 'đọc trực tiếp từ tài khoản trên chuỗi', fullSeason: 'Toàn bộ kỷ nguyên',
    schedule: 'Số ngày quyết định tình trạng thời tiết, không có dự báo riêng. Mất điện: 10%, bình thường: 50%, tăng vọt: 30%, cực điểm: 10%. Quy tắc trên chuỗi cũng cho phép tính các ngày sắp tới.', networkStates: 'Trạng thái mạng',
  },
  id: {
    epoch: 'Era', reading: 'Membaca keadaan hari…', unavailable: 'Keadaan hari tidak tersedia', unavailableReason: 'Jaringan tidak memberikan nomor hari dan keadaan yang terverifikasi. Kalender sengaja dikosongkan: tanpa nomor hari, jadwalnya tidak dapat dihitung dengan andal.', retry: 'Coba baca lagi',
    dayOfSeason: 'Hari {day} dari {total}', untilChange: '{days} sampai era berikutnya', days: 'hari', today: 'Hari ini',
    stationToday: 'Kondisi stasiun hari ini', rate: '{rate} unit sumber daya per jam', source: 'dibaca langsung dari akun blockchain', fullSeason: 'Seluruh era',
    schedule: 'Nomor hari menentukan keadaan cuaca; tidak ada prakiraan terpisah. Pemadaman: 10%, normal: 50%, lonjakan: 30%, puncak: 10%. Aturan blockchain ini juga memungkinkan perhitungan hari mendatang.', networkStates: 'Kondisi jaringan',
  },
  fil: {
    epoch: 'Panahon', reading: 'Binabasa ang lagay ng araw…', unavailable: 'Hindi makuha ang lagay ng araw', unavailableReason: 'Hindi nakuha sa network ang nakumpirmang bilang ng araw at lagay ng panahon. Sadyang walang laman ang kalendaryo: kung walang bilang ng araw, hindi mapagkakatiwalaang buuin ang iskedyul.', retry: 'Subukang basahin muli',
    dayOfSeason: 'Araw {day} sa {total}', untilChange: '{days} bago ang susunod na panahon', days: 'araw', today: 'Ngayon',
    stationToday: 'Kalagayan ng istasyon ngayon', rate: '{rate} yunit ng yaman kada oras', source: 'binasa mismo mula sa account sa blockchain', fullSeason: 'Buong panahon',
    schedule: 'Ang bilang ng araw ang nagtatakda ng panahon; walang hiwalay na pagtataya. Blackout: 10%, normal: 50%, pagtaas: 30%, sukdulan: 10%. Nagagamit din ang patakarang ito sa blockchain para sa mga susunod na araw.', networkStates: 'Kalagayan ng network',
  },
};
