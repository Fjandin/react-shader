import { generateDistortionRippleFunctionGpu, generateSceneCirclesFunctionGpu, ReactGpuShader } from "../.."

const gradientShader = /*wgsl*/ `

${generateSceneCirclesFunctionGpu()}

${generateDistortionRippleFunctionGpu()}

fn mainImage(uv0: vec2f) -> vec4f {
  var uv = uv0;

  uv += DistortionRipple(uv, uniforms.iMouseNormalized, 0.5, 1.0, 0.2);

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
  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <ReactGpuShader fragment={gradientShader} />
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
