# @fjandin/react-shader

A React component library for rendering WebGPU shaders. Provides `<ReactGpuShader>` for WGSL with automatic uniform handling, storage buffers, and audio reactivity.

## Installation

```bash
npm install @fjandin/react-shader
# or
yarn add @fjandin/react-shader
# or
bun add @fjandin/react-shader
```

## Quick Start

```tsx
import { ReactGpuShader } from "@fjandin/react-shader"

const fragment = /*wgsl*/ `
fn mainImage(uv: vec2f) -> vec4f {
  let color = 0.5 + 0.5 * cos(uniforms.iTime + vec3f(uv, 0.0) + vec3f(0.0, 2.0, 4.0));
  return vec4f(color, 1.0);
}
`

function App() {
  return (
    <div style={{ width: "800px", height: "600px" }}>
      <ReactGpuShader fragment={fragment} />
    </div>
  )
}
```

Shaders define a `mainImage(uv: vec2f) -> vec4f` function. Built-in uniforms are accessed via `uniforms.iTime`, `uniforms.iResolution`, etc. The component automatically generates the uniform struct and wrapping `@fragment` entry point.

## Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `fragment` | `string` | Yes | - | WGSL fragment shader source code |
| `uniforms` | `Record<string, GpuUniformValue>` | No | `{}` | Custom uniform values (`number`, `Vec2`, `Vec3`, `Vec4`) |
| `storageBuffers` | `Record<string, Vec4Array>` | No | - | Named storage buffers of `Vec4` arrays |
| `className` | `string` | No | - | CSS class name for the canvas |
| `fullscreen` | `boolean` | No | `false` | Render as fixed fullscreen overlay |
| `timeScale` | `number` | No | `1` | Scale factor for elapsed time |
| `onFrame` | `(info: FrameInfo) => void` | No | - | Callback invoked on each frame |
| `onClick` | `(info: FrameInfo) => void` | No | - | Callback invoked on canvas click |
| `onMouseMove` | `(info: FrameInfo) => void` | No | - | Callback invoked on mouse move |
| `onMouseDown` | `(info: FrameInfo) => void` | No | - | Callback invoked on mouse button press |
| `onMouseUp` | `(info: FrameInfo) => void` | No | - | Callback invoked on mouse button release |
| `onMouseWheel` | `(info: FrameInfo, wheelDelta: number) => void` | No | - | Callback invoked on mouse wheel scroll |

## Built-in Uniforms

These uniforms are automatically provided to your shader every frame:

| Uniform | WGSL Type | Description |
|---------|-----------|-------------|
| `iTime` | `f32` | Elapsed time in seconds (scaled by `timeScale`) |
| `iMouse` | `vec2f` | Mouse position in pixels (Y=0 at bottom) |
| `iMouseNormalized` | `vec2f` | Mouse position normalized with aspect correction (shorter axis -0.5 to 0.5, center is 0,0) |
| `iMouseLeftDown` | `f32` | `1.0` when left mouse button is pressed, `0.0` otherwise |
| `iResolution` | `vec2f` | Canvas resolution in pixels (includes high-DPI scaling) |

## Custom Uniforms

Custom uniforms support scalar and vector types:

```tsx
<ReactGpuShader
  fragment={fragment}
  uniforms={{
    scale: 2.0,            // f32
    offset: [0.5, 0.5],   // vec2f
    color: [1.0, 0.5, 0.2], // vec3f
    transform: [1, 0, 0, 1], // vec4f
  }}
/>
```

Custom uniforms are accessed via `uniforms.scale`, `uniforms.color`, etc. in your WGSL code.

## Storage Buffers

For large dynamic array data, storage buffers are more efficient than uniforms and support dynamic resizing:

```tsx
const [particles, setParticles] = useState<Vec4Array>([
  [0, 0, 0.5, 1],
  [1, 1, 0.3, 0.8],
])

<ReactGpuShader
  fragment={fragment}
  storageBuffers={{ particles }}
/>
```

In WGSL, storage buffers are declared as `array<vec4f>` and accessed by name:

```wgsl
fn mainImage(uv: vec2f) -> vec4f {
  for (var i: u32 = 0; i < arrayLength(&particles); i++) {
    let p = particles[i];
    // Use p.xy as position, p.z as radius, p.w as intensity...
  }
  return vec4f(0.0);
}
```

Storage buffers use over-allocation (1.5x growth) to minimize GPU buffer rebuilds when array sizes change frequently.

