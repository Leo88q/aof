import React, { ReactNode, useEffect, useMemo, useState } from "react";
import { DEVICE_BY_KEY, DEVICE_MAP, type DeviceKey } from "./deviceMap";
import { LanguageSwitcher, useLocale } from "../i18n/LocaleProvider";
import { galleryCopy } from "../i18n/galleryCopy";
import { frameIds, galleryFrameCopy, type FrameId } from "../i18n/galleryFrameCopy";
import { cryoIds, galleryCryoCopy, type CryoId } from "../i18n/galleryCryoCopy";
import { homeResourceNames } from "../i18n/homeDetail";
import { mixIds, galleryMixCopy, type MixId } from "../i18n/galleryMixCopy";
import { sonarIds, gallerySonarCopy, type SonarId } from "../i18n/gallerySonarCopy";
import { plateIds, galleryPlateCopy, type PlateId } from "../i18n/galleryPlateCopy";
import { gelIds, galleryGelCopy, type GelId } from "../i18n/galleryGelCopy";
import { crossIds, galleryCrossCopy, type CrossId } from "../i18n/galleryCrossCopy";
import { cardsIds, galleryCardsCopy, type CardsId } from "../i18n/galleryCardsCopy";
import { baroIds, galleryBaroCopy, type BaroId } from "../i18n/galleryBaroCopy";
import { behaviorIds, galleryBehaviorCopy, type BehaviorId } from "../i18n/galleryBehaviorCopy";
import { labHeroCopy } from "../i18n/labHeroCopy";
import { questsHomeCopy } from "../i18n/questsHomeCopy";
import { inboxUiCopy } from "../i18n/inboxReadCopy";
import { economyDetailCopy } from "../i18n/economyDetailCopy";
import { toolName, toolsCopy } from "../i18n/toolsCopy";
import type { Language } from "../i18n/translations";
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
  group: DeviceKey | "behavior";
  device: DeviceKey;
  title: string;
  variant: string;
  where: string;
  note: string;
  /** На слайде есть показательные (синтетические) значения. */
  demo: boolean;
  render: (language?: Language) => ReactNode;
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

type GelCategory = keyof (typeof economyDetailCopy)["ru"]["lanes"];
const lanes = (spec: [GelCategory, number[]][], language: Language, faint = false): GelLane[] =>
  spec.map(([key, positions]) => ({
    key,
    name: economyDetailCopy[language].lanes[key],
    title: economyDetailCopy[language].categories[key],
    bands: positions.map((at) => ({ at, kind: faint ? "weak" as const : "fresh" as const })),
  }));

const steps = (s: string): StepState[] => s.split("").map((ch) => (ch === "d" ? "done" : ch === "n" ? "next" : "open"));

const ports = (labels: string[], tones: CrossPort["lamp"][] = []): CrossPort[] =>
  labels.map((label, i) => ({ label, lamp: tones[i] ?? "idle" }));

const links = (pairs: [number, number, CrossLink["cord"], boolean?][]): CrossLink[] =>
  pairs.map(([from, to, cord, pulse]) => ({ from, to, cord, pulse }));

const sampleDays = ["1", "2", "3", "4", "5", "6", "7"];
const sampleLoadScale = (language: Language) => (["drought", "sunny", "festival"] as const)
  .map((type) => labHeroCopy[language].load[type].toLocaleUpperCase(language));

/* ─────────────────────────── Слайды ─────────────────────────── */

