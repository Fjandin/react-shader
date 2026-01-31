import { useCallback, useEffect, useRef } from "react"
import type { FrameInfo, UniformValue } from "../types"
import { createShaderProgram } from "../utils/shader"
import { cleanupTextures, createTextureManager, type TextureManager } from "../utils/textures"
import { createUniformLocationCache, injectUniformDeclarations, setUniforms } from "../utils/uniforms"

interface UseWebGLOptions {
  fragment: string
  vertex: string
  uniforms?: Record<string, UniformValue>
  onError?: (error: Error) => void
  onFrame?: (info: FrameInfo) => void
  onClick?: (info: FrameInfo) => void
  onMouseDown?: (info: FrameInfo) => void
  onMouseUp?: (info: FrameInfo) => void
  onMouseMove?: (info: FrameInfo) => void
  onMouseWheel?: (info: FrameInfo, wheelDelta: number) => void
  timeScale?: number
}

type WebGLContext = WebGLRenderingContext | WebGL2RenderingContext

interface WebGLState {
  gl: WebGLContext
  program: WebGLProgram
  positionBuffer: WebGLBuffer
  positionAttributeLocation: number
  uniformLocationCache: Map<string, WebGLUniformLocation | null>
  textureManager: TextureManager
}

const DEFAULT_UNIFORM_TYPES: Record<string, UniformValue> = {
  iTime: 0,
  iMouse: [0, 0],
  iMouseNormalized: [0, 0],
  iMouseLeftDown: 0,
  iResolution: [0, 0],
}

function initializeWebGL(
  canvas: HTMLCanvasElement,
  vertexSource: string,
  fragmentSource: string,
  customUniforms?: Record<string, UniformValue>,
): WebGLState {
  // Try WebGL2 first, fall back to WebGL1
  const gl = canvas.getContext("webgl2") || canvas.getContext("webgl")
  if (!gl) {
    throw new Error("WebGL not supported")
  }

  // Inject uniform declarations if marker is present
  const processedVertex = injectUniformDeclarations(vertexSource, customUniforms, DEFAULT_UNIFORM_TYPES)
  const processedFragment = injectUniformDeclarations(fragmentSource, customUniforms, DEFAULT_UNIFORM_TYPES)

  const program = createShaderProgram(gl, processedVertex, processedFragment)

  // Create position buffer for full-screen quad
  const positionBuffer = gl.createBuffer()
  if (!positionBuffer) {
    throw new Error("Failed to create position buffer")
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)

  // Two triangles covering the entire clip space (-1 to 1)
  const positions = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1])
  gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW)

  const positionAttributeLocation = gl.getAttribLocation(program, "a_position")
  if (positionAttributeLocation === -1) {
    throw new Error('Vertex shader must have an "a_position" attribute')
  }

  return {
    gl,
    program,
    positionBuffer,
    positionAttributeLocation,
    uniformLocationCache: createUniformLocationCache(),
    textureManager: createTextureManager(gl),
  }
}

function cleanupWebGL(gl: WebGLContext, state: WebGLState): void {
  cleanupTextures(gl, state.textureManager)
  gl.deleteBuffer(state.positionBuffer)
  gl.deleteProgram(state.program)
}

