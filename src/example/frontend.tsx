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
  const [iTime2, setITime2] = useState(0)
  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative" }}>
      <div style={{ fontSize: "20px", fontWeight: "bold", marginBottom: "100px" }}>Shader example</div>
      <ReactShader
        fragment={fragment}
        timeScale={1}
        uniforms={{
          iTime2: iTime2,
          scale: 1,
          iterations: 2,
          fractMultiplier: 1,
          waveLength: 10,
          edgeBlur: 0.06,
          contrast: 2,
          noiseScale: 0.3,
          noiseMultiplier: 0.5,
        }}
        onFrame={(info) => {
          setITime2(iTime2 + info.deltaTime * 0.2)
        }}
      />
    </div>
  )
}
