import React, { ReactNode, useEffect, useMemo, useState } from "react";
import { DEVICE_BY_KEY, DEVICE_MAP, type DeviceKey } from "./deviceMap";
import {
  Key,
  Keys,
  Lamp,
  Lamps,
  Note,
  Panel,
  Readout,
  Readouts,
  Row,
  Rows,
  Sticker,
  Tile,
  Tiles,
} from "../ui/forge/kit";
import {
  CrossPanel,
  CryoRack,
  Dewar,
  DrumChart,
  EchoTrace,
  GelLanes,
  MixerBus,
  MixerStrips,
  PlateGrid,
  PlateReader,
  PunchedCard,
  SonarPPI,
  type Channel,
  type CrossLink,
  type CrossPort,
  type GelLane,
  type PlateWell,
  type StepState,
  type Straw,
} from "../ui/forge/devices";

/**
 * Инструментальная палитра проекта.
 *
 * Каждый слайд — живой прибор на настоящем коде (`src/ui/forge/*`), а не
 * картинка: то, что видно здесь, стоит и в игре. Рядом указано, где именно
 * прибор появляется. Значения на слайдах с пометкой «демо» синтетические —
 * они нужны, чтобы показать шкалы; в игре таких чисел нет.
 */

export type Slide = {
  id: string;
  group: string;
  device: DeviceKey;
  title: string;
  variant: string;
  where: string;
  note: string;
  /** На слайде есть показательные (синтетические) значения. */
  demo: boolean;
  render: () => ReactNode;
};

const straws = (levels: (number | null)[], names: string[], values: string[]): Straw[] =>
  levels.map((level, i) => ({ key: `${names[i]}-${i}`, name: names[i], value: values[i], level }));

const channels = (rows: [string, number | null, number | null, boolean?][]): Channel[] =>
  rows.map(([name, load, hours, active]) => ({ key: name, name, load, hours, active }));

const wells = (list: [number, number, PlateWell["state"]][]): PlateWell[] =>
  list.map(([r, c, state]) => ({ r, c, state }));

const emptyWells = (rows: number, cols: number): PlateWell[] => {
  const out: PlateWell[] = [];
  for (let r = 0; r < rows; r += 1) for (let c = 0; c < cols; c += 1) out.push({ r, c, state: "empty" });
  return out;
};

const lanes = (spec: [string, number[]][]): GelLane[] =>
  spec.map(([name, at], i) => ({
    key: `${name}-${i}`,
    name,
    bands: at.map((v, j) => ({ at: v, kind: j === 0 ? "ref" : v > 0.6 ? "fresh" : "weak" })),
  }));

const steps = (s: string): StepState[] => s.split("").map((ch) => (ch === "d" ? "done" : ch === "n" ? "next" : "open"));

const ports = (labels: string[], tones: CrossPort["lamp"][] = []): CrossPort[] =>
  labels.map((label, i) => ({ label, lamp: tones[i] ?? "idle" }));

const links = (pairs: [number, number, CrossLink["cord"], boolean?][]): CrossLink[] =>
  pairs.map(([from, to, cord, pulse]) => ({ from, to, cord, pulse }));

const dayLabels = ["ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ", "ВС"];

/* ─────────────────────────── Слайды ─────────────────────────── */

