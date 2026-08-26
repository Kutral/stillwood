import { useEffect, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Sky } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette, SMAA } from "@react-three/postprocessing";
import * as THREE from "three";
import { CarModel } from "./scene/CarModel";
import { ForestWorld, simUniforms } from "./scene/ForestWorld";
import { Ambience } from "./scene/Ambience";
import { vehicle, stepVehicle, forwardVector } from "./vehicle";
import { sampleActions } from "./input";
import { playCollision, updateAudio } from "./audio";
import { useGame } from "./store";
import { bindControlsTest } from "./controlsTest";

const FIXED = 1 / 60;
const SUN = new THREE.Vector3(70, 24, 38);
// Reused per-frame scratch vectors (avoid GC churn in the hot loop).
const chasePos = new THREE.Vector3();
const chaseLook = new THREE.Vector3();
const cinePos = new THREE.Vector3();
const cineLook = new THREE.Vector3();

function GameLoop() {
  const { camera, scene } = useThree();
  const sunRef = useRef<THREE.DirectionalLight>(null);
  const acc = useRef(0);
  const telem = useRef(0);
  const blend = useRef(0);
  const camPos = useRef(new THREE.Vector3(14, 5.2, 12));
  const camLook = useRef(new THREE.Vector3(0, 1.2, 0));
  const lastHit = useRef(0);
  const driven = useRef(0);

  useEffect(() => {
    bindControlsTest();
    scene.fog = new THREE.FogExp2("#cbb89a", 0.0152);
    if (sunRef.current) scene.add(sunRef.current.target);
  }, [scene]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.1);
    simUniforms.time.value = state.clock.elapsedTime;
    const store = useGame.getState();
    const actions = sampleActions();

    if (actions.pause && store.phase === "playing") store.pause();
    else if (actions.pause && store.phase === "paused") store.resume();

    const playing = store.phase === "playing";
    if (playing) {
      acc.current += dt;
      let steps = 0;
      while (acc.current >= FIXED && steps < 4) {
        stepVehicle(FIXED, actions);
        acc.current -= FIXED;
        steps += 1;
      }
    } else {
      acc.current = 0;
    }

    if (vehicle.collision > lastHit.current + 0.12) {
      playCollision(vehicle.collision);
    }
    lastHit.current = vehicle.collision;

    driven.current += playing ? Math.abs(vehicle.speed) * dt : 0;
    if (store.hudHint && (driven.current > 18 || state.clock.elapsedTime > 24)) {
      store.hideHint();
    }

    telem.current -= dt;
    if (telem.current <= 0) {
      telem.current = 0.12;
      store.setTelemetry(vehicle.speed, vehicle.yaw, vehicle.distance);
    }

    updateAudio(dt);

    const targetBlend = playing || store.phase === "paused" ? 1 : 0;
    blend.current += (targetBlend - blend.current) * (1 - Math.exp(-1.6 * dt));

    const fwd = forwardVector();
    const chaseDist = store.camMode === "hood" ? -0.35 : 8.6;
    const chaseH = store.camMode === "hood" ? 1.28 : 3.05;
    const lookDist = store.camMode === "hood" ? 14 : 5.5;
    const lookY = store.camMode === "hood" ? 0.95 : 1.15;

    const chase = chasePos.set(
      vehicle.x - fwd.x * chaseDist,
      vehicle.y + chaseH,
      vehicle.z - fwd.z * chaseDist,
    );
    const look = chaseLook.set(
      vehicle.x + fwd.x * lookDist,
      vehicle.y + lookY,
      vehicle.z + fwd.z * lookDist,
    );

    const t = state.clock.elapsedTime;
    const cine = cinePos.set(
      vehicle.x + Math.cos(t * 0.11) * 13.5,
      vehicle.y + 4.4 + Math.sin(t * 0.17) * 0.55,
      vehicle.z + Math.sin(t * 0.11) * 13.5,
    );
    const cineTarget = cineLook.set(vehicle.x, vehicle.y + 1.15, vehicle.z);

    const desiredPos = cine.lerp(chase, blend.current);
    const desiredLook = cineTarget.lerp(look, blend.current);

    const k = store.camMode === "hood" ? 8 : 3.4;
    const follow = 1 - Math.exp(-k * dt);
    camPos.current.lerp(desiredPos, follow);
    camLook.current.lerp(desiredLook, 1 - Math.exp(-5.2 * dt));

    camera.position.copy(camPos.current);
    camera.lookAt(camLook.current);
    const spd = Math.abs(vehicle.speed);
    const cam = camera as THREE.PerspectiveCamera;
    if (cam.isPerspectiveCamera) {
      const fov = 50 + Math.min(10, spd * 0.42);
      cam.fov += (fov - cam.fov) * (1 - Math.exp(-2.5 * dt));
      cam.updateProjectionMatrix();
    }

    if (sunRef.current) {
      sunRef.current.position.set(vehicle.x + SUN.x, vehicle.y + SUN.y, vehicle.z + SUN.z);
      sunRef.current.target.position.set(vehicle.x, vehicle.y, vehicle.z);
      sunRef.current.target.updateMatrixWorld();
    }
  });

  const quality = useGame((s) => s.quality);

  return (
    <directionalLight
      ref={sunRef}
      intensity={2.15}
      color="#ffd4a3"
      castShadow={quality === "high"}
      shadow-mapSize-width={2048}
      shadow-mapSize-height={2048}
      shadow-camera-near={2}
      shadow-camera-far={140}
      shadow-camera-left={-38}
      shadow-camera-right={38}
      shadow-camera-top={38}
      shadow-camera-bottom={-38}
      shadow-bias={-0.00035}
    />
  );
}

