import { useCallback, useEffect, useRef } from "react"
import type { FrameInfo, Vec2, Vec3, Vec4, Vec4Array } from "../types"

// Supported GPU uniform types (no textures)
type GpuUniformValue = number | Vec2 | Vec3 | Vec4 | Vec4Array

interface UseWebGPUOptions {
  fragment: string
  uniforms?: Record<string, GpuUniformValue>
  onError?: (error: Error) => void
  timeScale?: number
  onFrame?: (info: FrameInfo) => void
  onClick?: (info: FrameInfo) => void
  onMouseMove?: (info: FrameInfo) => void
  onMouseDown?: (info: FrameInfo) => void
  onMouseUp?: (info: FrameInfo) => void
  onMouseWheel?: (info: FrameInfo, wheelDelta: number) => void
}

interface WebGPUState {
  device: GPUDevice
  context: GPUCanvasContext
  pipeline: GPURenderPipeline
  uniformBuffer: GPUBuffer
  uniformBindGroup: GPUBindGroup
  uniformLayout: UniformLayout
}

type WgslBaseType = "f32" | "vec2f" | "vec3f" | "vec4f"
type WgslType = WgslBaseType | `array<${WgslBaseType}, ${number}>`

interface UniformField {
  name: string
  type: WgslType
  offset: number
  size: number
  isArray?: boolean
  arrayLength?: number
  elementStride?: number
}

interface UniformLayout {
  fields: UniformField[]
  bufferSize: number
}

// Type detection helpers
function isVec2(value: GpuUniformValue): value is Vec2 {
  return Array.isArray(value) && value.length === 2 && typeof value[0] === "number"
}

function isVec3(value: GpuUniformValue): value is Vec3 {
  return Array.isArray(value) && value.length === 3 && typeof value[0] === "number"
}

function isVec4(value: GpuUniformValue): value is Vec4 {
  return Array.isArray(value) && value.length === 4 && typeof value[0] === "number"
}

function isVec4Array(value: GpuUniformValue): value is Vec4Array {
  return Array.isArray(value) && value.length > 0 && Array.isArray(value[0]) && value[0].length === 4
}

interface InferredType {
  wgslType: WgslType
  baseType: WgslBaseType
  isArray: boolean
  arrayLength: number
}

function inferWgslType(value: GpuUniformValue): InferredType {
  if (typeof value === "number") {
    return { wgslType: "f32", baseType: "f32", isArray: false, arrayLength: 0 }
  }
  if (isVec4Array(value)) {
    return {
      wgslType: `array<vec4f, ${value.length}>`,
      baseType: "vec4f",
      isArray: true,
      arrayLength: value.length,
    }
  }
  if (isVec4(value)) {
    return { wgslType: "vec4f", baseType: "vec4f", isArray: false, arrayLength: 0 }
  }
  if (isVec3(value)) {
    return { wgslType: "vec3f", baseType: "vec3f", isArray: false, arrayLength: 0 }
  }
  if (isVec2(value)) {
    return { wgslType: "vec2f", baseType: "vec2f", isArray: false, arrayLength: 0 }
  }
  throw new Error(`Unsupported uniform value type: ${typeof value}`)
}

function getTypeAlignment(type: WgslBaseType): number {
  switch (type) {
    case "f32":
      return 4
    case "vec2f":
      return 8
    case "vec3f":
    case "vec4f":
      return 16
  }
}

function getTypeSize(type: WgslBaseType): number {
  switch (type) {
    case "f32":
      return 4
    case "vec2f":
      return 8
    case "vec3f":
      return 12
    case "vec4f":
      return 16
  }
}

// In WGSL uniform buffers, array elements have 16-byte stride
const UNIFORM_ARRAY_STRIDE = 16

// Default uniforms with their types (order matters for alignment)
const DEFAULT_UNIFORMS: Array<{ name: string; baseType: WgslBaseType }> = [
  { name: "iTime", baseType: "f32" },
  { name: "iMouseLeftDown", baseType: "f32" },
  { name: "iResolution", baseType: "vec2f" },
  { name: "iMouse", baseType: "vec2f" },
  { name: "iMouseNormalized", baseType: "vec2f" },
]

