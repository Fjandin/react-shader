import { useRef, useEffect, useCallback } from 'react'
import type { UniformValue } from '../types'
import { createShaderProgram } from '../utils/shader'
import { setUniforms, createUniformLocationCache } from '../utils/uniforms'

export interface FrameInfo {
  time: number
  resolution: [number, number]
  mouse: [number, number]
}

interface UseWebGLOptions {
  fragment: string
  vertex: string
  uniforms?: Record<string, UniformValue>
  onError?: (error: Error) => void
  onFrame?: (info: FrameInfo) => void
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
    -1, 1,
    -1, 1,
    1, -1,
    1, 1,
  ])
  gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW)

  const positionAttributeLocation = gl.getAttribLocation(program, 'a_position')
  if (positionAttributeLocation === -1) {
    throw new Error('Vertex shader must have an "a_position" attribute')
  }

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
  const contextLostRef = useRef<boolean>(false)
  const uniformsRef = useRef(options.uniforms)
  const onErrorRef = useRef(options.onError)
  const onFrameRef = useRef(options.onFrame)
  const vertexRef = useRef(options.vertex)
  const fragmentRef = useRef(options.fragment)

  // Keep refs updated
  uniformsRef.current = options.uniforms
  onErrorRef.current = options.onError
  onFrameRef.current = options.onFrame
  vertexRef.current = options.vertex
  fragmentRef.current = options.fragment

  const render = useCallback((time: number) => {
    // Skip rendering if context is lost
    if (contextLostRef.current) return

    const state = stateRef.current
    const canvas = canvasRef.current
    if (!state || !canvas) return

    const { gl, program, positionAttributeLocation, uniformLocationCache } = state

    // Calculate elapsed time in seconds
    if (startTimeRef.current === 0) {
      startTimeRef.current = time
    }
    const elapsedTime = (time - startTimeRef.current) / 1000

    // Handle canvas resize with high-DPI support
    const dpr = window.devicePixelRatio || 1
    const displayWidth = canvas.clientWidth
    const displayHeight = canvas.clientHeight

    // Skip rendering if canvas has zero size (hidden or not in DOM)
    if (displayWidth === 0 || displayHeight === 0) {
      animationFrameRef.current = requestAnimationFrame(render)
      return
    }

    const bufferWidth = Math.round(displayWidth * dpr)
    const bufferHeight = Math.round(displayHeight * dpr)
    if (canvas.width !== bufferWidth || canvas.height !== bufferHeight) {
      canvas.width = bufferWidth
      canvas.height = bufferHeight
      gl.viewport(0, 0, bufferWidth, bufferHeight)
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

    // Call onFrame callback with current frame info
    if (onFrameRef.current) {
      onFrameRef.current({
        time: elapsedTime,
        resolution: [canvas.width, canvas.height],
        mouse: mouseRef.current,
      })
    }

    // Continue render loop
    animationFrameRef.current = requestAnimationFrame(render)
  }, [])

  // Initialize WebGL and start render loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const initialize = () => {
      try {
        stateRef.current = initializeWebGL(canvas, vertexRef.current, fragmentRef.current)
        startTimeRef.current = 0
        contextLostRef.current = false
        animationFrameRef.current = requestAnimationFrame(render)
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err))
        if (onErrorRef.current) {
          onErrorRef.current(error)
        } else {
          console.error('WebGL initialization failed:', error)
        }
      }
    }

    const handleContextLost = (event: WebGLContextEvent) => {
      event.preventDefault()
      contextLostRef.current = true
      cancelAnimationFrame(animationFrameRef.current)
      stateRef.current = null
    }

    const handleContextRestored = () => {
      initialize()
    }

    // Use type casting so that TypeScript accepts the event signature
    canvas.addEventListener('webglcontextlost', handleContextLost as EventListener)
    canvas.addEventListener('webglcontextrestored', handleContextRestored as EventListener)

    initialize()

    return () => {
      canvas.removeEventListener('webglcontextlost', handleContextLost as EventListener)
      canvas.removeEventListener('webglcontextrestored', handleContextRestored as EventListener)
      cancelAnimationFrame(animationFrameRef.current)
      if (stateRef.current) {
        cleanupWebGL(stateRef.current.gl, stateRef.current)
        stateRef.current = null
      }
    }
  }, [options.fragment, options.vertex, render])

  // Mouse tracking (globally, so position updates even outside canvas)
  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      const canvas = canvasRef.current
      if (!canvas) return

      const dpr = window.devicePixelRatio || 1
      const rect = canvas.getBoundingClientRect()
      const x = (event.clientX - rect.left) * dpr
      // Y is inverted: WebGL convention has Y=0 at bottom, DOM has Y=0 at top
      const y = (rect.height - (event.clientY - rect.top)) * dpr
      mouseRef.current = [x, y]
    }

    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  return { canvasRef, mouseRef }
}
