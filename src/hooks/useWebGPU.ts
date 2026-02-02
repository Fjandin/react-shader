import { useCallback, useEffect, useRef } from "react"
import type { Vec2, Vec3, Vec4 } from "../types"

// Supported GPU uniform types (no textures/arrays for now)
type GpuUniformValue = number | Vec2 | Vec3 | Vec4

interface UseWebGPUOptions {
  fragment: string
  uniforms?: Record<string, GpuUniformValue>
  onError?: (error: Error) => void
}

interface WebGPUState {
  device: GPUDevice
  context: GPUCanvasContext
  pipeline: GPURenderPipeline
  uniformBuffer: GPUBuffer
  uniformBindGroup: GPUBindGroup
  uniformLayout: UniformLayout
}

type WgslType = "f32" | "vec2f" | "vec3f" | "vec4f"

interface UniformField {
  name: string
  type: WgslType
  offset: number
  size: number
}

interface UniformLayout {
  fields: UniformField[]
  bufferSize: number
}

function inferWgslType(value: GpuUniformValue): WgslType {
  if (typeof value === "number") return "f32"
  if (Array.isArray(value)) {
    if (value.length === 2) return "vec2f"
    if (value.length === 3) return "vec3f"
    if (value.length === 4) return "vec4f"
  }
  throw new Error(`Unsupported uniform value type: ${typeof value}`)
}

function getTypeAlignment(type: WgslType): number {
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

function getTypeSize(type: WgslType): number {
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
const DEFAULT_UNIFORMS: Array<{ name: string; type: WgslType }> = [
  { name: "iTime", type: "f32" },
  { name: "iMouseLeftDown", type: "f32" },
  { name: "iResolution", type: "vec2f" },
  { name: "iMouse", type: "vec2f" },
  { name: "iMouseNormalized", type: "vec2f" },
]

function calculateUniformLayout(customUniforms?: Record<string, GpuUniformValue>): UniformLayout {
  const fields: UniformField[] = []
  let offset = 0

  // Helper to add a field with proper alignment
  const addField = (name: string, type: WgslType) => {
    const alignment = getTypeAlignment(type)
    const size = getTypeSize(type)

    // Align offset
    offset = Math.ceil(offset / alignment) * alignment

    fields.push({ name, type, offset, size })
    offset += size
  }

  // Add default uniforms first (already ordered for good packing)
  for (const u of DEFAULT_UNIFORMS) {
    addField(u.name, u.type)
  }

  // Add custom uniforms, sorted by alignment (largest first) for better packing
  if (customUniforms) {
    const customEntries = Object.entries(customUniforms)
      .map(([name, value]) => ({ name, type: inferWgslType(value) }))
      .sort((a, b) => getTypeAlignment(b.type) - getTypeAlignment(a.type))

    for (const { name, type } of customEntries) {
      addField(name, type)
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
  const fragmentRef = useRef(options.fragment)
  const uniformsRef = useRef(options.uniforms)
  const dprRef = useRef(window.devicePixelRatio || 1)

  // Keep refs updated
  onErrorRef.current = options.onError
  fragmentRef.current = options.fragment
  uniformsRef.current = options.uniforms

  const render = useCallback((time: number) => {
    const state = stateRef.current
    const canvas = canvasRef.current
    if (!state || !canvas) return

    // Calculate delta time
    const deltaTime = lastFrameTimeRef.current === 0 ? 0 : (time - lastFrameTimeRef.current) / 1000
    lastFrameTimeRef.current = time
    elapsedTimeRef.current += deltaTime

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

    // Merge with custom uniforms
    const allValues = { ...defaultValues, ...uniformsRef.current }

    // Pack uniforms into buffer according to layout
    const uniformData = new Float32Array(uniformLayout.bufferSize / 4)
    for (const field of uniformLayout.fields) {
      const value = allValues[field.name]
      if (value === undefined) continue

      const floatOffset = field.offset / 4
      if (typeof value === "number") {
        uniformData[floatOffset] = value
      } else if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
          uniformData[floatOffset + i] = value[i]
        }
      }
    }
    device.queue.writeBuffer(uniformBuffer, 0, uniformData)

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
  }, [])

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
    }

    const handleMouseDown = (event: MouseEvent) => {
      if (event.button === 0) {
        mouseLeftDownRef.current = true
      }
    }

    const handleMouseUp = (event: MouseEvent) => {
      if (event.button === 0) {
        mouseLeftDownRef.current = false
      }
    }

    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("mousedown", handleMouseDown)
    window.addEventListener("mouseup", handleMouseUp)

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener("scroll", updateRect)
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mousedown", handleMouseDown)
      window.removeEventListener("mouseup", handleMouseUp)
    }
  }, [])

  return { canvasRef, mouseRef }
}
