import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { usePrefersReducedMotion } from '../hooks/useMotionSystem';

export type BookStackPose = 'compact' | 'exploded' | 'orbital';

interface ThreeBookStackCanvasProps {
  totalTitles: number;
  activeLoans: number;
  availableCopies: number;
  overdueLoans: number;
}

const BOOK_PALETTE = [
  { cover: 0x2a533e, spine: 0x1d3b2b, foil: 0xffd085, title: 'Python Data Analysis' },
  { cover: 0x1e3a52, spine: 0x15293b, foil: 0x38bdf8, title: 'Algorithms & Complexity' },
  { cover: 0x5c3d1e, spine: 0x422b14, foil: 0xffd085, title: 'Statistical Learning' },
  { cover: 0x3b2638, spine: 0x291927, foil: 0xf43f5e, title: 'Database Internals' },
  { cover: 0x244237, spine: 0x182e26, foil: 0x34d399, title: 'Linear Algebra & NumPy' },
];

export const ThreeBookStackCanvas: React.FC<ThreeBookStackCanvasProps> = ({
  totalTitles,
  activeLoans,
  availableCopies,
  overdueLoans,
}) => {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const prefersReducedMotion = usePrefersReducedMotion();
  const [pose, setPose] = useState<BookStackPose>('exploded');
  const [hudCollapsed, setHudCollapsed] = useState<boolean>(false);

  const poseRef = useRef<BookStackPose>(pose);
  const reducedRef = useRef<boolean>(prefersReducedMotion);
  const pointerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const scrollProgressRef = useRef<number>(0);

  useEffect(() => {
    poseRef.current = pose;
  }, [pose]);

  useEffect(() => {
    reducedRef.current = prefersReducedMotion;
  }, [prefersReducedMotion]);

  useEffect(() => {
    const mountEl = canvasMountRef.current;
    if (!mountEl) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        preserveDrawingBuffer: true,
        powerPreference: 'high-performance',
      });
    } catch {
      return;
    }

    // 1. Software-WebGL detection directly from active context (no loseContext side-effects)
    const isSoftwareGl = (() => {
      try {
        const gl = renderer.getContext();
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();

    const width = mountEl.clientWidth || 420;
    const height = mountEl.clientHeight || 320;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.22;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    mountEl.innerHTML = '';
    mountEl.appendChild(renderer.domElement);

    const scene = new THREE.Scene();

    // 2. Studio Environment Reflection on Hardware GPU; Instant Multi-Point Rig on Software GL
    if (!isSoftwareGl) {
      const pmremGenerator = new THREE.PMREMGenerator(renderer);
      scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
      pmremGenerator.dispose();
    }

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 50);
    camera.position.set(0, 1.35, 5.2);
    camera.lookAt(0, 0.05, 0);

    // 3. Balanced Warm/Cool Studio Lighting Rig
    const hemiLight = new THREE.HemisphereLight(0xfef3c7, 0x1c1917, isSoftwareGl ? 1.45 : 0.9);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xffd085, isSoftwareGl ? 2.8 : 2.2);
    keyLight.position.set(3.5, 5.5, 4.2);
    if (!isSoftwareGl) {
      keyLight.castShadow = true;
      keyLight.shadow.camera.left = -3;
      keyLight.shadow.camera.right = 3;
      keyLight.shadow.camera.top = 3;
      keyLight.shadow.camera.bottom = -3;
      keyLight.shadow.bias = -0.0005;
      keyLight.shadow.normalBias = 0.02;
    }
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x34d399, isSoftwareGl ? 1.65 : 1.15);
    rimLight.position.set(-4.0, 2.5, -3.5);
    scene.add(rimLight);

    const frontFillLight = new THREE.DirectionalLight(0x93c5fd, isSoftwareGl ? 1.25 : 0.65);
    frontFillLight.position.set(-2.2, 1.8, 4.5);
    scene.add(frontFillLight);

    // 4. Soft Contact Shadow Grounding Plane
    const shadowGeo = new THREE.CircleGeometry(1.9, 32);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    });
    const contactShadow = new THREE.Mesh(shadowGeo, shadowMat);
    contactShadow.position.y = -1.18;
    scene.add(contactShadow);

    // 5. Composite Multi-Part 3D Library Monograph Stack & Orbital Astrolabe
    const rootGroup = new THREE.Group();
    scene.add(rootGroup);

    const bookGroups: THREE.Group[] = [];
    const sharedPageGeo = new THREE.BoxGeometry(1.62, 0.2, 1.18);
    const sharedBoardGeo = new THREE.BoxGeometry(1.7, 0.032, 1.24);
    const sharedSpineGeo = new THREE.BoxGeometry(0.05, 0.264, 1.24);
    const sharedRibGeo = new THREE.BoxGeometry(0.065, 0.022, 1.25);
    const sharedFoilBadgeGeo = new THREE.BoxGeometry(0.55, 0.01, 0.34);

    const pageMat = new THREE.MeshStandardMaterial({
      color: 0xf5f0e1,
      roughness: 0.78,
      metalness: 0.05,
    });

    BOOK_PALETTE.forEach((entry, idx) => {
      const bookGroup = new THREE.Group();

      const coverMat = new THREE.MeshStandardMaterial({
        color: entry.cover,
        roughness: 0.55,
        metalness: 0.18,
      });
      const spineMat = new THREE.MeshStandardMaterial({
        color: entry.spine,
        roughness: 0.42,
        metalness: 0.25,
      });
      const foilMat = new THREE.MeshStandardMaterial({
        color: entry.foil,
        roughness: 0.18,
        metalness: 0.92,
      });

      // Part 1: Cream Pages Block
      const pagesMesh = new THREE.Mesh(sharedPageGeo, pageMat);
      pagesMesh.position.x = 0.03;
      bookGroup.add(pagesMesh);

      // Part 2: Top & Bottom Hardcover Boards
      const topBoard = new THREE.Mesh(sharedBoardGeo, coverMat);
      topBoard.position.y = 0.116;
      bookGroup.add(topBoard);

      const bottomBoard = new THREE.Mesh(sharedBoardGeo, coverMat);
      bottomBoard.position.y = -0.116;
      bookGroup.add(bottomBoard);

      // Part 3: Bound Spine
      const spineMesh = new THREE.Mesh(sharedSpineGeo, spineMat);
      spineMesh.position.x = -0.835;
      bookGroup.add(spineMesh);

      // Part 4: Raised Brass/Gold Spine Ribs & Top Foil Emblem
      const ribOffsets = [-0.42, 0, 0.42];
      ribOffsets.forEach((zOff) => {
        const rib = new THREE.Mesh(sharedRibGeo, foilMat);
        rib.position.set(-0.838, 0, zOff);
        bookGroup.add(rib);
      });

      const foilBadge = new THREE.Mesh(sharedFoilBadgeGeo, foilMat);
      foilBadge.position.set(0.08, 0.135, 0);
      bookGroup.add(foilBadge);

      bookGroup.position.y = (idx - 2) * 0.46;
      bookGroup.rotation.y = (idx - 2) * 0.28;
      rootGroup.add(bookGroup);
      bookGroups.push(bookGroup);
    });

    rootGroup.rotation.set(0.12, 0.42, 0);

    // Part 5: Orbital Circulation Telemetry Rings & Data Nodes
    const ringGroup = new THREE.Group();
    const outerRingGeo = new THREE.TorusGeometry(1.72, 0.016, 12, 64);
    const innerRingGeo = new THREE.TorusGeometry(1.38, 0.012, 12, 48);
    const goldRingMat = new THREE.MeshStandardMaterial({
      color: 0xffd085,
      roughness: 0.2,
      metalness: 0.9,
    });
    const emeraldRingMat = new THREE.MeshStandardMaterial({
      color: 0x34d399,
      roughness: 0.25,
      metalness: 0.85,
    });

    const outerRing = new THREE.Mesh(outerRingGeo, goldRingMat);
    outerRing.rotation.x = Math.PI / 2.6;
    outerRing.rotation.y = 0.28;
    ringGroup.add(outerRing);

    const innerRing = new THREE.Mesh(innerRingGeo, emeraldRingMat);
    innerRing.rotation.x = -Math.PI / 3.1;
    innerRing.rotation.z = 0.4;
    ringGroup.add(innerRing);

    // Data Packet Spheres on the Orbital Ring
    const nodeGeo = new THREE.OctahedronGeometry(0.075, 0);
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const nodeMesh = new THREE.Mesh(nodeGeo, i % 2 === 0 ? goldRingMat : emeraldRingMat);
      nodeMesh.position.set(Math.cos(angle) * 1.72, Math.sin(angle) * 0.45, Math.sin(angle) * 1.65);
      ringGroup.add(nodeMesh);
    }

    rootGroup.add(ringGroup);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Track scroll position for scroll-linked 3D separation & rotation
    const onScroll = () => {
      const maxScroll = Math.max(1, window.innerHeight * 0.9);
      scrollProgressRef.current = Math.min(1, Math.max(0, window.scrollY / maxScroll));
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    const onResize = () => {
      if (!mountEl) return;
      const w = mountEl.clientWidth || 420;
      const h = mountEl.clientHeight || 320;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);
    const resizeObserver =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => onResize()) : null;
    resizeObserver?.observe(mountEl);

    // Software-WebGL safe frame scheduler (`afterDraw` per Three.js skill)
    let frameId = 0;
    let isDisposed = false;
    const startTimeMs = performance.now();
    let prevTimeMs = startTimeMs;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (!gl || typeof gl.fenceSync !== 'function') {
        frameId = window.setTimeout(cb, 90);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (isDisposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 8);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 85);
        }
      };
      frameId = window.setTimeout(poll, 8);
    }

    function tick() {
      if (isDisposed) return;
      const nowMs = performance.now();
      const dt = Math.min((nowMs - prevTimeMs) / 1000, 0.1);
      prevTimeMs = nowMs;
      const elapsed = (nowMs - startTimeMs) / 1000;
      const scrollP = scrollProgressRef.current;
      const currentPose = poseRef.current;
      const isReduced = reducedRef.current;

      // Target group rotation from pointer + scroll + pose
      const targetRotY =
        pointerRef.current.x * 0.55 +
        scrollP * 1.15 +
        (isReduced ? 0.35 : elapsed * (currentPose === 'orbital' ? 0.45 : 0.22));
      const targetRotX = -pointerRef.current.y * 0.32 + scrollP * 0.22 + 0.08;

      rootGroup.rotation.y = THREE.MathUtils.damp(rootGroup.rotation.y, targetRotY, 5, dt);
      rootGroup.rotation.x = THREE.MathUtils.damp(rootGroup.rotation.x, targetRotX, 5, dt);

      // Individual book layer kinematics based on pose & scroll
      const separationBase =
        currentPose === 'compact'
          ? 0.28
          : currentPose === 'exploded'
          ? 0.46 + scrollP * 0.18
          : 0.54 + scrollP * 0.22;

      bookGroups.forEach((bg, idx) => {
        const centeredIdx = idx - 2;
        const wave = isReduced ? 0 : Math.sin(elapsed * 1.6 + idx * 0.7) * 0.035;
        const targetY = centeredIdx * separationBase + wave;
        const targetTwist =
          currentPose === 'compact'
            ? centeredIdx * 0.08
            : currentPose === 'exploded'
            ? centeredIdx * (0.28 + scrollP * 0.25)
            : centeredIdx * 0.52 + (isReduced ? 0 : Math.cos(elapsed * 0.8 + idx) * 0.15);
        const targetSlideX =
          currentPose === 'orbital' ? Math.sin(idx * 1.2 + scrollP * 2) * 0.18 : 0;

        bg.position.y = THREE.MathUtils.damp(bg.position.y, targetY, 6, dt);
        bg.position.x = THREE.MathUtils.damp(bg.position.x, targetSlideX, 6, dt);
        bg.rotation.y = THREE.MathUtils.damp(bg.rotation.y, targetTwist, 6, dt);
      });

      // Ring orbital rotation
      const targetRingScale = currentPose === 'compact' ? 0.88 : 1.04;
      ringGroup.scale.setScalar(THREE.MathUtils.damp(ringGroup.scale.x, targetRingScale, 5, dt));
      if (!isReduced) {
        outerRing.rotation.z += dt * 0.35;
        innerRing.rotation.y -= dt * 0.48;
      }

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    tick();

    return () => {
      isDisposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      resizeObserver?.disconnect();
      sharedPageGeo.dispose();
      sharedBoardGeo.dispose();
      sharedSpineGeo.dispose();
      sharedRibGeo.dispose();
      sharedFoilBadgeGeo.dispose();
      outerRingGeo.dispose();
      innerRingGeo.dispose();
      nodeGeo.dispose();
      shadowGeo.dispose();
      renderer.dispose();
    };
  }, []);

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    pointerRef.current = { x: nx, y: ny };
  };

  const handlePointerLeave = () => {
    pointerRef.current = { x: 0, y: 0 };
  };

  return (
    <div
      data-testid="three-book-stack-stage"
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className="relative w-full h-[300px] sm:h-[340px] rounded-2xl border border-white/15 bg-black/45 overflow-hidden select-none"
    >
      {/* Top-Left Spec Badge (No pulsating dots per Three.js skill) */}
      <div className="absolute top-3.5 left-4 z-10 pointer-events-none flex items-center gap-2 text-[10px] font-mono text-[#d8dad0] bg-black/65 px-3 py-1 rounded-lg border border-white/10">
        <span className="text-[#ffd085] font-bold">3D MONOGRAPH ASTROLABE</span>
        <span className="text-white/25">//</span>
        <span>{totalTitles} TITLES · {activeLoans} ACTIVE · {availableCopies} AVAIL</span>
      </div>

      {/* Dedicated Isolated WebGL Canvas Mount */}
      <div ref={canvasMountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Unified Collapsible Bottom Control Dock (No backdrop-filter over active WebGL canvas) */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center max-w-[94%] w-auto">
        <button
          type="button"
          onClick={() => setHudCollapsed((prev) => !prev)}
          className="px-2.5 py-0.5 rounded-t-md bg-[#111513] border border-b-0 border-white/15 text-[10px] font-mono text-[#b5b8ad] hover:text-[#ffd085] transition-colors cursor-pointer"
        >
          {hudCollapsed ? '▴ Show 3D Controls' : '▾ Hide 3D Controls'}
        </button>
        {!hudCollapsed && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0d110f]/95 border border-white/15 shadow-xl text-[10px] font-mono">
            {(
              [
                { id: 'compact', label: 'Compact Stack' },
                { id: 'exploded', label: 'Exploded Layers' },
                { id: 'orbital', label: 'Orbital Scan' },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setPose(item.id)}
                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                  pose === item.id
                    ? 'bg-[#ffd085] text-[#191c19] font-bold'
                    : 'text-[#b5b8ad] hover:text-[#fbf8ee] hover:bg-white/5'
                }`}
              >
                {item.label}
              </button>
            ))}
            {overdueLoans > 0 && (
              <span className="hidden sm:inline-block pl-2 ml-1 border-l border-white/10 text-rose-400 font-semibold">
                {overdueLoans} Overdue
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
