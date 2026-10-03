'use client'

import { Suspense, lazy, useRef, useCallback } from 'react'
import type { Application } from '@splinetool/runtime'

const Spline = lazy(() => import('@splinetool/react-spline'))

interface SplineSceneProps {
  scene: string
  className?: string
  style?: React.CSSProperties
  zoom?: number | 'auto'
  onLoad?: (spline: Application) => void
}

export function SplineScene({ scene, className, style, zoom = 'auto', onLoad }: SplineSceneProps) {
  const splineRef = useRef<Application | null>(null)

  const applyFraming = useCallback((app: any) => {
    if (!app) return
    try {
      const canvas = app.canvas as HTMLCanvasElement | undefined
      const width = canvas?.clientWidth || (typeof window !== 'undefined' ? window.innerWidth / 2 : 800)
      const height = canvas?.clientHeight || (typeof window !== 'undefined' ? window.innerHeight : 800)
      const aspect = width / Math.max(height, 1)

      let targetZoom: number
      if (typeof zoom === 'number') {
        targetZoom = zoom
      } else {
        // When container is wide landscape (robot placed on top full-width, aspect >= 1.3),
        // container height is the primary constraint. We scale zoom to comfortably
        // frame the robot's head, arms, and upper body vertically.
        // For narrower / portrait containers (split column or mobile),
        // container width is the constraint so outstretched arms/hands don't clip.
        if (aspect >= 1.3) {
          targetZoom = Math.min(0.72, Math.max(0.55, 0.52 + (height / 800) * 0.20))
        } else {
          targetZoom = Math.min(0.82, Math.max(0.55, (width / 1000) * 0.80))
        }
      }

      // 1. Spline API setZoom (updates orbitControls if present)
      if (typeof app.setZoom === 'function') {
        try {
          app.setZoom(targetZoom)
        } catch {}
      }

      // 2. Camera zoom on all active & scene cameras
      const cameras: any[] = []
      if (app._camera) cameras.push(app._camera)
      if (app._scene?.activeCamera && !cameras.includes(app._scene.activeCamera)) {
        cameras.push(app._scene.activeCamera)
      }
      if (app._scene?.traverse) {
        try {
          app._scene.traverse((obj: any) => {
            if (obj && (obj.isCamera || obj.isPerspectiveCamera || obj.isOrthographicCamera)) {
              if (!cameras.includes(obj)) cameras.push(obj)
            }
          })
        } catch {}
      }

      cameras.forEach((cam) => {
        try {
          cam.zoom = targetZoom
          if (typeof cam.updateProjectionMatrix === 'function') {
            cam.updateProjectionMatrix()
          }
        } catch {}
      })

      // 3. Request render update
      if (typeof app.requestRender === 'function') {
        try {
          app.requestRender()
        } catch {}
      }
    } catch (err) {
      console.warn('Spline framing adjustment notice:', err)
    }
  }, [zoom])

  const handleSplineLoad = useCallback((app: Application) => {
    splineRef.current = app

    // Initial framing
    applyFraming(app)

    // Staggered retries for Spline internal scene initialization passes
    const t1 = setTimeout(() => applyFraming(app), 150)
    const t2 = setTimeout(() => applyFraming(app), 500)

    // Window resize listener
    const onResize = () => applyFraming(app)
    window.addEventListener('resize', onResize)

    // ResizeObserver on canvas container
    let ro: ResizeObserver | null = null
    const canvasParent = (app as any).canvas?.parentElement
    if (typeof ResizeObserver !== 'undefined' && canvasParent) {
      ro = new ResizeObserver(() => applyFraming(app))
      ro.observe(canvasParent)
    }

    onLoad?.(app)

    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      window.removeEventListener('resize', onResize)
      ro?.disconnect()
    }
  }, [applyFraming, onLoad])

  return (
    <Suspense 
      fallback={
        <div className="w-full h-full flex items-center justify-center">
          <span className="loader"></span>
        </div>
      }
    >
      <Spline
        scene={scene}
        className={className}
        style={style}
        onLoad={handleSplineLoad}
      />
    </Suspense>
  )
}

