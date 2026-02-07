# @fjandin/react-shader

A React component library for rendering WebGL and WebGPU shaders. Provides `<ReactShader>` for GLSL (Shadertoy-style) and `<ReactGpuShader>` for WGSL (WebGPU) with automatic uniform handling, texture support, storage buffers, and audio reactivity.

## Installation

```bash
npm install @fjandin/react-shader
# or
yarn add @fjandin/react-shader
# or
bun add @fjandin/react-shader
```

## Components

### `<ReactShader>` (WebGL)

Renders GLSL fragment shaders. Uses WebGL2 with WebGL1 fallback.

```tsx
import { ReactShader } from "@fjandin/react-shader"

const fragment = `#version 300 es
precision highp float;

uniform float iTime;
uniform vec2 iResolution;

out vec4 fragColor;

void main() {
  vec2 uv = gl_FragCoord.xy / iResolution;
  vec3 color = 0.5 + 0.5 * cos(iTime + uv.xyx + vec3(0, 2, 4));
  fragColor = vec4(color, 1.0);
}
`

function App() {
  return (
    <div style={{ width: "800px", height: "600px" }}>
      <ReactShader fragment={fragment} />
    </div>
  )
}
```

### `<ReactGpuShader>` (WebGPU)

Renders WGSL fragment shaders using WebGPU. Supports storage buffers for large array data.

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

WebGPU shaders define a `mainImage(uv: vec2f) -> vec4f` function. Built-in uniforms are accessed via `uniforms.iTime`, `uniforms.iResolution`, etc. The component automatically generates the uniform struct and wrapping `@fragment` entry point.

## Props

### ReactShader

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `fragment` | `string` | Yes | - | GLSL fragment shader source code |
| `vertex` | `string` | No | Default quad shader | GLSL vertex shader source code |
| `uniforms` | `Record<string, UniformValue>` | No | `{}` | Custom uniform values |
| `className` | `string` | No | - | CSS class name for the canvas |
| `fullscreen` | `boolean` | No | `false` | Render as fixed fullscreen overlay |
| `timeScale` | `number` | No | `1` | Scale factor for elapsed time |
| `onFrame` | `(info: FrameInfo) => void` | No | - | Callback invoked on each frame |
| `onClick` | `(info: FrameInfo) => void` | No | - | Callback invoked on canvas click |
| `onMouseMove` | `(info: FrameInfo) => void` | No | - | Callback invoked on mouse move |
| `onMouseDown` | `(info: FrameInfo) => void` | No | - | Callback invoked on mouse button press |
| `onMouseUp` | `(info: FrameInfo) => void` | No | - | Callback invoked on mouse button release |
| `onMouseWheel` | `(info: FrameInfo, wheelDelta: number) => void` | No | - | Callback invoked on mouse wheel scroll |

### ReactGpuShader

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

| Uniform | GLSL Type | WGSL Type | Description |
|---------|-----------|-----------|-------------|
| `iTime` | `float` | `f32` | Elapsed time in seconds (scaled by `timeScale`) |
| `iMouse` | `vec2` | `vec2f` | Mouse position in pixels (Y=0 at bottom) |
| `iMouseNormalized` | `vec2` | `vec2f` | Mouse position normalized with aspect correction (shorter axis -0.5 to 0.5, center is 0,0) |
| `iMouseLeftDown` | `float` | `f32` | `1.0` when left mouse button is pressed, `0.0` otherwise |
| `iResolution` | `vec2` | `vec2f` | Canvas resolution in pixels (includes high-DPI scaling) |

## Custom Uniforms

### WebGL (ReactShader)

Pass custom uniform values via the `uniforms` prop. Supports scalars, vectors, arrays, and textures:

```tsx
<ReactShader
  fragment={fragment}
  uniforms={{
    scale: 2.0,                              // float
    offset: [0.5, 0.5],                      // vec2
    color: [1.0, 0.5, 0.2],                  // vec3
    transform: [1, 0, 0, 1],                 // vec4
    weights: [0.1, 0.2, 0.3, 0.25, 0.15],   // float array
    points: [[0, 0], [1, 0], [0.5, 1]],     // vec2 array
    colors: [[1, 0, 0], [0, 1, 0]],         // vec3 array
    ripples: [[0, 0, 0.5, 0.1]],            // vec4 array
  }}
/>
```

Supported types:
- `number` → `float`
- `[number, number]` → `vec2`
- `[number, number, number]` → `vec3`
- `[number, number, number, number]` → `vec4`
- `number[]` (length > 4) → `float[N]`
- `[number, number][]` → `vec2[N]`
- `[number, number, number][]` → `vec3[N]`
- `[number, number, number, number][]` → `vec4[N]`
- `HTMLImageElement | HTMLCanvasElement | HTMLVideoElement | ImageBitmap | ImageData | OffscreenCanvas` → `sampler2D` (texture)
- `TextureOptions` object → `sampler2D` with wrap/filter configuration