const frameSlides: Slide[] = [
  {
    id: "frame-01",
    group: "Каркас окна",
    device: "frame",
    title: "Крупное окно",
    variant: "уровень «hero» — один прибор на весь экран",
    where: "Лаборатория, первый экран · Лабораторное окно стоит первым",
    note: "Крупное окно держит заголовок, этикетку и ленту ламп. Всё, что ниже — плитки и приборы на его полке.",
    demo: false,
    render: () => (
      <Panel
        tier="hero"
        device="cryo"
        id={<Sticker>ЛАБОРАТОРИЯ</Sticker>}
        meta="СТЕНД A · ГЛУБОКИЙ ХОЛОД"
        title="Твоя лаборатория"
        sub="стойка образцов и сосуд с азотом"
      >
        <Lamps>
          <Lamp tone="ok">связь с сетью</Lamp>
          <Lamp tone="wait">энергии в сети нет</Lamp>
        </Lamps>
        <div style={{ marginTop: 14 }}>
          <Readouts>
            <Readout label="Энергия" value="—" dash hint="кошелёк не подключён" />
            <Readout label="Образцов" value="—" dash hint="нет данных" />
          </Readouts>
        </div>
      </Panel>
    ),
  },
  {
    id: "frame-02",
    group: "Каркас окна",
    device: "frame",
    title: "Рабочее окно",
    variant: "уровень «panel» — прибор в потоке страницы",
    where: "везде, где прибор не занимает экран целиком",
    note: "Основной уровень: окно с бортиком, этикеткой слева и режимом справа.",
    demo: false,
    render: () => (
      <Panel
        tier="panel"
        device="plate"
        id={<Sticker alt>СТОЙКА</Sticker>}
        meta="В РАБОТЕ"
        title="Микропланшет места"
        sub="лунка — место под инструмент"
      >
        <Note quiet>Рабочее окно редко стоит одно: под ним идут плитки и считыватели.</Note>
      </Panel>
    ),
  },
  {
    id: "frame-03",
    group: "Каркас окна",
    device: "frame",
    title: "Тихое окно",
    variant: "уровень «quiet» — пояснение и справка",
    where: "подписи под приборами, справки, пустые состояния",
    note: "Тихое окно не спорит с прибором: нет бортика, есть подпись.",
    demo: false,
    render: () => (
      <Panel tier="quiet" title="Зачем это окно">
        <Note quiet>Тихий уровень нужен там, где прибор молчит: объяснить, чего не хватает, вместо пустоты.</Note>
      </Panel>
    ),
  },
  {
    id: "frame-04",
    group: "Каркас окна",
    device: "frame",
    title: "Этикетки и считыватели",
    variant: "штамп + значения с пояснениями",
    where: "все приборные окна",
    note: "Этикетка слева — имя аппарата; режим справа. Считыватель показывает значение и то, откуда оно взято.",
    demo: false,
    render: () => (
      <Panel
        tier="panel"
        id={<Sticker bars>ОБРАЗЕЦ · 04</Sticker>}
        meta="НОРМА"
        title="Считыватели"
        sub="подпись · значение · пояснение"
      >
        <Readouts>
          <Readout label="Позиций с запасом" value="7" hint="всего позиций: 27" />
          <Readout label="Полнее всего" value="1 240" hint="SPROUT" />
          <Readout label="Архив смены" value="—" dash hint="архив не ведётся" />
        </Readouts>
      </Panel>
    ),
  },
  {
    id: "frame-05",
    group: "Каркас окна",
    device: "frame",
    title: "Лампы, клавиши, плитки",
    variant: "управление без декора",
    where: "панели действий, стойки, кошельки",
    note: "Лампа горит только от реального источника. Клавиша ведёт себя одинаково во всех окнах.",
    demo: false,
    render: () => (
      <Panel tier="panel" id={<Sticker alt>УПРАВЛЕНИЕ</Sticker>} meta="РУЧНОЙ" title="Органы управления">
        <Lamps>
          <Lamp tone="ok">связь</Lamp>
          <Lamp tone="wait">в очереди</Lamp>
          <Lamp tone="err">сбой</Lamp>
        </Lamps>
        <Tiles>
          <Tile value="27" name="ресурсов" />
          <Tile value="—" name="заданий" />
          <Tile value="6" name="вкладок" />
        </Tiles>
        <Keys>
          <Key tone="primary">Забрать</Key>
          <Key>Осмотреть</Key>
          <Key tone="ghost" tiny>
            Справка
          </Key>
        </Keys>
      </Panel>
    ),
  },
  {
    id: "frame-06",
    group: "Каркас окна",
    device: "frame",
    title: "Палитра A",
    variant: "морозное стекло: 8 цветов",
    where: "src/theme/forge.css — переменные --fg-*",
    note: "Цвет в окнах идёт от значений и ламп, а не от рамок: фон почти чёрный, свет — циан.",
    demo: false,
    render: () => (
      <div className="vg-swatches">
        {[
          ["--fg-void", "#0B0D11", "фон"],
          ["--fg-text", "#E6EBF0", "текст"],
          ["--fg-glow", "#5FC9DA", "свет"],
          ["--fg-accent", "#8FE3F0", "яркий свет"],
          ["--fg-ok", "#5FD3A8", "норма"],
          ["--fg-reward", "#E0708A", "награда"],
          ["--fg-err", "#E2685F", "сбой"],
          ["--fg-deep", "#A99BEC", "глубина"],
        ].map(([name, hex, role]) => (
          <div className="vg-swatch" key={name}>
            <span className="vg-swatch__chip" style={{ background: hex }} />
            <span className="vg-swatch__name">{name}</span>
            <span className="vg-swatch__role">{role}</span>
            <code className="vg-swatch__hex">{hex}</code>
          </div>
        ))}
      </div>
    ),
  },
];

