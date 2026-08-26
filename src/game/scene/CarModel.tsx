import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { vehicle } from "../vehicle";

const BODY = "#6d7a58";
const BODY_DARK = "#4d5640";
const CREAM = "#e7dcc8";
const GLASS = "#1c241c";
const TRIM = "#2a2620";
const TIRE = "#1a1a18";
const HUB = "#c9c2b4";
const LIGHT = "#f4ecd4";
const TAIL = "#8a2a24";

function Wheel({
  position,
  steered,
}: {
  position: [number, number, number];
  steered?: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  const spin = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!group.current || !spin.current) return;
    group.current.rotation.y = steered ? vehicle.steerAngle * 0.9 : 0;
    spin.current.rotation.x = vehicle.wheelRot;
  });

  return (
    <group ref={group} position={position}>
      <group ref={spin} rotation={[0, 0, Math.PI / 2]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.38, 0.38, 0.26, 14]} />
          <meshStandardMaterial color={TIRE} roughness={0.92} />
        </mesh>
        <mesh>
          <cylinderGeometry args={[0.2, 0.2, 0.28, 10]} />
          <meshStandardMaterial color={HUB} roughness={0.35} metalness={0.45} />
        </mesh>
        <mesh>
          <cylinderGeometry args={[0.06, 0.06, 0.3, 8]} />
          <meshStandardMaterial color={TRIM} roughness={0.4} metalness={0.3} />
        </mesh>
      </group>
    </group>
  );
}

export function CarModel() {
  const root = useRef<THREE.Group>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame(() => {
    if (!root.current) return;
    dummy.position.set(vehicle.x, vehicle.y, vehicle.z);
    dummy.rotation.order = "YXZ";
    dummy.rotation.set(vehicle.pitch, vehicle.yaw + Math.PI, vehicle.roll);
    dummy.updateMatrix();
    root.current.position.copy(dummy.position);
    root.current.quaternion.copy(dummy.quaternion);
  });

  return (
    <group ref={root}>
      <mesh position={[0, 0.58, 0.05]} castShadow receiveShadow>
        <boxGeometry args={[1.72, 0.52, 3.55]} />
        <meshStandardMaterial color={BODY} roughness={0.42} metalness={0.12} />
      </mesh>
      <mesh position={[0, 0.72, 1.28]} rotation={[-0.12, 0, 0]} castShadow>
        <boxGeometry args={[1.68, 0.28, 1.15]} />
        <meshStandardMaterial color={BODY} roughness={0.42} metalness={0.12} />
      </mesh>
      <mesh position={[0, 1.18, -0.15]} castShadow>
        <boxGeometry args={[1.58, 0.72, 1.85]} />
        <meshStandardMaterial color={CREAM} roughness={0.5} metalness={0.06} />
      </mesh>
      <mesh position={[0, 1.2, 0.72]}>
        <boxGeometry args={[1.5, 0.58, 0.08]} />
        <meshStandardMaterial color={GLASS} roughness={0.12} metalness={0.35} transparent opacity={0.72} />
      </mesh>
      <mesh position={[0, 1.2, -1.05]}>
        <boxGeometry args={[1.5, 0.58, 0.08]} />
        <meshStandardMaterial color={GLASS} roughness={0.12} metalness={0.35} transparent opacity={0.55} />
      </mesh>
      <mesh position={[-0.8, 1.2, -0.12]}>
        <boxGeometry args={[0.06, 0.52, 1.55]} />
        <meshStandardMaterial color={GLASS} roughness={0.12} metalness={0.3} transparent opacity={0.5} />
      </mesh>
      <mesh position={[0.8, 1.2, -0.12]}>
        <boxGeometry args={[0.06, 0.52, 1.55]} />
        <meshStandardMaterial color={GLASS} roughness={0.12} metalness={0.3} transparent opacity={0.5} />
      </mesh>
      <mesh position={[0, 1.56, -0.12]} castShadow>
        <boxGeometry args={[1.62, 0.08, 1.95]} />
        <meshStandardMaterial color={CREAM} roughness={0.55} />
      </mesh>
      <mesh position={[0, 1.72, -0.2]}>
        <boxGeometry args={[1.2, 0.06, 1.5]} />
        <meshStandardMaterial color={TRIM} roughness={0.6} />
      </mesh>
      <mesh position={[-0.42, 1.82, 0.35]}>
        <boxGeometry args={[0.18, 0.16, 0.7]} />
        <meshStandardMaterial color="#6a5848" roughness={0.7} />
      </mesh>
      <mesh position={[0.42, 1.82, 0.2]}>
        <cylinderGeometry args={[0.12, 0.12, 0.42, 10]} />
        <meshStandardMaterial color="#4a4036" roughness={0.55} metalness={0.2} />
      </mesh>
      <mesh position={[0, 0.42, 1.82]} castShadow>
        <boxGeometry args={[1.78, 0.22, 0.28]} />
        <meshStandardMaterial color={BODY_DARK} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.42, -1.78]} castShadow>
        <boxGeometry args={[1.78, 0.22, 0.28]} />
        <meshStandardMaterial color={BODY_DARK} roughness={0.5} />
      </mesh>
      <mesh position={[-0.58, 0.62, 1.92]}>
        <sphereGeometry args={[0.13, 12, 10]} />
        <meshStandardMaterial color={LIGHT} emissive={LIGHT} emissiveIntensity={0.55} roughness={0.2} />
      </mesh>
      <mesh position={[0.58, 0.62, 1.92]}>
        <sphereGeometry args={[0.13, 12, 10]} />
        <meshStandardMaterial color={LIGHT} emissive={LIGHT} emissiveIntensity={0.55} roughness={0.2} />
      </mesh>
      <mesh position={[-0.62, 0.7, -1.9]}>
        <boxGeometry args={[0.28, 0.12, 0.06]} />
        <meshStandardMaterial color={TAIL} emissive={TAIL} emissiveIntensity={0.4} />
      </mesh>
      <mesh position={[0.62, 0.7, -1.9]}>
        <boxGeometry args={[0.28, 0.12, 0.06]} />
        <meshStandardMaterial color={TAIL} emissive={TAIL} emissiveIntensity={0.4} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[1.35, 16]} />
        <meshBasicMaterial color="#121410" transparent opacity={0.32} />
      </mesh>
      <mesh position={[0, 0.28, 0]} receiveShadow>
        <boxGeometry args={[1.5, 0.16, 3.2]} />
        <meshStandardMaterial color="#1c1c18" roughness={0.9} />
      </mesh>
      <mesh position={[-0.92, 1.12, 0.55]} rotation={[0, 0.2, 0]}>
        <boxGeometry args={[0.18, 0.1, 0.22]} />
        <meshStandardMaterial color={TRIM} />
      </mesh>
      <mesh position={[0.92, 1.12, 0.55]} rotation={[0, -0.2, 0]}>
        <boxGeometry args={[0.18, 0.1, 0.22]} />
        <meshStandardMaterial color={TRIM} />
      </mesh>
      <mesh position={[0, 0.78, -2.05]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.32, 0.32, 0.18, 12]} />
        <meshStandardMaterial color={TIRE} roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.55, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.08, 0.08, 1.7, 8]} />
        <meshStandardMaterial color={TRIM} />
      </mesh>
      <Wheel position={[-0.78, 0.38, 1.28]} steered />
      <Wheel position={[0.78, 0.38, 1.28]} steered />
      <Wheel position={[-0.78, 0.38, -1.22]} />
      <Wheel position={[0.78, 0.38, -1.22]} />
    </group>
  );
}