const frameSlides: Slide[] = [
  {
    id: "frame-01",
    group: "frame",
    device: "frame",
    ...galleryFrameCopy.ru.slides["frame-01"],
    demo: false,
    render: (language = "ru") => {
      const c = galleryFrameCopy[language].sample.hero;
      return (
        <Panel
          tier="hero"
          device="cryo"
          id={<Sticker>{c.tag}</Sticker>}
          meta={c.mode}
          title={c.title}
          sub={c.subtitle}
        >
          <Lamps>
            <Lamp tone="ok">{c.connected}</Lamp>
            <Lamp tone="wait">{c.noEnergy}</Lamp>
          </Lamps>
          <div style={{ marginTop: 14 }}>
            <Readouts>
              <Readout label={c.energy} value="—" dash hint={c.noWallet} />
              <Readout label={c.samples} value="—" dash hint={c.noData} />
            </Readouts>
          </div>
        </Panel>
      );
    },
  },
  {
    id: "frame-02",
    group: "frame",
    device: "frame",
    ...galleryFrameCopy.ru.slides["frame-02"],
    demo: false,
    render: (language = "ru") => {
      const c = galleryFrameCopy[language].sample.panel;
      return (
        <Panel
          tier="panel"
          device="plate"
          id={<Sticker alt>{c.tag}</Sticker>}
          meta={c.mode}
          title={c.title}
          sub={c.subtitle}
        >
          <Note quiet>{c.note}</Note>
        </Panel>
      );
    },
  },
  {
    id: "frame-03",
    group: "frame",
    device: "frame",
    ...galleryFrameCopy.ru.slides["frame-03"],
    demo: false,
    render: (language = "ru") => {
      const c = galleryFrameCopy[language].sample.quiet;
      return (
        <Panel tier="quiet" title={c.title}>
          <Note quiet>{c.note}</Note>
        </Panel>
      );
    },
  },
  {
    id: "frame-04",
    group: "frame",
    device: "frame",
    ...galleryFrameCopy.ru.slides["frame-04"],
    demo: false,
    render: (language = "ru") => {
      const c = galleryFrameCopy[language].sample.readouts;
      return (
        <Panel
          tier="panel"
          id={<Sticker bars>{c.tag}</Sticker>}
          meta={c.mode}
          title={c.title}
          sub={c.subtitle}
        >
          <Readouts>
            <Readout label={c.stocked} value="7" hint={c.total} />
            <Readout label={c.fullest} value={new Intl.NumberFormat(language).format(1240)} hint="SPROUT" />
            <Readout label={c.archive} value="—" dash hint={c.noArchive} />
          </Readouts>
        </Panel>
      );
    },
  },
  {
    id: "frame-05",
    group: "frame",
    device: "frame",
    ...galleryFrameCopy.ru.slides["frame-05"],
    demo: false,
    render: (language = "ru") => {
      const c = galleryFrameCopy[language].sample.controls;
      return (
        <Panel tier="panel" id={<Sticker alt>{c.tag}</Sticker>} meta={c.mode} title={c.title}>
          <Lamps>
            <Lamp tone="ok">{c.connected}</Lamp>
            <Lamp tone="wait">{c.queued}</Lamp>
            <Lamp tone="err">{c.error}</Lamp>
          </Lamps>
          <Tiles>
            <Tile value="27" name={c.resources} />
            <Tile value="—" name={c.quests} />
            <Tile value="6" name={c.tabs} />
          </Tiles>
          <Keys>
            <Key tone="primary">{c.collect}</Key>
            <Key>{c.inspect}</Key>
            <Key tone="ghost" tiny>
              {c.help}
            </Key>
          </Keys>
        </Panel>
      );
    },
  },
  {
    id: "frame-06",
    group: "frame",
    device: "frame",
    ...galleryFrameCopy.ru.slides["frame-06"],
    demo: false,
    render: (language = "ru") => {
      const c = galleryFrameCopy[language].sample.swatches;
      return (
        <div className="vg-swatches">
          {[
            ["--fg-void", "#0B0D11", c[0]],
            ["--fg-text", "#E6EBF0", c[1]],
            ["--fg-glow", "#5FC9DA", c[2]],
            ["--fg-accent", "#8FE3F0", c[3]],
            ["--fg-ok", "#5FD3A8", c[4]],
            ["--fg-reward", "#E0708A", c[5]],
            ["--fg-err", "#E2685F", c[6]],
            ["--fg-deep", "#A99BEC", c[7]],
          ].map(([name, hex, role]) => (
            <div className="vg-swatch" key={name}>
              <span className="vg-swatch__chip" style={{ background: hex }} />
              <span className="vg-swatch__name">{name}</span>
              <span className="vg-swatch__role">{role}</span>
              <code className="vg-swatch__hex">{hex}</code>
            </div>
          ))}
        </div>
      );
    },
  },
];

