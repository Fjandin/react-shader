/**
 * This file is the entry point for the React app, it sets up the root
 * element and renders the App component to the DOM.
 *
 * It is included in `src/index.html`.
 */

import { StrictMode, useState } from "react"
import { createRoot } from "react-dom/client"
import "./style.css"
import { ReactShader } from "../ReactShader"
import { fragment } from "./shader"

// biome-ignore lint/style/noNonNullAssertion: Allow
const elem = document.getElementById("root")!
const app = (
  <StrictMode>
    <App />
  </StrictMode>
)

if (import.meta.hot) {
  // With hot module reloading, `import.meta.hot.data` is persisted.
  // biome-ignore lint/suspicious/noAssignInExpressions: Allow
  const root = (import.meta.hot.data.root ??= createRoot(elem))
  root.render(app)
} else {
  // The hot module reloading API is not available in production.
  createRoot(elem).render(app)
}

export function App() {
  const [rippleRadius, setRippleRadius] = useState(0)
  const [rippleIntensity, setRippleIntensity] = useState(1)
  const [iTime2, setITime2] = useState(0)
  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative" }}>
      <div
        style={{ position: "absolute", top: 0, left: 0, fontSize: "20px", fontWeight: "bold", marginBottom: "100px" }}
      >
        <div>{rippleRadius}</div>
        <div>/</div>
        <div>{rippleIntensity}</div>
      </div>
      <ReactShader
        fragment={fragment}
        timeScale={0.5}
        uniforms={{
          iTime2: 0,
          scale: 1,
          iterations: 2,
          fractMultiplier: 2,
          waveLength: 10,
          edgeBlur: 0.01,
          contrast: 2,
          noiseScale: 0.1,
          noiseMultiplier: 0.2,
          ripples: [[0.1, 0.1, rippleRadius * 0.5, rippleIntensity * 0.5]],
        }}
        onFrame={(info) => {
          setITime2(iTime2 + info.deltaTime * 0.2)
          let newRippleTime = rippleRadius + info.deltaTime * 0.2
          if (newRippleTime > 1) {
            newRippleTime = newRippleTime - 1
          }
          setRippleIntensity(Math.abs(newRippleTime - 1))
          setRippleRadius(newRippleTime)
        }}
      />
    </div>
  )
}
