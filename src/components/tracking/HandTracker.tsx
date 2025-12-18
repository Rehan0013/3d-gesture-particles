"use client";
import { useEffect, useRef } from "react";
import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import { useStore } from "@/app/store";

export default function HandTracker() {
    const videoRef = useRef<HTMLVideoElement>(null);
    const { setHandPosition, setHandDetected, setGesture, setTargetShape, setRotation } = useStore();
    const prevHandPos = useRef<[number, number, number] | null>(null);
    const gestureHistory = useRef<string[]>([]); // Buffer for debouncing

    useEffect(() => {
        let handLandmarker: HandLandmarker | null = null;
        let animationFrameId: number;

        const setup = async () => {
            const vision = await FilesetResolver.forVisionTasks(
                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
            );
            handLandmarker = await HandLandmarker.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
                    delegate: "GPU",
                },
                runningMode: "VIDEO",
                numHands: 1,
            });

            startWebcam();
        };

        const startWebcam = async () => {
            if (!videoRef.current) return;
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { width: 640, height: 480 },
                });
                videoRef.current.srcObject = stream;
                videoRef.current.addEventListener("loadeddata", predictWebcam);
            } catch (err) {
                console.error("Error accessing webcam:", err);
            }
        };

        const predictWebcam = () => {
            if (!handLandmarker || !videoRef.current) return;

            if (videoRef.current.videoWidth === 0) {
                animationFrameId = requestAnimationFrame(predictWebcam);
                return;
            }

            let startTimeMs = performance.now();
            const results = handLandmarker.detectForVideo(videoRef.current, startTimeMs);

            if (results.landmarks.length > 0) {
                setHandDetected(true);
                const landmarks = results.landmarks[0];

                // Coordinates
                const x = (landmarks[8].x - 0.5) * 2;
                const y = -(landmarks[8].y - 0.5) * 2;
                const currentPos: [number, number, number] = [-x, y, 0];

                setHandPosition(currentPos);
                detectLogic(landmarks, currentPos);
                prevHandPos.current = currentPos;
            } else {
                setHandDetected(false);
                prevHandPos.current = null;
                gestureHistory.current = []; // Reset history
            }

            animationFrameId = requestAnimationFrame(predictWebcam);
        };

        const detectLogic = (landmarks: any[], currentPos: [number, number, number]) => {
            const wrist = landmarks[0];

            // Helper: Relative distance check for extension
            // Finger is extended if Tip is significantly further from Wrist than PIP
            const isExtended = (tipIdx: number, pipIdx: number) => {
                const dTip = Math.hypot(landmarks[tipIdx].x - wrist.x, landmarks[tipIdx].y - wrist.y);
                const dPip = Math.hypot(landmarks[pipIdx].x - wrist.x, landmarks[pipIdx].y - wrist.y);
                return dTip > (dPip * 1.15);
            };

            // Thumb specific
            const isThumbExtended = (tipIdx: number, ipIdx: number) => {
                const dTip = Math.hypot(landmarks[tipIdx].x - wrist.x, landmarks[tipIdx].y - wrist.y);
                const dIp = Math.hypot(landmarks[ipIdx].x - wrist.x, landmarks[ipIdx].y - wrist.y);
                return dTip > (dIp * 1.15);
            };

            const thumbExt = isThumbExtended(4, 2);
            const indexExt = isExtended(8, 6);
            const middleExt = isExtended(12, 10);
            const ringExt = isExtended(16, 14);
            const pinkyExt = isExtended(20, 18);

            let detectedGesture = "open";
            let detectedShape = "";

            const extendedCount = [indexExt, middleExt, ringExt, pinkyExt].filter(Boolean).length + (thumbExt ? 1 : 0);

            // Logic Priority
            // 1. PINCH (Heart) - Thumb + Index close
            if (Math.hypot(landmarks[4].x - landmarks[8].x, landmarks[4].y - landmarks[8].y) < 0.05) {
                detectedGesture = "pinch";
                detectedShape = "heart";
            }
            // 2. PINCH (Saturn) - Thumb + Middle close
            else if (Math.hypot(landmarks[4].x - landmarks[12].x, landmarks[4].y - landmarks[12].y) < 0.05) {
                detectedGesture = "pinch";
                detectedShape = "saturn";
            }
            // 3. FIST
            else if (extendedCount === 0 || (extendedCount === 1 && thumbExt)) {
                detectedGesture = "fist";
            }
            // 4. VICTORY (Flower)
            else if (indexExt && middleExt && !ringExt && !pinkyExt) {
                detectedGesture = "victory";
                detectedShape = "flower";
            }
            // 5. POINTER (Firework)
            else if (indexExt && !middleExt && !ringExt && !pinkyExt) {
                detectedGesture = "pointer";
                detectedShape = "firework";
            }
            // 6. THREE (Cube)
            else if (indexExt && middleExt && ringExt && !pinkyExt) {
                detectedGesture = "three";
                detectedShape = "cube";
            }
            // 7. OPEN (Sphere)
            else if (extendedCount >= 4) {
                detectedGesture = "open";
                detectedShape = "sphere";
            }

            // Debouncing
            gestureHistory.current.push(detectedShape || detectedGesture);
            if (gestureHistory.current.length > 10) gestureHistory.current.shift(); // Increase buffer for stability

            // Strict Consistency Check
            // Require at least 8 frames of consistency
            const counts: Record<string, number> = {};
            gestureHistory.current.forEach(g => { counts[g] = (counts[g] || 0) + 1; });

            // Find dominant gesture
            let maxCount = 0;
            let dominant = "";
            for (const g in counts) {
                if (counts[g] > maxCount) {
                    maxCount = counts[g];
                    dominant = g;
                }
            }

            // If strictly dominant (> 80%)
            if (maxCount > gestureHistory.current.length * 0.8 && gestureHistory.current.length > 5) {
                if (dominant === 'fist') {
                    setGesture('fist');
                } else {
                    setGesture('open');
                    if (['heart', 'saturn', 'flower', 'firework', 'cube', 'sphere'].includes(dominant)) {
                        setTargetShape(dominant as any);
                    }
                }
            }
        };

        setup();

        return () => {
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
            handLandmarker?.close();
            if (videoRef.current && videoRef.current.srcObject) {
                const stream = videoRef.current.srcObject as MediaStream;
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, [setHandDetected, setHandPosition, setGesture, setTargetShape, setRotation]);

    return (
        <div className="fixed bottom-4 right-4 z-50 pointer-events-none">
            <video
                ref={videoRef}
                autoPlay
                playsInline
                className="tracker-video rounded-xl border"
                muted
            />
            <div className="absolute bottom-full mb-2 right-0 text-xs text-white bg-black-50 px-2 py-1 rounded-lg">
                Tracking Active
            </div>
        </div>
    );
}
