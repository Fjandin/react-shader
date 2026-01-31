/**
 * This file is the entry point for the React app, it sets up the root
 * element and renders the App component to the DOM.
 *
 * It is included in `src/index.html`.
 */

import { StrictMode, useCallback, useEffect, useRef, useState } from "react"
import { createRoot } from "react-dom/client"
import "./style.css"
import { ReactShader } from "../ReactShader"
import type { FrameInfo, Vec2, Vec2Array, Vec4, Vec4Array } from "../types"
import { textureFragment } from "./glsl/texture-demo.glsl"
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

function createDemoTexture(): HTMLCanvasElement {
  const canvas = document.createElement("canvas")
  canvas.width = 512
  canvas.height = 512
  const ctx = canvas.getContext("2d")
  if (!ctx) return canvas

  // Create a gradient background
  const gradient = ctx.createLinearGradient(0, 0, 512, 512)
  gradient.addColorStop(0, "#1a1a2e")
  gradient.addColorStop(0.5, "#16213e")
  gradient.addColorStop(1, "#0f3460")
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 512, 512)

  // Draw some geometric shapes
  ctx.strokeStyle = "#e94560"
  ctx.lineWidth = 3
  for (let i = 0; i < 5; i++) {
    ctx.beginPath()
    ctx.arc(256, 256, 50 + i * 40, 0, Math.PI * 2)
    ctx.stroke()
  }

  // Add some text
  ctx.fillStyle = "#ffffff"
  ctx.font = "bold 48px sans-serif"
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText("TEXTURE", 256, 256)

  // Add corner decorations
  ctx.fillStyle = "#e94560"
  const corners = [
    [30, 30],
    [482, 30],
    [30, 482],
    [482, 482],
  ]
  for (const [x, y] of corners) {
    ctx.beginPath()
    ctx.arc(x, y, 15, 0, Math.PI * 2)
    ctx.fill()
  }

  return canvas
}

function TextureDemo() {
  const [texture, setTexture] = useState<HTMLCanvasElement | null>(null)

  useEffect(() => {
    setTexture(createDemoTexture())
  }, [])

  if (!texture) return null

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <ReactShader
        fragment={textureFragment}
        uniforms={{
          uTexture: {
            source: texture,
            wrapS: "repeat",
            wrapT: "repeat",
          },
          distortionAmount: 0.03,
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: 20,
          left: 20,
          color: "white",
          fontSize: "14px",
          background: "rgba(0,0,0,0.5)",
          padding: "8px 12px",
          borderRadius: "4px",
        }}
      >
        Texture Demo - Canvas texture with distortion effect
      </div>
    </div>
  )
}

export function App() {
  const [showTextureDemo, setShowTextureDemo] = useState(false)
  const mouseTrailRef = useRef<Vec2Array>([[0, 0]])
  const [mouseTrail, setMouseTrail] = useState<Vec2Array>([[0, 0]])
  const ripplesRef = useRef<Vec4Array>([[0, 0, 0, 0]])
  const [ripples, setRipples] = useState<Vec4Array>([[0, 0, 0, 0]])
  const lastMouseMoveRef = useRef<number>(0)

  const onMouseMove = useCallback((info: FrameInfo) => {
    if (!info.mouseLeftDown) return
    const now = Date.now()
    if (now - lastMouseMoveRef.current < 100) return
    lastMouseMoveRef.current = now
    const newMouseTrail = [info.mouseNormalized[0], info.mouseNormalized[1]] as Vec2
    const newRipple = [info.mouseNormalized[0], info.mouseNormalized[1], 0, 1] as Vec4
    mouseTrailRef.current = [...mouseTrailRef.current, newMouseTrail]
    ripplesRef.current = [...ripplesRef.current, newRipple]
    log("newRipple", newRipple)
  }, [])

  const onClick = useCallback((info: FrameInfo) => {
    const newRipple = [info.mouseNormalized[0], info.mouseNormalized[1], 0, 1] as Vec4
    ripplesRef.current = [...ripplesRef.current, newRipple]
    log("newRipple", newRipple)
  }, [])

  const onFrame = useCallback((info: FrameInfo) => {
    const maxMouseTrailLength = 10
    const newRipples = []
    let i = -1
    for (const ripple of ripplesRef.current) {
      i++
      if (i === 0) {
        newRipples.push([0, 0, 0, 0] as Vec4)
        continue
      }

      ripple[2] += info.deltaTime * 0.2
      ripple[3] = Math.abs(ripple[2] - 1)
      if (ripple[2] <= 1) {
        newRipples.push(ripple)
      }
    }
    setMouseTrail(mouseTrailRef.current.slice(-maxMouseTrailLength))
    setRipples(newRipples)
  }, [])

  return (
    <div
      style={{ width: "100vw", height: "100vh", position: "relative", cursor: showTextureDemo ? "default" : "none" }}
    >
      <button
        type="button"
        onClick={() => setShowTextureDemo(!showTextureDemo)}
        style={{
          position: "absolute",
          top: 20,
          right: 20,
          zIndex: 100,
          padding: "10px 20px",
          // background: "rgba(255,255,255,0.9)",
          border: "none",
          borderRadius: "4px",
          cursor: "pointer",
          fontWeight: "bold",
        }}
      >
        {showTextureDemo ? "Show Circles Demo" : "Show Texture Demo"}
      </button>

      {showTextureDemo ? (
        <TextureDemo />
      ) : (
        <ReactShader
          fragment={fragment}
          timeScale={0.3}
          fullscreen={true}
          uniforms={{
            scale: 1,
            iterations: 2,
            fractMultiplier: 1,
            waveLength: 30,
            edgeBlur: 0.01,
            contrast: 1,
            noiseScale: 1,
            noiseMultiplier: 0.5,
            ripples: ripples.map((ripple) => [ripple[0], ripple[1], ripple[2], ripple[3] * 0.5] as Vec4),
            mouseTrail,
          }}
          onFrame={onFrame}
          onClick={onClick}
          onMouseMove={onMouseMove}
        />
      )}
    </div>
  )
}
