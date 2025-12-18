"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment } from "@react-three/drei";
import { Suspense } from "react";
import ParticleField from "./ParticleField";
import Effects from "./Effects";

export default function Scene() {
    return (
        <div className="absolute inset-0 z-0">
            <Canvas
                camera={{ position: [0, 0, 22], fov: 45 }}
                dpr={[1, 2]}
                gl={{ antialias: false, alpha: false, stencil: false, depth: false }}
            >
                <color attach="background" args={['#000000']} />

                <Suspense fallback={null}>
                    <ParticleField count={6000} />
                    <Effects />
                    <Environment preset="city" />
                </Suspense>

                <OrbitControls makeDefault enableZoom={false} enablePan={false} maxPolarAngle={Math.PI / 1.5} minPolarAngle={Math.PI / 3} />
            </Canvas>
        </div>
    );
}
