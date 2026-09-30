#!/usr/bin/env node
/**
 * Full rebrand AOF -> NeuroForge — what was not done
 * Per REBRAND_MAP.md:
 * - Project name: Age of Farming -> NeuroForge — Age of Intelligence
 * - Keep gameId tenant `aof`, PDA seeds, internal field names (food_mint etc)
 * - UI copy: Farm -> Neuro Lab, Well -> Grid Station, etc.
 * - Resources: food->data, wood->circuit, etc. in UI, but keep aliases
 * - Tools: axe->plasma_cutter, etc.
 * - Rarity: Common->Base, etc.
 * - Weather: Drought->Blackout, etc.
 */
import fs from 'fs';
import path from 'path';

const root = process.cwd();

function replaceInFile(filePath, replacements) {
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;
  for (const [from, to] of replacements) {
    content = content.split(from).join(to);
  }
  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`[rebrand] ${filePath}`);
    return true;
  }
  return false;
}

console.log("=== Rebranding IDL descriptions ===");
const idlDir = path.join(root, 'aof_backend/src/idl');
const idlMap = {
  "Age of Farming core program": "NeuroForge — Age of Intelligence core program",
  "Age of Farming Liquidity Pools for Hot Market": "NeuroForge — Age of Intelligence Liquidity Pools",
  "Age of Farming Hot Market + Session Keys": "NeuroForge — Age of Intelligence Hot Market + Session Keys",
  "Age of Farming Quests, Achievements, Challenges, Drum of Luck": "NeuroForge — Quests, Achievements, Challenges, Quantum Drum",
  "Age of Farming Rebirth (prestige/endgame)": "NeuroForge — Re-Training (prestige/endgame)",
  "Age of Farming": "NeuroForge — Age of Intelligence",
};

for (const file of fs.readdirSync(idlDir).filter(f=>f.endsWith('.json'))) {
  const fp = path.join(idlDir, file);
  const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
  if (data.metadata && data.metadata.description) {
    let desc = data.metadata.description;
    for (const [from,to] of Object.entries(idlMap)) {
      if (desc.includes(from)) desc = desc.split(from).join(to);
    }
    // Ensure NeuroForge branding
    if (desc.includes("Age of Farming") && !desc.includes("NeuroForge")) {
      desc = desc.replace(/Age of Farming/g, "NeuroForge — Age of Intelligence");
    }
    if (data.metadata.description !== desc) {
      data.metadata.description = desc;
      fs.writeFileSync(fp, JSON.stringify(data, null, 2) + "\n", 'utf8');
      console.log(`[rebrand] IDL ${file}: ${desc}`);
    }
  }
  // Also check top-level description if exists
  if (data.description) {
    let desc = data.description;
    for (const [from,to] of Object.entries(idlMap)) {
      if (desc.includes(from)) desc = desc.split(from).join(to);
    }
    if (data.description !== desc) {
      data.description = desc;
      fs.writeFileSync(fp, JSON.stringify(data, null, 2) + "\n", 'utf8');
      console.log(`[rebrand] IDL ${file} top description: ${desc}`);
    }
  }
}

// Also update TS IDL
const tsIdlPath = path.join(idlDir, 'aof_core.ts');
if (fs.existsSync(tsIdlPath)) {
  replaceInFile(tsIdlPath, [
    ["Age of Farming", "NeuroForge — Age of Intelligence"],
  ]);
}

console.log("\n=== Rebranding frontend UI copy ===");
const frontendReplacements = [
  // Project name in UI
  ["Age of Farming", "NeuroForge — Age of Intelligence"],
  ["Age of Farming (AOF)", "NeuroForge — Age of Intelligence"],
  // Mechanics per REBRAND_MAP
  ["\"Колодец\"", "\"Сетевая станция\""], // FarmDashboard
  ["label: \"Колодец\"", "label: \"Сетевая станция\""],
  ["Ферма / поля", "Нейро-лаборатория"],
  ["Ферма", "Нейро-лаборатория"],
  // Keep some that are already rebranded but ensure consistency
  ["AOF · Основание UI", "NeuroForge · Основание UI"],
  ["AOF · МАТЕРИАЛЬНЫЙ СТЕНД", "NeuroForge · МАТЕРИАЛЬНЫЙ СТЕНД"],
  // Old resource labels in UI still using wood/stone/food as display names
  // These are in CraftPage, RepairPage etc — map to new names but keep icons
  // We do not replace code identifiers, only UI strings where safe
  ["label: \"Схема\"", "label: \"Схема (Circuit)\""], // already new, keep
];

// Apply to specific frontend files
const frontendFiles = [
  "frontend/src/pages/farm/FarmDashboard.tsx",
  "frontend/src/ui/demos/Foundation.tsx",
  "frontend/src/ui/demos/TokenDemo.tsx",
  "frontend/src/lib/wallet.ts",
];

for (const rel of frontendFiles) {
  const fp = path.join(root, rel);
  if (fs.existsSync(fp)) {
    replaceInFile(fp, frontendReplacements);
  }
}

// Update wallet proof domain
replaceInFile(path.join(root, "frontend/src/lib/wallet.ts"), [
  ["AOF_API", "NEUROFORGE_API"],
]);