const cryoSlides: Slide[] = [
  {
    id: "cryo-01",
    group: "К4 · криостойка и сосуд N₂",
    device: "cryo",
    title: "Стойка с образцами",
    variant: "полная полка",
    where: "Лаборатория · первый экран (components/farm/LabHero.tsx)",
    note: "Соломинка — позиция ресурса, уровень жидкости — доля от ёмкости. Значения показательные.",
    demo: true,
    render: () => (
      <CryoRack
        title="Стойка A · базовые"
        meta="норма"
        slots={straws(
          [0.82, 0.47, 0.18, 0.93],
          ["SPROUT", "EMBER", "GOLD", "WATER"],
          ["820", "470", "185", "9 300"],
        )}
      />
    ),
  },
  {
    id: "cryo-02",
    group: "К4 · криостойка и сосуд N₂",
    device: "cryo",
    title: "Стойка с наградной позицией",
    variant: "отмеченный сосуд",
    where: "Лаборатория · первый экран; награды сезона",
    note: "Магентовый колпачок — награда, а не «премиум-скин»: он указывает на ресурс события.",
    demo: true,
    render: () => (
      <CryoRack
        title="Стойка B · модельная цепочка"
        meta="контроль"
        slots={[
          ...straws([0.64, 0.31], ["MIND", "SKR"], ["128", "64"]),
          { key: "reward", name: "REWARD", value: "12", level: 0.55, reward: true },
        ]}
      />
    ),
  },
  {
    id: "cryo-03",
    group: "К4 · криостойка и сосуд N₂",
    device: "cryo",
    title: "Пустая стойка",
    variant: "нет данных — нет жидкости",
    where: "Лаборатория · кошелёк не подключён",
    note: "Уровень null — соломинка сухая, а значение честно «—». Ноль здесь означал бы «пусто у игрока», а не «нет связи».",
    demo: false,
    render: () => (
      <CryoRack
        title="Стойка A · базовые"
        meta="нет данных"
        slots={straws([null, null, null, null], ["SPROUT", "EMBER", "GOLD", "WATER"], ["—", "—", "—", "—"])}
      />
    ),
  },
  {
    id: "cryo-04",
    group: "К4 · криостойка и сосуд N₂",
    device: "cryo",
    title: "Сосуд с азотом",
    variant: "доля энергии сети",
    where: "Лаборатория · первый экран, рядом со стойкой",
    note: "Стекло заполняется долей энергии. Без данных сосуд сухой и подписан «—».",
    demo: false,
    render: () => (
      <div className="vg-row">
        <Dewar level={0.62} label="ЖИДК. N₂ · демо" />
        <Dewar level={null} label="ЖИДК. N₂" />
      </div>
    ),
  },
];

const mixSlides: Slide[] = [
  {
    id: "mix-01",
    group: "К5 · пульт мастерской",
    device: "mix",
    title: "Полный пульт",
    variant: "восемь каналов",
    where: "Инструменты · первый экран (pages/tools/ToolsHome.tsx)",
    note: "Стрелка — прочность, фейдер — часы смены, буква M — инструмент работает. Значения показательные.",
    demo: true,
    render: () => (
      <MixerStrips
        maxHours={20}
        channels={channels([
          ["плазменный резчик", 0.85, 17, true],
          ["экстрактор кремния", 0.6, 12],
          ["сборщик данных", 0.42, 8],
          ["квантовый передатчик", 0.28, 5, true],
          ["станция засева", 0.91, 18],
          ["очиститель", 0.35, 7],
          ["сушилка", 0.72, 14, true],
          ["модель", 0.55, 11],
        ])}
      />
    ),
  },
  {
    id: "mix-02",
    group: "К5 · пульт мастерской",
    device: "mix",
    title: "Короткая стойка",
    variant: "три канала: пульт не растягивается",
    where: "Инструменты · у игрока три инструмента",
    note: "Каналов ровно столько, сколько инструментов: пустых полос прибор не рисует.",
    demo: true,
    render: () => (
      <MixerStrips
        maxHours={20}
        channels={channels([
          ["плазменный резчик", 0.85, 17, true],
          ["станция засева", 0.91, 18],
          ["модель", null, null],
        ])}
      />
    ),
  },
  {
    id: "mix-03",
    group: "К5 · пульт мастерской",
    device: "mix",
    title: "Пульт до кошелька",
    variant: "каталог инструментов, «нет данных»",
    where: "Инструменты · кошелёк не подключён",
    note: "Без кошелька каналы подписаны названиями инструментов, а шкалы пустые: прибор видно, выдуманной прочности нет.",
    demo: false,
    render: () => (
      <MixerStrips
        maxHours={20}
        channels={channels([
          ["плазменный резчик", null, null],
          ["экстрактор кремния", null, null],
          ["сборщик данных", null, null],
          ["квантовый передатчик", null, null],
          ["станция засева", null, null],
        ])}
      />
    ),
  },
  {
    id: "mix-04",
    group: "К5 · пульт мастерской",
    device: "mix",
    title: "Стоящий канал",
    variant: "инструмент в стойке, смена выключена",
    where: "Инструменты · M выключен",
    note: "Погасший канал — не «поломка»: инструмент стоит, но не работает.",
    demo: true,
    render: () => (
      <MixerStrips maxHours={20} channels={channels([["очиститель", 0.5, null], ["сушилка", 0.72, 14, true]])} />
    ),
  },
  {
    id: "mix-05",
    group: "К5 · пульт мастерской",
    device: "mix",
    title: "Шинный считыватель",
    variant: "одна цифра под пультом",
    where: "Инструменты · итоги пульта (MixerBus)",
    note: "Дополнительная деталь пульта: короткая строка «подпись — значение» без отдельного окна.",
    demo: true,
    render: () => (
      <div style={{ display: "grid", gap: 8 }}>
        <MixerBus label="Каналов в смене" value="3" />
        <MixerBus label="Простой" dash />
      </div>
    ),
  },
];

