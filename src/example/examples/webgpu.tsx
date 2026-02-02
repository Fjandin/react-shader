import {
  generateDistortionRippleFunctionGpu,
  generateSceneCirclesFunctionGpu,
  generateSimplexNoiseFunctionGpu,
  ReactGpuShader,
} from "../.."

const gradientShader = /*wgsl*/ `

${generateSceneCirclesFunctionGpu()}
${generateDistortionRippleFunctionGpu()}
${generateSimplexNoiseFunctionGpu()}

fn mainImage(uv0: vec2f) -> vec4f {
  var uv = uv0;

  if (uniforms.iMouseLeftDown == 1.0) {
    uv += DistortionRipple(uv, uniforms.iMouseNormalized, uniforms.rippleRadius, 1.0, 0.2);
  }

  uv += DistortionRipple(uv, uniforms.ripples[1], uniforms.rippleRadius, 1.0, 0.2);

  // 
  // for (var i: i32 = 0; i < uniforms.ripples_count; i++) {
  //   uv += DistortionRipple(uv, uniforms.ripples[i], uniforms.rippleRadius, 1.0, 0.2);
  // }

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
  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <ReactGpuShader
        fragment={gradientShader}
        uniforms={{
          rippleRadius: 0.1,
          ripples: [
            [0, 0],
            [0.5, 0.5],
          ],
        }}
      />
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