### WebGPU (ReactGpuShader)

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

## Array Count Uniforms (WebGL)

For array uniforms, an additional `_count` uniform is automatically created and set:

```tsx
uniforms={{ points: [[0, 0], [1, 0], [0.5, 1]] }}
```

This generates both `uniform vec2 points[3]` and `uniform int points_count` (set to `3`), allowing you to loop over arrays in your shader:

```glsl
for (int i = 0; i < points_count; i++) {
  // Use points[i]...
}
```

## Storage Buffers (WebGPU)

For large dynamic array data, `ReactGpuShader` supports storage buffers. These are more efficient than uniforms for large datasets and support dynamic resizing:

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

## Texture Uniforms (WebGL)

Pass images, canvases, or video elements as texture uniforms:

```tsx
<ReactShader
  fragment={fragment}
  uniforms={{
    myTexture: imageElement,
    // or with options:
    myTexture: {
      source: imageElement,
      wrapS: "repeat",   // "repeat" | "clamp" | "mirror"
      wrapT: "repeat",
      minFilter: "linear", // "nearest" | "linear" | "mipmap"
      magFilter: "linear", // "nearest" | "linear"
      flipY: true,
    },
  }}
/>
```

## Automatic Uniform Injection (WebGL)

Instead of manually declaring uniforms in your shader, you can use the `// @UNIFORM_VALUES` marker to automatically inject all uniform declarations:

```tsx
const fragment = `#version 300 es
precision highp float;

// @UNIFORM_VALUES

out vec4 fragColor;

void main() {
  vec2 uv = gl_FragCoord.xy / iResolution;
  vec3 col = baseColor * (sin(iTime) * 0.5 + 0.5);
  fragColor = vec4(col, 1.0);
}
`

<ReactShader
  fragment={fragment}
  uniforms={{ baseColor: [1.0, 0.5, 0.2] }}
/>
```

The marker gets replaced with declarations for both built-in uniforms (`iTime`, `iMouse`, `iMouseNormalized`, `iMouseLeftDown`, `iResolution`) and your custom uniforms.

## Audio Reactivity

The `useAudio` hook provides real-time audio analysis for audio-reactive shaders:

```tsx
import { ReactShader, useAudio } from "@fjandin/react-shader"

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
      <ReactShader
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

Pre-built shader functions are available for both GLSL and WGSL:

```tsx
import {
  // GLSL (WebGL)
  generateSimplexNoiseFunction,
  generateColorPaletteFunction,
  generateDistortionRippleFunction,
  generateSceneCirclesFunction,
  generateUtilsFunction,
  // WGSL (WebGPU)
  generateSimplexNoiseFunctionGpu,
  generateColorPaletteFunctionGpu,
  generateDistortionRippleFunctionGpu,
  generateSceneCirclesFunctionGpu,
} from "@fjandin/react-shader"
```

Inject them into your shader source:

```tsx
// GLSL
const fragment = `#version 300 es
precision highp float;
${generateSimplexNoiseFunction()}
// Use SimplexNoise3D(vec3 v) in your shader...
`

// WGSL
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
    <ReactShader
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
  FloatArray,
  Vec2Array,
  Vec3Array,
  Vec4Array,
  UniformValue,
  GpuStorageBuffers,
  DefaultUniforms,
  FrameInfo,
  ReactShaderProps,
  ReactGpuShaderProps,
  TextureSource,
  TextureOptions,
  TextureWrap,
  TextureMinFilter,
  TextureMagFilter,
  AudioLevels,
  AudioConnectionState,
  AudioSourceType,
  UseAudioOptions,
  UseAudioReturn,
} from "@fjandin/react-shader"
```

A utility function for generating uniform declarations is also exported:

```tsx
import { generateUniformDeclarations } from "@fjandin/react-shader"

const declarations = generateUniformDeclarations({
  scale: 1.0,
  points: [[0, 0], [1, 1]],
})
// Returns:
// uniform float scale;
// uniform vec2 points[2];
// uniform int points_count;
```

## Features

- WebGL2 with WebGL1 fallback (`ReactShader`)
- WebGPU support with WGSL shaders (`ReactGpuShader`)
- Storage buffers for large dynamic arrays (WebGPU)
- Texture uniforms with configurable wrap/filter modes (WebGL)
- Audio reactivity via `useAudio` hook
- Pre-built shader functions (simplex noise, color palettes, distortion ripples, circles)
- High-DPI display support with automatic DPR change detection
- Automatic canvas resizing
- Shader compilation error display
- Context loss/restoration handling
- Mouse tracking with WebGL/WebGPU coordinate convention
- Optimized render loop with minimal per-frame allocations

## Requirements

- React >= 17.0.0

## License

MIT