const sonarSlides: Slide[] = [
  {
    id: "sonar-01",
    group: "К6 · эхолот и сонар",
    device: "sonar",
    title: "Лента глубины",
    variant: "отметки добычи",
    where: "Участок · журнал смены (pages/farm/FarmDashboard.tsx)",
    note: "Метки — события архива: чем ниже, тем глубже смена. Значения показательные.",
    demo: true,
    render: () => (
      <EchoTrace
        depth={0.42}
        marks={[
          { at: 60, depth: 0.2, size: 1.2 },
          { at: 140, depth: 0.5, size: 0.8 },
          { at: 230, depth: 0.34, size: 1.6 },
          { at: 330, depth: 0.62, size: 1 },
        ]}
      />
    ),
  },
  {
    id: "sonar-02",
    group: "К6 · эхолот и сонар",
    device: "sonar",
    title: "Молчащий эхолот",
    variant: "архива нет — пера нет",
    where: "Участок · журнал смены",
    note: "Когда архив сети не ведётся, прибор рисует только сетку и честно молчит вместо выдуманного графика.",
    demo: false,
    render: () => <EchoTrace marks={[]} depth={null} />,
  },
  {
    id: "sonar-03",
    group: "К6 · эхолот и сонар",
    device: "sonar",
    title: "Глубокая смена",
    variant: "одна крупная цель",
    where: "Участок · глубокая выработка",
    note: "Размер метки — вес события; лента не «украшение», а запись смены.",
    demo: true,
    render: () => <EchoTrace depth={0.78} marks={[{ at: 210, depth: 0.8, size: 2 }]} />,
  },
  {
    id: "sonar-04",
    group: "К6 · эхолот и сонар",
    device: "sonar",
    title: "Развёртка прилавков",
    variant: "лоты по цене",
    where: "Рынок · первый экран и витрина (pages/market/MarketHome.tsx, ListingPage.tsx)",
    note: "Чем ближе к центру, тем дешевле лот. Круг — это цена, а не «радар редкости».",
    demo: true,
    render: () => (
      <SonarPPI
        blips={[
          { x: 60, y: 30, r: 2.6 },
          { x: 92, y: 58, r: 2.2 },
          { x: 74, y: 96, r: 2.8 },
          { x: 38, y: 88, r: 2 },
          { x: 46, y: 44, r: 2.4 },
        ]}
        legend={
          <>
            <span>Лотов: <b>5</b></span>
            <span>Медиана: <b>0.0420 ◎</b></span>
          </>
        }
      />
    ),
  },
  {
    id: "sonar-05",
    group: "К6 · эхолот и сонар",
    device: "sonar",
    title: "Пустая витрина",
    variant: "нет данных сети",
    where: "Рынок · первый экран, пока прилавки не читаются",
    note: "Развёртка крутится, но отметок нет: прибор видно до появления данных, и он говорит словами, чего ждёт.",
    demo: false,
    render: () => (
      <SonarPPI
        blips={[]}
        legend={
          <>
            <span>Витрина: <b>—</b></span>
            <span>Медиана: <b>—</b></span>
          </>
        }
      />
    ),
  },
  {
    id: "sonar-06",
    group: "К6 · эхолот и сонар",
    device: "sonar",
    title: "Плотный прилавок",
    variant: "24 отметки",
    where: "Рынок · витрина листингов, много лотов",
    note: "Развёртка держит до 24 отметок: больше — уже не читается глазом.",
    demo: true,
    render: () => (
      <SonarPPI
        blips={Array.from({ length: 24 }, (_, i) => {
          const a = (-90 + (i / 24) * 360) * (Math.PI / 180);
          const r = 9 + 43 * ((i * 37) % 100) / 100;
          return { x: 60 + r * Math.cos(a), y: 60 + r * Math.sin(a), r: 2.2 };
        })}
        legend={<span>Лотов: <b>24</b></span>}
      />
    ),
  },
];

