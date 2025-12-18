"use client";
import { useRef, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useStore, ShapeType } from "@/app/store";

export default function ParticleField({ count = 6000 }) {
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const { targetShape, handPosition, isHandDetected, gesture } = useStore();
    const { mouse, viewport } = useThree();

    const dummy = useMemo(() => new THREE.Object3D(), []);

    // Generate a circular "glow" texture
    const texture = useMemo(() => {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
            grad.addColorStop(0, 'rgba(255,255,255,1)');
            grad.addColorStop(0.4, 'rgba(255,255,255,0.5)');
            grad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, 32, 32);
        }
        const tex = new THREE.CanvasTexture(canvas);
        return tex;
    }, []);

    // Particle state
    const particles = useMemo(() => {
        const temp = [];
        for (let i = 0; i < count; i++) {
            const x = (Math.random() - 0.5) * 20;
            const y = (Math.random() - 0.5) * 20;
            const z = (Math.random() - 0.5) * 20;
            temp.push({
                cx: x, cy: y, cz: z,
                color: new THREE.Color().setHSL(Math.random(), 0.8, 0.5)
            });
        }
        return temp;
    }, [count]);

    const colorArray = useMemo(() => new Float32Array(count * 3), [count]);

    // Rotation ref to accumulate changes
    const groupRotation = useRef(new THREE.Euler(0, 0, 0));
    const prevHandPos = useRef<[number, number, number] | null>(null);

    useFrame((state) => {
        if (!meshRef.current) return;

        const time = state.clock.getElapsedTime();

        // --- Interaction Coordinates ---
        // If hand is detected, use hand. Else use mouse.
        let ix = 0, iy = 0, iz = 0; // Interaction point
        let isInteracting = false;

        if (isHandDetected) {
            ix = handPosition[0] * 12;
            iy = handPosition[1] * 8;
            iz = 0;
            isInteracting = true;

            // --- Rotation Logic ---
            if (gesture === 'fist') {
                if (prevHandPos.current) {
                    const dx = handPosition[0] - prevHandPos.current[0];
                    const dy = handPosition[1] - prevHandPos.current[1];
                    // Rotate based on delta
                    groupRotation.current.y += dx * 2;
                    groupRotation.current.x += -dy * 2; // Inverted Y for natural feel
                }
                prevHandPos.current = [...handPosition];
            } else {
                prevHandPos.current = null; // Reset if not gripping
            }

        } else {
            // Fallback to mouse
            ix = (mouse.x * viewport.width) / 2;
            iy = (mouse.y * viewport.height) / 2;
            iz = 0;
            isInteracting = true; // Always true for mouse unless we want click?
        }

        // Apply Accumulated Rotation
        // Smoothly lerp towards target rotation? 
        // Actually we just set it since it's driven by delta.
        // Smoothing the rotation application:
        meshRef.current.rotation.x = THREE.MathUtils.lerp(meshRef.current.rotation.x, groupRotation.current.x, 0.1);
        meshRef.current.rotation.y = THREE.MathUtils.lerp(meshRef.current.rotation.y, groupRotation.current.y, 0.1);


        for (let i = 0; i < count; i++) {
            const p = particles[i];

            // 1. Target Position
            const target = getShapePosition(i, count, targetShape);

            let tx = target.x;
            let ty = target.y;
            let tz = target.z;

            // 2. Interaction (Repel/Attract)
            let forceX = 0, forceY = 0, forceZ = 0;

            // Only attract/repel if NOT rotating (fist)
            if (isInteracting && gesture !== 'fist') {
                // Apply inverse rotation to interaction point to match the rotated local space?
                // Actually, mesh rotates, so local points rotate. 
                // The interaction point (hand/mouse) is in WORLD space.
                // We need to convert World -> Local to apply forces correctly to particles in local space.
                // Simplified: Just use distance in world space by untransforming particles? Expensive.
                // Simpler: Just ignore rotation for physics or apply roughly.
                // Let's transform interaction point into local space.
                const invRot = new THREE.Euler(-meshRef.current.rotation.x, -meshRef.current.rotation.y, 0);
                const vec = new THREE.Vector3(ix, iy, iz);
                vec.applyEuler(invRot);

                const dx = vec.x - p.cx;
                const dy = vec.y - p.cy;
                const dz = vec.z - p.cz;
                const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
                if (dist < 4) {
                    const force = (4 - dist) / 4;
                    // Repel
                    forceX = -dx * force * 1.5;
                    forceY = -dy * force * 1.5;
                    forceZ = -dz * force * 1.5;
                }
            }

            // 3. Update Position
            const noiseX = Math.sin(time + i * 0.1) * 0.05;
            const noiseY = Math.cos(time + i * 0.2) * 0.05;

            // "Star" physics - slightly more jittery/energetic?
            p.cx += (tx + forceX - p.cx) * 0.04 + noiseX;
            p.cy += (ty + forceY - p.cy) * 0.04 + noiseY;
            p.cz += (tz + forceZ - p.cz) * 0.04;

            // 4. Matrix Update
            dummy.position.set(p.cx, p.cy, p.cz);

            // Scale based on "life" or sparkle
            // Add random sparkle
            const sparkle = Math.random() > 0.98 ? 1.5 : 1;
            const scale = (0.5 + Math.sin(time * 3 + i) * 0.3) * sparkle; // Smaller base size for stars
            dummy.scale.setScalar(scale);

            // Always face camera (billboard) if using planes? 
            // We are using Spheres, but they are small.
            // Actually points might be better for 6000 "stars" but InstancedMesh of planes/spheres allows nicer materials.
            // Let's stick to spheres but smaller.

            dummy.updateMatrix();
            meshRef.current.setMatrixAt(i, dummy.matrix);

            // 5. Color Update
            const targetColor = getShapeColor(targetShape, i, count);
            // Additive Blend needs darker colors to not blow out white
            // p.color.lerp(targetColor, 0.05);
            // Start sparkle: Flash white
            if (Math.random() > 0.99) {
                p.color.setHex(0xffffff);
            } else {
                p.color.lerp(targetColor, 0.1);
            }

            colorArray[i * 3] = p.color.r;
            colorArray[i * 3 + 1] = p.color.g;
            colorArray[i * 3 + 2] = p.color.b;
        }

        meshRef.current.instanceMatrix.needsUpdate = true;
        if (meshRef.current.instanceColor) {
            meshRef.current.instanceColor.needsUpdate = true;
        }
    });

    return (
        <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
            {/* Use a Plane for texture or Sphere? Sphere is easier to manage without billboard logic for now. 
          To make it look like a star, we should use a plane that always faces camera. 
          Or just a high-emissive sphere. 
          Let's use a Sphere but with our generated texture mapped? 
          Mapping texture to sphere looks weird.
          Let's try standard material but with high emissive.
      */}
            <sphereGeometry args={[0.05, 6, 6]}>
                <instancedBufferAttribute attach="attributes-color" args={[colorArray, 3]} />
            </sphereGeometry>
            {/* Additive Blending for Glow */}
            <meshStandardMaterial
                vertexColors
                toneMapped={false}
                emissiveIntensity={4} // High intensity for bloom
                blending={THREE.AdditiveBlending}
                depthWrite={false} // Important for additive transparency stacking
                transparent
                opacity={0.8}
                color="#fff" // base tint
            />
        </instancedMesh>
    );
}

