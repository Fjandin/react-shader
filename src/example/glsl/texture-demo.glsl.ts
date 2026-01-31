import { generateSimplexNoiseFunction } from "../../shaders/simplex-noise"
import { generateUtilsFunction } from "../../shaders/utils"

export const textureFragment = /*glsl*/ `#version 300 es
precision mediump float;

// @UNIFORM_VALUES

out vec4 fragColor;

${generateSimplexNoiseFunction()}

${generateUtilsFunction()}

void main() {
  vec2 uv = gl_FragCoord.xy / iResolution;
  vec2 uvCenter = GetUv(gl_FragCoord.xy, iResolution);

  // Add wavy distortion based on time and position
  float wave = sin(uvCenter.x * 10.0 + iTime * 2.0) * 0.02;
  wave += sin(uvCenter.y * 8.0 - iTime * 1.5) * 0.015;

  // Add noise-based distortion
  float noise = SimplexNoise3D(vec3(uvCenter * 3.0, iTime * 0.5)) * distortionAmount;

  vec2 distortedUv = uv + vec2(wave + noise, wave * 0.5 + noise);

  // Sample texture with distorted coordinates
  vec4 texColor = texture(uTexture, distortedUv);

  // Add vignette effect
  float vignette = 1.0 - length(uvCenter) * 0.5;
  vignette = smoothstep(0.0, 1.0, vignette);

  // Slight color shift based on distortion
  vec3 color = texColor.rgb;
  color.r = texture(uTexture, distortedUv + vec2(0.002, 0.0)).r;
  color.b = texture(uTexture, distortedUv - vec2(0.002, 0.0)).b;

  fragColor = vec4(color * vignette, texColor.a);
}
`