const plateSlides: Slide[] = [
  {
    id: "plate-01",
    group: "К7 · микропланшет 96 лунок",
    device: "plate",
    title: "Планшет стойки",
    variant: "работающие и стоящие инструменты",
    where: "Участок · первый экран (pages/farm/FarmDashboard.tsx)",
    note: "Лунка — место в стойке. Светится то, что работает; контур — стоит на месте.",
    demo: true,
    render: () => (
      <PlateGrid
        rows={6}
        cols={8}
        wells={wells([
          [0, 2, "g"],
          [0, 6, "q"],
          [1, 4, "g"],
          [2, 1, "q"],
          [3, 5, "g"],
          [4, 3, "q"],
        ])}
      />
    ),
  },
  {
    id: "plate-02",
    group: "К7 · микропланшет 96 лунок",
    device: "plate",
    title: "Пустой участок",
    variant: "все лунки свободны",
    where: "Участок · инструментов в стойке нет",
    note: "Пустой планшет — это состояние участка, а не ошибка: место под инструменты есть, инструментов нет.",
    demo: false,
    render: () => <PlateGrid rows={6} cols={8} wells={emptyWells(6, 8)} />,
  },
  {
    id: "plate-03",
    group: "К7 · микропланшет 96 лунок",
    device: "plate",
    title: "Один инструмент",
    variant: "одна занятая лунка",
    where: "Участок · первый инструмент в стойке",
    note: "Считывать планшет можно и по одной лунке: место занято — видно сразу.",
    demo: true,
    render: () => <PlateGrid rows={6} cols={8} wells={wells([[3, 4, "g"]])} />,
  },
  {
    id: "plate-04",
    group: "К7 · микропланшет 96 лунок",
    device: "plate",
    title: "Полный планшет",
    variant: "12 × 8 — заводской формат",
    where: "Участок · полная стойка",
    note: "Полный планшет — контрольный размер прибора: он не растёт от количества инструментов.",
    demo: true,
    render: () => (
      <PlateGrid
        rows={8}
        cols={12}
        wells={Array.from({ length: 40 }, (_, i) => ({
          r: Math.floor(i / 8),
          c: (i * 3) % 12,
          state: (i % 3 === 0 ? "g" : "q") as PlateWell["state"],
        }))}
      />
    ),
  },
  {
    id: "plate-05",
    group: "К7 · микропланшет 96 лунок",
    device: "plate",
    title: "Считыватель планшета",
    variant: "выписка по лунке",
    where: "Участок · карточка инструмента (PlateReader)",
    note: "Когда планшет используется как читальный стол, значения выносятся в отдельные ячейки.",
    demo: true,
    render: () => (
      <PlateReader
        boxes={[
          { label: "Прочность", value: "17 / 20" },
          { label: "Смена", value: "12 ч" },
          { label: "Партия", value: "—", dash: true },
        ]}
      />
    ),
  },
];

const gelSlides: Slide[] = [
  {
    id: "gel-01",
    group: "К8 · гель-электрофорез",
    device: "gel",
    title: "Дорожки склада",
    variant: "полосы по позициям",
    where: "Экономика · обзор (pages/economy/ResourceOverview.tsx)",
    note: "Дорожка — позиция ресурса, полоса — запас. Отдельная полоса сверху — эталон шкалы.",
    demo: true,
    render: () => (
      <GelLanes
        lanes={lanes([
          ["SPROUT", [0.2, 0.72]],
          ["EMBER", [0.2, 0.51]],
          ["GOLD", [0.2, 0.33]],
          ["WATER", [0.2, 0.88]],
        ])}
      />
    ),
  },
  {
    id: "gel-02",
    group: "К8 · гель-электрофорез",
    device: "gel",
    title: "Пустой склад",
    variant: "ни одной полосы",
    where: "Экономика · обзор, запасов нет",
    note: "Пустой гель говорит словами: «Все позиции пусты — полос нет», и не рисует нулевые дорожки.",
    demo: false,
    render: () => <GelLanes lanes={[]} />,
  },
  {
    id: "gel-03",
    group: "К8 · гель-электрофорез",
    device: "gel",
    title: "Одна позиция",
    variant: "узкий гель",
    where: "Экономика · обзор, один ресурс",
    note: "Гель читается и по одной дорожке: прибор не требует полного набора.",
    demo: true,
    render: () => <GelLanes lanes={lanes([["MIND", [0.2, 0.64]]])} />,
  },
  {
    id: "gel-04",
    group: "К8 · гель-электрофорез",
    device: "gel",
    title: "Слабые полосы",
    variant: "малый запас против эталона",
    where: "Экономика · обзор, остатки на нуле",
    note: "Слабая полоса — это «почти пусто», и её видно без чтения числа.",
    demo: true,
    render: () => (
      <GelLanes
        lanes={lanes([
          ["GOLD", [0.2, 0.12]],
          ["WATER", [0.2, 0.09]],
          ["EMBER", [0.2, 0.06]],
        ])}
      />
    ),
  },
  {
    id: "gel-05",
    group: "К8 · гель-электрофорез",
    device: "gel",
    title: "Полный склад",
    variant: "шесть дорожек",
    where: "Экономика · обзор, много позиций",
    note: "Чем больше дорожек, тем плотнее гель — прибор останавливается на шести, дальше идут считыватели.",
    demo: true,
    render: () => (
      <GelLanes
        lanes={lanes([
          ["SPROUT", [0.2, 0.92]],
          ["EMBER", [0.2, 0.74]],
          ["GOLD", [0.2, 0.61]],
          ["WATER", [0.2, 0.55]],
          ["MIND", [0.2, 0.38]],
          ["SKR", [0.2, 0.22]],
        ])}
      />
    ),
  },
];

