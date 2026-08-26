import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { groundHeight } from "../world";
import { vehicle } from "../vehicle";

function Bird({ seed, radius, height, speed }: { seed: number; radius: number; height: number; speed: number }) {
  const group = useRef<THREE.Group>(null);
  const left = useRef<THREE.Mesh>(null);
  const right = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!group.current) return;
    const t = clock.elapsedTime * speed + seed;
    const px = vehicle.x + Math.cos(t) * radius;
    const pz = vehicle.z + Math.sin(t) * radius;
    const py = height + Math.sin(t * 2.4) * 0.8 + vehicle.y * 0.15;
    group.current.position.set(px, py, pz);
    group.current.rotation.y = -t + Math.PI / 2;
    const flap = Math.sin(clock.elapsedTime * 11 + seed) * 0.55;
    if (left.current) left.current.rotation.z = 0.35 + flap;
    if (right.current) right.current.rotation.z = -0.35 - flap;
  });

  return (
    <group ref={group}>
      <mesh>
        <sphereGeometry args={[0.07, 6, 5]} />
        <meshStandardMaterial color="#1c1c18" roughness={0.8} />
      </mesh>
      <mesh ref={left} position={[-0.12, 0, 0]} rotation={[0, 0, 0.4]}>
        <boxGeometry args={[0.28, 0.02, 0.1]} />
        <meshStandardMaterial color="#222018" />
      </mesh>
      <mesh ref={right} position={[0.12, 0, 0]} rotation={[0, 0, -0.4]}>
        <boxGeometry args={[0.28, 0.02, 0.1]} />
        <meshStandardMaterial color="#222018" />
      </mesh>
    </group>
  );
}

export function Ambience() {
  const motes = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const n = 420;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 70;
      pos[i * 3 + 1] = Math.random() * 14;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 70;
    }
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return geo;
  }, []);

  const moteMat = useMemo(
    () =>
      new THREE.PointsMaterial({
        color: "#f0e6c8",
        size: 0.12,
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
      }),
    [],
  );

  const moteRef = useRef<THREE.Points>(null);
  const leavesRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const leafState = useMemo(() => {
    return Array.from({ length: 70 }, (_, i) => ({
      x: (Math.random() - 0.5) * 50,
      y: 4 + Math.random() * 10,
      z: (Math.random() - 0.5) * 50,
      s: 0.12 + Math.random() * 0.12,
      spin: Math.random() * Math.PI * 2,
      drift: 0.4 + Math.random() * 0.5,
      seed: i * 0.37,
    }));
  }, []);

  useFrame(({ clock }, delta) => {
    const d = Math.min(delta, 0.1);
    const t = clock.elapsedTime;
    if (moteRef.current) {
      moteRef.current.position.set(vehicle.x, vehicle.y, vehicle.z);
      moteRef.current.rotation.y += d * 0.02;
    }
    const mesh = leavesRef.current;
    if (!mesh) return;
    for (let i = 0; i < leafState.length; i++) {
      const L = leafState[i]!;
      L.y -= L.drift * d;
      L.x += Math.sin(t * 0.7 + L.seed) * d * 0.35;
      L.z += Math.cos(t * 0.5 + L.seed) * d * 0.28;
      L.spin += d * 1.2;
      if (L.y < groundHeight(vehicle.x + L.x, vehicle.z + L.z) + 0.2) {
        L.y = 8 + Math.random() * 8;
        L.x = (Math.random() - 0.5) * 46;
        L.z = (Math.random() - 0.5) * 46;
      }
      dummy.position.set(vehicle.x + L.x, L.y, vehicle.z + L.z);
      dummy.rotation.set(L.spin * 0.4, L.spin, 0.4);
      dummy.scale.setScalar(L.s);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <points ref={moteRef} geometry={motes} material={moteMat} />
      <instancedMesh ref={leavesRef} args={[undefined, undefined, leafState.length]}>
        <planeGeometry args={[1, 1]} />
        <meshStandardMaterial color="#8a6a32" side={THREE.DoubleSide} roughness={0.8} />
      </instancedMesh>
      <Bird seed={0.2} radius={28} height={11} speed={0.11} />
      <Bird seed={1.4} radius={36} height={13} speed={0.08} />
      <Bird seed={2.7} radius={22} height={9.5} speed={0.14} />
      <Bird seed={3.9} radius={44} height={14} speed={0.07} />
      <Bird seed={5.1} radius={31} height={12} speed={0.1} />
      <Bird seed={6.2} radius={19} height={8.5} speed={0.13} />
    </group>
  );
}