const cryoSlides: Slide[] = [
  {
    id: "cryo-01",
    group: "cryo",
    device: "cryo",
    ...galleryCryoCopy.ru.slides["cryo-01"],
    demo: true,
    render: (language = "ru") => {
      const c = galleryCryoCopy[language].demo;
      const names = homeResourceNames[language];
      return (
        <CryoRack
          title={c.baseRack}
          meta={c.baseMode}
          slots={straws(
            [0.82, 0.47, 0.18, 0.93],
            [names.data, names.circuit, names.silicon, names.power],
            [820, 470, 185, 9300].map((value) => new Intl.NumberFormat(language).format(value)),
          )}
        />
      );
    },
  },
  {
    id: "cryo-02",
    group: "cryo",
    device: "cryo",
    ...galleryCryoCopy.ru.slides["cryo-02"],
    demo: true,
    render: (language = "ru") => {
      const c = galleryCryoCopy[language].demo;
      const names = homeResourceNames[language];
      return (
        <CryoRack
          title={c.chainRack}
          meta={c.chainMode}
          slots={[
            ...straws([0.64, 0.31], [names.neuron, names.synapse], ["128", "64"]),
            { key: "highlight", name: names.soulCore, value: "12", level: 0.55, reward: true },
          ]}
        />
      );
    },
  },
  {
    id: "cryo-03",
    group: "cryo",
    device: "cryo",
    ...galleryCryoCopy.ru.slides["cryo-03"],
    demo: false,
    render: (language = "ru") => {
      const c = galleryCryoCopy[language].demo;
      const names = homeResourceNames[language];
      return (
        <CryoRack
          title={c.baseRack}
          meta={c.unavailable}
          slots={straws([null, null, null, null],
            [names.data, names.circuit, names.silicon, names.power], ["—", "—", "—", "—"])}
        />
      );
    },
  },
  {
    id: "cryo-04",
    group: "cryo",
    device: "cryo",
    ...galleryCryoCopy.ru.slides["cryo-04"],
    demo: false,
    render: (language = "ru") => {
      const c = galleryCryoCopy[language].demo;
      return (
        <div className="vg-row">
          <Dewar level={0.62} label={c.energyDemo} />
          <Dewar level={null} label={c.energyUnknown} />
        </div>
      );
    },
  },
];

const mixSlides: Slide[] = [
  {
    id: "mix-01",
    group: "mix",
    device: "mix",
    ...galleryMixCopy.ru.slides["mix-01"],
    demo: true,
    render: (language = "ru") => {
      const c = galleryMixCopy[language].sample;
      return (
        <MixerStrips
          maxHours={20}
          channels={channels([
            [toolName(language, "plasma_cutter"), 0.85, 17, true],
            [toolName(language, "silicon_extractor"), 0.6, 12],
            [toolName(language, "data_harvester"), 0.42, 8],
            [toolName(language, "quantum_transmitter"), 0.28, 5, true],
            [toolName(language, "neural_seeder"), 0.91, 18],
            [c.testOne, 0.35, 7],
            [c.testTwo, 0.72, 14, true],
            [c.testThree, 0.55, 11],
          ])}
        />
      );
    },
  },
  {
    id: "mix-02",
    group: "mix",
    device: "mix",
    ...galleryMixCopy.ru.slides["mix-02"],
    demo: true,
    render: (language = "ru") => (
      <MixerStrips
        maxHours={20}
        channels={channels([
          [toolName(language, "plasma_cutter"), 0.85, 17, true],
          [toolName(language, "neural_seeder"), 0.91, 18],
          [toolName(language, "data_harvester"), null, null],
        ])}
      />
    ),
  },
  {
    id: "mix-03",
    group: "mix",
    device: "mix",
    ...galleryMixCopy.ru.slides["mix-03"],
    demo: false,
    render: (language = "ru") => (
      <MixerStrips
        maxHours={20}
        channels={channels([
          [toolName(language, "plasma_cutter"), null, null],
          [toolName(language, "silicon_extractor"), null, null],
          [toolName(language, "data_harvester"), null, null],
          [toolName(language, "quantum_transmitter"), null, null],
          [toolName(language, "neural_seeder"), null, null],
        ])}
      />
    ),
  },
  {
    id: "mix-04",
    group: "mix",
    device: "mix",
    ...galleryMixCopy.ru.slides["mix-04"],
    demo: true,
    render: (language = "ru") => (
      <MixerStrips maxHours={20} channels={channels([
        [toolName(language, "silicon_extractor"), 0.5, null],
        [toolName(language, "data_harvester"), 0.72, 14, true],
      ])} />
    ),
  },
  {
    id: "mix-05",
    group: "mix",
    device: "mix",
    ...galleryMixCopy.ru.slides["mix-05"],
    demo: true,
    render: (language = "ru") => {
      const c = galleryMixCopy[language].sample;
      return (
        <div style={{ display: "grid", gap: 8 }}>
          <MixerBus label={c.shiftChannels} value="3" />
          <MixerBus label={c.idle} dash />
        </div>
      );
    },
  },
];