function Lights() {
  return (
    <>
      <hemisphereLight args={["#f2e6cc", "#2a3328", 0.62]} />
      <ambientLight intensity={0.16} color="#d8c8a8" />
      <Sky
        sunPosition={[SUN.x, SUN.y, SUN.z]}
        turbidity={5.5}
        rayleigh={0.55}
        mieCoefficient={0.006}
        mieDirectionalG={0.86}
      />
    </>
  );
}

function Post() {
  const quality = useGame((s) => s.quality);
  if (quality !== "high") return null;
  return (
    <EffectComposer enableNormalPass={false} multisampling={0}>
      <SMAA />
      <Bloom luminanceThreshold={0.92} intensity={0.28} mipmapBlur />
      <Vignette eskil={false} offset={0.18} darkness={0.52} />
    </EffectComposer>
  );
}

function Dust() {
  const ref = useRef<THREE.Points>(null);
  const geo = useRef<THREE.BufferGeometry>(null);
  const positions = useRef(new Float32Array(80 * 3));

  useFrame(() => {
    if (!ref.current || !geo.current) return;
    const spd = Math.abs(vehicle.speed);
    const fwd = forwardVector();
    const attr = geo.current.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < 80; i++) {
      let x = attr.getX(i);
      let y = attr.getY(i);
      let z = attr.getZ(i);
      y += 0.01;
      x += (Math.random() - 0.5) * 0.04;
      z += (Math.random() - 0.5) * 0.04;
      if (y > 1.4 || spd < 2) {
        x = vehicle.x - fwd.x * (2.2 + Math.random() * 1.4) + (Math.random() - 0.5) * 0.8;
        y = vehicle.y + 0.05;
        z = vehicle.z - fwd.z * (2.2 + Math.random() * 1.4) + (Math.random() - 0.5) * 0.8;
      }
      attr.setXYZ(i, x, y, z);
    }
    attr.needsUpdate = true;
    const mat = ref.current.material as THREE.PointsMaterial;
    mat.opacity = spd > 2.5 ? Math.min(0.35, (spd - 2.5) * 0.04) : 0;
  });

  return (
    <points ref={ref}>
      <bufferGeometry ref={geo}>
        <bufferAttribute attach="attributes-position" args={[positions.current, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#c4b08a" size={0.18} transparent opacity={0} depthWrite={false} />
    </points>
  );
}

export default function ForestScene() {
  const quality = useGame((s) => s.quality);

  return (
    <Canvas
      key={quality}
      shadows={quality === "high"}
      dpr={quality === "high" ? [1, 1.5] : [1, 1.15]}
      camera={{ fov: 52, near: 0.12, far: 260, position: [14, 5.2, 12] }}
      gl={{
        antialias: quality === "low",
        powerPreference: "high-performance",
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 0.9,
      }}
      onCreated={({ gl }) => {
        gl.outputColorSpace = THREE.SRGBColorSpace;
        gl.setClearColor("#cbb89a");
      }}
      style={{ touchAction: "none", width: "100%", height: "100%" }}
    >
      <Lights />
      <GameLoop />
      <ForestWorld />
      <CarModel />
      <Ambience />
      <Dust />
      <Post />
    </Canvas>
  );
}
