'use client'

import { SplineScene } from "@/components/ui/splite";
import { Card } from "@/components/ui/card"
import { Spotlight } from "@/components/ui/spotlight"
 
export function SplineSceneBasic() {
  return (
    <Card className="w-full h-[500px] bg-black/[0.96] relative overflow-hidden" style={{ borderColor: 'rgba(255, 255, 255, 0.1)', borderRadius: '24px' }}>
      <Spotlight
        className="-top-40 left-0 md:left-60 md:-top-20"
        fill="white"
      />
      
      <div className="flex h-full">
        {/* Left content */}
        <div className="flex-1 p-8 md:p-12 relative z-10 flex flex-col justify-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-neutral-50 to-neutral-400" style={{ letterSpacing: '-0.02em', lineHeight: 1.1 }}>
            NetWatch AI SOC
          </h1>
          <p className="mt-6 text-neutral-300 max-w-lg text-lg">
            Real-time network intrusion detection with explainable alerts.
            Dual-engine threat scoring paired with interactive MITRE ATT&CK telemetry.
          </p>
          <div className="mt-8 flex gap-4">
            <a href="/dashboard" className="px-6 py-3 rounded-full bg-white text-black font-semibold text-sm hover:bg-neutral-200 transition-colors">
              Launch Dashboard →
            </a>
          </div>
        </div>

        {/* Right content */}
        <div className="flex-1 relative hidden md:block">
          <SplineScene 
            scene="https://prod.spline.design/kZDDjO5HuC9GJUM2/scene.splinecode"
            className="w-full h-full"
          />
        </div>
      </div>
    </Card>
  )
}
