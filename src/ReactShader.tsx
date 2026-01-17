import { useCallback, useEffect, useRef, useState } from "react"
import { type FrameInfo, useWebGL } from "./hooks/useWebGL"
import type { ReactShaderProps, Vec2 } from "./types"

const DEFAULT_VERTEX = `
attribute vec2 a_position;

void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`

interface DebugInfo {
  iResolution: Vec2
  iMouse: Vec2
}

export function ReactShader({
  className,
  fragment,
  vertex = DEFAULT_VERTEX,
  uniforms,
  debug = false,
  fullscreen = false,
  running = true,
}: ReactShaderProps) {
  const [error, setError] = useState<string | null>(null)
  const [debugInfo, setDebugInfo] = useState<DebugInfo>({
    iResolution: [0, 0],
    iMouse: [0, 0],
  })
  const lastDebugUpdateRef = useRef<number>(0)

  const handleError = useCallback((err: Error) => {
    setError(err.message)
    console.error("ReactShader error:", err)
  }, [])

  const handleFrame = useCallback(
    (info: FrameInfo) => {
      if (!debug) return

      // Throttle debug updates to ~10fps to avoid excessive re-renders
      const now = performance.now()
      if (now - lastDebugUpdateRef.current < 100) return
      lastDebugUpdateRef.current = now

      setDebugInfo({
        iResolution: info.resolution,
        iMouse: info.mouse,
      })
    },
    [debug],
  )

  // biome-ignore lint/correctness/useExhaustiveDependencies: Clear error when shader props change to allow retry
  useEffect(() => {
    setError(null)
  }, [fragment, vertex])

  const { canvasRef } = useWebGL({
    fragment,
    vertex,
    uniforms,
    onError: handleError,
    onFrame: handleFrame,
    running,
  })

  const containerStyle: React.CSSProperties = fullscreen
    ? {
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        zIndex: 9999,
      }
    : {
        position: "relative",
        width: "100%",
        height: "100%",
      }

  if (error) {
    return (
      <div
        className={className}
        style={{
          ...containerStyle,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#1a1a1a",
          color: "#ff6b6b",
          fontFamily: "monospace",
          fontSize: "12px",
          padding: "16px",
          overflow: "auto",
          boxSizing: "border-box",
        }}
      >
        <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{error}</pre>
      </div>
    )
  }

  return (
    <div style={containerStyle}>
      <canvas ref={canvasRef} className={className} style={{ display: "block", width: "100%", height: "100%" }} />
      {debug && (
        <div
          style={{
            position: "absolute",
            top: 8,
            left: 8,
            backgroundColor: "rgba(0, 0, 0, 0.7)",
            color: "#fff",
            fontFamily: "monospace",
            fontSize: "12px",
            padding: "8px",
            borderRadius: "4px",
            pointerEvents: "none",
          }}
        >
          <div>
            iResolution: [{debugInfo.iResolution[0]}, {debugInfo.iResolution[1]}]
          </div>
          <div>
            iMouse: [{Math.round(debugInfo.iMouse[0])}, {Math.round(debugInfo.iMouse[1])}]
          </div>
        </div>
      )}
    </div>
  )
}