## Audio Reactivity

The `useAudio` hook provides real-time audio analysis for audio-reactive shaders:

```tsx
import { ReactGpuShader, useAudio } from "@fjandin/react-shader"

function AudioVisualizer() {
  const audio = useAudio({
    source: "microphone", // "microphone" | "element" | "display"
    smoothing: 0.9,       // 0-1, lerp factor between frames
  })

  return (
    <>
      <button onClick={() => audio.isRunning ? audio.stop() : audio.start()}>
        {audio.isRunning ? "Stop" : "Start"}
      </button>
      <ReactGpuShader
        fragment={fragment}
        uniforms={{
          audioLow: audio.levels.low,
          audioMid: audio.levels.mid,
          audioHigh: audio.levels.high,
        }}
      />
    </>
  )
}
```

`useAudio` options:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `source` | `"microphone" \| "element" \| "display"` | `"microphone"` | Audio input source |
| `mediaElement` | `HTMLAudioElement \| HTMLVideoElement` | - | Media element (when `source` is `"element"`) |
| `fftSize` | `number` | `2048` | FFT size for frequency analysis |
| `smoothingTimeConstant` | `number` | `0.8` | AnalyserNode smoothing |
| `smoothing` | `number` | `0.9` | Frame-to-frame lerp factor (0 = instant, 0.9 = very smooth) |

`useAudio` return value:

| Field | Type | Description |
|-------|------|-------------|
| `levels` | `AudioLevels` | `{ low, mid, high, bands }` - normalized 0-1 frequency levels |
| `frequencyData` | `Uint8Array \| null` | Raw frequency data |
| `state` | `AudioConnectionState` | `"disconnected" \| "connecting" \| "connected" \| "error"` |
| `error` | `Error \| null` | Connection error if any |
| `start` | `() => Promise<void>` | Start audio capture |
| `stop` | `() => void` | Stop audio capture |
| `isRunning` | `boolean` | Whether audio is currently capturing |

## Shader Helper Functions

Pre-built WGSL shader functions are available:

```tsx
import {
  generateSimplexNoiseFunctionGpu,
  generateColorPaletteFunctionGpu,
  generateDistortionRippleFunctionGpu,
  generateSceneCirclesFunctionGpu,
} from "@fjandin/react-shader"
```

Inject them into your shader source:

```tsx
const fragment = /*wgsl*/ `
${generateSimplexNoiseFunctionGpu()}
fn mainImage(uv: vec2f) -> vec4f {
  let n = SimplexNoise3D(vec3f(uv, uniforms.iTime));
  return vec4f(vec3f(n), 1.0);
}
`
```

## Frame Callback

Use the `onFrame` callback to update uniforms based on animation timing:

```tsx
function App() {
  const [customTime, setCustomTime] = useState(0)

  return (
    <ReactGpuShader
      fragment={fragment}
      uniforms={{ customTime }}
      onFrame={(info) => {
        setCustomTime((prev) => prev + info.deltaTime * 0.5)
      }}
    />
  )
}
```

The `FrameInfo` object contains:
- `deltaTime` - Time since last frame in seconds
- `time` - Total elapsed time in seconds
- `resolution` - Canvas resolution as `[width, height]`
- `mouse` - Mouse position as `[x, y]`
- `mouseNormalized` - Aspect-corrected mouse position as `[x, y]`
- `mouseLeftDown` - Whether left mouse button is pressed

## TypeScript

All types are exported:

```tsx
import type {
  Vec2,
  Vec3,
  Vec4,
  Vec2Array,
  Vec3Array,
  Vec4Array,
  GpuUniformValue,
  GpuStorageBuffers,
  DefaultUniforms,
  FrameInfo,
  ReactGpuShaderProps,
  AudioLevels,
  AudioConnectionState,
  AudioSourceType,
  UseAudioOptions,
  UseAudioReturn,
} from "@fjandin/react-shader"
```

## Features

- WebGPU rendering with WGSL shaders
- Storage buffers for large dynamic arrays
- Audio reactivity via `useAudio` hook
- Pre-built shader functions (simplex noise, color palettes, distortion ripples, circles)
- High-DPI display support with automatic DPR change detection
- Automatic canvas resizing
- Shader compilation error display
- Mouse tracking with WebGPU coordinate convention
- Optimized render loop with minimal per-frame allocations

## Requirements

- React >= 17.0.0
- A browser with WebGPU support

## License

MIT
