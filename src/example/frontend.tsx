/**
 * This file is the entry point for the React app, it sets up the root
 * element and renders the App component to the DOM.
 *
 * It is included in `src/index.html`.
 */

import { StrictMode, useState } from "react"
import { createRoot } from "react-dom/client"
import "./style.css"
import { WebGlDemo } from "./examples/webgl"
import { WebGpuDemo } from "./examples/webgpu"

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

type Demo = "webgl" | "webgpu"

export function App() {
  const [demo, setDemo] = useState<Demo>("webgpu")

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative" }}>
      <div style={{ position: "absolute", top: 20, left: 20, zIndex: 100 }}>
        <button
          type="button"
          onClick={() => setDemo("webgl")}
          style={{ marginRight: 10, opacity: demo === "webgl" ? 1 : 0.5 }}
        >
          WebGL
        </button>
        <button
          type="button"
          onClick={() => setDemo("webgpu")}
          style={{ marginRight: 10, opacity: demo === "webgpu" ? 1 : 0.5 }}
        >
          WebGPU
        </button>
      </div>
      {demo === "webgl" && <WebGlDemo />}
      {demo === "webgpu" && <WebGpuDemo />}
    </div>
  )
}
