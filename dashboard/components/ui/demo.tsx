'use client'

import { SplineScene } from "@/components/ui/splite";
import { Spotlight } from "@/components/ui/spotlight";
import { useEffect, useRef, useState } from "react";

export function SplineSceneBasic() {
  const [isMounted, setIsMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const splineAppRef = useRef<any>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Forward pointer moves across the hero area to Spline's canvas
  // so the 3D robot tracks mouse movement even when hovering over text/buttons below
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handlePointerMove = (e: PointerEvent) => {
      const canvas = splineAppRef.current?.canvas as HTMLCanvasElement | undefined;
      if (canvas && e.target !== canvas && !canvas.contains(e.target as Node)) {
        try {
          const synthetic = new PointerEvent("pointermove", {
            clientX: e.clientX,
            clientY: e.clientY,
            screenX: e.screenX,
            screenY: e.screenY,
            bubbles: true,
            cancelable: true,
            pointerId: e.pointerId,
            pointerType: e.pointerType,
          });
          canvas.dispatchEvent(synthetic);
        } catch {}
      }
    };

    container.addEventListener("pointermove", handlePointerMove);
    return () => container.removeEventListener("pointermove", handlePointerMove);
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-full h-full bg-black/[0.96] relative overflow-hidden flex items-center justify-center"
    >
      <Spotlight
        className="-top-40 left-0 md:left-60 md:-top-20"
        size={400}
      />

      {/* ── 3D Robot Layer: spans behind the text with transparent overlay ── */}
      <div className="absolute inset-0 w-full h-full z-0 overflow-hidden pointer-events-auto flex items-center justify-center">
        <div className="w-full h-full md:translate-x-[7%] lg:translate-x-[9%] flex items-center justify-center">
          {isMounted && (
            <SplineScene
              scene="https://prod.spline.design/kZDDjO5HuC9GJUM2/scene.splinecode"
              className="w-full h-full"
              onLoad={(app) => {
                splineAppRef.current = app;
              }}
            />
          )}
        </div>
      </div>

      {/* ── Foreground Text Layer: 100% transparent background so robot hands are visible behind ── */}
      <div className="w-full max-w-[1280px] mx-auto px-6 sm:px-8 lg:px-12 h-full flex items-center relative z-10 pointer-events-none">
        <div className="max-w-xl lg:max-w-2xl flex flex-col justify-center items-start text-left py-12 pointer-events-none bg-transparent">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-black/40 border border-white/15 text-xs font-semibold text-neutral-200 mb-6 backdrop-blur-md pointer-events-auto shadow-lg shadow-black/30">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" />
            AI SEC-OPS TELEMETRY
          </div>

          <h1
            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-white via-neutral-100 to-neutral-400 select-none drop-shadow-[0_4px_24px_rgba(0,0,0,0.9)]"
            style={{ letterSpacing: "-0.03em", lineHeight: 1.08 }}
          >
            NetWatch AI SOC
          </h1>

          <p className="mt-6 text-neutral-200 text-base sm:text-lg lg:text-xl leading-relaxed max-w-xl select-none drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)]">
            Real-time network intrusion detection with explainable alerts.
            Dual-engine threat scoring paired with interactive MITRE ATT&amp;CK telemetry.
          </p>

          <div className="mt-8 flex flex-wrap gap-4 items-center pointer-events-auto">
            <a
              href="/dashboard"
              className="px-8 py-3.5 rounded-full bg-white font-semibold text-base hover:bg-neutral-200 transition-colors shadow-2xl shadow-black/60 hover:scale-[1.02] active:scale-[0.98] transition-transform"
              style={{ color: "#000000" }}
            >
              Launch Dashboard →
            </a>
            <a
              href="/evaluation"
              className="px-6 py-3.5 rounded-full bg-black/40 hover:bg-white/[0.12] border border-white/15 font-semibold text-base text-neutral-200 transition-colors backdrop-blur-md hover:scale-[1.02] active:scale-[0.98] transition-transform"
            >
              View Proof
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
