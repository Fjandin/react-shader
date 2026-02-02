import { ReactShader } from "../../ReactShader"
import { generateDistortionRippleFunction } from "../../shaders/distortion-ripple"
import { generateSceneCirclesFunction } from "../../shaders/scene-circles"
import { generateSimplexNoiseFunction } from "../../shaders/simplex-noise"
import { generateUtilsFunction } from "../../shaders/utils"

const gradientShader = /*glsl*/ `#version 300 es
precision mediump float;

// @UNIFORM_VALUES

out vec4 fragColor;

${generateDistortionRippleFunction()}
${generateSceneCirclesFunction()}
${generateUtilsFunction()}
${generateSimplexNoiseFunction()}

void main() {
    vec2 uv = GetUv(gl_FragCoord.xy, iResolution);
    

    if (iMouseLeftDown == 1.0) {
      uv += DistortionRipple(uv, iMouseNormalized, rippleRadius, 1.0, 0.2);
    }

    for (int i = 0; i < ripples_count; i++) {
      uv += DistortionRipple(uv, ripples[i], rippleRadius, 1.0, 0.2);
    }

    float noiseValueX = SimplexNoise3D(vec3(uv / 0.1, iTime)) * 0.1;
    float noiseValueY = SimplexNoise3D(vec3(uv / 0.1, -iTime)) * 0.1;
    vec2 noiseValue = vec2(noiseValueX, noiseValueY);
    
    uv += noiseValue * 0.1;

    vec3 color = SceneCircles(uv,
        1.0,
        1.0,
        iTime,
        30.0,
        0.01,
        2.0
    );

    fragColor = vec4(color, 1.0);
}
`

export function WebGlDemo() {
  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <ReactShader
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
        WebGL Demo - Animated gradient with GLSL shader
      </div>
    </div>
  )
}
