/**
 * three.js scene for the organism. Tool and SoulCore models load from the
 * same-origin manifest in /assets/models3d (in-repo CC0 placeholders, sha256
 * pinned in the manifest); primitives stay as fallback until a model arrives
 * or when loading fails. The scene only reads an OrganismState, reports
 * pointer picks, and never writes chain or API state.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DURABILITY_MAX, type OrganismState } from './model';
import { ORGAN_IDS, TOOL_DOCKS, type OrganId } from './registry';

export type OrganismPick =
  | { kind: 'cell'; index: number }
  | { kind: 'dock'; index: number }
  | { kind: 'soul' };

const RARITY_COLOR: Record<string, number> = {
  common: 0x8aa0b0,
  uncommon: 0x5fd38d,
  rare: 0x4aa3ff,
  epic: 0xb06bff,
  legendary: 0xf2c14e,
};
const ORGAN_COLOR: Record<OrganId, number> = {
  base: 0x7fb6a8,
  model: 0x6aa7ff,
  cores: 0x3d7bd9,
  quartz: 0xd6b8ff,
  bits: 0x66e0d0,
  fluids: 0x7ce06a,
  special: 0xffd166,
};
const UNKNOWN = 0x3a4550;
const EMPTY = 0x1c2630;
const READY = 0xf2c14e;
const GROWING = 0x6fd7a4;

export interface OrganismScene {
  setState(state: OrganismState): void;
  dispose(): void;
}

export function createOrganismScene(container: HTMLElement, onPick?: (pick: OrganismPick) => void): OrganismScene {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.set(0, 1.4, 7.2);
  camera.lookAt(0, 0.2, 0);
  scene.add(new THREE.AmbientLight(0xffffff, 0.45));
  const key = new THREE.PointLight(0xffffff, 1.4, 30);
  key.position.set(2.5, 4, 5);
  scene.add(key);

  const disposables: Array<{ dispose(): void }> = [renderer];

  // Heart: personal energy pulse.
  const heartMat = new THREE.MeshStandardMaterial({ color: 0x2a3a48, emissive: 0x6fd7a4, emissiveIntensity: 0.2 });
  const heart = new THREE.Mesh(new THREE.SphereGeometry(0.42, 32, 24), heartMat);
  scene.add(heart);
  disposables.push(heart.geometry, heartMat);

  // Body: ten lab cells on a ring.
  const cellGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.5, 20);
  const cells: Array<{ mesh: THREE.Mesh; fill: THREE.Mesh; fillMat: THREE.MeshStandardMaterial; base: THREE.MeshStandardMaterial }> = [];
  const fillGeo = new THREE.CylinderGeometry(0.13, 0.13, 1, 16);
  for (let i = 0; i < 10; i += 1) {
    const angle = (i / 10) * Math.PI * 2;
    // The shell is translucent glass: the growth fill lives inside it and must
    // stay visible through it. An opaque shell hides the fill completely.
    const base = new THREE.MeshStandardMaterial({ color: EMPTY, emissive: 0x0f1a24, emissiveIntensity: 0.6, roughness: 0.6, transparent: true, opacity: 0.38, depthWrite: false });
    const mesh = new THREE.Mesh(cellGeo, base);
    mesh.userData.pick = { kind: 'cell', index: i } satisfies OrganismPick;
    mesh.position.set(Math.cos(angle) * 1.6, 0.1, Math.sin(angle) * 1.6);
    const fillMat = new THREE.MeshStandardMaterial({ color: GROWING, emissive: GROWING, emissiveIntensity: 0.8 });
    const fill = new THREE.Mesh(fillGeo, fillMat);
    fill.position.copy(mesh.position);
    scene.add(mesh, fill);
    cells.push({ mesh, fill, fillMat, base });
    disposables.push(base, fillMat);
  }
  disposables.push(cellGeo, fillGeo);

  // Limbs: five tool docks on the lower arc. GLB models replace the boxes
  // when the manifest load succeeds; dock order matches TOOL_DOCKS.
  const dockGeo = new THREE.BoxGeometry(0.34, 0.34, 0.34);
  const docks: Array<{ mesh: THREE.Mesh; mat: THREE.MeshStandardMaterial; model: THREE.Object3D | null; modelMats: THREE.MeshStandardMaterial[] }> = [];
  for (let i = 0; i < 5; i += 1) {
    const angle = Math.PI * (0.22 + (i / 4) * 0.56);
    const mat = new THREE.MeshStandardMaterial({ color: UNKNOWN, emissive: 0xffffff, emissiveIntensity: 0 });
    const mesh = new THREE.Mesh(dockGeo, mat);
    mesh.userData.pick = { kind: 'dock', index: i } satisfies OrganismPick;
    mesh.position.set(Math.cos(angle) * 2.6, -1.6 + Math.sin(angle) * 0.2, Math.sin(angle) * 0.9 - 0.4);
    scene.add(mesh);
    docks.push({ mesh, mat, model: null, modelMats: [] });
    disposables.push(mat);
  }
  disposables.push(dockGeo);

  // Organs: seven clusters on an outer arc, one node per resource.
  const nodeGeo = new THREE.SphereGeometry(0.1, 14, 10);
  disposables.push(nodeGeo);
  const organNodes: Array<{ mesh: THREE.Mesh; mat: THREE.MeshStandardMaterial; organ: OrganId; index: number }> = [];
  const organCenters = new Map<OrganId, THREE.Vector3>();
  ORGAN_IDS.forEach((id, i) => {
    const angle = Math.PI * (-0.15 + (i / (ORGAN_IDS.length - 1)) * 1.3);
    const center = new THREE.Vector3(Math.cos(angle) * 3.3, 1.1 + Math.sin(angle) * 1.5, Math.sin(angle) * -0.3);
    organCenters.set(id, center);
  });
  for (const id of ORGAN_IDS) {
    const center = organCenters.get(id)!;
    const count = id === 'base' ? 3 : id === 'model' ? 7 : id === 'cores' ? 3 : id === 'quartz' ? 3 : id === 'bits' ? 4 : id === 'fluids' ? 5 : 2;
    for (let k = 0; k < count; k += 1) {
      const a = (k / count) * Math.PI * 2;
      const mat = new THREE.MeshStandardMaterial({ color: UNKNOWN, emissive: ORGAN_COLOR[id], emissiveIntensity: 0 });
      const mesh = new THREE.Mesh(nodeGeo, mat);
      mesh.position.set(center.x + Math.cos(a) * 0.45, center.y + Math.sin(a) * 0.45, center.z);
      scene.add(mesh);
      organNodes.push({ mesh, mat, organ: id, index: k });
      disposables.push(mat);
    }
  }

  // Terminal node: SoulCore, lit only when the balance is known and positive.
  const soulMat = new THREE.MeshStandardMaterial({ color: UNKNOWN, emissive: 0xffd166, emissiveIntensity: 0 });
  const soul = new THREE.Mesh(new THREE.OctahedronGeometry(0.26), soulMat);
  soul.userData.pick = { kind: 'soul' } satisfies OrganismPick;
  soul.position.set(0, 2.4, 0);
  scene.add(soul);
  disposables.push(soulMat, soul.geometry);
  let soulModel: THREE.Object3D | null = null;
  const soulModelMats: THREE.MeshStandardMaterial[] = [];

  // GLB models from the same-origin manifest. Any failure (no network, bad
  // manifest, WebGL limits) silently keeps the primitive placeholders.
  let state: OrganismState | null = null;
  let disposed = false;
  const tagPick = (root: THREE.Object3D, pick: OrganismPick) => {
    root.traverse((o) => { o.userData.pick = pick; });
  };
  const fitModel = (root: THREE.Object3D, pos: THREE.Vector3, target: number) => {
    const box3 = new THREE.Box3().setFromObject(root);
    const size = box3.getSize(new THREE.Vector3());
    const center = box3.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    root.scale.setScalar(target / maxDim);
    root.position.copy(pos).sub(center.multiplyScalar(target / maxDim));
    scene.add(root);
  };
  void (async () => {
    try {
      const res = await fetch('/assets/models3d/manifest.json');
      if (!res.ok) return;
      const manifest = (await res.json()) as {
        version?: unknown;
        tools?: Record<string, { model?: unknown }>;
        soulCore?: { model?: unknown };
      };
      if (manifest.version !== 1 || !manifest.tools) return;
      const loader = new GLTFLoader();
      const loadAt = async (rel: string, pos: THREE.Vector3, pick: OrganismPick, target: number) => {
        const gltf = await loader.loadAsync(`/assets/models3d/${rel}`);
        if (disposed) return null;
        fitModel(gltf.scene, pos, target);
        tagPick(gltf.scene, pick);
        return gltf.scene as THREE.Object3D;
      };
      for (let i = 0; i < TOOL_DOCKS.length; i += 1) {
        const entry = manifest.tools[TOOL_DOCKS[i].toolType];
        if (!entry || typeof entry.model !== 'string') continue;
        const model = await loadAt(entry.model, docks[i].mesh.position.clone(), { kind: 'dock', index: i }, 0.72).catch(() => null);
        if (!model || disposed) continue;
        docks[i].model = model;
        model.traverse((o) => {
          if (o instanceof THREE.Mesh) {
            const m = (o.material as THREE.MeshStandardMaterial).clone();
            o.material = m;
            docks[i].modelMats.push(m);
            disposables.push(m, o.geometry);
          }
        });
        docks[i].mesh.visible = false;
        if (state) applyState(state);
      }
      if (typeof manifest.soulCore?.model === 'string') {
        const model = await loadAt(manifest.soulCore.model, soul.position.clone(), { kind: 'soul' }, 0.6).catch(() => null);
        if (model && !disposed) {
          soulModel = model;
          model.traverse((o) => {
            if (o instanceof THREE.Mesh) {
              const m = (o.material as THREE.MeshStandardMaterial).clone();
              o.material = m;
              soulModelMats.push(m);
              disposables.push(m, o.geometry);
            }
          });
          soul.visible = false;
          if (state) applyState(state);
        }
      }
    } catch {
      // Placeholders remain; the text list carries the same data.
    }
  })();

  // Pointer picking: report the pick, the view decides what it means.
  const raycaster = new THREE.Raycaster();
  const onPointerDown = (ev: PointerEvent) => {
    if (!onPick) return;
    const rect = renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((ev.clientX - rect.left) / rect.width) * 2 - 1,
      -((ev.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(ndc, camera);
    const targets: THREE.Object3D[] = [
      ...cells.map((c) => c.mesh as THREE.Object3D),
      ...docks.map((d) => (d.model ?? d.mesh) as THREE.Object3D),
      (soulModel ?? soul) as THREE.Object3D,
    ];
    const hit = raycaster.intersectObjects(targets, true)[0];
    const pick = hit?.object.userData.pick as OrganismPick | undefined;
    if (pick) onPick(pick);
  };
  renderer.domElement.addEventListener('pointerdown', onPointerDown);

  // Links from the heart to each organ.
  const linkMat = new THREE.LineBasicMaterial({ color: 0x6fd7a4, transparent: true, opacity: 0.18 });
  disposables.push(linkMat);
  for (const center of organCenters.values()) {
    const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), center]);
    scene.add(new THREE.Line(geo, linkMat));
    disposables.push(geo);
  }

  let frame = 0;
  const clock = new THREE.Clock();

  function applyState(s: OrganismState) {
    // Heart brightness follows energy share; unknown stays grey.
    if (s.heart.known && s.heart.share !== null) {
      heartMat.color.setHex(0x2a3a48).lerp(new THREE.Color(0x6fd7a4), s.heart.share * 0.6);
    } else {
      heartMat.color.setHex(UNKNOWN);
    }
    s.cells.forEach((cell, i) => {
      const slot = cells[i];
      if (!slot) return;
      if (cell.state === 'unknown') {
        slot.base.color.setHex(UNKNOWN);
        slot.fill.visible = false;
      } else if (cell.state === 'empty') {
        slot.base.color.setHex(EMPTY);
        slot.fill.visible = false;
      } else {
        slot.base.color.setHex(0x3a5468);
        slot.fill.visible = true;
        const h = Math.max(0.1, cell.progress * 0.5);
        slot.fill.scale.set(1, h, 1);
        slot.fill.position.y = 0.1 - 0.25 + h / 2;
        slot.fill.position.x = slot.mesh.position.x;
        slot.fill.position.z = slot.mesh.position.z;
        slot.fillMat.color.setHex(cell.state === 'ready' ? READY : GROWING);
        slot.fillMat.emissive.setHex(cell.state === 'ready' ? READY : GROWING);
        slot.fillMat.emissiveIntensity = cell.state === 'ready' ? 1.2 : 1.5;
      }
    });
    s.docks.forEach((dock, i) => {
      const slot = docks[i];
      if (!slot) return;
      if (dock.owned === null) {
        slot.mat.color.setHex(UNKNOWN);
      } else if (dock.owned === 0) {
        slot.mat.color.setHex(EMPTY);
      } else {
        slot.mat.color.setHex(RARITY_COLOR[dock.bestRarity ?? 'common'] ?? RARITY_COLOR.common);
      }
      slot.mat.userData.working = dock.working;
      // GLB model tint: rarity sets the emissive; unknown stays unlit.
      const tint = dock.owned === null || dock.owned === 0
        ? null
        : (RARITY_COLOR[dock.bestRarity ?? 'common'] ?? RARITY_COLOR.common);
      for (const m of slot.modelMats) {
        if (tint === null) m.emissive.setHex(0x000000);
        else m.emissive.setHex(tint);
        m.userData.working = dock.working;
      }
      if (slot.model) slot.model.visible = dock.owned !== null;
    });
    const byId = new Map(s.organs.flatMap((o) => o.resources.map((r) => [r.id, r] as const)));
    const resourcesByOrgan = new Map<OrganId, string[]>();
    for (const organ of s.organs) {
      resourcesByOrgan.set(organ.id as OrganId, organ.resources.map((r) => r.id));
    }
    for (const node of organNodes) {
      const ids = resourcesByOrgan.get(node.organ) ?? [];
      const resource = byId.get(ids[node.index] ?? '');
      if (!resource || resource.amount === null) {
        node.mat.userData.intensity = 0;
        node.mat.color.setHex(UNKNOWN);
        node.mesh.scale.setScalar(0.6);
      } else {
        node.mat.userData.intensity = resource.intensity;
        node.mat.color.setHex(ORGAN_COLOR[node.organ]);
        node.mesh.scale.setScalar(0.5 + resource.intensity * 1.1);
      }
    }
    if (s.soulCore.known && (s.soulCore.amount ?? 0) > 0) {
      soulMat.color.setHex(0xffd166);
      soulMat.userData.lit = true;
      soulMat.userData.assemblyShare = 1;
    } else {
      soulMat.color.setHex(UNKNOWN);
      soulMat.userData.lit = false;
      // Assembly progress toward one seal set, from the same known balances.
      soulMat.userData.assemblyShare = s.soulCore.assemblyTotal > 0
        ? s.soulCore.assemblyReady / s.soulCore.assemblyTotal
        : 0;
    }
    soul.scale.setScalar(0.75 + 0.5 * Number(soulMat.userData.assemblyShare ?? 0));
  }

  function resize() {
    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
  observer?.observe(container);
  resize();

  function tick() {
    frame = requestAnimationFrame(tick);
    const t = clock.getElapsedTime();
    const share = state?.heart.share ?? 0;
    const pace = 0.8 + share * 2.2;
    if (state?.heart.known) {
      heart.scale.setScalar(1 + Math.sin(t * pace) * 0.05);
    }
    heart.rotation.y = t * 0.15;
    for (const cell of cells) {
      if (cell.fill.visible && cell.fillMat.emissive.getHex() === READY) {
        cell.fillMat.emissiveIntensity = 0.5 + 0.5 * Math.sin(t * 3);
      }
    }
    for (const dock of docks) {
      const working = Number(dock.mat.userData.working ?? 0) > 0;
      dock.mat.emissiveIntensity = working ? 0.35 + 0.25 * Math.sin(t * 4) : 0;
      dock.mesh.rotation.y = working ? t * 1.2 : 0;
      if (dock.model) dock.model.rotation.y = working ? t * 1.2 : 0;
      for (const m of dock.modelMats) {
        m.emissiveIntensity = Number(m.userData.working ?? 0) > 0 ? 0.35 + 0.25 * Math.sin(t * 4) : 0.12;
      }
    }
    for (const node of organNodes) {
      const intensity = Number(node.mat.userData.intensity ?? 0);
      node.mat.emissiveIntensity = 0.1 + intensity * 0.5;
    }
    soulMat.emissiveIntensity = soulMat.userData.lit
      ? 0.6 + 0.4 * Math.sin(t * 1.5)
      : 0.3 * Number(soulMat.userData.assemblyShare ?? 0);
    soul.rotation.y = t * 0.6;
    if (soulModel) {
      soulModel.rotation.y = t * 0.6;
      soulModel.scale.setScalar(0.75 + 0.5 * Number(soulMat.userData.assemblyShare ?? 0));
      for (const m of soulModelMats) m.emissiveIntensity = soulMat.emissiveIntensity;
    }
    renderer.render(scene, camera);
  }
  frame = requestAnimationFrame(tick);

  return {
    setState(next: OrganismState) {
      state = next;
      applyState(next);
    },
    dispose() {
      disposed = true;
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      cancelAnimationFrame(frame);
      observer?.disconnect();
      for (const d of disposables) d.dispose();
      renderer.domElement.remove();
    },
  };
}
