"use client";

import { ReactLenis } from "lenis/react";
import { ReactNode } from "react";

interface SmoothScrollProps {
  children: ReactNode;
}

/**
 * SmoothScroll component powered by lenis.dev (Studio Freight / Darkroom Engineering).
 * Provides hardware-accelerated, inertial smooth scrolling for the entire application.
 */
export default function SmoothScroll({ children }: SmoothScrollProps) {
  return (
    <ReactLenis
      root
      options={{
        lerp: 0.09,
        duration: 1.2,
        smoothWheel: true,
        wheelMultiplier: 1,
        touchMultiplier: 1.2,
        infinite: false,
      }}
    >
      {children}
    </ReactLenis>
  );
}
