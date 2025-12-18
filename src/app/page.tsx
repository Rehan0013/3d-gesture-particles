"use client";
import dynamic from 'next/dynamic';

const Scene = dynamic(() => import('@/components/scene/Scene'), { ssr: false });
const HandTracker = dynamic(() => import('@/components/tracking/HandTracker'), { ssr: false });
import { useStore } from './store';

export default function Home() {
  const { targetShape, setTargetShape } = useStore();

  return (
    <main className="relative w-full h-screen bg-black overflow-hidden">
      <Scene />
      <HandTracker />

      {/* UI Overlay */}
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-2 p-4 pointer-events-none">
        <h1 className="text-2xl font-bold gradient-text">
          Stellar Particles
        </h1>
        <p className="text-sm text-gray-400" style={{ maxWidth: '300px' }}>
          <span className="text-white font-bold">Gestures:</span><br />
          ✊ <span className="text-white">Fist</span>: Grab & Rotate<br />
          👌 <span className="text-white">Pinch (Index)</span>: Heart Shape<br />
          🤏 <span className="text-white">Pinch (Middle)</span>: Saturn<br />
          ✌️ <span className="text-white">Victory (Index + Middle extended)</span>: Flower<br />
          ☝️ <span className="text-white">Pointer (Index extended only)</span>: Firework<br />
          🖐 <span className="text-white">Open Hand</span>: Interact/Repel
        </p>

        <div className="flex flex-wrap gap-2 pointer-events-auto" style={{ marginTop: '1rem' }}>
          {['sphere', 'cube', 'heart', 'flower', 'saturn', 'firework', 'random'].map((shape) => (
            <button
              key={shape}
              onClick={() => setTargetShape(shape as any)}
              className={`button-base rounded-full text-xs border backdrop-blur-md ${targetShape === shape
                ? 'bg-white text-black border-white shadow-[0_0_15px_rgba(255,255,255,0.5)]'
                : 'bg-black/30 text-white/70 border-white/20 hover:bg-white/10 hover:border-white/50'
                }`}
              style={{ padding: '0.4rem 1rem', transition: 'all 0.3s ease' }}
            >
              {shape.charAt(0).toUpperCase() + shape.slice(1)}
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}
