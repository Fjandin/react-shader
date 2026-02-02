import { ReactShader } from "../../ReactShader"
import { generateDistortionRippleFunction } from "../../shaders/distortion-ripple"
import { generateSceneCirclesFunction } from "../../shaders/scene-circles"
import { generateUtilsFunction } from "../../shaders/utils"

const gradientShader = /*glsl*/ `#version 300 es
precision mediump float;

// @UNIFORM_VALUES

out vec4 fragColor;

${generateDistortionRippleFunction()}
${generateSceneCirclesFunction()}
${generateUtilsFunction()}

void main() {
    vec2 uv = GetUv(gl_FragCoord.xy, iResolution);
    

    uv += DistortionRipple(uv, iMouseNormalized, 0.5, 1.0, 0.2);

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
      <ReactShader fragment={gradientShader} uniforms={{}} />
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