const sonarSlides: Slide[] = [
  {
    id: "sonar-01",
    group: "sonar",
    device: "sonar",
    ...gallerySonarCopy.ru.slides["sonar-01"],
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
    group: "sonar",
    device: "sonar",
    ...gallerySonarCopy.ru.slides["sonar-02"],
    demo: false,
    render: () => <EchoTrace marks={[]} depth={null} />,
  },
  {
    id: "sonar-03",
    group: "sonar",
    device: "sonar",
    ...gallerySonarCopy.ru.slides["sonar-03"],
    demo: true,
    render: () => <EchoTrace depth={0.78} marks={[{ at: 210, depth: 0.8, size: 2 }]} />,
  },
  {
    id: "sonar-04",
    group: "sonar",
    device: "sonar",
    ...gallerySonarCopy.ru.slides["sonar-04"],
    demo: true,
    render: (language = "ru") => {
      const c = gallerySonarCopy[language];
      return (
        <SonarPPI
          ariaLabel={c.slides["sonar-04"].title}
          blips={[
            { x: 60, y: 30, r: 2.6 },
            { x: 92, y: 58, r: 2.2 },
            { x: 74, y: 96, r: 2.8 },
            { x: 38, y: 88, r: 2 },
            { x: 46, y: 44, r: 2.4 },
          ]}
          legend={<>
            <span>{c.sample.lots}: <b>5</b></span>
            <span>{c.sample.layout}</span>
          </>}
        />
      );
    },
  },
  {
    id: "sonar-05",
    group: "sonar",
    device: "sonar",
    ...gallerySonarCopy.ru.slides["sonar-05"],
    demo: false,
    render: (language = "ru") => {
      const c = gallerySonarCopy[language];
      return (
        <SonarPPI
          ariaLabel={c.slides["sonar-05"].title}
          blips={[]}
          legend={<>
            <span>{c.sample.listings}: <b>—</b></span>
            <span>{c.sample.prices}: <b>—</b></span>
          </>}
        />
      );
    },
  },
  {
    id: "sonar-06",
    group: "sonar",
    device: "sonar",
    ...gallerySonarCopy.ru.slides["sonar-06"],
    demo: true,
    render: (language = "ru") => {
      const c = gallerySonarCopy[language];
      return (
        <SonarPPI
          ariaLabel={c.slides["sonar-06"].title}
          blips={Array.from({ length: 24 }, (_, i) => {
            const a = (-90 + (i / 24) * 360) * (Math.PI / 180);
            const r = 9 + 43 * ((i * 37) % 100) / 100;
            return { x: 60 + r * Math.cos(a), y: 60 + r * Math.sin(a), r: 2.2 };
          })}
          legend={<span>{c.sample.lots}: <b>24</b></span>}
        />
      );
    },
  },
];

