import { useCallback, useEffect, useRef } from "react"
import type { FrameInfo, GpuUniformValue, Vec2, Vec3, Vec4, Vec4Array } from "../types"

interface UseWebGPUOptions {
  fragment: string
  uniforms?: Record<string, GpuUniformValue>
  storageBuffers?: Record<string, Vec4Array>
  onError?: (error: Error) => void
  timeScale?: number
  onFrame?: (info: FrameInfo) => void
  onClick?: (info: FrameInfo) => void
  onMouseMove?: (info: FrameInfo) => void
  onMouseDown?: (info: FrameInfo) => void
  onMouseUp?: (info: FrameInfo) => void
  onMouseWheel?: (info: FrameInfo, wheelDelta: number) => void
}

interface StorageBufferEntry {
  name: string
  binding: number
  buffer: GPUBuffer
  currentLength: number
  dataLength: number
  packingArray: Float32Array<ArrayBuffer>
}

interface WebGPUState {
  device: GPUDevice
  context: GPUCanvasContext
  pipeline: GPURenderPipeline
  uniformBuffer: GPUBuffer
  uniformBindGroup: GPUBindGroup
  uniformLayout: UniformLayout
  bindGroupLayout: GPUBindGroupLayout
  storageBuffers: StorageBufferEntry[]
  renderPassDescriptor: GPURenderPassDescriptor
  submitArray: GPUCommandBuffer[]
}

type WgslBaseType = "f32" | "vec2f" | "vec3f" | "vec4f"

interface UniformField {
  name: string
  type: WgslBaseType
  offset: number
  size: number
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

function inferWgslType(value: GpuUniformValue): WgslBaseType {
  if (typeof value === "number") return "f32"
  if (isVec4(value)) return "vec4f"
  if (isVec3(value)) return "vec3f"
  if (isVec2(value)) return "vec2f"
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

    fields.push({ name, type: baseType, offset, size })
    offset += size
  }

  // Add default uniforms first (already ordered for good packing)
  for (const u of DEFAULT_UNIFORMS) {
    addField(u.name, u.baseType)
  }