function calculateUniformLayout(customUniforms?: Record<string, GpuUniformValue>): UniformLayout {
  const fields: UniformField[] = []
  let offset = 0

  // Helper to add a scalar/vector field with proper alignment
  const addField = (name: string, baseType: WgslBaseType) => {
    const alignment = getTypeAlignment(baseType)
    const size = getTypeSize(baseType)

    // Align offset
    offset = Math.ceil(offset / alignment) * alignment

    fields.push({ name, type: baseType, offset, size, isArray: false })
    offset += size
  }

  // Helper to add an array field
  const addArrayField = (name: string, baseType: WgslBaseType, arrayLength: number) => {
    // Arrays in uniform buffers need 16-byte alignment
    offset = Math.ceil(offset / 16) * 16

    const totalSize = arrayLength * UNIFORM_ARRAY_STRIDE
    fields.push({
      name,
      type: `array<${baseType}, ${arrayLength}>`,
      offset,
      size: totalSize,
      isArray: true,
      arrayLength,
      elementStride: UNIFORM_ARRAY_STRIDE,
    })
    offset += totalSize
  }

  // Add default uniforms first (already ordered for good packing)
  for (const u of DEFAULT_UNIFORMS) {
    addField(u.name, u.baseType)
  }

  // Process custom uniforms - separate arrays from scalars/vectors
  if (customUniforms) {
    const scalarEntries: Array<{ name: string; inferred: InferredType }> = []
    const arrayEntries: Array<{ name: string; inferred: InferredType }> = []

    for (const [name, value] of Object.entries(customUniforms)) {
      const inferred = inferWgslType(value)
      if (inferred.isArray) {
        arrayEntries.push({ name, inferred })
      } else {
        scalarEntries.push({ name, inferred })
      }
    }

    // Auto-generate _count scalars for each array uniform
    for (const { name } of arrayEntries) {
      scalarEntries.push({
        name: `${name}_count`,
        inferred: { wgslType: "f32", baseType: "f32", isArray: false, arrayLength: 0 },
      })
    }

    // Add scalar/vector uniforms first, sorted by alignment for better packing
    scalarEntries.sort((a, b) => getTypeAlignment(b.inferred.baseType) - getTypeAlignment(a.inferred.baseType))
    for (const { name, inferred } of scalarEntries) {
      addField(name, inferred.baseType)
    }

    // Add array uniforms after (they need more alignment anyway)
    for (const { name, inferred } of arrayEntries) {
      addArrayField(name, inferred.baseType, inferred.arrayLength)
    }
  }

  // Buffer size must be multiple of 16 for uniform buffers
  const bufferSize = Math.ceil(offset / 16) * 16

  return { fields, bufferSize }
}

function generateUniformStruct(layout: UniformLayout): string {
  const members = layout.fields.map((f) => `  ${f.name}: ${f.type},`).join("\n")
  return `struct Uniforms {\n${members}\n}`
}

function packUniformValue(field: UniformField, value: GpuUniformValue, floatData: Float32Array): void {
  const floatOffset = field.offset / 4

  if (field.isArray && field.elementStride && field.arrayLength) {
    // Pack array with proper stride
    const stride = field.elementStride / 4 // stride in floats
    const maxLen = field.arrayLength

    if (isVec4Array(value)) {
      for (let i = 0; i < value.length && i < maxLen; i++) {
        const elemOffset = floatOffset + i * stride
        floatData[elemOffset] = value[i][0]
        floatData[elemOffset + 1] = value[i][1]
        floatData[elemOffset + 2] = value[i][2]
        floatData[elemOffset + 3] = value[i][3]
      }
    }
  } else if (typeof value === "number") {
    floatData[floatOffset] = value
  } else if (Array.isArray(value) && typeof value[0] === "number") {
    // Vec2, Vec3, Vec4
    for (let i = 0; i < value.length; i++) {
      floatData[floatOffset + i] = value[i] as number
    }
  }
}

const VERTEX_SHADER = `
struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
}

@vertex
fn main(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  // Full-screen triangle (covers clip space with a single triangle)
  var pos = array<vec2f, 3>(
    vec2f(-1.0, -1.0),
    vec2f(3.0, -1.0),
    vec2f(-1.0, 3.0)
  );

  var output: VertexOutput;
  output.position = vec4f(pos[vertexIndex], 0.0, 1.0);
  // UV coordinates: (0,0) at bottom-left, (1,1) at top-right
  output.uv = (pos[vertexIndex] + 1.0) * 0.5;
  return output;
}
`

function createFragmentShader(userCode: string, layout: UniformLayout): string {
  return `
${generateUniformStruct(layout)}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

${userCode}

@fragment
fn main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let fragCoord = uv * uniforms.iResolution;
  let correctedUv = ((uv * uniforms.iResolution) - 0.5 * uniforms.iResolution) / uniforms.iResolution.y;

  return mainImage(correctedUv);
}
`
}

