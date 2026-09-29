import type { Language } from './translations';

export const baroIds = ['baro-01', 'baro-02', 'baro-03', 'baro-04'] as const;
export type BaroId = typeof baroIds[number];
type Meta = { title: string; variant: string; where: string; note: string };

/** Barograph samples show a forecast, not recorded past events or historical outages. */
export const galleryBaroCopy: Record<Language, { slides: Record<BaroId, Meta> }> = {
  ru: { slides: {
    'baro-01': { title: 'Лента прогноза нагрузки', variant: 'семь примерных дней', where: 'Участок · станция (components/farm/WeatherRecorder.tsx, WellPanel.tsx)', note: 'В игре лента показывает прогноз по дням сезона, рассчитанный из расписания сети. Эти семь точек условные, не архив событий или измерения кошелька.' },
    'baro-02': { title: 'Ровная примерная лента', variant: 'один уровень на все дни', where: 'Участок · проба одинакового прогноза', note: 'Ровная линия означает только одинаковые пробные уровни. Она не подтверждает, что за неделю ничего не произошло.' },
    'baro-03': { title: 'Лента без прогноза', variant: 'нет точек и подписей дней', where: 'Участок · станция, прогноз недоступен', note: 'Без точек перо не рисует линию. Это состояние отсутствия прогноза, а не доказательство нулевой нагрузки.' },
    'baro-04': { title: 'Низкая точка нагрузки', variant: 'проба засушливого дня', where: 'Участок · пример прогноза засухи', note: 'Пробный спад соответствует типу «засуха» в шкале игры, а не блэкауту или подтверждённой истории сети.' },
  } },
  en: { slides: {
    'baro-01': { title: 'Load forecast tape', variant: 'seven sample days', where: 'Plot · station (components/farm/WeatherRecorder.tsx, WellPanel.tsx)', note: 'In the game, the tape forecasts season days using the network schedule. These seven points are samples, not an event archive or wallet readings.' },
    'baro-02': { title: 'Flat sample tape', variant: 'same level every day', where: 'Plot · constant-forecast test', note: 'A flat line only means equal sample levels. It does not prove that nothing happened over the week.' },
    'baro-03': { title: 'Tape without a forecast', variant: 'no points or day labels', where: 'Plot · station, forecast unavailable', note: 'With no points, the pen draws no line. Missing forecast data is not evidence of zero load.' },
    'baro-04': { title: 'Low load point', variant: 'dry-day illustration', where: 'Plot · drought forecast example', note: 'This sample dip follows the in-game drought scale, not a blackout or confirmed network history.' },
  } },
  pt: { slides: {
    'baro-01': { title: 'Fita da previsão de carga', variant: 'sete dias ilustrativos', where: 'Terreno · estação (components/farm/WeatherRecorder.tsx, WellPanel.tsx)', note: 'No jogo, a fita prevê dias da fase pelo calendário da rede. Os sete pontos são exemplos, não um histórico de eventos nem leituras da carteira.' },
    'baro-02': { title: 'Fita plana ilustrativa', variant: 'mesmo nível todos os dias', where: 'Terreno · teste de previsão constante', note: 'Uma linha plana representa apenas níveis ilustrativos iguais. Não prova que nada aconteceu durante a semana.' },
    'baro-03': { title: 'Fita sem previsão', variant: 'sem pontos nem dias marcados', where: 'Terreno · estação, previsão indisponível', note: 'Sem pontos, a pena não traça uma linha. Falta de previsão não é prova de carga zero.' },
    'baro-04': { title: 'Ponto de carga baixa', variant: 'exemplo de dia seco', where: 'Terreno · exemplo de previsão de seca', note: 'Esta queda ilustrativa segue a escala de seca do jogo, não representa um blecaute nem um histórico confirmado da rede.' },
  } },
  es: { slides: {
    'baro-01': { title: 'Cinta del pronóstico de carga', variant: 'siete días ilustrativos', where: 'Parcela · estación (components/farm/WeatherRecorder.tsx, WellPanel.tsx)', note: 'En el juego, la cinta pronostica días de la fase según el calendario de la red. Los siete puntos son ejemplos, no un historial ni lecturas de la cartera.' },
    'baro-02': { title: 'Cinta plana ilustrativa', variant: 'mismo nivel cada día', where: 'Parcela · prueba de pronóstico constante', note: 'La línea plana solo representa niveles de ejemplo iguales. No demuestra que no ocurriera nada durante la semana.' },
    'baro-03': { title: 'Cinta sin pronóstico', variant: 'sin puntos ni días marcados', where: 'Parcela · estación, pronóstico no disponible', note: 'Sin puntos, la pluma no dibuja la línea. La ausencia de pronóstico no demuestra que la carga sea cero.' },
    'baro-04': { title: 'Punto de carga baja', variant: 'ejemplo de un día seco', where: 'Parcela · ejemplo de pronóstico de sequía', note: 'Esta bajada ilustrativa sigue la escala de sequía del juego, no representa un apagón ni un historial confirmado de la red.' },
  } },
  vi: { slides: {
    'baro-01': { title: 'Băng dự báo tải', variant: 'bảy ngày minh họa', where: 'Khu đất · trạm (components/farm/WeatherRecorder.tsx, WellPanel.tsx)', note: 'Trong trò chơi, băng dự báo các ngày của giai đoạn theo lịch mạng. Bảy điểm này chỉ minh họa, không phải lịch sử sự kiện hay chỉ số của ví.' },
    'baro-02': { title: 'Băng phẳng minh họa', variant: 'cùng mức mỗi ngày', where: 'Khu đất · thử dự báo không đổi', note: 'Đường thẳng chỉ cho thấy các mức giả định bằng nhau, không chứng minh cả tuần không có sự kiện.' },
    'baro-03': { title: 'Băng chưa có dự báo', variant: 'không có điểm hay nhãn ngày', where: 'Khu đất · trạm, không có dự báo', note: 'Không có điểm thì bút không vẽ đường. Thiếu dự báo không có nghĩa tải bằng không.' },
    'baro-04': { title: 'Điểm tải thấp', variant: 'ví dụ ngày khô hạn', where: 'Khu đất · ví dụ dự báo hạn hán', note: 'Điểm giảm giả định dựa trên thang hạn hán trong trò chơi, không phải mất điện hay lịch sử mạng đã xác nhận.' },
  } },
  id: { slides: {
    'baro-01': { title: 'Pita prakiraan beban', variant: 'contoh tujuh hari', where: 'Lahan · stasiun (components/farm/WeatherRecorder.tsx, WellPanel.tsx)', note: 'Dalam gim, pita memprakirakan hari dalam fase menurut jadwal jaringan. Tujuh titik ini contoh, bukan riwayat kejadian atau bacaan dompet.' },
    'baro-02': { title: 'Pita datar contoh', variant: 'tingkat sama setiap hari', where: 'Lahan · uji prakiraan tetap', note: 'Garis datar hanya menunjukkan tingkat contoh yang sama, bukan bukti tidak terjadi apa-apa sepanjang minggu.' },
    'baro-03': { title: 'Pita tanpa prakiraan', variant: 'tanpa titik atau label hari', where: 'Lahan · stasiun, prakiraan tidak tersedia', note: 'Tanpa titik, pena tidak menggambar garis. Tidak adanya prakiraan bukan bukti beban nol.' },
    'baro-04': { title: 'Titik beban rendah', variant: 'ilustrasi hari kering', where: 'Lahan · contoh prakiraan kekeringan', note: 'Penurunan contoh ini mengikuti skala kekeringan dalam gim, bukan pemadaman atau riwayat jaringan terverifikasi.' },
  } },
  fil: { slides: {
    'baro-01': { title: 'Teyp ng tantiya sa pasan', variant: 'pitong halimbawang araw', where: 'Lupain · istasyon (components/farm/WeatherRecorder.tsx, WellPanel.tsx)', note: 'Sa laro, tinatantiya ng teyp ang mga araw ng yugto ayon sa iskedyul ng network. Halimbawa lang ang pitong tuldok, hindi talaan ng pangyayari o sukat mula sa wallet.' },
    'baro-02': { title: 'Pantay na halimbawang teyp', variant: 'parehong antas araw-araw', where: 'Lupain · pagsubok ng di-nagbabagong tantiya', note: 'Ibig sabihin lang ng pantay na guhit ay magkapareho ang mga halimbawang antas. Hindi nito pinatutunayang walang nangyari sa buong linggo.' },
    'baro-03': { title: 'Teyp na walang tantiya', variant: 'walang tuldok o etiketa ng araw', where: 'Lupain · istasyon, walang tantiya', note: 'Kung walang tuldok, walang guhit ang panulat. Hindi katibayan ng serong pasan ang nawawalang tantiya.' },
    'baro-04': { title: 'Mababang antas ng pasan', variant: 'halimbawa ng tuyong araw', where: 'Lupain · halimbawa ng tantiya sa tagtuyot', note: 'Ayon sa antas ng tagtuyot sa laro ang halimbawang pagbaba, hindi ito blackout o kumpirmadong kasaysayan ng network.' },
  } },
};
