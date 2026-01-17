import { useRef, useEffect, useCallback } from 'react'
import type { UniformValue } from '../types'
import { createShaderProgram } from '../utils/shader'
import { setUniforms, createUniformLocationCache } from '../utils/uniforms'

interface UseWebGLOptions {
  fragment: string
  vertex: string
  uniforms?: Record<string, UniformValue>
  onError?: (error: Error) => void
}

interface WebGLState {
  gl: WebGLRenderingContext
  program: WebGLProgram
  positionBuffer: WebGLBuffer
  positionAttributeLocation: number
  uniformLocationCache: Map<string, WebGLUniformLocation | null>
}

function initializeWebGL(
  canvas: HTMLCanvasElement,
  vertexSource: string,
  fragmentSource: string
): WebGLState {
  const gl = canvas.getContext('webgl')
  if (!gl) {
    throw new Error('WebGL not supported')
  }

  const program = createShaderProgram(gl, vertexSource, fragmentSource)

  // Create position buffer for full-screen quad
  const positionBuffer = gl.createBuffer()
  if (!positionBuffer) {
    throw new Error('Failed to create position buffer')
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)

  // Two triangles covering the entire clip space (-1 to 1)
  const positions = new Float32Array([
    -1, -1,
     1, -1,
    -1,  1,
    -1,  1,
     1, -1,
     1,  1,
  ])
  gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW)

  const positionAttributeLocation = gl.getAttribLocation(program, 'a_position')

  return {
    gl,
    program,
    positionBuffer,
    positionAttributeLocation,
    uniformLocationCache: createUniformLocationCache(),
  }
}

function cleanupWebGL(gl: WebGLRenderingContext, state: WebGLState): void {
  gl.deleteBuffer(state.positionBuffer)
  gl.deleteProgram(state.program)
}

export function useWebGL(options: UseWebGLOptions) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef<WebGLState | null>(null)
  const animationFrameRef = useRef<number>(0)
  const startTimeRef = useRef<number>(0)
  const mouseRef = useRef<[number, number]>([0, 0])
  const uniformsRef = useRef(options.uniforms)
  const onErrorRef = useRef(options.onError)

  // Keep refs updated
  uniformsRef.current = options.uniforms
  onErrorRef.current = options.onError

  const render = useCallback((time: number) => {
    const state = stateRef.current
    const canvas = canvasRef.current
    if (!state || !canvas) return

    const { gl, program, positionAttributeLocation, uniformLocationCache } = state

    // Calculate elapsed time in seconds
    if (startTimeRef.current === 0) {
      startTimeRef.current = time
    }
    const elapsedTime = (time - startTimeRef.current) / 1000

    // Handle canvas resize
    const displayWidth = canvas.clientWidth
    const displayHeight = canvas.clientHeight
    if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
      canvas.width = displayWidth
      canvas.height = displayHeight
      gl.viewport(0, 0, displayWidth, displayHeight)
    }

    // Clear and set up
    gl.clearColor(0, 0, 0, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)

    gl.useProgram(program)

    // Set up position attribute
    gl.enableVertexAttribArray(positionAttributeLocation)
    gl.bindBuffer(gl.ARRAY_BUFFER, state.positionBuffer)
    gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0)

    // Set default uniforms
    const defaultUniforms: Record<string, UniformValue> = {
      iTime: elapsedTime,
      iMouse: mouseRef.current,
      iResolution: [canvas.width, canvas.height],
    }

    setUniforms(gl, program, defaultUniforms, uniformLocationCache)

    // Set custom uniforms
    if (uniformsRef.current) {
      setUniforms(gl, program, uniformsRef.current, uniformLocationCache)
    }

    // Draw
    gl.drawArrays(gl.TRIANGLES, 0, 6)

    // Continue render loop
    animationFrameRef.current = requestAnimationFrame(render)
  }, [])

  // Initialize WebGL and start render loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    try {
      stateRef.current = initializeWebGL(canvas, options.vertex, options.fragment)
      startTimeRef.current = 0
      animationFrameRef.current = requestAnimationFrame(render)
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      if (onErrorRef.current) {
        onErrorRef.current(error)
      } else {
        console.error('WebGL initialization failed:', error)
      }
    }

    return () => {
      cancelAnimationFrame(animationFrameRef.current)
      if (stateRef.current) {
        cleanupWebGL(stateRef.current.gl, stateRef.current)
        stateRef.current = null
      }
    }
  }, [options.fragment, options.vertex, render])

  // Mouse tracking
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const handleMouseMove = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      const x = event.clientX - rect.left
      const y = rect.height - (event.clientY - rect.top) // Flip Y for WebGL coords
      mouseRef.current = [x, y]
    }

    canvas.addEventListener('mousemove', handleMouseMove)
    return () => canvas.removeEventListener('mousemove', handleMouseMove)
  }, [])

  return { canvasRef, mouseRef }
}