const tempColor = new THREE.Color();

// Copied shape algorithms, preserving them
function getShapePosition(i: number, count: number, shape: ShapeType): { x: number, y: number, z: number } {
    const r = 5;

    if (shape === 'sphere') {
        const phi = Math.acos(-1 + (2 * i) / count);
        const theta = Math.sqrt(count * Math.PI) * phi;
        return {
            x: r * Math.sin(phi) * Math.cos(theta),
            y: r * Math.sin(phi) * Math.sin(theta),
            z: r * Math.cos(phi)
        };
    }

    // ... (rest of shapes same as before, just ensuring we have the code)
    if (shape === 'cube') {
        const cbrt = Math.ceil(Math.pow(count, 1 / 3));
        const spacing = 7 / cbrt * 2; // Slightly larger for stars
        const ix = i % cbrt;
        const iy = Math.floor(i / cbrt) % cbrt;
        const iz = Math.floor(i / (cbrt * cbrt));
        return {
            x: ix * spacing - 7,
            y: iy * spacing - 7,
            z: iz * spacing - 7
        };
    }

    if (shape === 'heart') {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI;

        // Random point on sphere
        // Then deform to heart?
        // Better: Rejection sampling for volume
        // (x^2 + 9/4y^2 + z^2 - 1)^3 - x^2z^3 - 9/80y^2z^3 < 0
        // Bounds: x: -1.5..1.5, y: -1.5..1.5, z: -1.5..1.5

        // Doing rejection sampling in a loop is expensive for 6000 particles every frame?
        // Actually this `getShapePosition` is called every frame? No, `target` is calculated every frame! 
        // WAIT. `getShapePosition` implementation shown in `view_file` takes `i` and `count`. 
        // It's deterministic based on `i`. We cannot use `Math.random()` inside it if we want stability!
        // If we use random, particles will jitter wildly every frame.
        // We MUST use `i` to determine position.

        // Deterministic approach:
        // Use the parametric surface method but better distributed.
        // x = 16sin^3(t) 
        // y = 13cos(t) - 5cos(2t) ...
        // This is 2D outline. 
        // Let's use the current layered approach but adding noise or thickness based on `i`.

        const t = (i / count) * Math.PI * 2;
        const x = 16 * Math.pow(Math.sin(t), 3);
        const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);

        // Add volume: z depends on how "deep" we are in the heart
        // Simple scale + noise
        // Let's make it a thick outline instead of a solid volume if volume is too hard deterministically.
        // Or distribute `i` across multiple "shells" of the heart.

        const shell = (i % 6) + 1; // 1 to 6 shells
        const scale = shell * 0.15;

        const xFinal = x * scale;
        const yFinal = y * scale + 2; // Bias Y to center
        const zFinal = (Math.sin(i) * 2) * scale; // Random-ish depth based on index

        return { x: xFinal * 0.5, y: yFinal * 0.5, z: zFinal * 0.5 };
    }

    if (shape === 'flower') {
        const phi = (i / count) * Math.PI * 20;
        const k = 4;
        const r_flower = 6 * Math.cos(k * phi);
        const x = r_flower * Math.cos(phi);
        const y = r_flower * Math.sin(phi);
        const z = (i / count) * 6 - 3;
        return { x, y, z };
    }

    if (shape === 'saturn') {
        if (i < count * 0.6) {
            const idx = i;
            const subCount = count * 0.6;
            const phi = Math.acos(-1 + (2 * idx) / subCount);
            const theta = Math.sqrt(subCount * Math.PI) * phi;
            return {
                x: 3 * Math.sin(phi) * Math.cos(theta),
                y: 3 * Math.sin(phi) * Math.sin(theta),
                z: 3 * Math.cos(phi)
            };
        } else {
            const idx = i - count * 0.6;
            const subCount = count * 0.4;
            const angle = (idx / subCount) * Math.PI * 2 * 10;
            const rStable = 4.5 + ((i * 132.1) % 200) / 100 * 2.5;
            return {
                x: rStable * Math.cos(angle),
                y: rStable * Math.sin(angle) * 0.2,
                z: rStable * Math.sin(angle)
            };
        }
    }

    if (shape === 'firework') {
        const r = ((i * 12.34) % 15) + 2;
        const phi = Math.acos(-1 + (2 * i) / count);
        const theta = Math.sqrt(count * Math.PI) * phi;
        return {
            x: r * Math.sin(phi) * Math.cos(theta),
            y: r * Math.sin(phi) * Math.sin(theta),
            z: r * Math.cos(phi)
        };
    }

    // Default Random Cloud
    const s = i * 0.5;
    return {
        x: Math.sin(s * 1.1) * 7,
        y: Math.cos(s * 1.3) * 7,
        z: Math.sin(s * 1.7) * 7
    };
}

function getShapeColor(shape: ShapeType, i: number, count: number) {
    if (shape === 'heart') return tempColor.setHSL(0.9 + Math.random() * 0.1, 0.9, 0.6);
    if (shape === 'saturn') return tempColor.setHSL(0.1 + ((i * 0.01) % 0.1), 0.9, 0.6);
    if (shape === 'flower') return tempColor.setHSL(0.55 + Math.random() * 0.3, 0.9, 0.6);
    if (shape === 'firework') return tempColor.setHSL(Math.random(), 1, 0.6);
    return tempColor.setHSL(0.6, 0.9, 0.7);
}