const crossSlides: Slide[] = [
  {
    id: "cross-01",
    group: "К9 · кросс-панель",
    device: "cross",
    title: "Письма как корды",
    variant: "шесть портов, четыре связи",
    where: "Инбокс · первый экран (pages/inbox/InboxHome.tsx)",
    note: "Порт сверху — отправитель, снизу — получатель. Натянутый корд означает письмо; провис — нет ответа.",
    demo: true,
    render: () => (
      <CrossPanel
        top={ports(["сеть", "рынок", "цех", "лавка", "эпоха", "агент"], ["ok", "err", "idle", "ok", "ok", "idle"])}
        bottom={ports(["ты", "склад", "стойка", "казна"])}
        links={links([
          [0, 0, 1],
          [1, 1, 2, true],
          [2, 3, 3],
          [5, 2, 4, true],
        ])}
      />
    ),
  },
  {
    id: "cross-02",
    group: "К9 · кросс-панель",
    device: "cross",
    title: "Пустой ящик",
    variant: "кордов нет",
    where: "Инбокс · писем нет",
    note: "Пустая кросс-панель — нормальное состояние: порты на месте, кордов нет, и это сказано словами.",
    demo: false,
    render: () => <CrossPanel top={ports(["сеть", "рынок", "цех"])} bottom={ports(["ты", "склад"])} links={[]} />,
  },
  {
    id: "cross-03",
    group: "К9 · кросс-панель",
    device: "cross",
    title: "Один корд",
    variant: "одно письмо",
    where: "Инбокс · одно входящее",
    note: "Одиночный корд видно сразу: прибор не теряет смысл на коротком списке.",
    demo: true,
    render: () => <CrossPanel top={ports(["рынок"])} bottom={ports(["ты"])} links={links([[0, 0, 2, true]])} />,
  },
  {
    id: "cross-04",
    group: "К9 · кросс-панель",
    device: "cross",
    title: "Сбойный порт",
    variant: "лампа «сбой» на отправителе",
    where: "Инбокс · источник недоступен",
    note: "Красная лампа стоит у порта-источника: видно, кто именно не отвечает.",
    demo: true,
    render: () => (
      <CrossPanel
        top={ports(["сеть", "рынок", "цех"], ["ok", "err", "ok"])}
        bottom={ports(["ты", "склад"], ["idle", "idle"])}
        links={links([
          [0, 0, 1],
          [1, 1, 3],
          [2, 1, 4],
        ])}
      />
    ),
  },
  {
    id: "cross-05",
    group: "К9 · кросс-панель",
    device: "cross",
    title: "Пульс на линии",
    variant: "активная связь",
    where: "Инбокс · письмо в работе",
    note: "Пульс — единственное движение на панели, и оно означает «линия живая».",
    demo: true,
    render: () => (
      <CrossPanel
        top={ports(["сеть", "рынок"])}
        bottom={ports(["ты", "казна"])}
        links={links([
          [0, 0, 2, true],
          [1, 1, 4, true],
        ])}
      />
    ),
  },
];

const cardsSlides: Slide[] = [
  {
    id: "cards-01",
    group: "К10 · перфокарты Жаккарда",
    device: "cards",
    title: "Прогресс задания",
    variant: "четыре шага из пяти",
    where: "Задания · первый экран (pages/quests/QuestsHome.tsx)",
    note: "Колонка — шаг, пробитые ряды — зачтённые. Значения показательные.",
    demo: true,
    render: () => <PunchedCard title="ПРОГРЕСС" steps={steps("ddddn")} footLeft="4 / 5" footMid="80 %" />,
  },
  {
    id: "cards-02",
    group: "К10 · перфокарты Жаккарда",
    device: "cards",
    title: "Пустая карта",
    variant: "ни один шаг не зачтён",
    where: "Задания · кошелёк не подключён или заданий нет",
    note: "Пустая карта стоит на экране всегда: иначе приборов не видно до подключения кошелька.",
    demo: false,
    render: () => <PunchedCard title="ПРОГРЕСС" steps={steps("ooooo")} rows={4} footLeft="0 / 0" footMid="шагов" footRight="—" />,
  },
  {
    id: "cards-03",
    group: "К10 · перфокарты Жаккарда",
    device: "cards",
    title: "Выполненное задание",
    variant: "все шаги зачтены",
    where: "Задания · награда получена",
    note: "Полная перфорация — награда забрана; карта не исчезает, чтобы прогресс можно было перечитать.",
    demo: true,
    render: () => <PunchedCard title="ПРОГРЕСС" steps={steps("ddddd")} footLeft="5 / 5" footMid="100 %" />,
  },
  {
    id: "cards-04",
    group: "К10 · перфокарты Жаккарда",
    device: "cards",
    title: "Короткая карта",
    variant: "четыре ряда вместо пяти",
    where: "Задания · короткие задания дня",
    note: "Число рядов — настройка прибора: короткое задание не должно выглядеть обрезанным.",
    demo: true,
    render: () => <PunchedCard title="ПРОГРЕСС" steps={steps("dno")} rows={4} footLeft="1 / 3" footMid="33 %" />,
  },
  {
    id: "cards-05",
    group: "К10 · перфокарты Жаккарда",
    device: "cards",
    title: "Карта без ведомости",
    variant: "значения спрашиваются словами",
    where: "Задания · нет данных о шагах",
    note: "Если шаги неизвестны, нижняя строка молчит: «—» вместо придуманных чисел.",
    demo: false,
    render: () => <PunchedCard title="ПРОГРЕСС" steps={steps("onooo")} footLeft="—" footMid="—" footRight="—" />,
  },
];

