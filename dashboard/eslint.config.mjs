import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Next's rules plus React's hook rules: the stale-closure and effect bugs the
// dashboard shipped with (a modal that reopened, a feed that resubscribed on
// every render) are what react-hooks/exhaustive-deps flags.
const config = [
  ...nextVitals,
  ...nextTs,
  { ignores: [".next/**", "node_modules/**", "next-env.d.ts"] },
  {
    // The landing page's robot reaches into Spline's untyped scene internals and
    // waits for mount before loading the canvas. It is kept as it is.
    files: ["components/ui/splite.tsx", "components/ui/demo.tsx"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
];

export default config;
