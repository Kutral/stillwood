import { createNoise2D } from "simplex-noise";

export const CHUNK_SIZE = 64;
export const CHUNK_RES = 36;
export const VIEW_RADIUS_HIGH = 2;
export const VIEW_RADIUS_LOW = 1;
export const CAR_RADIUS = 1.15;
export const WORLD_SEED = "stillwood-forest";

function xmur3(str: string) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

export function mulberry32(a: number) {
  return () => {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const seedRoot = xmur3(WORLD_SEED);
const nA = createNoise2D(mulberry32(seedRoot()));
const nB = createNoise2D(mulberry32(seedRoot()));
const nC = createNoise2D(mulberry32(seedRoot()));
const nD = createNoise2D(mulberry32(seedRoot()));

export function hash2(x: number, z: number, salt = 0) {
  const s = xmur3(`${x}|${z}|${salt}|${WORLD_SEED}`)();
  return s;
}

function fbm(
  noise: (x: number, y: number) => number,
  x: number,
  z: number,
  octaves = 4,
) {
  let v = 0;
  let a = 1;
  let f = 1;
  let s = 0;
  for (let i = 0; i < octaves; i++) {
    v += noise(x * f, z * f) * a;
    s += a;
    a *= 0.5;
    f *= 2.05;
  }
  return v / s;
}

export function smoothstep(e0: number, e1: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

export function meadowFactor(x: number, z: number) {
  const n = nB(x * 0.0105, z * 0.0105);
  return smoothstep(0.12, -0.28, n);
}

export function pathFactor(x: number, z: number) {
  const n = nC(x * 0.0032, z * 0.0032);
  const d = Math.abs(n);
  return Math.max(0, 1 - d / 0.068);
}

export function spawnClearing(x: number, z: number) {
  const d = Math.hypot(x, z);
  return 1 - smoothstep(16, 40, d);
}

export function heightAt(x: number, z: number) {
  const hills = fbm(nA, x * 0.0064, z * 0.0064, 5);
  const ridged = 1 - Math.abs(nD(x * 0.014, z * 0.014));
  const detail = fbm(nB, x * 0.028 + 12, z * 0.028 - 7, 3);
  let h = hills * 10.2 + ridged * 1.6 + detail * 1.8;

  const meadow = meadowFactor(x, z);
  h = h * (1 - meadow * 0.58) + 0.35 * meadow;

  const spawn = spawnClearing(x, z);
  h = h * (1 - spawn * 0.88) + 0.12 * spawn;

  const path = pathFactor(x, z);
  h -= path * 0.42;

  return h;
}

export function normalAt(x: number, z: number) {
  const e = 0.6;
  const hL = groundHeight(x - e, z);
  const hR = groundHeight(x + e, z);
  const hD = groundHeight(x, z - e);
  const hU = groundHeight(x, z + e);
  const nx = hL - hR;
  const nz = hD - hU;
  const ny = e * 2;
  const len = Math.hypot(nx, ny, nz) || 1;
  return { x: nx / len, y: ny / len, z: nz / len };
}

export function slopeAt(x: number, z: number) {
  const n = normalAt(x, z);
  return 1 - n.y;
}

export function treeDensity(x: number, z: number) {
  if (spawnClearing(x, z) > 0.15) return 0;
  const meadow = meadowFactor(x, z);
  const path = pathFactor(x, z);
  const patch = 0.5 + 0.5 * nB(x * 0.018, z * 0.018);
  return Math.max(0, (1 - meadow) * (1 - path * 0.92) * (0.28 + 0.72 * patch));
}

export type TreeKind = "pine" | "spruce" | "oak" | "birch" | "dead";

export type TreeSpec = {
  x: number;
  y: number;
  z: number;
  rot: number;
  scale: number;
  kind: TreeKind;
  radius: number;
  canopyTint: number;
  trunkTint: number;
};

export type ScatterSpec = {
  x: number;
  y: number;
  z: number;
  rot: number;
  sx: number;
  sy: number;
  sz: number;
  kind: "rock" | "log" | "stump" | "fern" | "flower";
  tint: number;
};

export type PondSpec = {
  x: number;
  y: number;
  z: number;
  radius: number;
};

export type CanopyInstance = {
  x: number;
  y: number;
  z: number;
  rot: number;
  sx: number;
  sy: number;
  sz: number;
  color: number;
  shape: "cone" | "round";
};

export type TrunkInstance = {
  x: number;
  y: number;
  z: number;
  rot: number;
  sx: number;
  sy: number;
  sz: number;
  color: number;
};

const treeCache = new Map<string, TreeSpec[]>();
const scatterCache = new Map<string, ScatterSpec[]>();
const pondCache = new Map<string, PondSpec | null>();

function chunkKey(cx: number, cz: number) {
  return `${cx}:${cz}`;
}

function pruneCache<T>(cache: Map<string, T>, cx: number, cz: number) {
  if (cache.size < 220) return;
  for (const key of cache.keys()) {
    const [sx, sz] = key.split(":").map(Number);
    if (Math.abs(sx - cx) > 8 || Math.abs(sz - cz) > 8) cache.delete(key);
  }
}

export function chunkCoord(v: number) {
  return Math.floor(v / CHUNK_SIZE);
}

export function treesInChunk(cx: number, cz: number): TreeSpec[] {
  const key = chunkKey(cx, cz);
  const hit = treeCache.get(key);
  if (hit) return hit;

  const rng = mulberry32(hash2(cx, cz, 11));
  const trees: TreeSpec[] = [];
  const originX = cx * CHUNK_SIZE;
  const originZ = cz * CHUNK_SIZE;
  const attempts = 34;

  for (let i = 0; i < attempts; i++) {
    const x = originX + rng() * CHUNK_SIZE;
    const z = originZ + rng() * CHUNK_SIZE;
    const dens = treeDensity(x, z);
    if (rng() > dens) continue;
    if (slopeAt(x, z) > 0.55) continue;

    let inPond = false;
    for (const p of pondsNear(x, z)) {
      if (Math.hypot(x - p.x, z - p.z) < p.radius + 2.2) {
        inPond = true;
        break;
      }
    }
    if (inPond) continue;

    let tooClose = false;
    for (const t of trees) {
      if ((t.x - x) * (t.x - x) + (t.z - z) * (t.z - z) < 18) {
        tooClose = true;
        break;
      }
    }
    if (tooClose) continue;

    const y = groundHeight(x, z);
    const roll = rng();
    let kind: TreeKind;
    if (roll < 0.34) kind = "pine";
    else if (roll < 0.55) kind = "spruce";
    else if (roll < 0.78) kind = "oak";
    else if (roll < 0.93) kind = "birch";
    else kind = "dead";

    const scale =
      kind === "oak"
        ? 0.95 + rng() * 0.55
        : kind === "pine"
          ? 0.85 + rng() * 0.7
          : 0.75 + rng() * 0.5;

    const canopyTint =
      kind === "oak"
        ? lerpColor(0x4f6a32, 0xb08a3a, rng() * 0.85)
        : kind === "birch"
          ? lerpColor(0x6f8a48, 0xc4b05a, rng() * 0.5)
          : kind === "spruce"
            ? lerpColor(0x1f3a28, 0x3d5c44, rng())
            : kind === "dead"
              ? lerpColor(0x5a5044, 0x6e6354, rng())
              : lerpColor(0x1a3a24, 0x2f5a38, rng());

    const trunkTint =
      kind === "birch"
        ? lerpColor(0xd8d2c4, 0xf0ece3, rng())
        : kind === "dead"
          ? lerpColor(0x4a433c, 0x5c5348, rng())
          : lerpColor(0x3a2c22, 0x5a4434, rng());

    const radius =
      (kind === "oak" ? 1.05 : kind === "birch" ? 0.42 : 0.62) * scale;

    trees.push({
      x,
      y,
      z,
      rot: rng() * Math.PI * 2,
      scale,
      kind,
      radius,
      canopyTint,
      trunkTint,
    });
  }

  treeCache.set(key, trees);
  pruneCache(treeCache, cx, cz);
  return trees;
}

export function scatterInChunk(cx: number, cz: number): ScatterSpec[] {
  const key = chunkKey(cx, cz);
  const hit = scatterCache.get(key);
  if (hit) return hit;

  const rng = mulberry32(hash2(cx, cz, 29));
  const items: ScatterSpec[] = [];
  const originX = cx * CHUNK_SIZE;
  const originZ = cz * CHUNK_SIZE;

  const count = 22;
  for (let i = 0; i < count; i++) {
    const x = originX + rng() * CHUNK_SIZE;
    const z = originZ + rng() * CHUNK_SIZE;
    if (spawnClearing(x, z) > 0.7 && rng() > 0.35) continue;
    let inPond = false;
    for (const p of pondsNear(x, z)) {
      if (Math.hypot(x - p.x, z - p.z) < p.radius + 1.6) {
        inPond = true;
        break;
      }
    }
    if (inPond) continue;
    const y = groundHeight(x, z);
    const roll = rng();
    const meadow = meadowFactor(x, z);
    const path = pathFactor(x, z);

    if (path > 0.45 && roll < 0.4) continue;

    if (roll < 0.38) {
      const s = 0.35 + rng() * 1.1;
      items.push({
        x,
        y,
        z,
        rot: rng() * Math.PI * 2,
        sx: s * (0.8 + rng() * 0.5),
        sy: s * (0.45 + rng() * 0.5),
        sz: s * (0.8 + rng() * 0.5),
        kind: "rock",
        tint: lerpColor(0x5a564e, 0x7a7368, rng()),
      });
    } else if (roll < 0.5 && meadow < 0.7) {
      items.push({
        x,
        y: y + 0.22,
        z,
        rot: rng() * Math.PI,
        sx: 0.7 + rng() * 1.4,
        sy: 0.18 + rng() * 0.12,
        sz: 0.18 + rng() * 0.1,
        kind: "log",
        tint: lerpColor(0x3b2c22, 0x5a4332, rng()),
      });
    } else if (roll < 0.58) {
      items.push({
        x,
        y,
        z,
        rot: rng() * Math.PI * 2,
        sx: 0.35 + rng() * 0.25,
        sy: 0.35 + rng() * 0.3,
        sz: 0.35 + rng() * 0.25,
        kind: "stump",
        tint: lerpColor(0x3a2e24, 0x5c4636, rng()),
      });
    } else if (roll < 0.82) {
      items.push({
        x,
        y,
        z,
        rot: rng() * Math.PI * 2,
        sx: 0.45 + rng() * 0.4,
        sy: 0.5 + rng() * 0.55,
        sz: 0.45 + rng() * 0.4,
        kind: "fern",
        tint: lerpColor(0x2f5a38, 0x6a8a44, rng()),
      });
    } else if (meadow > 0.25 || spawnClearing(x, z) > 0.2) {
      items.push({
        x,
        y,
        z,
        rot: rng() * Math.PI * 2,
        sx: 0.12 + rng() * 0.1,
        sy: 0.12 + rng() * 0.12,
        sz: 0.12 + rng() * 0.1,
        kind: "flower",
        tint: rng() < 0.5 ? 0xf0e6c8 : rng() < 0.5 ? 0xe8c07a : 0xf4f1ea,
      });
    }
  }

  // A few hero rocks in the spawn meadow
  if (cx === 0 && cz === 0) {
    items.push({
      x: 6.5,
      y: heightAt(6.5, -4.2),
      z: -4.2,
      rot: 0.4,
      sx: 1.6,
      sy: 0.9,
      sz: 1.2,
      kind: "rock",
      tint: 0x6a6560,
    });
    items.push({
      x: -8.2,
      y: heightAt(-8.2, 5.4) + 0.2,
      z: 5.4,
      rot: 1.1,
      sx: 2.2,
      sy: 0.22,
      sz: 0.22,
      kind: "log",
      tint: 0x4a382c,
    });
  }

  scatterCache.set(key, items);
  pruneCache(scatterCache, cx, cz);
  return items;
}

export function pondInChunk(cx: number, cz: number): PondSpec | null {
  const key = chunkKey(cx, cz);
  if (pondCache.has(key)) return pondCache.get(key) ?? null;

  if (cx === 0 && cz === 0) {
    const pond = { x: -11, y: 0.08, z: -9.5, radius: 4.4 };
    pond.y = heightAt(pond.x, pond.z) - 0.15;
    pondCache.set(key, pond);
    return pond;
  }

  const rng = mulberry32(hash2(cx, cz, 71));
  if (rng() > 0.16) {
    pondCache.set(key, null);
    return null;
  }
  const x = (cx + 0.2 + rng() * 0.6) * CHUNK_SIZE;
  const z = (cz + 0.2 + rng() * 0.6) * CHUNK_SIZE;
  if (spawnClearing(x, z) > 0.4) {
    pondCache.set(key, null);
    return null;
  }
  if (meadowFactor(x, z) < 0.35) {
    pondCache.set(key, null);
    return null;
  }
  const y = heightAt(x, z);
  if (y > 2.8) {
    pondCache.set(key, null);
    return null;
  }
  const pond = { x, y: y - 0.12, z, radius: 3.2 + rng() * 2.4 };
  pondCache.set(key, pond);
  pruneCache(pondCache, cx, cz);
  return pond;
}

/** All ponds whose carving can influence terrain within one chunk of (x, z). */
export function pondsNear(x: number, z: number): PondSpec[] {
  const cx = chunkCoord(x);
  const cz = chunkCoord(z);
  const out: PondSpec[] = [];
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      const p = pondInChunk(cx + dx, cz + dz);
      if (p) out.push(p);
    }
  }
  return out;
}

/**
 * Walkable/rendered ground height: terrain height with pond basins carved in.
 * Mirrors the displacement applied to chunk geometry exactly, so props,
 * vegetation and the vehicle all sit on the surface that is drawn.
 */
export function groundHeight(x: number, z: number) {
  let y = heightAt(x, z);
  for (const p of pondsNear(x, z)) {
    const d = Math.hypot(x - p.x, z - p.z);
    if (d < p.radius) {
      y = Math.min(y, p.y - 0.08);
    } else if (d < p.radius + 1.4) {
      const k = 1 - (d - p.radius) / 1.4;
      y += (p.y - y) * k;
    }
  }
  return y;
}

export function expandTreeToInstances(tree: TreeSpec): {
  trunk: TrunkInstance;
  canopies: CanopyInstance[];
} {
  const { x, y, z, rot, scale, kind, canopyTint, trunkTint } = tree;
  const trunkH =
    kind === "pine" || kind === "spruce" ? 4.2 * scale : 3.1 * scale;
  const trunkR =
    kind === "oak" ? 0.32 * scale : kind === "birch" ? 0.16 * scale : 0.22 * scale;

  const trunk: TrunkInstance = {
    x,
    y: y + trunkH * 0.5,
    z,
    rot,
    sx: trunkR / 0.22,
    sy: trunkH / 4.2,
    sz: trunkR / 0.22,
    color: trunkTint,
  };

  const canopies: CanopyInstance[] = [];
  if (kind === "pine") {
    canopies.push(
      {
        x,
        y: y + 3.4 * scale,
        z,
        rot,
        sx: 1.15 * scale,
        sy: 1.35 * scale,
        sz: 1.15 * scale,
        color: canopyTint,
        shape: "cone",
      },
      {
        x,
        y: y + 5.1 * scale,
        z,
        rot,
        sx: 0.85 * scale,
        sy: 1.15 * scale,
        sz: 0.85 * scale,
        color: canopyTint,
        shape: "cone",
      },
      {
        x,
        y: y + 6.6 * scale,
        z,
        rot,
        sx: 0.52 * scale,
        sy: 0.95 * scale,
        sz: 0.52 * scale,
        color: canopyTint,
        shape: "cone",
      },
    );
  } else if (kind === "spruce") {
    canopies.push(
      {
        x,
        y: y + 2.8 * scale,
        z,
        rot,
        sx: 1.05 * scale,
        sy: 1.1 * scale,
        sz: 1.05 * scale,
        color: canopyTint,
        shape: "cone",
      },
      {
        x,
        y: y + 4.2 * scale,
        z,
        rot,
        sx: 0.78 * scale,
        sy: 1.05 * scale,
        sz: 0.78 * scale,
        color: canopyTint,
        shape: "cone",
      },
      {
        x,
        y: y + 5.5 * scale,
        z,
        rot,
        sx: 0.5 * scale,
        sy: 0.9 * scale,
        sz: 0.5 * scale,
        color: canopyTint,
        shape: "cone",
      },
      {
        x,
        y: y + 6.6 * scale,
        z,
        rot,
        sx: 0.28 * scale,
        sy: 0.7 * scale,
        sz: 0.28 * scale,
        color: canopyTint,
        shape: "cone",
      },
    );
  } else if (kind === "oak") {
    canopies.push(
      {
        x,
        y: y + 3.6 * scale,
        z,
        rot,
        sx: 1.7 * scale,
        sy: 1.25 * scale,
        sz: 1.7 * scale,
        color: canopyTint,
        shape: "round",
      },
      {
        x: x + 0.7 * scale,
        y: y + 3.2 * scale,
        z: z - 0.4 * scale,
        rot,
        sx: 1.1 * scale,
        sy: 0.9 * scale,
        sz: 1.1 * scale,
        color: canopyTint,
        shape: "round",
      },
      {
        x: x - 0.55 * scale,
        y: y + 3.9 * scale,
        z: z + 0.5 * scale,
        rot,
        sx: 1.05 * scale,
        sy: 0.85 * scale,
        sz: 1.05 * scale,
        color: canopyTint,
        shape: "round",
      },
    );
  } else if (kind === "birch") {
    canopies.push(
      {
        x,
        y: y + 3.55 * scale,
        z,
        rot,
        sx: 1.05 * scale,
        sy: 0.85 * scale,
        sz: 1.05 * scale,
        color: canopyTint,
        shape: "round",
      },
      {
        x: x + 0.35 * scale,
        y: y + 3.15 * scale,
        z: z - 0.25 * scale,
        rot,
        sx: 0.7 * scale,
        sy: 0.6 * scale,
        sz: 0.7 * scale,
        color: canopyTint,
        shape: "round",
      },
    );
  } else {
    // Dead tree: snag blobs hug the trunk top so nothing floats.
    canopies.push(
      {
        x,
        y: y + 3.15 * scale,
        z,
        rot,
        sx: 0.5 * scale,
        sy: 0.4 * scale,
        sz: 0.5 * scale,
        color: canopyTint,
        shape: "round",
      },
      {
        x: x + 0.22 * scale,
        y: y + 2.68 * scale,
        z: z - 0.18 * scale,
        rot,
        sx: 0.28 * scale,
        sy: 0.24 * scale,
        sz: 0.28 * scale,
        color: canopyTint,
        shape: "round",
      },
    );
  }

  return { trunk, canopies };
}

export function nearbyTrees(x: number, z: number, radiusChunks = 1): TreeSpec[] {
  const cx = chunkCoord(x);
  const cz = chunkCoord(z);
  const out: TreeSpec[] = [];
  for (let dz = -radiusChunks; dz <= radiusChunks; dz++) {
    for (let dx = -radiusChunks; dx <= radiusChunks; dx++) {
      out.push(...treesInChunk(cx + dx, cz + dz));
    }
  }
  return out;
}

export function collideTrees(
  x: number,
  z: number,
  vx: number,
  vz: number,
  carRadius = CAR_RADIUS,
) {
  const trees = nearbyTrees(x, z, 1);
  let px = x;
  let pz = z;
  let pvx = vx;
  let pvz = vz;
  let hit = 0;
  for (const t of trees) {
    const dx = px - t.x;
    const dz = pz - t.z;
    const minD = carRadius + t.radius;
    const d2 = dx * dx + dz * dz;
    if (d2 >= minD * minD || d2 < 1e-8) continue;
    const d = Math.sqrt(d2);
    const nx = dx / d;
    const nz = dz / d;
    px = t.x + nx * minD;
    pz = t.z + nz * minD;
    const vn = pvx * nx + pvz * nz;
    if (vn < 0) {
      pvx -= vn * nx * 1.35;
      pvz -= vn * nz * 1.35;
      hit = Math.max(hit, Math.min(1, -vn * 0.18));
    }
  }
  return { x: px, z: pz, vx: pvx, vz: pvz, hit };
}

export function visibleChunkList(cx: number, cz: number, radius: number) {
  const list: { cx: number; cz: number }[] = [];
  for (let z = cz - radius; z <= cz + radius; z++) {
    for (let x = cx - radius; x <= cx + radius; x++) {
      list.push({ cx: x, cz: z });
    }
  }
  return list;
}

export function lerpColor(a: number, b: number, t: number) {
  const ar = (a >> 16) & 255;
  const ag = (a >> 8) & 255;
  const ab = a & 255;
  const br = (b >> 16) & 255;
  const bg = (b >> 8) & 255;
  const bb = b & 255;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}

export function terrainColor(x: number, z: number, y: number, slope: number) {
  const meadow = meadowFactor(x, z);
  const path = pathFactor(x, z);
  const moist = 0.5 + 0.5 * nC(x * 0.02 + 4, z * 0.02);

  let r = 0.28;
  let g = 0.38;
  let b = 0.22;

  if (slope > 0.38) {
    r = 0.38;
    g = 0.36;
    b = 0.32;
  } else if (path > 0.2) {
    const dirtR = 0.42;
    const dirtG = 0.32;
    const dirtB = 0.2;
    const k = Math.min(1, path * 1.2);
    r = r + (dirtR - r) * k;
    g = g + (dirtG - g) * k;
    b = b + (dirtB - b) * k;
  } else if (meadow > 0.25) {
    r = 0.4 + meadow * 0.08;
    g = 0.44 + meadow * 0.06;
    b = 0.24;
  } else {
    r = 0.18 + moist * 0.08;
    g = 0.32 + moist * 0.12;
    b = 0.18;
  }

  const shade = 0.88 + Math.min(0.18, y * 0.012);
  r *= shade;
  g *= shade;
  b *= shade;
  return { r, g, b };
}
