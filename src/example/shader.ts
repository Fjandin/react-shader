import { generateDistortionRippleFunction } from "../shaders/distortion-ripple"
import { generateSceneCirclesFunction } from "../shaders/scene-circles"
import { generateSimplexNoiseFunction } from "../shaders/simplex-noise"
import { generateUtilsFunction } from "../shaders/utils"

export const fragment = /*glsl*/ `#version 300 es
precision mediump float;

// @UNIFORM_VALUES 

out vec4 fragColor;

${generateSimplexNoiseFunction()}

${generateSceneCirclesFunction()}

${generateDistortionRippleFunction()}

${generateUtilsFunction()}

void main() {
  // Aspect-correct UVs: divide by height only to keep circles round
  vec2 uv = GetUv(gl_FragCoord.xy, iResolution) * scale;
  vec2 mouse = GetMouse(iMouse, iResolution) * scale; 
  vec2 uv0 = uv;
 
  float noiseValueX = SimplexNoise3D(vec3(uv / noiseScale, iTime)) * noiseMultiplier;
  float noiseValueY = SimplexNoise3D(vec3(uv / noiseScale, -iTime)) * noiseMultiplier;
  vec2 noiseValue = vec2(noiseValueX, noiseValueY);

  for (int i = 0; i < ripples_count; i++) {
    uv += DistortionRipple(uv, ripples[i].xy, ripples[i].z, ripples[i].w, 0.03);
  }

  uv += noiseValue * 0.1;
  
  vec3 color = SceneCircles(uv, iterations, fractMultiplier, iTime, waveLength, edgeBlur, contrast);

  // Small white circle at mouse position
 
  float mouseDist = length(uv0 - mouse);
  float circle = smoothstep(0.02, 0.015, mouseDist);
  color = mix(color, vec3(1.0), circle);

  fragColor = vec4(color, 1.0);
}`
