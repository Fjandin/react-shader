import { useCallback, useEffect, useRef } from "react"

interface UseWebGPUOptions {
  fragment: string
  onError?: (error: Error) => void
}

interface WebGPUState {
  device: GPUDevice
  context: GPUCanvasContext
  pipeline: GPURenderPipeline
  uniformBuffer: GPUBuffer
  uniformBindGroup: GPUBindGroup
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

function createFragmentShader(userCode: string): string {
  return `
struct Uniforms {
  iTime: f32,
  _pad0: f32,
  iResolution: vec2f,
}

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

async function initializeWebGPU(canvas: HTMLCanvasElement, fragmentSource: string): Promise<WebGPUState> {
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

  const vertexModule = device.createShaderModule({
    label: "vertex shader",
    code: VERTEX_SHADER,
  })

  const fragmentModule = device.createShaderModule({
    label: "fragment shader",
    code: createFragmentShader(fragmentSource),
  })

  // Create uniform buffer (16 bytes: f32 time + f32 padding + vec2f resolution)
  const uniformBuffer = device.createBuffer({
    label: "uniforms",
    size: 16,
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
  const onErrorRef = useRef(options.onError)
  const fragmentRef = useRef(options.fragment)
  const dprRef = useRef(window.devicePixelRatio || 1)

  // Keep refs updated
  onErrorRef.current = options.onError
  fragmentRef.current = options.fragment

  const render = useCallback((time: number) => {
    const state = stateRef.current
    const canvas = canvasRef.current
    if (!state || !canvas) return

    // Calculate delta time
    const deltaTime = lastFrameTimeRef.current === 0 ? 0 : (time - lastFrameTimeRef.current) / 1000
    lastFrameTimeRef.current = time
    elapsedTimeRef.current += deltaTime

    const { device, context, pipeline, uniformBuffer, uniformBindGroup } = state

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

    // Update uniforms
    const uniformData = new Float32Array([
      elapsedTimeRef.current,
      0, // padding
      canvas.width,
      canvas.height,
    ])
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
        const state = await initializeWebGPU(canvas, fragmentRef.current)
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

  return { canvasRef }
}