const plateSlides: Slide[] = [
  {
    id: "plate-01",
    group: "plate",
    device: "plate",
    ...galleryPlateCopy.ru.slides["plate-01"],
    demo: true,
    render: () => (
      <PlateGrid
        rows={6}
        cols={8}
        wells={wells([
          [0, 2, "g"], [0, 6, "q"], [1, 4, "g"],
          [2, 1, "q"], [3, 5, "g"], [4, 3, "q"],
        ])}
      />
    ),
  },
  {
    id: "plate-02",
    group: "plate",
    device: "plate",
    ...galleryPlateCopy.ru.slides["plate-02"],
    demo: false,
    render: () => <PlateGrid rows={6} cols={8} wells={emptyWells(6, 8)} />,
  },
  {
    id: "plate-03",
    group: "plate",
    device: "plate",
    ...galleryPlateCopy.ru.slides["plate-03"],
    demo: true,
    render: () => <PlateGrid rows={6} cols={8} wells={wells([[3, 4, "g"]])} />,
  },
  {
    id: "plate-04",
    group: "plate",
    device: "plate",
    ...galleryPlateCopy.ru.slides["plate-04"],
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
    group: "plate",
    device: "plate",
    ...galleryPlateCopy.ru.slides["plate-05"],
    demo: true,
    render: (language = "ru") => (
      <PlateReader
        boxes={[
          { label: toolsCopy[language].card.durability, value: "17 / 20" },
          { label: galleryPlateCopy[language].sample.shift, value: `12 ${toolsCopy[language].card.hourAbbrev}` },
          { label: galleryPlateCopy[language].sample.batch, value: "—", dash: true },
        ]}
      />
    ),
  },
];

const gelSlides: Slide[] = [
  {
    id: "gel-01",
    group: "gel",
    device: "gel",
    ...galleryGelCopy.ru.slides["gel-01"],
    demo: true,
    render: (language = "ru") => (
      <GelLanes lanes={lanes([
        ["lab", [0.2, 0.72]],
        ["consumables", [0.2, 0.51]],
        ["cores", [0.2, 0.33]],
        ["fluids", [0.2, 0.88]],
      ], language)} />
    ),
  },
  {
    id: "gel-02",
    group: "gel",
    device: "gel",
    ...galleryGelCopy.ru.slides["gel-02"],
    demo: false,
    render: () => <GelLanes lanes={[]} />,
  },
  {
    id: "gel-03",
    group: "gel",
    device: "gel",
    ...galleryGelCopy.ru.slides["gel-03"],
    demo: true,
    render: (language = "ru") => <GelLanes lanes={lanes([["lab", [0.2, 0.64]]], language)} />,
  },
  {
    id: "gel-04",
    group: "gel",
    device: "gel",
    ...galleryGelCopy.ru.slides["gel-04"],
    demo: true,
    render: (language = "ru") => (
      <GelLanes lanes={lanes([
        ["quartz", [0.2, 0.12]],
        ["fluids", [0.2, 0.09]],
        ["consumables", [0.2, 0.06]],
      ], language, true)} />
    ),
  },
  {
    id: "gel-05",
    group: "gel",
    device: "gel",
    ...galleryGelCopy.ru.slides["gel-05"],
    demo: true,
    render: (language = "ru") => (
      <GelLanes lanes={lanes([
        ["lab", [0.2, 0.92]],
        ["consumables", [0.2, 0.74]],
        ["cores", [0.2, 0.61]],
        ["quartz", [0.2, 0.55]],
        ["chips", [0.2, 0.38]],
        ["fluids", [0.2, 0.22]],
      ], language)} />
    ),
  },
];