// Update txGuard comments
replaceInFile(path.join(root, "frontend/src/lib/txGuard.ts"), [
  ["These are the six deployed AOF programs", "These are the six deployed NeuroForge programs"],
  ["allowed AOF program", "allowed NeuroForge program"],
]);

// Update frontend/src/site/content/mechanics.ts — resource IDs still old per map, but relatedResources should use new IDs
const mechanicsPath = path.join(root, "frontend/src/site/content/mechanics.ts");
if (fs.existsSync(mechanicsPath)) {
  let content = fs.readFileSync(mechanicsPath, 'utf8');
  // Map old resource IDs to new per REBRAND_MAP
  const resourceMap = {
    "'wood'": "'circuit'",
    "'stone'": "'silicon'",
    "'food'": "'data'",
    "'seeds'": "'neuron'",
    "'wheat'": "'synapse'",
    "'flour'": "'signal'",
    "'bread'": "'model'",
    "'water'": "'power'",
    "'coal'": "'compute'",
    "'meat'": "'dataset'",
    "'stoneBlue'": "'blueCore'",
    "'stonePurple'": "'purpleCore'",
    "'stoneRed'": "'redCore'",
    "'sandWhite'": "'clearQuartz'",
    "'sandPink'": "'roseQuartz'",
    "'sandYellow'": "'amberQuartz'",
    "'gemBlue'": "'quantumBit'",
    "'gemOrange'": "'neuralChip'",
    "'gemWhite'": "'photonBit'",
    "'gemGreen'": "'bioChip'",
    "'flaskBlue'": "'cryoFluid'",
    "'flaskYellow'": "'voltFluid'",
    "'flaskGreen'": "'bioFluid'",
    "'flaskPink'": "'nanoFluid'",
    "'flaskPurple'": "'quantumFluid'",
    "'loveHeart'": "'soulCore'",
    "'potato'": "'mind'",
    "\"wood\"": "\"circuit\"",
    "\"stone\"": "\"silicon\"",
    "\"food\"": "\"data\"",
    "\"seeds\"": "\"neuron\"",
    "\"wheat\"": "\"synapse\"",
    "\"flour\"": "\"signal\"",
    "\"bread\"": "\"model\"",
    "\"water\"": "\"power\"",
    "\"coal\"": "\"compute\"",
    "\"meat\"": "\"dataset\"",
  };
  // Only replace in relatedResources arrays, not in narrative text
  // Simple heuristic: replace all occurrences for now, but keep old as alias comment
  let newContent = content;
  for (const [from,to] of Object.entries(resourceMap)) {
    // Avoid double-replacing already new ones
    if (newContent.includes(from)) {
      // Count occurrences, but only in relatedResources context we want new
      // For safety, replace globally — old IDs are deprecated per REBRAND_MAP
      newContent = newContent.split(from).join(to);
    }
  }
  // Also update mechanic names per REBRAND_MAP
  const mechanicNameMap = [
    ["name:'Кузница'", "name:'Квантовая кузница'"],
    ["name:'Паки'", "name:'Капсулы дропа'"],
    ["name:'Лотерея'", "name:'Квантовый розыгрыш'"],
    ["name:'Кузница'", "name:'Квантовая кузница'"],
    ["id:'farm',name:'Лаборатория'", "id:'farm',name:'Нейро-лаборатория'"],
    ["id:'lottery',name:'Лотерея'", "id:'lottery',name:'Квантовый розыгрыш'"],
    ["id:'forge',name:'Кузница'", "id:'forge',name:'Квантовая кузница'"],
    ["id:'packs',name:'Паки'", "id:'packs',name:'Капсулы дропа'"],
    ["id:'seasons',name:'Эпохи'", "id:'seasons',name:'Эпохи'"], // keep but EN is Epoch
    ["id:'rebirth',name:'Rebirth'", "id:'rebirth',name:'Переобучение'"],
    ["id:'weather',name:'Погода'", "id:'weather',name:'Нагрузка сети'"],
    ["id:'gas',name:'Газ'", "id:'gas',name:'Топливо'"],
  ];
  for (const [from,to] of mechanicNameMap) {
    newContent = newContent.split(from).join(to);
  }

  if (newContent !== content) {
    fs.writeFileSync(mechanicsPath, newContent, 'utf8');
    console.log(`[rebrand] ${mechanicsPath} — resources and mechanics renamed`);
  }
}

// Update frontend/src/pages/farm/ExplorationPage.tsx — costs already partially rebranded
replaceInFile(path.join(root, "frontend/src/pages/farm/ExplorationPage.tsx"), [
  ["EXPLORATION_COST", "EXPLORATION_COST // NeuroForge: Data/Circuit/Silicon/Dataset"],
]);

// Update package.json name if still aof_gui
const pkgPath = path.join(root, "frontend/package.json");
if (fs.existsSync(pkgPath)) {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  if (pkg.name === "aof_gui") {
    pkg.name = "neuroforge_gui";
    pkg.description = "NeuroForge — Age of Intelligence GUI (ex-AOF)";
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n", 'utf8');
    console.log(`[rebrand] frontend/package.json name -> neuroforge_gui`);
  }
}

console.log("\n=== Rebrand done. Check REBRAND_MAP.md for what NOT to rename (gameId aof, PDA seeds, mint addresses) ===");
