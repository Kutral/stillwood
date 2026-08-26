import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  CHUNK_RES,
  CHUNK_SIZE,
  VIEW_RADIUS_HIGH,
  VIEW_RADIUS_LOW,
  chunkCoord,
  expandTreeToInstances,
  groundHeight,
  meadowFactor,
  pathFactor,
  pondInChunk,
  scatterInChunk,
  terrainColor,
  treesInChunk,
  visibleChunkList,
  type CanopyInstance,
  type ScatterSpec,
  type TrunkInstance,
} from "../world";
import { vehicle } from "../vehicle";
import { useGame } from "../store";
import { makeBarkTexture, makeGrassTexture, makeLeafTexture } from "../textures";

export const simUniforms = { time: { value: 0 } };

const MAX_TRUNKS = 900;
const MAX_CONES = 2000;
const MAX_ROUNDS = 1600;
const MAX_ROCKS = 520;
const MAX_LOGS = 220;
const MAX_FERNS = 420;
const MAX_FLOWERS = 380;
const MAX_GRASS = 2400;
const MAX_STUMPS = 180;

const dummy = new THREE.Object3D();
const tint = new THREE.Color();

function attachWind(material: THREE.MeshStandardMaterial, amount: number) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = simUniforms.time;
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
uniform float uTime;`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
float wind = sin(uTime * 0.65 + transformed.x * 0.14 + transformed.z * 0.11);
transformed.x += wind * ${amount.toFixed(3)} * max(transformed.y, 0.0);
transformed.z += wind * ${(amount * 0.55).toFixed(3)} * max(transformed.y, 0.0);`,
      );
  };
  material.customProgramCacheKey = () => `stillwood-wind-${amount}`;
}

function buildChunkGeometry(cx: number, cz: number) {
  const geo = new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE, CHUNK_RES, CHUNK_RES);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const ox = (cx + 0.5) * CHUNK_SIZE;
  const oz = (cz + 0.5) * CHUNK_SIZE;
  const stride = CHUNK_RES + 1;
  const step = CHUNK_SIZE / CHUNK_RES;
  const heights = new Float32Array(pos.count);

  // Pass 1: heights only (the expensive part).
  for (let i = 0; i < pos.count; i++) {
    const y = groundHeight(ox + pos.getX(i), oz + pos.getZ(i));
    heights[i] = y;
    pos.setY(i, y);
  }

  // Pass 2: slope from neighbouring grid heights (no extra terrain sampling),
  // then color. ~17x fewer height evaluations than sampling normals per vertex.
  for (let i = 0; i < pos.count; i++) {
    const ix = i % stride;
    const iz = (i / stride) | 0;
    const yL = heights[ix > 0 ? i - 1 : i]!;
    const yR = heights[ix < stride - 1 ? i + 1 : i]!;
    const yD = heights[iz > 0 ? i - stride : i]!;
    const yU = heights[iz < stride - 1 ? i + stride : i]!;
    const sx = (yR - yL) / (2 * step);
    const sz = (yU - yD) / (2 * step);
    const slope = 1 - 1 / Math.sqrt(1 + sx * sx + sz * sz);
    const c = terrainColor(ox + pos.getX(i), oz + pos.getZ(i), heights[i]!, slope);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

function TerrainChunk({
  cx,
  cz,
  material,
}: {
  cx: number;
  cz: number;
  material: THREE.MeshStandardMaterial;
}) {
  const geo = useMemo(() => buildChunkGeometry(cx, cz), [cx, cz]);
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <mesh
      geometry={geo}
      material={material}
      position={[(cx + 0.5) * CHUNK_SIZE, 0, (cz + 0.5) * CHUNK_SIZE]}
      receiveShadow
    />
  );
}

