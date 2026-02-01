import { useCallback, useEffect, useMemo, useState } from "react"
import { useWebGL } from "./hooks/useWebGL"
import type { ReactShaderProps } from "./types"

const DEFAULT_VERTEX = `#version 300 es
precision highp float;
in vec2 a_position;

void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`

// Static styles extracted to module level to avoid re-creation
const FULLSCREEN_CONTAINER_STYLE: React.CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  width: "100vw",
  height: "100vh",
  zIndex: 9000,
}

const DEFAULT_CONTAINER_STYLE: React.CSSProperties = {
  position: "relative",
  width: "100%",
  height: "100%",
}

const CANVAS_STYLE: React.CSSProperties = {
  display: "block",
  width: "100%",
  height: "100%",
}

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
  onMouseDown,
  onMouseUp,
  onMouseWheel,
}: ReactShaderProps) {
  const [error, setError] = useState<string | null>(null)

  const handleError = useCallback((err: Error) => {
    setError(err.message)
    console.error("ReactShader error:", err)
  }, [])

  // biome-ignore lint/correctness/useExhaustiveDependencies: Clear error when shader props change to allow retry
  useEffect(() => {
    setError(null)
  }, [fragment, vertex])

  const { canvasRef } = useWebGL({
    fragment,
    vertex,
    uniforms,
    onError: handleError,
    onFrame,
    onClick,
    onMouseMove,
    onMouseDown,
    onMouseUp,
    onMouseWheel,
    timeScale,
  })

  const containerStyle = useMemo(
    () => (fullscreen ? FULLSCREEN_CONTAINER_STYLE : DEFAULT_CONTAINER_STYLE),
    [fullscreen],
  )

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

  return <canvas ref={canvasRef} className={className} style={CANVAS_STYLE} />
}
