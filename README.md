# @fjandin/react-shader

A React component for rendering WebGL fragment and vertex shaders. Designed to work with Shadertoy-style shaders with automatic uniform handling.

## Installation

```bash
npm install @fjandin/react-shader
# or
yarn add @fjandin/react-shader
# or
bun add @fjandin/react-shader
```

## Basic Usage

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

## Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `fragment` | `string` | Yes | - | GLSL fragment shader source code |
| `vertex` | `string` | No | Default quad shader | GLSL vertex shader source code |
| `uniforms` | `Record<string, UniformValue>` | No | `{}` | Custom uniform values |
| `className` | `string` | No | - | CSS class name for the container |
| `debug` | `boolean` | No | `false` | Show debug overlay with resolution and mouse info |
| `fullscreen` | `boolean` | No | `false` | Render as fixed fullscreen overlay |
| `timeScale` | `number` | No | `1` | Scale factor for elapsed time |
| `onFrame` | `(info: FrameInfo) => void` | No | - | Callback invoked on each frame |
| `onClick` | `(info: FrameInfo) => void` | No | - | Callback invoked on canvas click |
| `onMouseMove` | `(info: FrameInfo) => void` | No | - | Callback invoked on mouse move |

## Built-in Uniforms

These uniforms are automatically provided to your shader every frame:

| Uniform | GLSL Type | Description |
|---------|-----------|-------------|
| `iTime` | `float` | Elapsed time in seconds (scaled by `timeScale` prop) |
| `iMouse` | `vec2` | Mouse position in pixels (Y=0 at bottom) |
| `iMouseNormalized` | `vec2` | Mouse position normalized with aspect correction (shorter axis -0.5 to 0.5, center is 0,0) |
| `iMouseLeftDown` | `float` | `1.0` when left mouse button is pressed, `0.0` otherwise |
| `iResolution` | `vec2` | Canvas resolution in pixels (includes high-DPI scaling) |

## Custom Uniforms

Pass custom uniform values via the `uniforms` prop:

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

### Array Count Uniforms

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

## Automatic Uniform Injection

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

The marker gets replaced with declarations for both built-in uniforms (`iTime`, `iMouse`, `iMouseNormalized`, `iMouseLeftDown`, `iResolution`) and your custom uniforms:

```glsl
uniform float iTime;
uniform vec2 iMouse;
uniform vec2 iMouseNormalized;
uniform float iMouseLeftDown;
uniform vec2 iResolution;
uniform vec3 baseColor;
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
  DefaultUniforms,
  FrameInfo,
  ReactShaderProps,
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

- WebGL2 with WebGL1 fallback
- High-DPI display support via `devicePixelRatio`
- Automatic canvas resizing
- Shader compilation error display
- Context loss/restoration handling
- Mouse tracking with WebGL coordinate convention

## Requirements

- React >= 17.0.0

## License

MIT
