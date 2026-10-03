/**
 * buildShield: собирает 3D-модель «сканирующего щита» из примитивов three.js.
 *
 * Композиция: металлический щит → светящаяся панель-экран → строки «терминала»
 * → замок → кольца сканирования → проволочная сфера-«поле» → луч сканера
 * → распадающиеся воксели и осколки (щит «ломается» в правом верхнем углу).
 *
 * Функция чистая: только строит объекты, не трогает сцену и рендер.
 * Возвращает анимируемые части и `dispose()` для освобождения GPU-памяти.
 */
import * as THREE from 'three';

/** Цвета модели. Совпадают с токенами `_tokens.scss`. */
export const SHIELD_COLORS = {
  gunmetal: 0x2a2e38,
  cyan: 0x49e8d6,
  magenta: 0xff3d7f,
  voxel: 0x6b7280,
  brass: 0xc9a05a,
} as const;

/** Части модели, которые анимируются в рендер-цикле. */
export interface ShieldParts {
  /** Проволочная сфера-«поле»: медленно вращается. */
  readonly shell: THREE.Mesh;
  /** Луч сканера: ездит вверх-вниз. */
  readonly beam: THREE.Mesh;
  /** Кольца за щитом: вращаются в разные стороны. */
  readonly rings: ReadonlyArray<THREE.Mesh>;
  /** Воксели и осколки: «парят» (базовая позиция лежит в userData.baseY). */
  readonly debris: ReadonlyArray<THREE.Mesh>;
}

/** Результат сборки. */
export interface ShieldModel {
  /** Корневая группа: добавляется в сцену. */
  readonly group: THREE.Group;
  /** Анимируемые части. */
  readonly parts: ShieldParts;
  /** Освобождает геометрии и материалы. */
  dispose(): void;
}

/** Детерминированный «рандом»: модель одинакова при каждой загрузке. */
function pseudoRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

/** Силуэт геральдического щита заданной ширины/высоты. */
function shieldShape(halfWidth: number, top: number, shoulder: number, tip: number): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(-halfWidth, top);
  s.lineTo(halfWidth, top);
  s.lineTo(halfWidth, shoulder);
  s.quadraticCurveTo(halfWidth, tip + 0.15, 0, tip);
  s.quadraticCurveTo(-halfWidth, tip + 0.15, -halfWidth, shoulder);
  s.closePath();
  return s;
}

