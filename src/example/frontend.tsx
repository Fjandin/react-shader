/**
 * This file is the entry point for the React app, it sets up the root
 * element and renders the App component to the DOM.
 *
 * It is included in `src/index.html`.
 */

import { StrictMode, useState } from "react"
import { createRoot } from "react-dom/client"
import "./style.css"
import { WebGpuMandelbrotDemo } from "./examples/mandelbrot"
import { WebGpuMandelbrotDemo2 } from "./examples/mandelbrot2"
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

type Demo = "webgpu" | "mandelbrot" | "mandelbrot2"

export function App() {
  const [demo, setDemo] = useState<Demo>("webgpu")

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative" }}>
      <div style={{ position: "absolute", top: 20, left: 20, zIndex: 100 }}>
        <button
          type="button"
          onClick={() => setDemo("webgpu")}
          style={{ marginRight: 10, opacity: demo === "webgpu" ? 1 : 0.5 }}
        >
          WebGPU
        </button>
        <button
          type="button"
          onClick={() => setDemo("mandelbrot")}
          style={{ marginRight: 10, opacity: demo === "mandelbrot" ? 1 : 0.5 }}
        >
          Mandelbrot
        </button>
        <button
          type="button"
          onClick={() => setDemo("mandelbrot2")}
          style={{ marginRight: 10, opacity: demo === "mandelbrot2" ? 1 : 0.5 }}
        >
          Mandelbrot2
        </button>
      </div>
      {demo === "webgpu" && <WebGpuDemo />}
      {demo === "mandelbrot" && <WebGpuMandelbrotDemo />}
      {demo === "mandelbrot2" && <WebGpuMandelbrotDemo2 />}
    </div>
  )
}
