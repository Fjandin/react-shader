import { useCallback, useEffect, useMemo, useState } from "react"
import { useWebGPU } from "./hooks/useWebGPU"

export interface ReactGpuShaderProps {
  className?: string
  fragment: string
  fullscreen?: boolean
}

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

export function ReactGpuShader({ className, fragment, fullscreen = false }: ReactGpuShaderProps) {
  const [error, setError] = useState<string | null>(null)

  const handleError = useCallback((err: Error) => {
    setError(err.message)
    console.error("ReactGpuShader error:", err)
  }, [])

  // biome-ignore lint/correctness/useExhaustiveDependencies: Clear error when shader props change to allow retry
  useEffect(() => {
    setError(null)
  }, [fragment])

  const { canvasRef } = useWebGPU({
    fragment,
    onError: handleError,
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