const baroSlides: Slide[] = [
  {
    id: "baro-01",
    group: "К11 · барограф",
    device: "baro",
    title: "Лента нагрузки",
    variant: "неделя погодных событий",
    where: "Участок · колодец (components/farm/WeatherRecorder.tsx, WellPanel.tsx)",
    note: "Барабан пишет нагрузку сети: номинал посередине, френзи наверху, блэкаут внизу. Значения показательные.",
    demo: true,
    render: () => <DrumChart points={[0.5, 0.62, 0.35, 0.9, 0.5, 0.2, 0.55]} dayLabels={dayLabels} />,
  },
  {
    id: "baro-02",
    group: "К11 · барограф",
    device: "baro",
    title: "Перо на нуле",
    variant: "событий нет",
    where: "Участок · колодец, погода не менялась",
    note: "Ровная линия — тоже запись: за неделю ничего не произошло, и это видно.",
    demo: true,
    render: () => <DrumChart points={[0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]} dayLabels={dayLabels} />,
  },
  {
    id: "baro-03",
    group: "К11 · барограф",
    device: "baro",
    title: "Молчащий барабан",
    variant: "лента не заправлена",
    where: "Участок · колодец, архива нет",
    note: "Без точек перо не рисует кривую: пустой барабан честнее выдуманного прогноза.",
    demo: false,
    render: () => <DrumChart points={[]} dayLabels={dayLabels} />,
  },
  {
    id: "baro-04",
    group: "К11 · барограф",
    device: "baro",
    title: "Блэкаут",
    variant: "провал нагрузки",
    where: "Участок · колодец, событие «блэкаут»",
    note: "Нижняя полка шкалы — падение сети; верхняя — событие «френзи».",
    demo: true,
    render: () => <DrumChart points={[0.5, 0.45, 0.1, 0.05, 0.3, 0.62, 0.5]} dayLabels={dayLabels} />,
  },
];

const behaviorSlides: Slide[] = [
  {
    id: "beh-01",
    group: "Поведение окон",
    device: "frame",
    title: "«—» вместо нуля",
    variant: "нет связи ≠ ноль на балансе",
    where: "все приборы: prop dash / level: null",
    note: "Пустая ячейка со значением «—» означает «неизвестно». Ноль ставится только тогда, когда сеть реально отдала ноль.",
    demo: false,
    render: () => (
      <Panel tier="panel" id={<Sticker alt>ПРАВИЛО</Sticker>} meta="ЧЕСТНОСТЬ" title="Неизвестное и пустое">
        <Rows>
          <Row k="Баланс в сети" v="—" note="нет связи с узлом" />
          <Row k="Баланс в сети" v="0" note="узел ответил: пусто" />
          <Row k="Прочность инструмента" v="17 / 20" note="прочитано из сети" />
        </Rows>
      </Panel>
    ),
  },
  {
    id: "beh-02",
    group: "Поведение окон",
    device: "frame",
    title: "Длинные подписи",
    variant: "имя ресурса не ломает окно",
    where: "все окна: подписи обрезаются, шкалы не сжимаются",
    note: "Имя инструмента может быть длинным: канал пульта не должен от этого разъезжаться.",
    demo: true,
    render: () => (
      <MixerStrips
        maxHours={20}
        channels={channels([
          ["квантовый передатчик дальней связи", 0.7, 14, true],
          ["экстрактор кремния повышенной чистоты", 0.4, 9],
        ])}
      />
    ),
  },
  {
    id: "beh-03",
    group: "Поведение окон",
    device: "frame",
    title: "Пояснение вместо догадки",
    variant: "тихая заметка под прибором",
    where: "пустые состояния всех вкладок",
    note: "Прибор не молчит и не выдумывает: он говорит, чего не хватает — кошелька, сети или самих данных.",
    demo: false,
    render: () => (
      <Panel tier="panel" id={<Sticker alt>МОЛЧАНИЕ</Sticker>} meta="НЕТ ДАННЫХ" title="Как говорит пустой прибор">
        <Note quiet>Подключи кошелёк — покажем прочность твоих инструментов.</Note>
        <Note quiet>Стойка не читается: сеть не ответила.</Note>
        <Note quiet>Инструментов пока нет: собери первый в кузнице или открой капсулу.</Note>
      </Panel>
    ),
  },
  {
    id: "beh-04",
    group: "Поведение окон",
    device: "frame",
    title: "Только настоящие номера",
    variant: "номер — подпись реального объекта",
    where: "этикетки приборов: партия, стенд, ID",
    note: "Номера в этикетках берутся из данных. Прибор без номера подписывается именем, а не придуманным индексом.",
    demo: false,
    render: () => (
      <Panel tier="panel" id={<Sticker bars>СТОЙКА · 3</Sticker>} meta="ПУЛЬТ" title="Номер — это факт">
        <Rows>
          <Row k="Номер партии" v="0x3f…a1" note="ID инструмента" />
          <Row k="Стенд" v="—" note="сеть не назвала стенд" />
        </Rows>
      </Panel>
    ),
  },
  {
    id: "beh-05",
    group: "Поведение окон",
    device: "frame",
    title: "Движение только физическое",
    variant: "жидкость, стрелка, перо",
    where: "все приборы; отключается системной настройкой «меньше движения»",
    note: "Двигаются только части аппарата: жидкость в сосуде, стрелка, перо самописца. Декоративной анимации нет.",
    demo: true,
    render: () => (
      <div className="vg-row">
        <Dewar level={0.35} label="уровень — демо" />
        <MixerStrips maxHours={20} channels={channels([["стрелка", 0.66, 13, true]])} />
      </div>
    ),
  },
];

