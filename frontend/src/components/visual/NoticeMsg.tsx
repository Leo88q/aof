import { UI_ICONS, resourceIcon } from "../../lib/visualAssets";

/** Scene / NPC prefixes reuse the location and NPC plates. */
const SCENE_EMOJI: Record<string, string> = {
  "🗺️": "locMap", "🗺": "locMap", "🏚️": "locServerRuins", "🏚": "locServerRuins",
  "🏭": "locFactory", "🏰": "locVault", "🏡": "locEdge", "🏖️": "locCoolLake",
  "🏖": "locCoolLake", "🌵": "locArid", "🧙♂️": "npcOracle", "🧙": "npcOracle",
  "💡": "buffIdea", "📜": "catalog",
};

/**
 * Toast/flash messages carry their meaning as a leading emoji from the old
 * UI ("✅ Готово", "❌ Ошибка"). The two notification plates are registered
 * once here; every render site below the emoji prefix is stripped and the
 * right plate is shown instead, so the whole app reuses exactly two images.
 */
const SUCCESS = new Set(["✅", "🎉", "✓"]);
const ERROR = new Set(["❌", "", "️", "", "💀", "✕"]);

/** A few resource-flavoured prefixes reuse the existing resource icons. */
const RESOURCE_EMOJI: Record<string, string> = {
  "🧠": "MIND", "🥔": "MIND", "🥣": "SIGNAL", "🍞": "MODEL", "🌱": "NEURON",
  "🌾": "SYNAPSE", "🪨": "SILICON", "🪵": "CIRCUIT", "💧": "POWER", "⚡": "NEURON",
  "🔋": "POWER", "💻": "COMPUTE", "📊": "DATA", "🔌": "CIRCUIT", "🧱": "SILICON",
  "💎": "QUANTUM_BIT", "🧪": "CRYO_FLUID", "🍖": "DATASET",
};

export function noticeSplit(raw?: string | null): { icon?: string; text: string } {
  const text = raw ?? "";
  const chars = Array.from(text);
  if (!chars.length) return { text };
  let head = chars[0];
  let vi = 1;
  if (chars[1] === "️") { head += "️"; vi = 2; }
  const rest = chars.slice(vi).join("").replace(/^\s+/, "");

  if (SUCCESS.has(head) || SUCCESS.has(chars[0])) return { icon: UI_ICONS.noticeSuccess, text: rest };
  if (ERROR.has(head) || ERROR.has(chars[0])) return { icon: UI_ICONS.noticeError, text: rest };
  const resKey = RESOURCE_EMOJI[head] || RESOURCE_EMOJI[chars[0]];
  if (resKey) return { icon: resourceIcon(resKey), text: rest };
  const sceneKey = SCENE_EMOJI[head] || SCENE_EMOJI[chars[0]];
  if (sceneKey) return { icon: (UI_ICONS as Record<string, string>)[sceneKey], text: rest };
  return { text };
}

/** Inline status line: plate + cleaned text, same everywhere. */
export function NoticeMsg({ text, className = "", iconSize = 16 }: {
  text?: string | null;
  className?: string;
  iconSize?: number;
}) {
  const n = noticeSplit(text);
  return (
    <span className={"inline-flex items-center gap-1.5 " + className}>
      {n.icon ? (
        <img
          src={n.icon}
          alt=""
          draggable={false}
          className="object-contain shrink-0"
          width={iconSize}
          height={iconSize}
        />
      ) : null}
      <span>{n.text}</span>
    </span>
  );
}