function writeInstance(
  mesh: THREE.InstancedMesh,
  i: number,
  x: number,
  y: number,
  z: number,
  rot: number,
  sx: number,
  sy: number,
  sz: number,
  color: number,
) {
  dummy.position.set(x, y, z);
  dummy.rotation.set(0, rot, 0);
  dummy.scale.set(sx, sy, sz);
  dummy.updateMatrix();
  mesh.setMatrixAt(i, dummy.matrix);
  tint.setHex(color);
  mesh.setColorAt(i, tint);
}

function fillMesh(
  mesh: THREE.InstancedMesh | null,
  count: number,
  write: (i: number) => void,
) {
  if (!mesh) return;
  mesh.count = Math.min(count, mesh.instanceMatrix.count);
  for (let i = 0; i < mesh.count; i++) write(i);
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();
  mesh.frustumCulled = false;
}

function grassCells(px: number, pz: number, radius: number, budget: number) {
  const cell = 2.35;
  const out: { x: number; y: number; z: number; rot: number; s: number }[] = [];
  const x0 = Math.floor((px - radius) / cell);
  const x1 = Math.floor((px + radius) / cell);
  const z0 = Math.floor((pz - radius) / cell);
  const z1 = Math.floor((pz + radius) / cell);
  for (let iz = z0; iz <= z1 && out.length < budget; iz++) {
    for (let ix = x0; ix <= x1 && out.length < budget; ix++) {
      let h = (ix * 374761393 + iz * 668265263) | 0;
      h = Math.imul(h ^ (h >>> 13), 1274126177);
      const r = ((h >>> 0) % 1000) / 1000;
      if (r > 0.62) continue;
      const x = ix * cell + r * 1.4;
      const z = iz * cell + (((h >>> 8) % 1000) / 1000) * 1.4;
      if (pathFactor(x, z) > 0.55) continue;
      if (Math.hypot(x - px, z - pz) > radius) continue;
      out.push({ x, y: groundHeight(x, z), z, rot: r * Math.PI * 2, s: 0.7 + (r % 0.5) });
    }
  }
  return out;
}