export function useWebGL(options: UseWebGLOptions) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef<WebGLState | null>(null)
  const animationFrameRef = useRef<number>(0)
  const elapsedTimeRef = useRef<number>(0)
  const lastFrameTimeRef = useRef<number>(0)
  const mouseRef = useRef<[number, number]>([0, 0])
  const mouseNormalizedRef = useRef<[number, number]>([0, 0])
  const mouseLeftDownRef = useRef<boolean>(false)
  const canvasRectRef = useRef<DOMRect | null>(null)
  const contextLostRef = useRef<boolean>(false)
  const uniformsRef = useRef(options.uniforms)
  const onErrorRef = useRef(options.onError)
  const onFrameRef = useRef(options.onFrame)
  const onClickRef = useRef(options.onClick)
  const onMouseDownRef = useRef(options.onMouseDown)
  const onMouseUpRef = useRef(options.onMouseUp)
  const onMouseMoveRef = useRef(options.onMouseMove)
  const onMouseWheelRef = useRef(options.onMouseWheel)
  const timeScaleRef = useRef(options.timeScale ?? 1)
  const vertexRef = useRef(options.vertex)
  const fragmentRef = useRef(options.fragment)
  const dprRef = useRef(window.devicePixelRatio || 1)

  // Reusable uniforms object to avoid per-frame allocations
  const defaultUniformsRef = useRef<Record<string, UniformValue>>({
    iTime: 0,
    iMouse: [0, 0],
    iMouseNormalized: [0, 0],
    iMouseLeftDown: 0,
    iResolution: [0, 0],
  })

  // Keep refs updated
  uniformsRef.current = options.uniforms
  onErrorRef.current = options.onError
  onFrameRef.current = options.onFrame
  onClickRef.current = options.onClick
  onMouseDownRef.current = options.onMouseDown
  onMouseUpRef.current = options.onMouseUp
  onMouseMoveRef.current = options.onMouseMove
  onMouseWheelRef.current = options.onMouseWheel
  timeScaleRef.current = options.timeScale ?? 1
  vertexRef.current = options.vertex
  fragmentRef.current = options.fragment

  const render = useCallback((time: number) => {
    // Skip rendering if context is lost
    if (contextLostRef.current) return

    const state = stateRef.current
    const canvas = canvasRef.current
    if (!state || !canvas) return

    // Calculate delta time
    const deltaTime = lastFrameTimeRef.current === 0 ? 0 : (time - lastFrameTimeRef.current) / 1000
    lastFrameTimeRef.current = time

    elapsedTimeRef.current += deltaTime * timeScaleRef.current

    const { gl, program, positionAttributeLocation, uniformLocationCache, textureManager } = state
    const elapsedTime = elapsedTimeRef.current

    // Handle canvas resize with high-DPI support (use cached DPR)
    const dpr = dprRef.current
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

    // biome-ignore lint/correctness/useHookAtTopLevel: not a react hook
    gl.useProgram(program)

    // Set up position attribute
    gl.enableVertexAttribArray(positionAttributeLocation)
    gl.bindBuffer(gl.ARRAY_BUFFER, state.positionBuffer)
    gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0)

    // Update reusable uniforms object (avoids per-frame allocation)
    const defaultUniforms = defaultUniformsRef.current
    defaultUniforms.iTime = elapsedTime
    defaultUniforms.iMouse = mouseRef.current
    defaultUniforms.iMouseNormalized = mouseNormalizedRef.current
    defaultUniforms.iMouseLeftDown = mouseLeftDownRef.current ? 1.0 : 0.0
    defaultUniforms.iResolution = [canvas.width, canvas.height]

    // Set uniforms in single call, with custom uniforms overriding defaults
    setUniforms(gl, program, { ...defaultUniforms, ...uniformsRef.current }, uniformLocationCache, textureManager)

    // Draw
    gl.drawArrays(gl.TRIANGLES, 0, 6)

    // Call onFrame callback with current frame info
    if (onFrameRef.current) {
      onFrameRef.current({
        deltaTime,
        time: elapsedTime,
        resolution: [canvas.width, canvas.height],
        mouse: mouseRef.current,
        mouseNormalized: mouseNormalizedRef.current,
        mouseLeftDown: mouseLeftDownRef.current,
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
        stateRef.current = initializeWebGL(canvas, vertexRef.current, fragmentRef.current, uniformsRef.current)
        elapsedTimeRef.current = 0
        lastFrameTimeRef.current = 0
        contextLostRef.current = false
        animationFrameRef.current = requestAnimationFrame(render)
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err))
        if (onErrorRef.current) {
          onErrorRef.current(error)
        } else {
          console.error("WebGL initialization failed:", error)
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

    // Listen for DPR changes (e.g., moving window between monitors)
    const dprMediaQuery = window.matchMedia(`(resolution: ${dprRef.current}dppx)`)
    const handleDprChange = () => {
      dprRef.current = window.devicePixelRatio || 1
    }
    dprMediaQuery.addEventListener("change", handleDprChange)

    // Use type casting so that TypeScript accepts the event signature
    canvas.addEventListener("webglcontextlost", handleContextLost as EventListener)
    canvas.addEventListener("webglcontextrestored", handleContextRestored as EventListener)

    initialize()

    return () => {
      dprMediaQuery.removeEventListener("change", handleDprChange)
      canvas.removeEventListener("webglcontextlost", handleContextLost as EventListener)
      canvas.removeEventListener("webglcontextrestored", handleContextRestored as EventListener)
      cancelAnimationFrame(animationFrameRef.current)
      if (stateRef.current) {
        cleanupWebGL(stateRef.current.gl, stateRef.current)
        stateRef.current = null
      }
    }
  }, [render])

  // Mouse tracking (globally, so position updates even outside canvas)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Cache the bounding rect and update on resize
    const updateRect = () => {
      canvasRectRef.current = canvas.getBoundingClientRect()
    }
    updateRect()

    const resizeObserver = new ResizeObserver(updateRect)
    resizeObserver.observe(canvas)

    // Also update on scroll since getBoundingClientRect is viewport-relative
    window.addEventListener("scroll", updateRect, { passive: true })

    const handleMouseMove = (event: MouseEvent) => {
      const rect = canvasRectRef.current
      if (!rect) return

      const dpr = dprRef.current
      const x = (event.clientX - rect.left) * dpr
      // Y is inverted: WebGL convention has Y=0 at bottom, DOM has Y=0 at top
      const y = (rect.height - (event.clientY - rect.top)) * dpr
      mouseRef.current = [x, y]

      // Update normalized mouse position
      const minDimension = Math.min(canvas.width, canvas.height) || 1
      mouseNormalizedRef.current = [
        (mouseRef.current[0] - canvas.width / 2) / minDimension,
        (mouseRef.current[1] - canvas.height / 2) / minDimension,
      ]

      onMouseMoveRef.current?.({
        deltaTime: 0,
        time: elapsedTimeRef.current,
        resolution: [canvas.width, canvas.height],
        mouse: mouseRef.current,
        mouseNormalized: mouseNormalizedRef.current,
        mouseLeftDown: mouseLeftDownRef.current,
      })
    }

    const handleMouseDown = (event: MouseEvent) => {
      if (event.button === 0) {
        mouseLeftDownRef.current = true
      }
      onMouseDownRef.current?.({
        deltaTime: 0,
        time: elapsedTimeRef.current,
        resolution: [canvas.width, canvas.height],
        mouse: mouseRef.current,
        mouseNormalized: mouseNormalizedRef.current,
        mouseLeftDown: mouseLeftDownRef.current,
      })
    }

    const handleMouseUp = (event: MouseEvent) => {
      if (event.button === 0) {
        mouseLeftDownRef.current = false
      }
      onMouseUpRef.current?.({
        deltaTime: 0,
        time: elapsedTimeRef.current,
        resolution: [canvas.width, canvas.height],
        mouse: mouseRef.current,
        mouseNormalized: mouseNormalizedRef.current,
        mouseLeftDown: mouseLeftDownRef.current,
      })
    }

    const handleClick = () => {
      if (!onClickRef.current) return

      onClickRef.current({
        deltaTime: 0,
        time: elapsedTimeRef.current,
        resolution: [canvas.width, canvas.height],
        mouse: mouseRef.current,
        mouseNormalized: mouseNormalizedRef.current,
        mouseLeftDown: mouseLeftDownRef.current,
      })
    }

    const handleMouseWheel = (event: WheelEvent) => {
      onMouseWheelRef.current?.(
        {
          deltaTime: 0,
          time: elapsedTimeRef.current,
          resolution: [canvas.width, canvas.height],
          mouse: mouseRef.current,
          mouseNormalized: mouseNormalizedRef.current,
          mouseLeftDown: mouseLeftDownRef.current,
        },
        event.deltaY,
      )
    }

    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("mousedown", handleMouseDown)
    window.addEventListener("mouseup", handleMouseUp)
    canvas.addEventListener("click", handleClick)
    window.addEventListener("wheel", handleMouseWheel)
    return () => {
      resizeObserver.disconnect()
      window.removeEventListener("scroll", updateRect)
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mousedown", handleMouseDown)
      window.removeEventListener("mouseup", handleMouseUp)
      canvas.removeEventListener("click", handleClick)
      window.removeEventListener("wheel", handleMouseWheel)
    }
  }, [])

  return { canvasRef, mouseRef }
}
