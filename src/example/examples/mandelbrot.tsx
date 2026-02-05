import { useCallback, useRef, useState } from "react"
import { type FrameInfo, generateColorPaletteFunctionGpu, ReactGpuShader, type Vec2 } from "../.."

const gradientShader = /*wgsl*/ `

${generateColorPaletteFunctionGpu("colorPalette", "[[0.5 0.5 0.5] [0.5 0.5 0.5] [1.0 1.0 1.0] [0.263 0.416 0.557]]")}

fn mainImage(uv0: vec2f) -> vec4f {
  let uv = uv0 * uniforms.scale;
  let c = uv + uniforms.center;

  var z = vec2f(0.0); // logic: mutable variable
  var iterations = 0;
  const maxIterations = 100;
  const escapeRadius = 2.0;

  while (length(z) <= escapeRadius && iterations < maxIterations) {
    // Math: explicit float types
    z = vec2f(z.x * z.x - z.y * z.y + c.x, 2.0 * z.x * z.y + c.y);
    iterations++;
  }

  // Casting: explicit casting from i32 to f32
  let color = colorPalette(f32(iterations) / f32(maxIterations));

  // Fix: Return the calculated color (Input code returned raw UVs)
  return vec4f(color, 1.0);
}
`

export function WebGpuMandelbrotDemo() {
  const [center, setCenter] = useState<Vec2>([0, 0])
  const [scale, setScale] = useState<number>(1)
  const lastMousePosRef = useRef<Vec2 | null>(null)
  const onMouseWheel = useCallback(
    (info: FrameInfo, wheelDelta: number) => {
      const zoomFactor = wheelDelta > 0 ? 0.9 : 1.1
      const mouseWorld: Vec2 = [
        info.mouseNormalized[0] * scale + center[0],
        info.mouseNormalized[1] * scale + center[1],
      ]
      const newScale = scale * zoomFactor
      const newCenter: Vec2 = [
        mouseWorld[0] - info.mouseNormalized[0] * newScale,
        mouseWorld[1] - info.mouseNormalized[1] * newScale,
      ]
      setScale(newScale)
      setCenter(newCenter)
    },
    [scale, center],
  )

  const onMouseMove = useCallback(
    (info: FrameInfo) => {
      if (!info.mouseLeftDown) {
        lastMousePosRef.current = null
        return
      }
      const currentPos: Vec2 = [info.mouseNormalized[0] * scale, info.mouseNormalized[1] * scale]
      if (lastMousePosRef.current) {
        const deltaX = currentPos[0] - lastMousePosRef.current[0]
        const deltaY = currentPos[1] - lastMousePosRef.current[1]
        setCenter((prev) => [prev[0] - deltaX, prev[1] - deltaY])
      }
      lastMousePosRef.current = currentPos
    },
    [scale],
  )

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <ReactGpuShader
        fragment={gradientShader}
        uniforms={{
          scale,
          center,
        }}
        timeScale={0.5}
        onMouseWheel={onMouseWheel}
        onMouseMove={onMouseMove}
      />
      <div
        style={{
          position: "absolute",
          bottom: 20,
          right: 20,
          color: "white",
          fontSize: "14px",
          background: "rgba(0,0,0,0.5)",
          padding: "8px 12px",
          borderRadius: "4px",
        }}
      >
        Scale: {scale.toExponential(2)}
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 20,
          left: 20,
          color: "white",
          fontSize: "14px",
          background: "rgba(0,0,0,0.5)",
          padding: "8px 12px",
          borderRadius: "4px",
        }}
      >
        WebGPU Demo - Mandelbrot with WGSL shader
      </div>
    </div>
  )
}
