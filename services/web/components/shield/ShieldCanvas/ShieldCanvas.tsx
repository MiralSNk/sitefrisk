'use client';
/**
 * ShieldCanvas: WebGL-вьюпорт с 3D-щитом (three.js).
 *
 * Делает:
 *  - свой рендерер, свет и камеру (прозрачный фон: сквозь него видны сканлайны);
 *  - автоповорот и вращение мышью (OrbitControls, без зума и панорамы);
 *  - «живую» анимацию: луч ездит, поле вращается, обломки парят;
 *  - подстройку под размер контейнера (ResizeObserver);
 *  - паузу, когда вьюпорт вне экрана или вкладка скрыта (экономия батареи);
 *  - полную очистку GPU-ресурсов при размонтировании.
 *
 * На тач-устройствах ручное вращение выключено, чтобы жест не мешал
 * прокрутке страницы. Автоповорот при этом работает.
 *
 * Экспорт по умолчанию нужен для `next/dynamic` (см. ShieldPanel).
 */
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { buildShield } from './buildShield';
import styles from './ShieldCanvas.module.scss';

/** Пропсы вьюпорта. */
export interface ShieldCanvasProps {
  /** Автоповорот (выключается при reduced motion). */
  autoRotate?: boolean;
}

/** Скорость автоповорота (единицы OrbitControls). */
const AUTO_ROTATE_SPEED = 1.4;
/** Ограничение плотности пикселей: 2x достаточно, выше просто тратит GPU. */
const MAX_PIXEL_RATIO = 2;

export default function ShieldCanvas({ autoRotate = true }: ShieldCanvasProps) {
  /** Контейнер, в который монтируется canvas. */
  const mountRef = useRef<HTMLDivElement | null>(null);
  /** Контролы в ref: autoRotate можно переключать без пересоздания сцены. */
  const controlsRef = useRef<OrbitControls | null>(null);
  /** Нужно ли анимировать (читается внутри рендер-цикла). */
  const animateRef = useRef(autoRotate);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // ── Рендерер ───────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.className = styles.canvas;
    mount.appendChild(renderer.domElement);

    // ── Сцена, камера, свет ────────────────────────────────────────────────
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50);
    camera.position.set(0.5, 0.3, 3.1);

    scene.add(new THREE.HemisphereLight(0xcfe3ff, 0x0a0b0f, 0.7));
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(2, 3, 4);
    const rim = new THREE.DirectionalLight(0x49e8d6, 1.4);
    rim.position.set(-3, 1, -2);
    const accent = new THREE.PointLight(0xff3d7f, 0.8, 6);
    accent.position.set(1.2, 1, 1);
    scene.add(key, rim, accent);

    // ── Модель ─────────────────────────────────────────────────────────────
    const model = buildShield();
    scene.add(model.group);

    // ── Управление ─────────────────────────────────────────────────────────
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.autoRotate = animateRef.current;
    controls.autoRotateSpeed = AUTO_ROTATE_SPEED;
    controls.minPolarAngle = Math.PI * 0.3;
    controls.maxPolarAngle = Math.PI * 0.7;
    /** Тач-экран: отключаем жест вращения, чтобы не блокировать скролл. */
    const isCoarse = window.matchMedia('(pointer: coarse)').matches;
    if (isCoarse) {
      controls.enableRotate = false;
      renderer.domElement.style.touchAction = 'pan-y';
    }
    controlsRef.current = controls;

    // ── Размер ─────────────────────────────────────────────────────────────
    const resize = () => {
      const { clientWidth: w, clientHeight: h } = mount;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);
    resize();

    // ── Рендер-цикл с паузой вне экрана ────────────────────────────────────
    /** Виден ли вьюпорт. */
    let visible = true;
    /** id текущего кадра. */
    let frame = 0;
    const clock = new THREE.Clock();
    const { shell, beam, rings, debris } = model.parts;

    const loop = () => {
      frame = requestAnimationFrame(loop);
      if (!visible || document.hidden) return;
      const dt = clock.getDelta();
      const t = clock.elapsedTime;
      if (animateRef.current) {
        shell.rotation.y += dt * 0.15;
        shell.rotation.x += dt * 0.05;
        beam.position.y = 0.5 + Math.sin(t * 1.6) * 0.45;
        rings[0].rotation.z += dt * 0.3;
        rings[1].rotation.z -= dt * 0.2;
        debris.forEach((piece, i) => {
          piece.position.y = (piece.userData.baseY as number) + Math.sin(t * 1.2 + (piece.userData.phase as number)) * 0.015;
          piece.rotation.x += dt * (0.2 + (i % 3) * 0.1);
        });
      }
      controls.update();
      renderer.render(scene, camera);
    };
    loop();

    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) clock.getDelta(); // сбрасываем накопленную дельту, иначе будет рывок
    });
    intersection.observe(mount);

    // ── Очистка ────────────────────────────────────────────────────────────
    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      intersection.disconnect();
      controls.dispose();
      controlsRef.current = null;
      model.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  // Переключение автоповорота без пересоздания сцены.
  useEffect(() => {
    animateRef.current = autoRotate;
    if (controlsRef.current) controlsRef.current.autoRotate = autoRotate;
  }, [autoRotate]);

  return <div ref={mountRef} className={styles.mount} role="img" aria-label="3D-модель: щит под сканированием, распадается на фрагменты" />;
}
