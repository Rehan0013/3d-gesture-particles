import { create } from 'zustand';

export type ShapeType = 'sphere' | 'cube' | 'heart' | 'flower' | 'saturn' | 'firework' | 'random';

interface AppState {
  handPosition: [number, number, number]; // Normalized -1 to 1
  isHandDetected: boolean;
  gesture: string | null;
  rotation: [number, number]; // [y, x] rotation angles
  targetShape: ShapeType;
  setHandPosition: (pos: [number, number, number]) => void;
  setHandDetected: (detected: boolean) => void;
  setGesture: (gesture: string | null) => void;
  setRotation: (rot: [number, number]) => void;
  setTargetShape: (shape: ShapeType) => void;
}

export const useStore = create<AppState>((set) => ({
  handPosition: [0, 0, 0],
  isHandDetected: false,
  gesture: null,
  targetShape: 'sphere',
  rotation: [0, 0],
  setHandPosition: (pos) => set({ handPosition: pos }),
  setHandDetected: (detected) => set({ isHandDetected: detected }),
  setGesture: (gesture) => set({ gesture }),
  setRotation: (rot) => set({ rotation: rot }),
  setTargetShape: (shape) => set({ targetShape: shape }),
}));
