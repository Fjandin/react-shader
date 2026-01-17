import { useState, useCallback } from 'react'
import type { ReactShaderProps } from './types'
import { useWebGL } from './hooks/useWebGL'

const DEFAULT_VERTEX = `
attribute vec2 a_position;

void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`

export function ReactShader({
  className,
  fragment,
  vertex = DEFAULT_VERTEX,
  uniforms,
}: ReactShaderProps) {
  const [error, setError] = useState<string | null>(null)

  const handleError = useCallback((err: Error) => {
    setError(err.message)
    console.error('ReactShader error:', err)
  }, [])

  const { canvasRef } = useWebGL({
    fragment,
    vertex,
    uniforms,
    onError: handleError,
  })

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
    <canvas
      ref={canvasRef}
      className={className}
      style={{ display: 'block', width: '100%', height: '100%' }}
    />
  )
}