export function buildShield(): ShieldModel {
  const group = new THREE.Group();
  group.name = 'scanningShield';

  // ── Материалы ────────────────────────────────────────────────────────────
  const gunmetal = new THREE.MeshStandardMaterial({ color: SHIELD_COLORS.gunmetal, roughness: 0.4, metalness: 0.35 });
  const cyan = new THREE.MeshStandardMaterial({
    color: SHIELD_COLORS.cyan, roughness: 0.25, metalness: 0.15, emissive: 0x0c3f3a, emissiveIntensity: 0.6,
  });
  const magenta = new THREE.MeshStandardMaterial({
    color: SHIELD_COLORS.magenta, roughness: 0.3, metalness: 0.1, emissive: 0x3a0a1c, emissiveIntensity: 0.5,
  });
  const voxel = new THREE.MeshStandardMaterial({ color: SHIELD_COLORS.voxel, roughness: 0.45, metalness: 0.3 });
  const brass = new THREE.MeshStandardMaterial({ color: SHIELD_COLORS.brass, roughness: 0.3, metalness: 0.4 });
  const wire = new THREE.MeshStandardMaterial({ color: SHIELD_COLORS.cyan, wireframe: true, transparent: true, opacity: 0.35 });

  /** Хелпер: создать меш и сразу добавить в группу. */
  const add = (geometry: THREE.BufferGeometry, material: THREE.Material, name: string) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    group.add(mesh);
    return mesh;
  };

  // ── Щит и панель ─────────────────────────────────────────────────────────
  const plateGeo = new THREE.ExtrudeGeometry(shieldShape(0.34, 1.05, 0.55, 0), {
    depth: 0.06, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 3, curveSegments: 24,
  });
  plateGeo.translate(0, 0, -0.03);
  add(plateGeo, gunmetal, 'shieldPlate');

  const inset = add(
    new THREE.ExtrudeGeometry(shieldShape(0.26, 0.92, 0.5, -0.02), { depth: 0.015, bevelEnabled: false, curveSegments: 24 }),
    cyan,
    'shieldInset',
  );
  inset.position.set(0, 0.05, 0.045);

  // Строки «терминала» на панели.
  for (let i = 0; i < 5; i++) {
    const bar = add(new THREE.BoxGeometry(0.34 - i * 0.03, 0.012, 0.004), i % 2 === 0 ? gunmetal : magenta, `readoutBar${i}`);
    bar.position.set(0, 0.78 - i * 0.09, 0.065);
  }

  // ── Замок ────────────────────────────────────────────────────────────────
  add(new THREE.BoxGeometry(0.16, 0.13, 0.07), brass, 'lockBody').position.set(0, 0.32, 0.07);
  add(new THREE.TorusGeometry(0.07, 0.016, 12, 24, Math.PI), cyan, 'lockShackle').position.set(0, 0.4, 0.07);
  const keyhole = add(new THREE.CylinderGeometry(0.014, 0.014, 0.08, 10), gunmetal, 'lockKeyhole');
  keyhole.rotation.x = Math.PI / 2;
  keyhole.position.set(0, 0.3, 0.07);

  // ── Кольца сканирования ──────────────────────────────────────────────────
  const ringCyan = add(new THREE.TorusGeometry(0.5, 0.012, 12, 56), cyan, 'scanRingCyan');
  ringCyan.position.set(0, 0.5, -0.16);
  const ringMagenta = add(new THREE.TorusGeometry(0.58, 0.009, 12, 56), magenta, 'scanRingMagenta');
  ringMagenta.position.set(0, 0.52, -0.24);
  ringMagenta.rotation.z = 0.26;

  // ── Поле и луч ───────────────────────────────────────────────────────────
  const shell = add(new THREE.IcosahedronGeometry(0.72, 1), wire, 'containmentShell');
  shell.position.set(0, 0.5, -0.05);
  const beam = add(new THREE.CylinderGeometry(0.006, 0.006, 1.5, 8), magenta, 'scanBeam');
  beam.rotation.z = Math.PI / 2;
  beam.position.set(0, 0.5, 0.1);

  // ── Распад: воксели и осколки ────────────────────────────────────────────
  const debris: THREE.Mesh[] = [];
  for (let i = 0; i < 16; i++) {
    const [r1, r2, r3] = [pseudoRandom(i + 1), pseudoRandom(i + 11), pseudoRandom(i + 21)];
    const dist = 0.06 + i * 0.028;
    const angle = 0.3 + r1 * 1.1;
    const size = Math.max(0.014, 0.05 - i * 0.0022);
    const material = i % 3 === 0 ? magenta : i % 3 === 1 ? cyan : voxel;
    const cube = add(new THREE.BoxGeometry(size, size, size), material, `voxel${i}`);
    cube.position.set(0.3 + Math.cos(angle) * dist, 0.85 + Math.sin(angle) * dist * 0.8 + (r2 - 0.5) * 0.12, (r3 - 0.5) * 0.18);
    cube.rotation.set(r1 * Math.PI, r2 * Math.PI, r3 * Math.PI);
    cube.userData.baseY = cube.position.y;
    cube.userData.phase = r1 * Math.PI * 2;
    debris.push(cube);
  }
  for (let i = 0; i < 7; i++) {
    const [r1, r2, r3] = [pseudoRandom(i + 101), pseudoRandom(i + 111), pseudoRandom(i + 121)];
    const dist = 0.52 + i * 0.045;
    const angle = 0.2 + r1 * 1.3;
    const shard = add(new THREE.TetrahedronGeometry(0.035 + r2 * 0.03), i % 2 === 0 ? magenta : cyan, `shard${i}`);
    shard.position.set(0.3 + Math.cos(angle) * dist, 0.85 + Math.sin(angle) * dist * 0.8 + (r2 - 0.5) * 0.15, (r3 - 0.5) * 0.22);
    shard.rotation.set(r1 * Math.PI, r2 * Math.PI, r3 * Math.PI);
    shard.userData.baseY = shard.position.y;
    shard.userData.phase = r2 * Math.PI * 2;
    debris.push(shard);
  }

  // Центрируем модель вокруг начала координат.
  group.position.y = -0.5;

  return {
    group,
    parts: { shell, beam, rings: [ringCyan, ringMagenta], debris },
    dispose() {
      group.traverse((obj) => {
        if (obj instanceof THREE.Mesh) obj.geometry.dispose();
      });
      [gunmetal, cyan, magenta, voxel, brass, wire].forEach((m) => m.dispose());
    },
  };
}
