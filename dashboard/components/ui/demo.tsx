'use client'

import { SplineScene } from "@/components/ui/splite";
import { Card } from "@/components/ui/card"
import { Spotlight } from "@/components/ui/spotlight"
import { useEffect, useState } from "react"

// Tailwind's `md` breakpoint. Below it the scene's column is display:none, and a
// mounted Spline canvas would keep rendering into a 0x0 surface (WebGPU errors).
const MD_QUERY = "(min-width: 768px)"

function useIsMdUp() {
  const [isMdUp, setIsMdUp] = useState(false)
  useEffect(() => {
    const mql = window.matchMedia(MD_QUERY)
    setIsMdUp(mql.matches)
    const onChange = (e: MediaQueryListEvent) => setIsMdUp(e.matches)
    mql.addEventListener("change", onChange)
    return () => mql.removeEventListener("change", onChange)
  }, [])
  return isMdUp
}

export function SplineSceneBasic() {
  const isMdUp = useIsMdUp()

  return (
    <div className="w-full h-full bg-black/[0.96] relative overflow-hidden">
      <Spotlight
        className="-top-40 left-0 md:left-60 md:-top-20"
      />
      
      <div className="flex h-full">
        {/* Left content */}
        <div className="flex-1 p-8 md:p-12 relative z-10 flex flex-col justify-center items-center text-center">
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-neutral-50 to-neutral-400" style={{ letterSpacing: '-0.03em', lineHeight: 1.05 }}>
            NetWatch AI SOC
          </h1>
          <p className="mt-8 text-neutral-300 max-w-2xl text-xl md:text-2xl">
            Real-time network intrusion detection with explainable alerts.
            Dual-engine threat scoring paired with interactive MITRE ATT&CK telemetry.
          </p>
          <div className="mt-10 flex gap-4">
            <a href="/dashboard" className="px-8 py-4 rounded-full bg-white font-semibold text-base hover:bg-neutral-200 transition-colors" style={{ color: '#000000' }}>
              Launch Dashboard →
            </a>
          </div>
        </div>

        {/* Right content */}
        <div className="flex-1 relative hidden md:block">
          {isMdUp && (
            <SplineScene
              scene="https://prod.spline.design/kZDDjO5HuC9GJUM2/scene.splinecode"
              className="w-full h-full"
            />
          )}
        </div>
      </div>
    </div>
  )
}