async function initializeWebGPU(
  canvas: HTMLCanvasElement,
  fragmentSource: string,
  customUniforms?: Record<string, GpuUniformValue>,
): Promise<WebGPUState> {
  if (!navigator.gpu) {
    throw new Error("WebGPU not supported in this browser")
  }

  const adapter = await navigator.gpu.requestAdapter()
  if (!adapter) {
    throw new Error("Failed to get WebGPU adapter")
  }

  const device = await adapter.requestDevice()

  const context = canvas.getContext("webgpu")
  if (!context) {
    throw new Error("Failed to get WebGPU context")
  }

  const format = navigator.gpu.getPreferredCanvasFormat()
  context.configure({
    device,
    format,
    alphaMode: "premultiplied",
  })

  // Calculate uniform layout based on custom uniforms
  const uniformLayout = calculateUniformLayout(customUniforms)

  const vertexModule = device.createShaderModule({
    label: "vertex shader",
    code: VERTEX_SHADER,
  })

  const fragmentModule = device.createShaderModule({
    label: "fragment shader",
    code: createFragmentShader(fragmentSource, uniformLayout),
  })

  // Create uniform buffer with calculated size
  const uniformBuffer = device.createBuffer({
    label: "uniforms",
    size: uniformLayout.bufferSize,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  })

  const bindGroupLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.FRAGMENT,
        buffer: { type: "uniform" },
      },
    ],
  })

  const uniformBindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [
      {
        binding: 0,
        resource: { buffer: uniformBuffer },
      },
    ],
  })

  const pipelineLayout = device.createPipelineLayout({
    bindGroupLayouts: [bindGroupLayout],
  })

  const pipeline = device.createRenderPipeline({
    label: "render pipeline",
    layout: pipelineLayout,
    vertex: {
      module: vertexModule,
      entryPoint: "main",
    },
    fragment: {
      module: fragmentModule,
      entryPoint: "main",
      targets: [{ format }],
    },
  })

  return {
    device,
    context,
    pipeline,
    uniformBuffer,
    uniformBindGroup,
    uniformLayout,
  }
}

function cleanupWebGPU(state: WebGPUState): void {
  state.uniformBuffer.destroy()
  state.device.destroy()
}

