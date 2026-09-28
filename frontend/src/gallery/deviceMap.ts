/**
 * Карта приборов: где каждый аппарат стоит в игре.
 *
 * Это единственный источник правды и для галереи `/visual`, и для документа
 * `docs/UI_DEVICE_MAP_2026-09-28.md`. Если прибор переезжает на другую вкладку,
 * правится строка здесь — и карта, и палитра начинают говорить одно и то же.
 */

export type DeviceKey =
  | "frame" /* каркас окна: уровни, этикетки, считыватели, лампы, клавиши */
  | "cryo"  /* К4 · криостойка и сосуд с азотом */
  | "mix"   /* К5 · микшерный пульт */
  | "sonar" /* К6 · эхолот и сонар */
  | "plate" /* К7 · микропланшет 96 лунок */
  | "gel"   /* К8 · гель-электрофорез */
  | "cross" /* К9 · кросс-панель */
  | "cards" /* К10 · перфокарты Жаккарда */
  | "baro"; /* К11 · барограф */

export type DeviceInfo = {
  key: DeviceKey;
  /** Имя аппарата так, как его видит игрок. */
  name: string;
  /** Вкладка дока, где прибор стоит. */
  tab: string;
  /** Суб-вкладка внутри вкладки, если прибор не на первом экране. */
  sub: string;
  /** Файл, который собирает прибор на экране. */
  file: string;
  /** Что именно показывает прибор. */
  purpose: string;
};

export const DEVICE_MAP: DeviceInfo[] = [
  {
    key: "frame",
    name: "Каркас окна",
    tab: "все вкладки",
    sub: "—",
    file: "src/ui/forge/kit.tsx",
    purpose: "уровни окна (крупное / рабочее / тихое), этикетки, считыватели, лампы, клавиши",
  },
  {
    key: "cryo",
    name: "К4 · криостойка и сосуд N₂",
    tab: "Лаборатория",
    sub: "первый экран",
    file: "src/components/farm/LabHero.tsx",
    purpose: "запас ресурсов в сосудах; уровень азота — доля энергии сети",
  },
  {
    key: "mix",
    name: "К5 · пульт мастерской",
    tab: "Инструменты",
    sub: "первый экран",
    file: "src/pages/tools/ToolsHome.tsx",
    purpose: "каналы по инструментам: стрелка — прочность, фейдер — часы смены",
  },
  {
    key: "sonar",
    name: "К6 · эхолот и сонар",
    tab: "Участок · Рынок",
    sub: "журнал смены (Участок), первый экран (Рынок)",
    file: "src/pages/farm/FarmDashboard.tsx, src/pages/market/MarketHome.tsx, ListingPage.tsx",
    purpose: "лента глубины по архиву добычи; круговая развёртка цен прилавков",
  },
  {
    key: "plate",
    name: "К7 · микропланшет 96 лунок",
    tab: "Участок",
    sub: "первый экран",
    file: "src/pages/farm/FarmDashboard.tsx",
    purpose: "каждая лунка — место в стойке инструментов; занятые светятся",
  },
  {
    key: "gel",
    name: "К8 · гель-электрофорез",
    tab: "Экономика",
    sub: "обзор",
    file: "src/pages/economy/ResourceOverview.tsx",
    purpose: "полосы склада: сколько чего лежит на балансе",
  },
  {
    key: "cross",
    name: "К9 · кросс-панель",
    tab: "Инбокс",
    sub: "первый экран",
    file: "src/pages/inbox/InboxHome.tsx",
    purpose: "письма как патч-корды между портами: от кого — кому",
  },
  {
    key: "cards",
    name: "К10 · перфокарты Жаккарда",
    tab: "Задания",
    sub: "первый экран",
    file: "src/pages/quests/QuestsHome.tsx",
    purpose: "прогресс задания: колонка — шаг, пробитые ряды — зачтённые",
  },
  {
    key: "baro",
    name: "К11 · барограф",
    tab: "Участок",
    sub: "колодец",
    file: "src/components/farm/WeatherRecorder.tsx, src/pages/farm/WellPanel.tsx",
    purpose: "лента нагрузки сети: номинал, скачок, блэкаут, френзи",
  },
];

export const DEVICE_BY_KEY: Record<DeviceKey, DeviceInfo> = DEVICE_MAP.reduce(
  (acc, d) => ({ ...acc, [d.key]: d }),
  {} as Record<DeviceKey, DeviceInfo>,
);

/** Восемь аппаратов К4–К11 (каркас окна к ним не относится). */
export const INSTRUMENTS = DEVICE_MAP.filter((d) => d.key !== "frame");
