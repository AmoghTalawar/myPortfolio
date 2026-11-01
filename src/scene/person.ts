/* The character at the desk, built in code to follow Amogh's model sheet: a sculpted head with a
   real jaw, nose and brow, hair made of individual locks flowing from the crown, and an inked,
   cel-shaded look. He faces -z (toward the monitor), so the camera normally sees his back. */
import * as THREE from "three";
import { mergeGeometries, mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export interface Person {
  group: THREE.Group;
  animate(t: number): void;
}

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const { smoothstep: ss, lerp } = THREE.MathUtils;
const bump = (x: number, centre: number, width: number) => Math.exp(-(((x - centre) / width) ** 2));

// half the head's width, height and depth
const HEAD = V(0.268, 0.318, 0.3);
const INK = 0x1b1a2b;
const SKIN = 0xd69a6e;
const HAIR = 0x221c28;
// the crown, where all the hair grows from: on top of the head and toward the back
const CROWN = V(0.02, 0.88, 0.47).normalize();

/** turns a direction on a unit sphere into a point on the sculpted head */
function sculpt(d: THREE.Vector3): THREE.Vector3 {
  const { x, y, z } = d;
  const ax = Math.abs(x);
  const front = ss(-z, 0.15, 0.65);
  // the skull narrows into the jaw and the chin
  const jaw = ss(-y, 0.2, 1) * ss(-z, -0.5, 0.3);
  // a sphere pinches to a point at its pole, so the lower half is pushed out to give a rounded chin
  const full = y < 0 ? Math.max(Math.sqrt(Math.max(1 - y * y, 0.0001)), 0.05) ** -0.42 : 1;
  const width = (1 - 0.26 * jaw) * (y < 0 ? lerp(1, full, 0.8) : 1);
  // the back of the head tucks in toward the neck, and the face is flatter than the skull
  const depth = (z > 0 ? 1 - 0.34 * ss(-y, 0, 0.9) : 0.9) * lerp(1, full, 0.75);
  let out = 0;
  out += 0.115 * bump(x, 0, 0.1) * bump(y, -0.25, 0.11); // nose tip
  out += 0.075 * bump(x, 0, 0.065) * bump(y, -0.03, 0.2); // bridge
  out += 0.05 * bump(ax, 0.12, 0.05) * bump(y, -0.3, 0.05); // nostril wings
  out += 0.035 * bump(y, 0.2, 0.09) * bump(ax, 0.34, 0.28); // brow ridge
  out -= 0.05 * bump(ax, 0.37, 0.15) * bump(y, 0.03, 0.09); // eye sockets
  out += 0.03 * bump(ax, 0.5, 0.2) * bump(y, -0.28, 0.2); // cheeks
  out += 0.03 * bump(x, 0, 0.2) * bump(y, -0.55, 0.06); // lips
  out -= 0.015 * bump(x, 0, 0.2) * bump(y, -0.66, 0.035); // the dip under the lip
  out += 0.05 * bump(x, 0, 0.22) * bump(y, -0.8, 0.12); // chin
  return V(x * width * HEAD.x, y * (y < 0 ? 0.94 : 1) * HEAD.y, (z * depth - out * front) * HEAD.z);
}

/** how far down the head the hair reaches at each angle around it; angle 0 is the face */
function hairlineY(angle: number): number {
  const c = Math.cos(angle);
  const sides = lerp(-0.46, 0.04, ss(c, -1, -0.1));
  return lerp(sides, 0.46, ss(c, 0.3, 0.85));
}

/** a tube along `points` whose thickness varies; `out` is the direction its flat side faces */
function taperTube(
  points: THREE.Vector3[],
  radius: (u: number) => number,
  out: (p: THREE.Vector3) => THREE.Vector3,
  flat = 1,
  segments = 16,
  sides = 8,
): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(points);
  const positions: number[] = [];
  const indices: number[] = [];
  const p = V(0, 0, 0), t = V(0, 0, 0), n = V(0, 0, 0), b = V(0, 0, 0);
  for (let i = 0; i <= segments; i++) {
    const u = i / segments;
    curve.getPointAt(u, p);
    curve.getTangentAt(u, t);
    n.copy(out(p)).addScaledVector(t, -out(p).dot(t)).normalize();
    b.crossVectors(t, n);
    const r = radius(u);
    for (let j = 0; j < sides; j++) {
      const a = (j / sides) * Math.PI * 2;
      const c = Math.cos(a) * r, s = Math.sin(a) * r * flat;
      positions.push(p.x + b.x * c + n.x * s, p.y + b.y * c + n.y * s, p.z + b.z * c + n.z * s);
    }
  }
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < sides; j++) {
      const a = i * sides + j, c = i * sides + ((j + 1) % sides);
      indices.push(a, a + sides, c, c, a + sides, c + sides);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

export function buildPerson(opts: {
  track: <T extends { dispose(): void }>(x: T) => T;
  shadows: boolean;
  reduceMotion: boolean;
}): Person {
  const { track, shadows, reduceMotion } = opts;
  const group = new THREE.Group();

  // ---------- cel shading and ink ----------
  const ramp = track(new THREE.DataTexture(new Uint8Array([170, 215, 255]), 3, 1, THREE.RedFormat));
  ramp.minFilter = ramp.magFilter = THREE.NearestFilter;
  ramp.needsUpdate = true;
  const softRamp = track(new THREE.DataTexture(new Uint8Array([212, 240, 255]), 3, 1, THREE.RedFormat));
  softRamp.minFilter = softRamp.magFilter = THREE.NearestFilter;
  softRamp.needsUpdate = true;
  const toon = (hex: number, map = ramp) => track(new THREE.MeshToonMaterial({ color: hex, gradientMap: map }));
  const M = {
    skin: toon(SKIN, softRamp),
    skinShade: toon(0xa86f4c),
    hair: toon(HAIR),
    hairLit: toon(0x30283a),
    ink: toon(INK),
    hoodie: toon(0x1c1d22),
    rib: toon(0x2a2b32),
    seam: toon(0x43454f),
    trousers: toon(0x20294a),
    shoe: toon(0xc4c6ce),
    white: toon(0xffffff),
    iris: toon(0x4a2c18),
    lip: toon(0xa85f4c),
    mouth: toon(0x6e3428),
  };
  const inkMat = (width: number) =>
    track(new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: { width: { value: width }, ink: { value: new THREE.Color(INK) } },
      vertexShader: "uniform float width; void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position + normal * width, 1.0); }",
      fragmentShader: "uniform vec3 ink;\nvoid main() {\ngl_FragColor = vec4(ink, 1.0);\n#include <colorspace_fragment>\n}",
    }));
  const INKS = { body: inkMat(0.0075), fine: inkMat(0.004), scaled: inkMat(0.07) };
  const mesh = (g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0) => {
    const o = new THREE.Mesh(track(g), m);
    o.position.set(x, y, z);
    o.castShadow = o.receiveShadow = shadows;
    return o;
  };
  /** a mesh with an ink outline: a slightly fatter copy showing only its far side */
  const inked = (g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0, ink: THREE.Material = INKS.body) => {
    const o = mesh(g, m, x, y, z);
    const line = new THREE.Mesh(g, ink);
    line.raycast = () => {};
    o.add(line);
    return o;
  };
  const limb = (a: THREE.Vector3, b: THREE.Vector3, r: number, m: THREE.Material) => {
    const len = a.distanceTo(b);
    const o = inked(new THREE.CapsuleGeometry(r, Math.max(len - r * 2, 0.01), 6, 16), m);
    o.position.copy(a).add(b).multiplyScalar(0.5);
    o.quaternion.setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize());
    return o;
  };

  // ---------- head ----------
  const head = new THREE.Group();
  head.position.set(0, 0.47, 0.68);
  const raw = new THREE.SphereGeometry(1, 128, 96);
  raw.deleteAttribute("uv");
  raw.deleteAttribute("normal");
  const skullGeo = mergeVertices(raw); // joins the sphere's seam, so normals stay smooth across it
  raw.dispose();
  const pos = skullGeo.attributes.position as THREE.BufferAttribute;
  const colours = new Float32Array(pos.count * 3);
  const skin = new THREE.Color(SKIN), hairTone = new THREE.Color(HAIR), lipTone = new THREE.Color(0xc07d62), c = new THREE.Color();
  const d = V(0, 0, 0);
  for (let i = 0; i < pos.count; i++) {
    d.fromBufferAttribute(pos, i).normalize();
    const front = ss(-d.z, 0.1, 0.5);
    // hair colour on the scalp under the locks, so no skin shows between them
    const around = Math.atan2(d.x, -d.z);
    const line = hairlineY(around) + front * Math.sin(around * 11) * 0.035; // an uneven edge on the forehead
    const soften = lerp(0.3, 0.03, front); // a long fade at the back and sides, a crisp edge on the forehead
    const scalp = ss(d.y, line - soften, line + 0.08);
    // soft stubble along the jaw, thicker on the chin and above the lip
    const jawLine = front * ss(-d.y, 0.6, 0.82) * 0.2;
    const goatee = front * (1 - ss(Math.hypot(d.x / 0.3, (d.y + 0.82) / 0.17), 0.3, 1)) * 0.3;
    c.copy(skin).lerp(hairTone, Math.max(scalp, jawLine, goatee));
    c.lerp(lipTone, front * bump(d.x, 0, 0.2) * bump(d.y, -0.56, 0.03) * 0.8);
    c.toArray(colours, i * 3);
    sculpt(d).toArray(pos.array as Float32Array, i * 3);
  }
  skullGeo.setAttribute("color", new THREE.BufferAttribute(colours, 3));
  skullGeo.computeVertexNormals();
  const skull = inked(skullGeo, track(new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: softRamp })));
  head.add(skull);

  // finds a point on the face from its height and sideways position, for placing features on the surface
  skull.updateMatrixWorld();
  const caster = new THREE.Raycaster();
  const toward = V(0, 0, 1);
  const onFace = (x: number, y: number, lift = 0) => {
    caster.set(V(x, y, -1), toward);
    const hit = caster.intersectObject(skull, false)[0];
    return hit.point.clone().add(V(0, 0, -lift));
  };
  const faceOut = () => V(0, 0, -1);
  const stroke = (pts: THREE.Vector3[], r: (u: number) => number, m: THREE.Material, flat = 0.6) => mesh(taperTube(pts, r, faceOut, flat, 18, 8), m);

  for (const s of [-1, 1]) {
    // ear, with a darker hollow
    const ear = inked(new THREE.SphereGeometry(1, 16, 12), M.skin, s * 0.268, -0.025, 0.03, INKS.scaled);
    ear.scale.set(0.024, 0.066, 0.045);
    ear.rotation.y = s * 0.3;
    head.add(ear);
    const hollow = mesh(new THREE.SphereGeometry(1, 12, 10), M.skinShade, s * 0.272, -0.025, 0.03);
    hollow.scale.set(0.012, 0.042, 0.027);
    hollow.rotation.y = s * 0.3;
    head.add(hollow);

    // eye: an almond of white with iris, pupil and catchlight, under a heavy upper lid
    const eye = new THREE.Group();
    eye.position.copy(onFace(s * 0.104, 0.008, 0.002));
    eye.rotation.y = -s * 0.3;
    const white = mesh(new THREE.SphereGeometry(1, 18, 14), M.white);
    white.scale.set(0.05, 0.027, 0.013);
    eye.add(white);
    const iris = mesh(new THREE.SphereGeometry(1, 16, 12), M.iris, 0, 0.001, -0.009);
    iris.scale.set(0.024, 0.024, 0.008);
    eye.add(iris);
    const pupil = mesh(new THREE.SphereGeometry(1, 12, 10), M.ink, 0, 0.001, -0.0135);
    pupil.scale.set(0.013, 0.013, 0.005);
    eye.add(pupil);
    const spark = new THREE.Mesh(track(new THREE.SphereGeometry(0.0055, 8, 6)), track(new THREE.MeshBasicMaterial({ color: 0xffffff })));
    spark.position.set(0.007, 0.009, -0.0185);
    eye.add(spark);
    eye.add(mesh(taperTube([V(-0.055, -0.003, -0.002), V(-0.03, 0.021, -0.012), V(0, 0.03, -0.016), V(0.03, 0.021, -0.012), V(0.056, -0.006, -0.002)], (u) => 0.002 + 0.0055 * Math.sin(Math.PI * u), faceOut, 0.7), M.ink));
    eye.add(mesh(taperTube([V(-0.045, -0.012, -0.004), V(0, -0.027, -0.012), V(0.045, -0.012, -0.004)], (u) => 0.0008 + 0.0018 * Math.sin(Math.PI * u), faceOut), M.skinShade));
    head.add(eye);

    // thick eyebrow, heavy on the inside and tapering outward
    head.add(stroke(
      [onFace(s * 0.04, 0.066, 0.006), onFace(s * 0.09, 0.08, 0.006), onFace(s * 0.135, 0.08, 0.006), onFace(s * 0.178, 0.054, 0.004)],
      (u) => 0.016 * (1 - u * 0.78) * Math.min(1, 0.55 + u * 5),
      M.ink,
    ));
    // moustache: a thin, gently drooping stroke either side of the groove
    head.add(stroke(
      [onFace(s * 0.006, -0.128, 0.004), onFace(s * 0.035, -0.128, 0.004), onFace(s * 0.065, -0.14, 0.004), onFace(s * 0.09, -0.156, 0.002)],
      (u) => 0.0075 * (1 - u * 0.85) * Math.min(1, 0.5 + u * 5),
      M.ink,
    ));
    // the nostril
    head.add(stroke([onFace(s * 0.012, -0.101, 0.003), onFace(s * 0.03, -0.097, 0.003), onFace(s * 0.043, -0.083, 0.002)], (u) => 0.0028 * Math.sin(Math.PI * u) + 0.0008, M.skinShade));
  }
  // a closed, easy smile with the corners lifted
  head.add(stroke(
    [onFace(-0.079, -0.164, 0.002), onFace(-0.04, -0.181, 0.002), onFace(0, -0.183, 0.002), onFace(0.04, -0.181, 0.002), onFace(0.079, -0.164, 0.002)],
    (u) => 0.0012 + 0.0035 * Math.sin(Math.PI * u),
    M.mouth,
  ));

  // ---------- hair: locks grow from the crown and follow the head down to the hairline ----------
  const locks: THREE.BufferGeometry[] = [];
  const sheen: THREE.BufferGeometry[] = [];
  let seed = 41;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const between = (a: number, b: number) => a + (b - a) * rand();
  const dirAt = (angle: number, y: number) => {
    const r = Math.sqrt(Math.max(1 - y * y, 0));
    return V(Math.sin(angle) * r, y, -Math.cos(angle) * r);
  };
  const lock = (start: THREE.Vector3, end: THREE.Vector3, width: number, rise: number, flick: number, curl: number, lit = false) => {
    const pts: THREE.Vector3[] = [];
    const side = V(0, 0, 0).crossVectors(end, start).normalize();
    for (let i = 0; i <= 6; i++) {
      const t = i / 6;
      const dir = start.clone().lerp(end, t).addScaledVector(side, Math.sin(Math.PI * t) * curl).normalize();
      // stands away from the scalp through the middle; `flick` kicks the tip outward
      const height = 0.012 + rise * Math.sin(Math.PI * Math.min(1, t * 1.05)) ** 0.7 + flick * t ** 3;
      pts.push(sculpt(dir).add(dir.clone().multiplyScalar(height)));
    }
    const centre = V(0, 0, 0);
    (lit ? sheen : locks).push(taperTube(pts, (u) => width * ss(u, 0, 0.14) * (1 - u ** 2.4) + 0.0015, (p) => p.clone().sub(centre).normalize(), 0.5, 14, 7));
  };
  /* front hair sweeps across the forehead to one side; the rest falls straight */
  const LAYERS = [
    // the long outer layer that reaches the hairline all the way round
    { count: 44, reach: 1, width: [0.05, 0.068], rise: 0.03, flick: [0.0, 0.025] },
    // a shorter layer over it, which gives the hair its volume
    { count: 30, reach: 0.7, width: [0.055, 0.075], rise: 0.05, flick: [0.0, 0.03] },
    // short messy pieces on top that break up the silhouette
    { count: 18, reach: 0.5, width: [0.035, 0.05], rise: 0.05, flick: [0.01, 0.04] },
  ];
  for (const layer of LAYERS) {
    for (let i = 0; i < layer.count; i++) {
      const angle = (i / layer.count) * Math.PI * 2 + between(-0.07, 0.07);
      const facing = ss(Math.cos(angle), 0.3, 0.85);
      const end = dirAt(angle + facing * 0.85, hairlineY(angle) + between(-0.05, 0.03));
      const tip = CROWN.clone().lerp(end, layer.reach).normalize();
      const start = CROWN.clone().lerp(end, between(0.02, 0.1)).normalize();
      // the quiff: hair above the forehead stands much taller and its ends lift
      const rise = layer.rise * (1 + facing * 0.45 + (1 - Math.abs(Math.cos(angle))) * 0.7) * between(0.85, 1.15);
      lock(start, tip, between(layer.width[0], layer.width[1]) * (1 + facing * 0.2), rise, between(layer.flick[0], layer.flick[1]) + facing * 0.03, between(-0.09, 0.09) + facing * 0.08, layer.reach < 1 && rand() < 0.4);
    }
  }
  // pointed tufts that come down in front of each ear
  for (const s of [-1, 1]) {
    for (const [a, y, w] of [[1.12, -0.2, 0.034], [1.34, -0.12, 0.04], [1.55, -0.08, 0.038]]) {
      lock(dirAt(s * a * 0.8, 0.6), dirAt(s * a, y), w, 0.03, 0.012, 0);
    }
  }
  const hairGeo = mergeGeometries(locks)!;
  const sheenGeo = mergeGeometries(sheen)!;
  [...locks, ...sheen].forEach((g) => g.dispose());
  head.add(inked(hairGeo, M.hair, 0, 0, 0, INKS.fine), inked(sheenGeo, M.hairLit, 0, 0, 0, INKS.fine));
  group.add(head);

  // ---------- neck ----------
  group.add(inked(new THREE.CylinderGeometry(0.1, 0.12, 0.34, 20), M.skin, 0, 0.17, 0.71));

  // ---------- torso ----------
  const TORSO_Y = -0.47, TORSO_Z = 0.72;
  const torsoGeo = new THREE.CapsuleGeometry(0.4, 0.5, 10, 36);
  const tp = torsoGeo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < tp.count; i++) {
    let y = tp.getY(i);
    // squarer shoulders, then a slim waist
    if (y > 0.22) y = 0.22 + (y - 0.22) * 0.62;
    const waist = 1.13 - 0.14 * ss(-y, -0.12, 0.42);
    tp.setXYZ(i, tp.getX(i) * waist, y, tp.getZ(i) * 0.66);
  }
  torsoGeo.computeVertexNormals();
  const torso = inked(torsoGeo, M.hoodie, 0, TORSO_Y, TORSO_Z);
  group.add(torso);
  // the hood, down: a thick roll of fabric around the neck...
  const hoodRing: THREE.Vector3[] = [];
  for (let i = 0; i <= 18; i++) {
    const a = 0.5 + (i / 18) * (Math.PI * 2 - 1);
    hoodRing.push(V(Math.sin(a) * 0.158, 0.012 + 0.035 * ss(-Math.cos(a), -0.5, 0.8), TORSO_Z - Math.cos(a) * 0.145));
  }
  group.add(inked(
    taperTube(hoodRing, (u) => 0.066 * Math.min(1, 0.35 + Math.min(u, 1 - u) * 6), (p) => V(p.x, 0, p.z - TORSO_Z).normalize(), 0.62, 44, 10),
    M.hoodie,
  ));
  // ...and the rest of it hanging against the upper back, narrowing toward the bottom
  const pouchGeo = new THREE.SphereGeometry(1, 32, 24);
  const pp = pouchGeo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pp.count; i++) pp.setX(i, pp.getX(i) * lerp(1, 0.58, ss(-pp.getY(i), -0.2, 1)));
  pouchGeo.computeVertexNormals();
  const pouch = inked(pouchGeo, M.hoodie, 0, -0.1, TORSO_Z + 0.205, INKS.scaled);
  pouch.scale.set(0.26, 0.2, 0.095);
  group.add(pouch);

  // stitching and folds, drawn directly on the fabric in a lighter grey so they show on black
  group.updateMatrixWorld(true);
  const onFabric = (target: THREE.Object3D, x: number, y: number) => {
    caster.set(V(x, y, 3), V(0, 0, -1));
    const hit = caster.intersectObject(target, false)[0];
    return hit ? hit.point.clone().add(V(0, 0, 0.004)) : V(x, y, TORSO_Z + 0.26);
  };
  const fabricLine = (target: THREE.Object3D, pts: [number, number][], r: number) => {
    const g = taperTube(pts.map(([x, y]) => onFabric(target, x, y)), (u) => r * (0.35 + 0.65 * Math.sin(Math.PI * u)), () => V(0, 0, 1), 0.6, 20, 6);
    group.add(new THREE.Mesh(track(g), M.seam));
  };
  fabricLine(pouch, [[0, 0.07], [0, -0.1], [0, -0.26]], 0.005); // the hood's centre seam
  fabricLine(pouch, [[-0.19, -0.02], [-0.1, 0.045], [0, 0.065], [0.1, 0.045], [0.19, -0.02]], 0.006); // its rim
  fabricLine(torso, [[-0.38, -0.2], [-0.33, -0.36], [-0.27, -0.56]], 0.005); // sleeve seams
  fabricLine(torso, [[0.38, -0.2], [0.33, -0.36], [0.27, -0.56]], 0.005);
  fabricLine(torso, [[-0.2, -0.4], [-0.1, -0.47], [0.02, -0.49]], 0.0045); // folds across the back
  fabricLine(torso, [[0.22, -0.46], [0.12, -0.54], [-0.02, -0.57]], 0.0045);

  // ---------- arms: full hoodie sleeves with ribbed cuffs, hands on the keyboard ----------
  const armR = new THREE.Group(), armL = new THREE.Group();
  for (const [s, arm] of [[-1, armL], [1, armR]] as const) {
    const shoulder = V(s * 0.415, -0.14, 0.72);
    const elbow = V(s * 0.52, -0.52, 0.35);
    const wrist = V(s * 0.28, -0.46, -0.24);
    group.add(limb(shoulder, elbow, 0.108, M.hoodie));
    arm.add(limb(elbow, elbow.clone().lerp(wrist, 0.84), 0.092, M.hoodie));
    arm.add(limb(elbow.clone().lerp(wrist, 0.82), elbow.clone().lerp(wrist, 0.95), 0.07, M.rib));
    arm.add(limb(elbow.clone().lerp(wrist, 0.93), wrist, 0.052, M.skin));
    const palm = inked(new THREE.SphereGeometry(1, 16, 12), M.skin, wrist.x, wrist.y + 0.002, wrist.z - 0.06, INKS.scaled);
    palm.scale.set(0.074, 0.034, 0.08);
    arm.add(palm);
    for (let f = 0; f < 4; f++) {
      const x = wrist.x + (f - 1.5) * 0.031;
      arm.add(limb(V(x, wrist.y, wrist.z - 0.12), V(x + (f - 1.5) * 0.004, wrist.y - 0.024, wrist.z - 0.185 + Math.abs(f - 1.5) * 0.008), 0.0135, M.skin));
    }
    arm.add(limb(V(wrist.x - s * 0.06, wrist.y, wrist.z - 0.05), V(wrist.x - s * 0.085, wrist.y - 0.018, wrist.z - 0.115), 0.0145, M.skin));
    group.add(arm);
  }

  // ---------- legs ----------
  for (const s of [-1, 1]) {
    const hip = V(s * 0.2, -1.1, 0.62), knee = V(s * 0.25, -1.2, -0.05), ankle = V(s * 0.25, -2.36, 0);
    group.add(limb(hip, knee, 0.135, M.trousers), limb(knee, ankle, 0.112, M.trousers));
    const shoe = inked(new THREE.SphereGeometry(1, 18, 12), M.shoe, s * 0.25, -2.48, -0.09, INKS.scaled);
    shoe.scale.set(0.115, 0.075, 0.215);
    group.add(shoe);
  }

  // ---------- motion: he keeps his eyes on the monitor and types ----------
  const wristY = armL.position.y;
  return {
    group,
    animate(t) {
      const tap = reduceMotion ? 0 : Math.sin(t * 14) * 0.012;
      armL.position.y = wristY + tap;
      armR.position.y = wristY - tap;
    },
  };
}
