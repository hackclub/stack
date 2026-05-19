import { useEffect, useRef } from "react";
import * as THREE from "three";
import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import brickMtlUrl from "@assets/mainPage/section_1/3D_brick_fusion/brick_main.mtl?url";
import brickObjUrl from "@assets/mainPage/section_1/3D_brick_fusion/brick_main.obj?url";
export function BrickModel() {
  const containerRef = useRef(null);

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

    const handlePointerDown = (event) => {
      dragState.active = true;
      dragState.pointerId = event.pointerId;
      dragState.x = event.clientX;
      dragState.y = event.clientY;
      container.setPointerCapture(event.pointerId);
    };

    const handlePointerMove = (event) => {
      if (!dragState.active || dragState.pointerId !== event.pointerId) return;

      const deltaX = event.clientX - dragState.x;
      const deltaY = event.clientY - dragState.y;

      targetRotation.x += deltaX * 0.012;
      targetRotation.y += deltaY * 0.012;
      dragState.x = event.clientX;
      dragState.y = event.clientY;
    };

    const handlePointerUp = (event) => {
      if (dragState.pointerId !== event.pointerId) return;

      dragState.active = false;
      dragState.pointerId = null;
      if (container.hasPointerCapture(event.pointerId)) {
        container.releasePointerCapture(event.pointerId);
      }
    };

    container.addEventListener("pointerdown", handlePointerDown);
    container.addEventListener("pointermove", handlePointerMove);
    container.addEventListener("pointerup", handlePointerUp);
    container.addEventListener("pointercancel", handlePointerUp);

    const materialsLoader = new MTLLoader();
    materialsLoader.load(brickMtlUrl, (materials) => {
      if (disposed) return;

      materials.preload();

      const objectLoader = new OBJLoader();
      objectLoader.setMaterials(materials);
      objectLoader.load(brickObjUrl, (object) => {
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
    });

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
      container.removeEventListener("pointerdown", handlePointerDown);
      container.removeEventListener("pointermove", handlePointerMove);
      container.removeEventListener("pointerup", handlePointerUp);
      container.removeEventListener("pointercancel", handlePointerUp);
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
  }, []);

  return <div ref={containerRef} className="hero__brick-model" aria-label="Interactive LEGO brick model" />;
}
