import { useCallback, useEffect, useState } from "react"
import { useWebGL } from "./hooks/useWebGL"
import type { FrameInfo, ReactShaderProps } from "./types"

const DEFAULT_VERTEX = `#version 300 es
in vec2 a_position;

void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`

export function ReactShader({
  className,
  fragment,
  vertex = DEFAULT_VERTEX,
  uniforms,
  fullscreen = false,
  timeScale = 1,
  onFrame,
  onClick,
  onMouseMove,
}: ReactShaderProps) {
  const [error, setError] = useState<string | null>(null)

  const handleError = useCallback((err: Error) => {
    setError(err.message)
    console.error("ReactShader error:", err)
  }, [])

  const handleFrame = useCallback(
    (info: FrameInfo) => {
      if (onFrame) {
        onFrame(info)
      }
    },
    [onFrame],
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
    onClick,
    onMouseMove,
    timeScale,
  })

  const containerStyle: React.CSSProperties = fullscreen
    ? {
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        zIndex: 9000,
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
          width: "100%",
          height: "100%",
        }}
      >
        <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{error}</pre>
      </div>
    )
  }

  return <canvas ref={canvasRef} className={className} style={{ display: "block", width: "100%", height: "100%" }} />
}