export function useWebGPU(options: UseWebGPUOptions) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef<WebGPUState | null>(null)
  const animationFrameRef = useRef<number>(0)
  const elapsedTimeRef = useRef<number>(0)
  const lastFrameTimeRef = useRef<number>(0)
  const mouseRef = useRef<[number, number]>([0, 0])
  const mouseNormalizedRef = useRef<[number, number]>([0, 0])
  const mouseLeftDownRef = useRef<boolean>(false)
  const canvasRectRef = useRef<DOMRect | null>(null)
  const onErrorRef = useRef(options.onError)
  const onFrameRef = useRef(options.onFrame)
  const onClickRef = useRef(options.onClick)
  const onMouseDownRef = useRef(options.onMouseDown)
  const onMouseUpRef = useRef(options.onMouseUp)
  const onMouseMoveRef = useRef(options.onMouseMove)
  const onMouseWheelRef = useRef(options.onMouseWheel)
  const timeScaleRef = useRef(options.timeScale ?? 1)
  const fragmentRef = useRef(options.fragment)
  const uniformsRef = useRef(options.uniforms)
  const dprRef = useRef(window.devicePixelRatio || 1)

  // Keep refs updated
  onErrorRef.current = options.onError
  onFrameRef.current = options.onFrame
  onClickRef.current = options.onClick
  onMouseDownRef.current = options.onMouseDown
  onMouseUpRef.current = options.onMouseUp
  onMouseMoveRef.current = options.onMouseMove
  onMouseWheelRef.current = options.onMouseWheel
  timeScaleRef.current = options.timeScale ?? 1
  fragmentRef.current = options.fragment
  uniformsRef.current = options.uniforms

  const buildFrameInfo = useCallback((deltaTime: number): FrameInfo => {
    const canvas = canvasRef.current
    return {
      deltaTime,
      time: elapsedTimeRef.current,
      resolution: [canvas?.width ?? 0, canvas?.height ?? 0],
      mouse: mouseRef.current,
      mouseNormalized: mouseNormalizedRef.current,
      mouseLeftDown: mouseLeftDownRef.current,
    }
  }, [])

  const render = useCallback(
    (time: number) => {
      const state = stateRef.current
      const canvas = canvasRef.current
      if (!state || !canvas) {
        return
      }

      // Calculate delta time
      const deltaTime = lastFrameTimeRef.current === 0 ? 0 : (time - lastFrameTimeRef.current) / 1000
      lastFrameTimeRef.current = time
      elapsedTimeRef.current += deltaTime * timeScaleRef.current

      // Call onFrame callback with current frame info
      if (onFrameRef.current) {
        onFrameRef.current(buildFrameInfo(deltaTime))
      }

      const { device, context, pipeline, uniformBuffer, uniformBindGroup, uniformLayout } = state

      // Handle canvas resize with high-DPI support
      const dpr = dprRef.current
      const displayWidth = canvas.clientWidth
      const displayHeight = canvas.clientHeight

      // Skip rendering if canvas has zero size
      if (displayWidth === 0 || displayHeight === 0) {
        animationFrameRef.current = requestAnimationFrame(render)
        return
      }

      const bufferWidth = Math.round(displayWidth * dpr)
      const bufferHeight = Math.round(displayHeight * dpr)
      if (canvas.width !== bufferWidth || canvas.height !== bufferHeight) {
        canvas.width = bufferWidth
        canvas.height = bufferHeight
      }

      // Build default uniform values
      const defaultValues: Record<string, GpuUniformValue> = {
        iTime: elapsedTimeRef.current,
        iMouseLeftDown: mouseLeftDownRef.current ? 1.0 : 0.0,
        iResolution: [canvas.width, canvas.height],
        iMouse: mouseRef.current,
        iMouseNormalized: mouseNormalizedRef.current,
      }

      // Merge with custom uniforms and auto-generate _count values for arrays
      const allValues: Record<string, GpuUniformValue> = { ...defaultValues, ...uniformsRef.current }
      if (uniformsRef.current) {
        for (const [name, value] of Object.entries(uniformsRef.current)) {
          if (isVec4Array(value)) {
            allValues[`${name}_count`] = value.length
          }
        }
      }

      // Pack uniforms into buffer according to layout
      const uniformData = new Float32Array(uniformLayout.bufferSize / 4)
      for (const field of uniformLayout.fields) {
        const value = allValues[field.name]
        if (value === undefined) {
          continue
        }
        packUniformValue(field, value, uniformData)
      }
      device.queue.writeBuffer(uniformBuffer, 0, uniformData)

      // console.log("uniformData", uniformData)

      // Create command encoder and render pass
      const commandEncoder = device.createCommandEncoder()
      const textureView = context.getCurrentTexture().createView()

      const renderPass = commandEncoder.beginRenderPass({
        colorAttachments: [
          {
            view: textureView,
            clearValue: { r: 0, g: 0, b: 0, a: 1 },
            loadOp: "clear",
            storeOp: "store",
          },
        ],
      })

      renderPass.setPipeline(pipeline)
      renderPass.setBindGroup(0, uniformBindGroup)
      renderPass.draw(3)
      renderPass.end()

      device.queue.submit([commandEncoder.finish()])

      // Continue render loop
      animationFrameRef.current = requestAnimationFrame(render)
    },
    [buildFrameInfo],
  )

  // Initialize WebGPU and start render loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let mounted = true

    const initialize = async () => {
      try {
        const state = await initializeWebGPU(canvas, fragmentRef.current, uniformsRef.current)
        if (!mounted) {
          cleanupWebGPU(state)
          return
        }
        stateRef.current = state
        elapsedTimeRef.current = 0
        lastFrameTimeRef.current = 0
        animationFrameRef.current = requestAnimationFrame(render)
      } catch (err) {
        if (!mounted) return
        const error = err instanceof Error ? err : new Error(String(err))
        if (onErrorRef.current) {
          onErrorRef.current(error)
        } else {
          console.error("WebGPU initialization failed:", error)
        }
      }
    }

    // Listen for DPR changes
    const dprMediaQuery = window.matchMedia(`(resolution: ${dprRef.current}dppx)`)
    const handleDprChange = () => {
      dprRef.current = window.devicePixelRatio || 1
    }
    dprMediaQuery.addEventListener("change", handleDprChange)

    void initialize()

    return () => {
      mounted = false
      dprMediaQuery.removeEventListener("change", handleDprChange)
      cancelAnimationFrame(animationFrameRef.current)
      if (stateRef.current) {
        cleanupWebGPU(stateRef.current)
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
      // Y is inverted: WebGL/WebGPU convention has Y=0 at bottom, DOM has Y=0 at top
      const y = (rect.height - (event.clientY - rect.top)) * dpr
      mouseRef.current = [x, y]

      // Update normalized mouse position
      const minDimension = Math.min(canvas.width, canvas.height) || 1
      mouseNormalizedRef.current = [
        (mouseRef.current[0] - canvas.width / 2) / minDimension,
        (mouseRef.current[1] - canvas.height / 2) / minDimension,
      ]

      onMouseMoveRef.current?.(buildFrameInfo(0))
    }

    const handleMouseDown = (event: MouseEvent) => {
      if (event.button === 0) {
        mouseLeftDownRef.current = true
      }
      onMouseDownRef.current?.(buildFrameInfo(0))
    }

    const handleMouseUp = (event: MouseEvent) => {
      if (event.button === 0) {
        mouseLeftDownRef.current = false
      }
      onMouseUpRef.current?.(buildFrameInfo(0))
    }

    const handleClick = () => {
      onClickRef.current?.(buildFrameInfo(0))
    }

    const handleMouseWheel = (event: WheelEvent) => {
      onMouseWheelRef.current?.(buildFrameInfo(0), event.deltaY)
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
  }, [buildFrameInfo])

  return { canvasRef, mouseRef }
}
