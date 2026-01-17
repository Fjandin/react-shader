import { useState, useCallback, useEffect } from 'react'
import type { ReactShaderProps, Vec2 } from './types'
import { useWebGL } from './hooks/useWebGL'

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
}: ReactShaderProps) {
  const [error, setError] = useState<string | null>(null)
  const [debugInfo, setDebugInfo] = useState<DebugInfo>({
    iResolution: [0, 0],
    iMouse: [0, 0],
  })

  const handleError = useCallback((err: Error) => {
    setError(err.message)
    console.error('ReactShader error:', err)
  }, [])

  const { canvasRef, mouseRef } = useWebGL({
    fragment,
    vertex,
    uniforms,
    onError: handleError,
  })

  useEffect(() => {
    if (!debug) return

    const updateDebugInfo = () => {
      const canvas = canvasRef.current
      if (canvas) {
        setDebugInfo({
          iResolution: [canvas.width, canvas.height],
          iMouse: mouseRef.current,
        })
      }
    }

    const intervalId = setInterval(updateDebugInfo, 100)
    return () => clearInterval(intervalId)
  }, [debug, canvasRef, mouseRef])

  if (error) {
    return (
      <div
        className={className}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#1a1a1a',
          color: '#ff6b6b',
          fontFamily: 'monospace',
          fontSize: '12px',
          padding: '16px',
          overflow: 'auto',
        }}
      >
        <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{error}</pre>
      </div>
    )
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <canvas
        ref={canvasRef}
        className={className}
        style={{ display: 'block', width: '100%', height: '100%' }}
      />
      {debug && (
        <div
          style={{
            position: 'absolute',
            top: 8,
            left: 8,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            color: '#fff',
            fontFamily: 'monospace',
            fontSize: '12px',
            padding: '8px',
            borderRadius: '4px',
            pointerEvents: 'none',
          }}
        >
          <div>iResolution: [{debugInfo.iResolution[0]}, {debugInfo.iResolution[1]}]</div>
          <div>iMouse: [{Math.round(debugInfo.iMouse[0])}, {Math.round(debugInfo.iMouse[1])}]</div>
        </div>
      )}
    </div>
  )
}
