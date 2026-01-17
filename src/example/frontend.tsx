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
import fragment from "./shader.glsl" with { type: "text" }

console.log("fragment", fragment)

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
    <div style={{ width: "100vw", height: "100vh" }}>
      <ReactShader fragment={fragment} running={true} uniforms={{ scale: 1.0 }} />
    </div>
  )
}