export const SLIDES: Slide[] = [
  ...frameSlides,
  ...cryoSlides,
  ...mixSlides,
  ...sonarSlides,
  ...plateSlides,
  ...gelSlides,
  ...crossSlides,
  ...cardsSlides,
  ...baroSlides,
  ...behaviorSlides,
];

/* ─────────────────────────── Экран палитры ─────────────────────────── */

export function VisualGallery() {
  const [at, setAt] = useState(() => {
    const raw = Number(new URLSearchParams(window.location.search).get("s"));
    return Number.isFinite(raw) && raw >= 1 && raw <= SLIDES.length ? raw - 1 : 0;
  });
  const slide = SLIDES[Math.min(at, SLIDES.length - 1)];

  const groups = useMemo(() => {
    const out: { group: string; items: { slide: Slide; index: number }[] }[] = [];
    SLIDES.forEach((s, index) => {
      const last = out[out.length - 1];
      if (last && last.group === s.group) last.items.push({ slide: s, index });
      else out.push({ group: s.group, items: [{ slide: s, index }] });
    });
    return out;
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setAt((v) => Math.min(SLIDES.length - 1, v + 1));
      if (e.key === "ArrowLeft") setAt((v) => Math.max(0, v - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("s", String(at + 1));
    window.history.replaceState(null, "", url.toString());
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [at]);

  const device = DEVICE_BY_KEY[slide.device];

  return (
    <div className="vg">
      <aside className="vg-index">
        <div className="vg-index__head">
          <b>Инструментальная палитра</b>
          <span>50 слайдов · 8 аппаратов К4–К11</span>
          <a className="vg-index__back" href="/">
            ← в игру
          </a>
        </div>
        <nav>
          {groups.map((g) => (
            <div key={g.group} className="vg-index__group">
              <div className="vg-index__title">{g.group}</div>
              {g.items.map(({ slide: s, index }) => (
                <button
                  key={s.id}
                  type="button"
                  className={"vg-index__item" + (index === at ? " active" : "")}
                  onClick={() => setAt(index)}
                >
                  <span className="vg-index__num">{String(index + 1).padStart(2, "0")}</span>
                  <span>
                    {s.title}
                    <small>{s.variant}</small>
                  </span>
                </button>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      <main className="vg-main">
        <div className="vg-top">
          <button type="button" className="vg-nav" onClick={() => setAt((v) => Math.max(0, v - 1))} disabled={at === 0}>
            ← назад
          </button>
          <span className="vg-count">
            слайд {at + 1} из {SLIDES.length}
          </span>
          <button
            type="button"
            className="vg-nav"
            onClick={() => setAt((v) => Math.min(SLIDES.length - 1, v + 1))}
            disabled={at === SLIDES.length - 1}
          >
            вперёд →
          </button>
        </div>

        <h1 className="vg-title">
          {slide.title}
          {slide.demo && <span className="vg-demo">демо-значения</span>}
        </h1>
        <p className="vg-variant">{slide.variant}</p>

        <div className="vg-stage">{slide.render()}</div>

        <dl className="vg-facts">
          <div>
            <dt>Прибор</dt>
            <dd>
              {device.name} — {device.purpose}
            </dd>
          </div>
          <div>
            <dt>Где в игре</dt>
            <dd>
              {slide.where}
              <br />
              <span className="vg-file">
                {device.tab}
                {device.sub !== "—" ? ` → ${device.sub}` : ""} · {device.file}
              </span>
            </dd>
          </div>
          <div>
            <dt>Что видно</dt>
            <dd>{slide.note}</dd>
          </div>
        </dl>
      </main>
    </div>
  );
}

/** Список аппаратов — тот же, что в карте приборов: галерея и док говорят одно. */
export const GALLERY_DEVICES = DEVICE_MAP;
