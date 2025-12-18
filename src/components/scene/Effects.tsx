"use client";
import { EffectComposer, Bloom } from "@react-three/postprocessing";

export default function Effects() {
    return (
        <EffectComposer>
            <Bloom
                luminanceThreshold={0.2}
                mipmapBlur
                intensity={1.5}
                radius={0.8}
                levels={9}
            />
        </EffectComposer>
    );
}