  // Add custom uniforms sorted by alignment for better packing
  if (customUniforms) {
    const entries = Object.entries(customUniforms).map(([name, value]) => ({
      name,
      baseType: inferWgslType(value),
    }))
    entries.sort((a, b) => getTypeAlignment(b.baseType) - getTypeAlignment(a.baseType))
    for (const { name, baseType } of entries) {
      addField(name, baseType)
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

  if (typeof value === "number") {
    floatData[floatOffset] = value
  } else if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      floatData[floatOffset + i] = value[i]
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

function getStorageBufferNames(defs?: Record<string, Vec4Array>): string[] {
  if (!defs) return []
  return Object.keys(defs).sort()
}

function createStorageBuffer(device: GPUDevice, name: string, binding: number, data: Vec4Array): StorageBufferEntry {
  const length = Math.max(data.length, 1)
  const byteSize = length * 16 // 4 floats * 4 bytes each
  const buffer = device.createBuffer({
    label: `storage: ${name}`,
    size: byteSize,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  })
  const packingArray = new Float32Array(length * 4)

  // Pack initial data
  for (let i = 0; i < data.length; i++) {
    const off = i * 4
    packingArray[off] = data[i][0]
    packingArray[off + 1] = data[i][1]
    packingArray[off + 2] = data[i][2]
    packingArray[off + 3] = data[i][3]
  }
  device.queue.writeBuffer(buffer, 0, packingArray)

  return { name, binding, buffer, currentLength: length, dataLength: data.length, packingArray }
}

function packAndUploadStorageBuffer(device: GPUDevice, entry: StorageBufferEntry, data: Vec4Array): void {
  const arr = entry.packingArray
  for (let i = 0; i < data.length; i++) {
    const off = i * 4
    arr[off] = data[i][0]
    arr[off + 1] = data[i][1]
    arr[off + 2] = data[i][2]
    arr[off + 3] = data[i][3]
  }
  const uploadLength = Math.max(entry.dataLength, 1)
  device.queue.writeBuffer(entry.buffer, 0, arr, 0, uploadLength * 4)
}

function rebuildBindGroup(state: WebGPUState): GPUBindGroup {
  const entries: GPUBindGroupEntry[] = [{ binding: 0, resource: { buffer: state.uniformBuffer } }]
  for (const sb of state.storageBuffers) {
    entries.push({ binding: sb.binding, resource: { buffer: sb.buffer } })
  }
  return state.device.createBindGroup({
    layout: state.bindGroupLayout,
    entries,
  })
}

function createFragmentShader(userCode: string, layout: UniformLayout, storageBufferNames: string[]): string {
  const storageDeclarations = storageBufferNames
    .map((name, i) => `@group(0) @binding(${i + 1}) var<storage, read> ${name}: array<vec4f>;`)
    .join("\n")

  return `
${generateUniformStruct(layout)}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
${storageDeclarations}

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
  storageBufferDefs?: Record<string, Vec4Array>,
): Promise<WebGPUState> {
  if (!navigator.gpu) {
    throw new Error("WebGPU not supported in this browser")
  }

  const adapter = await navigator.gpu.requestAdapter()
  if (!adapter) {
    throw new Error("Failed to get WebGPU adapter")
  }

  const device = await adapter.requestDevice()

  device.lost.then((info) => {
    console.error(`WebGPU device lost: ${info.message}`)
  })

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
  const storageBufferNames = getStorageBufferNames(storageBufferDefs)

  const vertexModule = device.createShaderModule({
    label: "vertex shader",
    code: VERTEX_SHADER,
  })

  const fragmentModule = device.createShaderModule({
    label: "fragment shader",
    code: createFragmentShader(fragmentSource, uniformLayout, storageBufferNames),
  })

  // Create uniform buffer with calculated size
  const uniformBuffer = device.createBuffer({
    label: "uniforms",
    size: uniformLayout.bufferSize,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  })

  // Create storage buffers
  const storageBuffers: StorageBufferEntry[] = storageBufferNames.map((name, i) =>
    createStorageBuffer(device, name, i + 1, storageBufferDefs?.[name] ?? []),
  )

  // Build bind group layout entries
  const layoutEntries: GPUBindGroupLayoutEntry[] = [
    {
      binding: 0,
      visibility: GPUShaderStage.FRAGMENT,
      buffer: { type: "uniform" },
    },
  ]
  for (const sb of storageBuffers) {
    layoutEntries.push({
      binding: sb.binding,
      visibility: GPUShaderStage.FRAGMENT,
      buffer: { type: "read-only-storage" },
    })
  }

  const bindGroupLayout = device.createBindGroupLayout({ entries: layoutEntries })

  // Build bind group entries
  const bindGroupEntries: GPUBindGroupEntry[] = [{ binding: 0, resource: { buffer: uniformBuffer } }]
  for (const sb of storageBuffers) {
    bindGroupEntries.push({ binding: sb.binding, resource: { buffer: sb.buffer } })
  }

  const uniformBindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: bindGroupEntries,
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
    bindGroupLayout,
    storageBuffers,
    renderPassDescriptor: {
      colorAttachments: [
        {
          view: undefined as unknown as GPUTextureView,
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: "clear" as const,
          storeOp: "store" as const,
        },
      ],
    },
    submitArray: [null as unknown as GPUCommandBuffer],
  }
}

function cleanupWebGPU(state: WebGPUState): void {
  for (const sb of state.storageBuffers) {
    sb.buffer.destroy()
  }
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
  const resolutionRef = useRef<[number, number]>([0, 0])
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
  const storageBuffersRef = useRef(options.storageBuffers)
  const dprRef = useRef(window.devicePixelRatio || 1)
  const uniformDataRef = useRef<Float32Array<ArrayBuffer> | null>(null)
  const allValuesRef = useRef<Record<string, GpuUniformValue>>({})
  const frameInfoRef = useRef<FrameInfo>({
    deltaTime: 0,
    time: 0,
    resolution: [0, 0],
    mouse: [0, 0],
    mouseNormalized: [0, 0],
    mouseLeftDown: false,
  })

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
  storageBuffersRef.current = options.storageBuffers

  const render = useCallback((time: number) => {
    const state = stateRef.current
    const canvas = canvasRef.current
    if (!state || !canvas) {
      return
    }

    // Calculate delta time
    const deltaTime = lastFrameTimeRef.current === 0 ? 0 : (time - lastFrameTimeRef.current) / 1000
    lastFrameTimeRef.current = time
    elapsedTimeRef.current += deltaTime * timeScaleRef.current

    const info = frameInfoRef.current
    info.deltaTime = deltaTime
    info.time = elapsedTimeRef.current
    info.resolution[0] = canvas.width
    info.resolution[1] = canvas.height
    info.mouse = mouseRef.current
    info.mouseNormalized = mouseNormalizedRef.current
    info.mouseLeftDown = mouseLeftDownRef.current

    // Call onFrame callback with current frame info
    if (onFrameRef.current) {
      onFrameRef.current(frameInfoRef.current)
    }

    const { device, context, pipeline, uniformBuffer, uniformLayout } = state

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

    // Update default uniform values in-place
    const allValues = allValuesRef.current
    allValues.iTime = elapsedTimeRef.current
    allValues.iMouseLeftDown = mouseLeftDownRef.current ? 1.0 : 0.0
    resolutionRef.current[0] = canvas.width
    resolutionRef.current[1] = canvas.height
    allValues.iResolution = resolutionRef.current
    allValues.iMouse = mouseRef.current
    allValues.iMouseNormalized = mouseNormalizedRef.current

    // Merge custom uniforms
    const customs = uniformsRef.current
    if (customs) {
      for (const name in customs) {
        allValues[name] = customs[name]
      }
    }

    // Pack uniforms into pre-allocated buffer according to layout
    const uniformData = uniformDataRef.current as Float32Array<ArrayBuffer>
    for (const field of uniformLayout.fields) {
      const value = allValues[field.name]
      if (value === undefined) {
        continue
      }
      packUniformValue(field, value, uniformData)
    }
    device.queue.writeBuffer(uniformBuffer, 0, uniformData)

    // Update storage buffers
    let needsBindGroupRebuild = false
    for (const entry of state.storageBuffers) {
      const data = storageBuffersRef.current?.[entry.name]
      if (!data) continue

      const requiredLength = Math.max(data.length, 1)
      if (requiredLength > entry.currentLength || requiredLength < entry.currentLength / 2) {
        // Buffer needs resize — over-allocate to reduce rebuilds
        const allocLength = Math.max(Math.ceil(requiredLength * 1.5), 1)
        entry.buffer.destroy()
        const byteSize = allocLength * 16
        entry.buffer = device.createBuffer({
          label: `storage: ${entry.name}`,
          size: byteSize,
          usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        })
        entry.packingArray = new Float32Array(allocLength * 4)
        entry.currentLength = allocLength
        needsBindGroupRebuild = true
      }
      entry.dataLength = data.length

      packAndUploadStorageBuffer(device, entry, data)
    }

    if (needsBindGroupRebuild) {
      state.uniformBindGroup = rebuildBindGroup(state)
    }

    // Create command encoder and render pass
    const commandEncoder = device.createCommandEncoder()
    const textureView = context.getCurrentTexture().createView()
    ;(state.renderPassDescriptor.colorAttachments as GPURenderPassColorAttachment[])[0].view = textureView
    const renderPass = commandEncoder.beginRenderPass(state.renderPassDescriptor)

    renderPass.setPipeline(pipeline)
    renderPass.setBindGroup(0, state.uniformBindGroup)
    renderPass.draw(3)
    renderPass.end()

    state.submitArray[0] = commandEncoder.finish()
    device.queue.submit(state.submitArray)

    // Continue render loop
    animationFrameRef.current = requestAnimationFrame(render)
  }, [])

  // Initialize WebGPU and start render loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let mounted = true

    const initialize = async () => {
      try {
        const state = await initializeWebGPU(
          canvas,
          fragmentRef.current,
          uniformsRef.current,
          storageBuffersRef.current,
        )
        if (!mounted) {
          cleanupWebGPU(state)
          return
        }
        stateRef.current = state
        uniformDataRef.current = new Float32Array(state.uniformLayout.bufferSize / 4)
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

      onMouseMoveRef.current?.(frameInfoRef.current)
    }

    const handleMouseDown = (event: MouseEvent) => {
      if (event.button === 0) {
        mouseLeftDownRef.current = true
      }
      onMouseDownRef.current?.(frameInfoRef.current)
    }

    const handleMouseUp = (event: MouseEvent) => {
      if (event.button === 0) {
        mouseLeftDownRef.current = false
      }
      onMouseUpRef.current?.(frameInfoRef.current)
    }

    const handleClick = () => {
      onClickRef.current?.(frameInfoRef.current)
    }

    const handleMouseWheel = (event: WheelEvent) => {
      onMouseWheelRef.current?.(frameInfoRef.current, event.deltaY)
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
