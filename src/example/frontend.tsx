/**
 * This file is the entry point for the React app, it sets up the root
 * element and renders the App component to the DOM.
 *
 * It is included in `src/index.html`.
 */

import { StrictMode } from "react"
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
  return (
    <div style={{ width: "800px", height: "600px" }}>
      <ReactShader
        fragment={fragment}
        timeScale={1.2}
        fullscreen={true}
        uniforms={{
          scale: 1,
          iterations: 1,
          fractMultiplier: 1,
          waveLength: 10,
          edgeBlur: 0.01,
          contrast: 0.5,
          noiseScale: 1,
          noiseMultiplier: 0.1,
        }}
      />
    </div>
  )
}
