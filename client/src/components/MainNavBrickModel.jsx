import { useEffect, useRef } from "react";
import * as THREE from "three";
import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";

/**
 * OBJ/MTL preview with the same drag-to-rotate behaviour as {@link BrickModel}.
 * Call `onInteractDrag` when the user rotates (suppress parent `<a>` navigation).
 */
export function MainNavBrickModel({ mtlUrl, objUrl, onInteractDrag }) {
  const containerRef = useRef(null);
  const onInteractDragRef = useRef(onInteractDrag);
  onInteractDragRef.current = onInteractDrag;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(0, 0.05, 4.9);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    container.appendChild(renderer.domElement);

    const modelRoot = new THREE.Group();
    modelRoot.position.set(-0.28, 0.22, 0);
    modelRoot.rotation.set(-0.18, -0.38, 0.02);
    scene.add(modelRoot);

    const ambient = new THREE.AmbientLight(0xffffff, 1.25);
    scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
    keyLight.position.set(3, 5, 4);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xffe6c7, 1.1);
    fillLight.position.set(-4, 1.5, 3);
    scene.add(fillLight);

    const targetRotation = new THREE.Vector2(-0.38, -0.52);
    const currentRotation = new THREE.Vector2(-0.38, -0.52);
    const dragState = {
      active: false,
      pointerId: null,
      x: 0,
      y: 0,
    };
    let dragDistance = 0;
    let frameId = 0;
    let disposed = false;

    const resize = () => {
      const { width, height } = container.getBoundingClientRect();
      if (!width || !height) return;

      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    resize();

    const capture = true;

    const handlePointerDown = (event) => {
      if (event.button !== 0 && event.button !== undefined) return;
      dragState.active = true;
      dragState.pointerId = event.pointerId;
      dragState.x = event.clientX;
      dragState.y = event.clientY;
      dragDistance = 0;
      container.setPointerCapture(event.pointerId);
    };

    const handlePointerMove = (event) => {
      if (!dragState.active || dragState.pointerId !== event.pointerId) return;

      const deltaX = event.clientX - dragState.x;
      const deltaY = event.clientY - dragState.y;

      dragDistance += Math.abs(deltaX) + Math.abs(deltaY);

      if (dragDistance > 4) {
        event.preventDefault();
      }

      targetRotation.x += deltaX * 0.012;
      targetRotation.y += deltaY * 0.012;
      dragState.x = event.clientX;
      dragState.y = event.clientY;
    };

    const handlePointerUp = (event) => {
      const pid = event.pointerId;
      if (dragState.pointerId !== pid) return;

      if (dragDistance > 8 && typeof onInteractDragRef.current === "function") {
        onInteractDragRef.current();
      }

      try {
        if (container.hasPointerCapture(pid)) {
          container.releasePointerCapture(pid);
        }
      } catch {
        // ignore duplicate release
      }

      dragState.active = false;
      dragState.pointerId = null;
    };

    container.addEventListener("pointerdown", handlePointerDown, { capture });
    container.addEventListener("pointermove", handlePointerMove, { capture, passive: false });
    container.addEventListener("pointerup", handlePointerUp, { capture });
    container.addEventListener("pointercancel", handlePointerUp, { capture });

    const materialsLoader = new MTLLoader();
    materialsLoader.load(
      mtlUrl,
      (materials) => {
        if (disposed) return;

        materials.preload();

        const objectLoader = new OBJLoader();
        objectLoader.setMaterials(materials);
        objectLoader.load(objUrl, (object) => {
          if (disposed) return;

          const box = new THREE.Box3().setFromObject(object);
          const center = box.getCenter(new THREE.Vector3());
          const size = box.getSize(new THREE.Vector3());
          const maxAxis = Math.max(size.x, size.y, size.z) || 1;

          object.position.sub(center);
          object.scale.setScalar(2.72 / maxAxis);
          object.traverse((child) => {
            if (child.isMesh) {
              child.castShadow = false;
              child.receiveShadow = false;
            }
          });

          modelRoot.add(object);
        });
      },
      undefined,
      (err) => {
        console.error("[MainNavBrickModel] Failed to load materials:", err);
      }
    );

    const animate = () => {
      currentRotation.x += (targetRotation.x - currentRotation.x) * 0.08;
      currentRotation.y += (targetRotation.y - currentRotation.y) * 0.08;
      modelRoot.rotation.y = currentRotation.x;
      modelRoot.rotation.x = currentRotation.y;

      renderer.render(scene, camera);
      frameId = window.requestAnimationFrame(animate);
    };

    animate();

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      container.removeEventListener("pointerdown", handlePointerDown, { capture: true });
      container.removeEventListener("pointermove", handlePointerMove, { capture: true });
      container.removeEventListener("pointerup", handlePointerUp, { capture: true });
      container.removeEventListener("pointercancel", handlePointerUp, { capture: true });
      renderer.dispose();
      renderer.domElement.remove();
      scene.traverse((object) => {
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
    };
  }, [mtlUrl, objUrl]);

  return (
    <div
      ref={containerRef}
      className="platform-main__brick-model"
      aria-hidden="true"
      style={{ touchAction: "none" }}
    />
  );
}