export function ForestWorld() {
  const quality = useGame((s) => s.quality);
  const radius = quality === "high" ? VIEW_RADIUS_HIGH : VIEW_RADIUS_LOW;
  const [chunks, setChunks] = useState(() => visibleChunkList(0, 0, radius));
  const lastChunk = useRef({ cx: 0, cz: 0 });
  const lastGrass = useRef({ x: 9999, z: 9999 });

  const trunksRef = useRef<THREE.InstancedMesh>(null);
  const conesRef = useRef<THREE.InstancedMesh>(null);
  const roundsRef = useRef<THREE.InstancedMesh>(null);
  const rocksRef = useRef<THREE.InstancedMesh>(null);
  const logsRef = useRef<THREE.InstancedMesh>(null);
  const fernsRef = useRef<THREE.InstancedMesh>(null);
  const flowersRef = useRef<THREE.InstancedMesh>(null);
  const grassRef = useRef<THREE.InstancedMesh>(null);
  const stumpsRef = useRef<THREE.InstancedMesh>(null);

  const materials = useMemo(() => {
    const barkMap = makeBarkTexture();
    const grassMap = makeGrassTexture();
    const leafMap = makeLeafTexture();
    const terrain = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.94,
      metalness: 0.02,
    });
    const trunk = new THREE.MeshStandardMaterial({ map: barkMap, roughness: 0.92, metalness: 0.02 });
    const cone = new THREE.MeshStandardMaterial({ color: "#3d5c38", roughness: 0.82 });
    attachWind(cone, 0.045);
    const round = new THREE.MeshStandardMaterial({
      color: "#5a7040",
      map: leafMap,
      roughness: 0.78,
    });
    attachWind(round, 0.06);
    const rock = new THREE.MeshStandardMaterial({ color: "#6a6560", roughness: 0.9, metalness: 0.08 });
    const log = new THREE.MeshStandardMaterial({ map: barkMap, roughness: 0.9 });
    const fern = new THREE.MeshStandardMaterial({
      color: "#3d6a38",
      map: grassMap,
      transparent: true,
      alphaTest: 0.2,
      side: THREE.DoubleSide,
      roughness: 0.8,
      depthWrite: false,
    });
    attachWind(fern, 0.09);
    const flower = new THREE.MeshStandardMaterial({ roughness: 0.55 });
    const grass = new THREE.MeshStandardMaterial({
      map: grassMap,
      transparent: true,
      alphaTest: 0.25,
      side: THREE.DoubleSide,
      roughness: 0.85,
      depthWrite: false,
    });
    attachWind(grass, 0.12);
    const stump = new THREE.MeshStandardMaterial({ map: barkMap, roughness: 0.9 });
    const water = new THREE.MeshStandardMaterial({
      color: "#3d5c58",
      roughness: 0.12,
      metalness: 0.28,
      transparent: true,
      opacity: 0.78,
    });
    return { terrain, trunk, cone, round, rock, log, fern, flower, grass, stump, water, barkMap, grassMap, leafMap };
  }, []);

  useEffect(
    () => () => {
      materials.terrain.dispose();
      materials.trunk.dispose();
      materials.cone.dispose();
      materials.round.dispose();
      materials.rock.dispose();
      materials.log.dispose();
      materials.fern.dispose();
      materials.flower.dispose();
      materials.grass.dispose();
      materials.stump.dispose();
      materials.water.dispose();
      materials.barkMap.dispose();
      materials.grassMap.dispose();
      materials.leafMap.dispose();
    },
    [materials],
  );

  const geos = useMemo(() => {
    const trunk = new THREE.CylinderGeometry(0.22, 0.28, 4.2, 6);
    const cone = new THREE.ConeGeometry(1.7, 2.6, 7);
    const round = new THREE.IcosahedronGeometry(1.15, 1);
    const rock = new THREE.DodecahedronGeometry(0.7, 0);
    const log = new THREE.CylinderGeometry(0.22, 0.2, 1, 7);
    log.rotateZ(Math.PI / 2);
    const fern = new THREE.PlaneGeometry(1.1, 1.3);
    fern.translate(0, 0.65, 0);
    const flower = new THREE.SphereGeometry(0.16, 6, 5);
    const grass = new THREE.PlaneGeometry(0.42, 1.05);
    grass.translate(0, 0.52, 0);
    const stump = new THREE.CylinderGeometry(0.28, 0.32, 0.45, 7);
    stump.translate(0, 0.22, 0);
    const pond = new THREE.CircleGeometry(1, 24);
    pond.rotateX(-Math.PI / 2);
    return { trunk, cone, round, rock, log, fern, flower, grass, stump, pond };
  }, []);

  useEffect(
    () => () => {
      Object.values(geos).forEach((g) => g.dispose());
    },
    [geos],
  );

  const fillVegetation = (cx: number, cz: number) => {
    const view = visibleChunkList(cx, cz, radius);
    const trunks: TrunkInstance[] = [];
    const cones: CanopyInstance[] = [];
    const rounds: CanopyInstance[] = [];
    const rocks: ScatterSpec[] = [];
    const logs: ScatterSpec[] = [];
    const ferns: ScatterSpec[] = [];
    const flowers: ScatterSpec[] = [];
    const stumps: ScatterSpec[] = [];

    for (const c of view) {
      for (const tree of treesInChunk(c.cx, c.cz)) {
        const exp = expandTreeToInstances(tree);
        trunks.push(exp.trunk);
        for (const cap of exp.canopies) {
          if (cap.shape === "cone") cones.push(cap);
          else rounds.push(cap);
        }
      }
      for (const s of scatterInChunk(c.cx, c.cz)) {
        if (s.kind === "rock") rocks.push(s);
        else if (s.kind === "log") logs.push(s);
        else if (s.kind === "fern") ferns.push(s);
        else if (s.kind === "flower") flowers.push(s);
        else if (s.kind === "stump") stumps.push(s);
      }
    }

    fillMesh(trunksRef.current, trunks.length, (i) => {
      const t = trunks[i]!;
      writeInstance(trunksRef.current!, i, t.x, t.y, t.z, t.rot, t.sx, t.sy, t.sz, t.color);
    });
    fillMesh(conesRef.current, cones.length, (i) => {
      const t = cones[i]!;
      writeInstance(conesRef.current!, i, t.x, t.y, t.z, t.rot, t.sx, t.sy, t.sz, t.color);
    });
    fillMesh(roundsRef.current, rounds.length, (i) => {
      const t = rounds[i]!;
      writeInstance(roundsRef.current!, i, t.x, t.y, t.z, t.rot, t.sx, t.sy, t.sz, t.color);
    });
    fillMesh(rocksRef.current, rocks.length, (i) => {
      const t = rocks[i]!;
      writeInstance(rocksRef.current!, i, t.x, t.y, t.z, t.rot, t.sx, t.sy, t.sz, t.tint);
    });
    fillMesh(logsRef.current, logs.length, (i) => {
      const t = logs[i]!;
      writeInstance(logsRef.current!, i, t.x, t.y, t.z, t.rot, t.sx, t.sy, t.sz, t.tint);
    });
    fillMesh(fernsRef.current, ferns.length, (i) => {
      const t = ferns[i]!;
      writeInstance(fernsRef.current!, i, t.x, t.y, t.z, t.rot, t.sx, t.sy, t.sz, t.tint);
    });
    fillMesh(flowersRef.current, flowers.length, (i) => {
      const t = flowers[i]!;
      writeInstance(flowersRef.current!, i, t.x, t.y + 0.18, t.z, t.rot, t.sx, t.sy, t.sz, t.tint);
    });
    fillMesh(stumpsRef.current, stumps.length, (i) => {
      const t = stumps[i]!;
      writeInstance(stumpsRef.current!, i, t.x, t.y, t.z, t.rot, t.sx, t.sy, t.sz, t.tint);
    });
  };

  const fillGrass = (px: number, pz: number) => {
    const mesh = grassRef.current;
    if (!mesh) return;
    const budget = quality === "high" ? MAX_GRASS : 900;
    const blades = grassCells(px, pz, quality === "high" ? 42 : 28, budget);
    fillMesh(mesh, blades.length, (i) => {
      const g = blades[i]!;
      const color = meadowFactor(g.x, g.z) > 0.3 ? 0x8a9a48 : 0x3d6a34;
      writeInstance(mesh, i, g.x, g.y, g.z, g.rot, g.s, g.s, g.s, color);
    });
  };

  useLayoutEffect(() => {
    const meshes = [
      trunksRef.current,
      conesRef.current,
      roundsRef.current,
      rocksRef.current,
      logsRef.current,
      fernsRef.current,
      flowersRef.current,
      grassRef.current,
      stumpsRef.current,
    ];
    for (const m of meshes) {
      if (m) m.count = 0;
    }
    fillVegetation(lastChunk.current.cx, lastChunk.current.cz);
    fillGrass(vehicle.x, vehicle.z);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quality, radius]);

  useFrame(() => {
    const cx = chunkCoord(vehicle.x);
    const cz = chunkCoord(vehicle.z);
    if (cx !== lastChunk.current.cx || cz !== lastChunk.current.cz) {
      lastChunk.current = { cx, cz };
      setChunks(visibleChunkList(cx, cz, radius));
      fillVegetation(cx, cz);
    }
    if (Math.hypot(vehicle.x - lastGrass.current.x, vehicle.z - lastGrass.current.z) > 10) {
      lastGrass.current = { x: vehicle.x, z: vehicle.z };
      fillGrass(vehicle.x, vehicle.z);
    }
  });

  const ponds = chunks.map((c) => pondInChunk(c.cx, c.cz)).filter(Boolean);

  return (
    <group>
      {chunks.map((c) => (
        <TerrainChunk key={`${c.cx}:${c.cz}`} cx={c.cx} cz={c.cz} material={materials.terrain} />
      ))}

      <instancedMesh ref={trunksRef} args={[geos.trunk, materials.trunk, MAX_TRUNKS]} frustumCulled={false} />
      <instancedMesh ref={conesRef} args={[geos.cone, materials.cone, MAX_CONES]} frustumCulled={false} />
      <instancedMesh ref={roundsRef} args={[geos.round, materials.round, MAX_ROUNDS]} frustumCulled={false} />
      <instancedMesh ref={rocksRef} args={[geos.rock, materials.rock, MAX_ROCKS]} frustumCulled={false} />
      <instancedMesh ref={logsRef} args={[geos.log, materials.log, MAX_LOGS]} frustumCulled={false} />
      <instancedMesh ref={fernsRef} args={[geos.fern, materials.fern, MAX_FERNS]} frustumCulled={false} />
      <instancedMesh ref={flowersRef} args={[geos.flower, materials.flower, MAX_FLOWERS]} frustumCulled={false} />
      <instancedMesh ref={grassRef} args={[geos.grass, materials.grass, MAX_GRASS]} frustumCulled={false} />
      <instancedMesh ref={stumpsRef} args={[geos.stump, materials.stump, MAX_STUMPS]} frustumCulled={false} />

      {ponds.map((p) =>
        p ? (
          <mesh
            key={`pond-${p.x.toFixed(1)}-${p.z.toFixed(1)}`}
            geometry={geos.pond}
            material={materials.water}
            position={[p.x, p.y + 0.05, p.z]}
            scale={[p.radius, 1, p.radius]}
          />
        ) : null,
      )}

      <HeroOak />
      <HorizonMountains />
    </group>
  );
}