const crossSlides: Slide[] = [
  {
    id: "cross-01",
    group: "cross",
    device: "cross",
    ...galleryCrossCopy.ru.slides["cross-01"],
    demo: true,
    render: (language = "ru") => (
      <CrossPanel
        top={ports(["1", "2", "3", "4", "5", "6"], ["ok", "err", "idle", "ok", "ok", "idle"])}
        bottom={ports([inboxUiCopy[language].waiting, inboxUiCopy[language].read, inboxUiCopy[language].fresh])}
        links={links([
          [0, 0, 1],
          [1, 1, 2],
          [2, 2, 3],
          [5, 2, 4, true],
        ])}
      />
    ),
  },
  {
    id: "cross-02",
    group: "cross",
    device: "cross",
    ...galleryCrossCopy.ru.slides["cross-02"],
    demo: false,
    render: (language = "ru") => <CrossPanel top={ports(["1", "2", "3"])} bottom={ports([inboxUiCopy[language].waiting, inboxUiCopy[language].read])} links={[]} />,
  },
  {
    id: "cross-03",
    group: "cross",
    device: "cross",
    ...galleryCrossCopy.ru.slides["cross-03"],
    demo: true,
    render: (language = "ru") => <CrossPanel top={ports(["1"])} bottom={ports([inboxUiCopy[language].fresh])} links={links([[0, 0, 2, true]])} />,
  },
  {
    id: "cross-04",
    group: "cross",
    device: "cross",
    ...galleryCrossCopy.ru.slides["cross-04"],
    demo: true,
    render: (language = "ru") => (
      <CrossPanel
        top={ports(["1", "2", "3"], ["ok", "err", "ok"])}
        bottom={ports([inboxUiCopy[language].waiting, inboxUiCopy[language].read])}
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
    group: "cross",
    device: "cross",
    ...galleryCrossCopy.ru.slides["cross-05"],
    demo: true,
    render: (language = "ru") => (
      <CrossPanel
        top={ports(["1", "2"])}
        bottom={ports([inboxUiCopy[language].fresh, inboxUiCopy[language].read])}
        links={links([
          [0, 0, 2, true],
          [1, 1, 4],
        ])}
      />
    ),
  },
];

const cardsSlides: Slide[] = [
  {
    id: "cards-01",
    group: "cards",
    device: "cards",
    ...galleryCardsCopy.ru.slides["cards-01"],
    demo: true,
    render: (language = "ru") => <PunchedCard title={galleryCardsCopy[language].sampleLabel} steps={steps("ddddn")} footLeft="4 / 5" footMid="80 %" />,
  },
  {
    id: "cards-02",
    group: "cards",
    device: "cards",
    ...galleryCardsCopy.ru.slides["cards-02"],
    demo: false,
    render: (language = "ru") => <PunchedCard unknown title={questsHomeCopy[language].cardTitle} steps={steps("oooooooooooo")} rows={4} footMid={questsHomeCopy[language].placeholder} />,
  },
  {
    id: "cards-03",
    group: "cards",
    device: "cards",
    ...galleryCardsCopy.ru.slides["cards-03"],
    demo: true,
    render: (language = "ru") => <PunchedCard title={galleryCardsCopy[language].sampleLabel} steps={steps("ddddd")} footLeft="5 / 5" footMid="100 %" />,
  },
  {
    id: "cards-04",
    group: "cards",
    device: "cards",
    ...galleryCardsCopy.ru.slides["cards-04"],
    demo: true,
    render: (language = "ru") => <PunchedCard title={galleryCardsCopy[language].sampleLabel} steps={steps("dno")} rows={4} footLeft="1 / 3" footMid="33 %" />,
  },
  {
    id: "cards-05",
    group: "cards",
    device: "cards",
    ...galleryCardsCopy.ru.slides["cards-05"],
    demo: true,
    render: (language = "ru") => <PunchedCard unknown title={questsHomeCopy[language].cardTitle} steps={steps("ooooo")} footMid={questsHomeCopy[language].placeholder} />,
  },
];

const baroSlides: Slide[] = [
  {
    id: "baro-01",
    group: "baro",
    device: "baro",
    ...galleryBaroCopy.ru.slides["baro-01"],
    demo: true,
    render: (language = "ru") => <DrumChart points={[0.32, 0.68, 0.32, 0.95, 0.32, 0.02, 0.68]} dayLabels={sampleDays} scaleLabels={sampleLoadScale(language)} />,
  },
  {
    id: "baro-02",
    group: "baro",
    device: "baro",
    ...galleryBaroCopy.ru.slides["baro-02"],
    demo: true,
    render: (language = "ru") => <DrumChart points={[0.32, 0.32, 0.32, 0.32, 0.32, 0.32, 0.32]} dayLabels={sampleDays} scaleLabels={sampleLoadScale(language)} />,
  },
  {
    id: "baro-03",
    group: "baro",
    device: "baro",
    ...galleryBaroCopy.ru.slides["baro-03"],
    demo: false,
    render: (language = "ru") => <DrumChart points={[]} dayLabels={[]} scaleLabels={sampleLoadScale(language)} />,
  },
  {
    id: "baro-04",
    group: "baro",
    device: "baro",
    ...galleryBaroCopy.ru.slides["baro-04"],
    demo: true,
    render: (language = "ru") => <DrumChart points={[0.32, 0.32, 0.02, 0.02, 0.32, 0.68, 0.32]} dayLabels={sampleDays} scaleLabels={sampleLoadScale(language)} />,
  },
];

const behaviorSlides: Slide[] = [
  {
    id: "beh-01",
    group: "behavior",
    device: "frame",
    ...galleryBehaviorCopy.ru.slides["beh-01"],
    demo: true,
    render: (language = "ru") => {
      const c = galleryBehaviorCopy[language].sample;
      return (
        <Panel tier="panel" id={<Sticker alt>{c.rule}</Sticker>} meta={c.honesty} title={c.unknownTitle}>
          <Rows>
            <Row k={c.balance} v="—" note={c.noConnection} />
            <Row k={c.balance} v="0" note={c.zeroResponse} />
            <Row k={toolsCopy[language].card.durability} v="17 / 20" note={c.exampleValue} />
          </Rows>
        </Panel>
      );
    },
  },
  {
    id: "beh-02",
    group: "behavior",
    device: "frame",
    ...galleryBehaviorCopy.ru.slides["beh-02"],
    demo: true,
    render: (language = "ru") => (
      <MixerStrips
        maxHours={20}
        channels={channels([
          [toolName(language, "quantum_transmitter"), 0.7, 14, true],
          [toolName(language, "silicon_extractor"), 0.4, 9],
        ])}
      />
    ),
  },
  {
    id: "beh-03",
    group: "behavior",
    device: "frame",
    ...galleryBehaviorCopy.ru.slides["beh-03"],
    demo: false,
    render: (language = "ru") => {
      const c = galleryBehaviorCopy[language].sample;
      const tool = toolsCopy[language].home;
      return (
        <Panel tier="panel" id={<Sticker alt>{c.quiet}</Sticker>} meta={c.unavailable} title={c.emptyTitle}>
          <Note quiet>{tool.connectHint}</Note>
          <Note quiet>{tool.networkHint}</Note>
          <Note quiet>{tool.emptyHint}</Note>
        </Panel>
      );
    },
  },
  {
    id: "beh-04",
    group: "behavior",
    device: "frame",
    ...galleryBehaviorCopy.ru.slides["beh-04"],
    demo: false,
    render: (language = "ru") => {
      const c = galleryBehaviorCopy[language].sample;
      return (
        <Panel tier="panel" id={<Sticker bars>{c.rack}</Sticker>} meta={c.console} title={c.noIdTitle}>
          <Rows>
            <Row k={c.batch} v="—" note={c.idUnavailable} />
            <Row k={c.stand} v="—" note={c.standUnavailable} />
          </Rows>
        </Panel>
      );
    },
  },
  {
    id: "beh-05",
    group: "behavior",
    device: "frame",
    ...galleryBehaviorCopy.ru.slides["beh-05"],
    demo: true,
    render: (language = "ru") => (
      <div className="vg-row">
        <Dewar level={0.35} label={galleryBehaviorCopy[language].sample.demoLevel} />
        <MixerStrips maxHours={20} channels={channels([[galleryBehaviorCopy[language].sample.needle, 0.66, 13, true]])} />
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
  const { language } = useLocale();
  const copy = galleryCopy[language];
  const slideMeta = (id: string) => {
    if (frameIds.includes(id as FrameId)) return galleryFrameCopy[language].slides[id as FrameId];
    if (cryoIds.includes(id as CryoId)) return galleryCryoCopy[language].slides[id as CryoId];
    if (mixIds.includes(id as MixId)) return galleryMixCopy[language].slides[id as MixId];
    if (sonarIds.includes(id as SonarId)) return gallerySonarCopy[language].slides[id as SonarId];
    if (plateIds.includes(id as PlateId)) return galleryPlateCopy[language].slides[id as PlateId];
    if (gelIds.includes(id as GelId)) return galleryGelCopy[language].slides[id as GelId];
    if (crossIds.includes(id as CrossId)) return galleryCrossCopy[language].slides[id as CrossId];
    if (cardsIds.includes(id as CardsId)) return galleryCardsCopy[language].slides[id as CardsId];
    if (baroIds.includes(id as BaroId)) return galleryBaroCopy[language].slides[id as BaroId];
    if (behaviorIds.includes(id as BehaviorId)) return galleryBehaviorCopy[language].slides[id as BehaviorId];
    throw new Error(`Missing gallery translation for ${id}`);
  };
  const [at, setAt] = useState(() => {
    const raw = Number(new URLSearchParams(window.location.search).get("s"));
    return Number.isFinite(raw) && raw >= 1 && raw <= SLIDES.length ? raw - 1 : 0;
  });
  const slide = SLIDES[Math.min(at, SLIDES.length - 1)];
  const shown = slideMeta(slide.id);
  const slideLanguage = language;

  const groups = useMemo(() => {
    const out: { group: Slide["group"]; items: { slide: Slide; index: number }[] }[] = [];
    SLIDES.forEach((s, index) => {
      const last = out[out.length - 1];
      if (last && last.group === s.group) last.items.push({ slide: s, index });
      else out.push({ group: s.group, items: [{ slide: s, index }] });
    });
    return out;
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || e.isComposing) return;
      // Arrow keys belong to the focused control (especially the language menu),
      // not to this window-wide slide shortcut.
      if (e.target instanceof Element && e.target.closest(
        'a, button, input, select, textarea, summary, details, [contenteditable="true"], [contenteditable=""], [role="slider"], [role="combobox"], [role="listbox"], [role="menu"], [role="tablist"], [tabindex]:not([tabindex="-1"])',
      )) return;
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

  const device = { ...DEVICE_BY_KEY[slide.device], ...copy.devices[slide.device] };

  return (
    <div className="vg">
      <aside className="vg-index">
        <div className="vg-index__head">
          <b>{copy.chrome.title}</b>
          <span>{SLIDES.length} {copy.chrome.slides} · {DEVICE_MAP.length - 1} {copy.chrome.instruments}</span>
          <a className="vg-index__back" href="/">{copy.chrome.back}</a>
          <LanguageSwitcher compact />

        </div>
        <nav aria-label={copy.chrome.navigation}>
          {groups.map((g) => (
            <div key={g.group} className="vg-index__group">
              <div className="vg-index__title">{g.items[0].slide.id.startsWith("beh-") ? copy.chrome.behavior : copy.devices[g.items[0].slide.device].name}</div>
              {g.items.map(({ slide: s, index }) => (
                <button
                  key={s.id}
                  type="button"
                  className={"vg-index__item" + (index === at ? " active" : "")}
                  onClick={() => setAt(index)}
                >
                  <span className="vg-index__num">{String(index + 1).padStart(2, "0")}</span>
                  <span lang={language}>
                    {slideMeta(s.id).title}
                    <small>{slideMeta(s.id).variant}</small>
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
            {copy.chrome.previous}
          </button>
          <span className="vg-count">
            {copy.chrome.count(at + 1, SLIDES.length)}
          </span>
          <button
            type="button"
            className="vg-nav"
            onClick={() => setAt((v) => Math.min(SLIDES.length - 1, v + 1))}
            disabled={at === SLIDES.length - 1}
          >
            {copy.chrome.next}
          </button>
        </div>

        <h1 className="vg-title">
          <span lang={slideLanguage}>{shown.title}</span>
          {slide.demo && <span className="vg-demo">{copy.chrome.demo}</span>}
        </h1>
        <p className="vg-variant" lang={slideLanguage}>{shown.variant}</p>

        <div className="vg-stage" lang={slideLanguage}>{slide.render(language)}</div>

        <dl className="vg-facts">
          <div>
            <dt>{copy.chrome.device}</dt>
            <dd>
              {device.name} — {device.purpose}
            </dd>
          </div>
          <div>
            <dt>{copy.chrome.where}</dt>
            <dd>
              <span lang={slideLanguage}>{shown.where}</span>
              <br />
              <span className="vg-file">
                {device.tab}
                {device.sub !== "—" ? ` → ${device.sub}` : ""} · {device.file}
              </span>
            </dd>
          </div>
          <div>
            <dt>{copy.chrome.visible}</dt>
            <dd lang={slideLanguage}>{shown.note}</dd>
          </div>
        </dl>
      </main>
    </div>
  );
}

/** Список аппаратов — тот же, что в карте приборов: галерея и док говорят одно. */
export const GALLERY_DEVICES = DEVICE_MAP;
