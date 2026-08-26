import * as THREE from "three";

function canvas(size: number) {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("2d");
  return { c, ctx };
}

function tex(c: HTMLCanvasElement, repeat = 4) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

export function makeBarkTexture() {
  const { c, ctx } = canvas(256);
  ctx.fillStyle = "#3a2c22";
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 40; i++) {
    ctx.strokeStyle = `rgba(20,14,10,${0.15 + Math.random() * 0.35})`;
    ctx.lineWidth = 1 + Math.random() * 3;
    const x = Math.random() * 256;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.bezierCurveTo(x + 8, 80, x - 10, 160, x + 4, 256);
    ctx.stroke();
  }
  for (let i = 0; i < 120; i++) {
    ctx.fillStyle = `rgba(${50 + Math.random() * 40},${32 + Math.random() * 20},${18},0.25)`;
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 8 + Math.random() * 18);
  }
  return tex(c, 2);
}

export function makeLeafTexture() {
  const { c, ctx } = canvas(128);
  ctx.clearRect(0, 0, 128, 128);
  const g = ctx.createRadialGradient(64, 64, 10, 64, 64, 62);
  g.addColorStop(0, "#6a8a40");
  g.addColorStop(0.55, "#3d5c2c");
  g.addColorStop(1, "rgba(20,40,16,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(64, 64, 60, 60, 0, 0, Math.PI * 2);
  ctx.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

export function makeGrassTexture() {
  const { c, ctx } = canvas(64);
  ctx.clearRect(0, 0, 64, 64);
  const g = ctx.createLinearGradient(32, 64, 32, 0);
  g.addColorStop(0, "rgba(40,70,28,0)");
  g.addColorStop(0.12, "#355828");
  g.addColorStop(0.7, "#5a7a38");
  g.addColorStop(1, "rgba(180,190,90,0.1)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(32, 64);
  ctx.quadraticCurveTo(10, 28, 28, 0);
  ctx.quadraticCurveTo(36, 24, 38, 64);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(32, 64);
  ctx.quadraticCurveTo(48, 30, 40, 4);
  ctx.quadraticCurveTo(34, 30, 32, 64);
  ctx.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

export function makeNoiseTexture() {
  const { c, ctx } = canvas(128);
  const img = ctx.createImageData(128, 128);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = 90 + Math.random() * 80;
    img.data[i] = n;
    img.data[i + 1] = n;
    img.data[i + 2] = n;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = tex(c, 8);
  t.colorSpace = THREE.NoColorSpace;
  return t;
}