function HeroOak() {
  const x = -7.5;
  const z = -16;
  const y = groundHeight(x, z);
  return (
    <group position={[x, y, z]}>
      <mesh position={[0, 2.4, 0]} castShadow>
        <cylinderGeometry args={[0.42, 0.55, 4.8, 8]} />
        <meshStandardMaterial color="#3a2c22" roughness={0.92} />
      </mesh>
      <mesh position={[0, 5.4, 0]} castShadow>
        <icosahedronGeometry args={[2.6, 1]} />
        <meshStandardMaterial color="#5a6e34" roughness={0.8} />
      </mesh>
      <mesh position={[1.4, 4.8, 0.6]} castShadow>
        <icosahedronGeometry args={[1.5, 1]} />
        <meshStandardMaterial color="#6a7a38" roughness={0.8} />
      </mesh>
      <mesh position={[-1.2, 5.1, -0.8]} castShadow>
        <icosahedronGeometry args={[1.35, 1]} />
        <meshStandardMaterial color="#4a5c2c" roughness={0.8} />
      </mesh>
    </group>
  );
}

function HorizonMountains() {
  const group = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const peaks = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        a: (i / 14) * Math.PI * 2,
        h: 18 + ((i * 17) % 13),
        s: 14 + ((i * 9) % 10),
        c: i % 2 === 0 ? "#3a463c" : "#2e3a32",
      })),
    [],
  );

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    peaks.forEach((p, i) => {
      dummy.position.set(Math.cos(p.a) * 175, p.h * 0.35 - 4, Math.sin(p.a) * 175);
      dummy.scale.set(p.s, p.h, p.s);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      color.set(p.c);
      mesh.setColorAt(i, color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [peaks]);

  useFrame(() => {
    if (group.current) group.current.position.set(vehicle.x, 0, vehicle.z);
  });

  return (
    <group ref={group}>
      <instancedMesh ref={meshRef} args={[undefined, undefined, peaks.length]} frustumCulled={false}>
        <coneGeometry args={[1, 1, 5]} />
        <meshStandardMaterial roughness={1} />
      </instancedMesh>
    </group>
  );
}
