/**
 * This file is the entry point for the React app, it sets up the root
 * element and renders the App component to the DOM.
 *
 * It is included in `src/index.html`.
 */

import { StrictMode, useCallback, useRef, useState } from "react"
import { createRoot } from "react-dom/client"
import "./style.css"
import type { FrameInfo } from "../hooks/useWebGL"
import { ReactShader } from "../ReactShader"
import type { Vec4, Vec4Array } from "../types"
import { log } from "./lib/logger"
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
  const ripplesRef = useRef<Vec4Array>([[0, 0, 0, 0]])
  const [ripples, setRipples] = useState<Vec4Array>([[0, 0, 0, 0]])
  const lastMouseMoveRef = useRef<number>(0)

  const onMouseMove = useCallback((info: FrameInfo) => {
    if (!info.mouseLeftDown) return
    const now = Date.now()
    if (now - lastMouseMoveRef.current < 200) return
    lastMouseMoveRef.current = now
    const newRipple = [info.mouseNormalized[0], info.mouseNormalized[1], 0, 1] as Vec4
    ripplesRef.current = [...ripplesRef.current, newRipple]
    log("newRipple", newRipple)
  }, [])

  const onClick = useCallback((info: FrameInfo) => {
    const newRipple = [info.mouseNormalized[0], info.mouseNormalized[1], 0, 1] as Vec4
    ripplesRef.current = [...ripplesRef.current, newRipple]
    log("newRipple", newRipple)
  }, [])

  const onFrame = useCallback((info: FrameInfo) => {
    const newRipples = []
    let i = -1
    for (const ripple of ripplesRef.current) {
      i++
      if (i === 0) {
        newRipples.push([0, 0, 0, 0] as Vec4)
        continue
      }

      ripple[2] += info.deltaTime * 0.5
      ripple[3] = Math.abs(ripple[2] - 1)
      if (ripple[2] <= 1) {
        newRipples.push(ripple)
      }
    }
    setRipples(newRipples)
  }, [])

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative" }}>
      {/* <div
        style={{
          //display: "none",
          position: "absolute",
          top: 10,
          left: 10,
          fontSize: "14px",
          fontWeight: "bold",
          marginBottom: "100px",
        }}
      >
        {ripples.map((ripple, index) => (
          <div key={ripple[0] + ripple[1] + index.toString()}>
            {Math.round(ripple[0] * 100) / 100}, {Math.round(ripple[1] * 100) / 100},{" "}
            {Math.round(ripple[2] * 100) / 100}, {Math.round(ripple[3] * 100) / 100}
          </div>
        ))}
      </div> */}
      <ReactShader
        fragment={fragment}
        timeScale={0.3}
        fullscreen={true}
        uniforms={{
          scale: 1,
          iterations: 2,
          fractMultiplier: 1,
          waveLength: 10,
          edgeBlur: 0.01,
          contrast: 2,
          noiseScale: 1,
          noiseMultiplier: 0.5,
          ripples: ripples.map((ripple) => [ripple[0], ripple[1], ripple[2] * 0.5, ripple[3] * 0.5] as Vec4),
        }}
        onFrame={onFrame}
        onClick={onClick}
        onMouseMove={onMouseMove}
      />
    </div>
  )
}
