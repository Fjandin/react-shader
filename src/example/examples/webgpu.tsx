import { useCallback, useRef, useState } from "react"
import {
  type FrameInfo,
  generateDistortionRippleFunctionGpu,
  generateSceneCirclesFunctionGpu,
  generateSimplexNoiseFunctionGpu,
  ReactGpuShader,
  type Vec2,
  type Vec4,
  type Vec4Array,
} from "../.."

const gradientShader = /*wgsl*/ `

${generateSceneCirclesFunctionGpu()}
${generateDistortionRippleFunctionGpu()}
${generateSimplexNoiseFunctionGpu()}

fn mainImage(uv0: vec2f) -> vec4f {
  var uv = uv0;

  for (var i: i32 = 1; i < i32(uniforms.ripples_count); i++) {
    uv += DistortionRipple(
      uv,
      uniforms.ripples[i].xy,
      uniforms.ripples[i][2],
      uniforms.ripples[i][3] * 0.1,
      0.05
    );
  }

  let noiseValueX = SimplexNoise3D(vec3(uv / 0.1, uniforms.iTime)) * 0.1;
  let noiseValueY = SimplexNoise3D(vec3(uv / 0.1, -uniforms.iTime)) * 0.1;
  let noiseValue = vec2(noiseValueX, noiseValueY);

  uv += noiseValue * 0.1;

  let color = SceneCircles(                                                                                                                                         
    uv,                                                                                                                                                           
    1.0,           // iterations
    1.0,           // fractMultiplier
    uniforms.iTime,
    30.0,          // waveLength
    0.01,          // edgeBlur
    2.0            // contrast
  );

  return vec4f(color, 1.0);
}
`

export function WebGpuDemo() {
  const lastMouseMoveRef = useRef<number>(0)
  const ripplesRef = useRef<Vec4Array>([[0, 0, 0, 0]])
  const [scale, setScale] = useState<number>(1)
  const [rippleSpeed, setRippleSpeed] = useState<number>(0.5)
  const [ripples, setRipples] = useState<Vec4Array>([[0, 0, 0, 0]])

  const onMouseMove = useCallback(
    (info: FrameInfo) => {
      if (!info.mouseLeftDown) return
      const now = Date.now()
      if (now - lastMouseMoveRef.current < 100) return
      lastMouseMoveRef.current = now
      const normalizedMouse = [info.mouseNormalized[0] * scale, info.mouseNormalized[1] * scale] as Vec2
      const newRipple = [normalizedMouse[0], normalizedMouse[1], 0, 1] as Vec4
      ripplesRef.current = [...ripplesRef.current, newRipple]
    },
    [scale],
  )

  const onMouseDown = useCallback(
    (info: FrameInfo) => {
      const normalizedMouse = [info.mouseNormalized[0] * scale, info.mouseNormalized[1] * scale] as Vec2
      const newRipple = [normalizedMouse[0], normalizedMouse[1], 0, 1] as Vec4
      ripplesRef.current = [...ripplesRef.current, newRipple]
    },
    [scale],
  )

  const onFrame = useCallback(
    (info: FrameInfo) => {
      const newRipples = []
      let i = -1
      for (const ripple of ripplesRef.current) {
        i++
        if (i === 0) {
          newRipples.push([0, 0, 0, 0] as Vec4)
          continue
        }

        ripple[2] += info.deltaTime * rippleSpeed
        ripple[3] = Math.abs(ripple[2] - 1)
        if (ripple[2] <= 1) {
          newRipples.push(ripple)
        }
      }
      setRipples(newRipples)
    },
    [rippleSpeed],
  )

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <ReactGpuShader
        fragment={gradientShader}
        uniforms={{
          ripples,
        }}
        timeScale={0.5}
        onFrame={onFrame}
        onMouseMove={onMouseMove}
        onMouseDown={onMouseDown}
      />
      <div
        style={{
          position: "absolute",
          top: 20,
          right: 20,
          color: "white",
          fontSize: "14px",
          background: "rgba(0,0,0,0.5)",
          padding: "8px 12px",
          borderRadius: "4px",
        }}
      >
        {ripples.map((ripple, index) => (
          <div key={index.toString()}>
            {ripple[0].toFixed(2)}, {ripple[1].toFixed(2)}, {ripple[2].toFixed(2)}, {ripple[3].toFixed(2)}
          </div>
        ))}
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
        WebGPU Demo - Animated gradient with WGSL shader
      </div>
    </div>
  )
}
