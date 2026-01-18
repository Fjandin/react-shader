import noise from "./glsl/noise.glsl"
import { generatePaletteFunction } from "./glsl/palette.glsl"

export const fragment = /*glsl*/ `#version 300 es
precision mediump float;
uniform float iTime;
uniform float iTime2;
uniform vec2 iResolution;
uniform vec2 iMouse;
uniform float iMouseLeftDown;
uniform float scale;
uniform float iterations;
uniform float fractMultiplier;
uniform float waveLength;
uniform float edgeBlur;
uniform float contrast;
uniform float noiseScale;
uniform float noiseMultiplier;

out vec4 fragColor;

${noise}

${generatePaletteFunction("circlesPalette", "[[0.5 0.5 0.5] [0.5 0.5 0.5] [1.0 1.0 1.0] [0.263 0.416 0.557]]")}

vec3 Circles(
  vec2 uv0,
  float iterations,
  float fractMultiplier,
  float time,
  float waveLength,
  float edgeBlur,
  float contrast
) {
  vec3 col = vec3(0.0);
  vec2 uv = uv0;

  for (float i = 0.0; i < iterations; i++) {
    uv = fract(uv * fractMultiplier) - 0.5;

    float d = length(uv) * exp(-length(uv0));

    vec3 color = circlesPalette(length(uv0) + i * 0.4 + time * 0.4);

    d = sin(d * waveLength + time) / waveLength;
    d = abs(d);
    d = pow(edgeBlur / d, contrast);

    col += color * d;
  }
  return col;
}

void main() {
  // Aspect-correct UVs: divide by height only to keep circles round
  vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution) / iResolution.y * scale;
  
  // iMouse uses same coordinate system as gl_FragCoord (Y=0 at bottom)
  vec2 mouse = (iMouse - 0.5 * iResolution) / iResolution.y * scale;

  float noiseValueX = SimplexNoise(vec3(uv / noiseScale, iTime2)) * noiseMultiplier;
  float noiseValueY = SimplexNoise(vec3(uv / noiseScale, -iTime2)) * noiseMultiplier;
  vec2 noiseValue = vec2(noiseValueX, noiseValueY);

  float dist = length(uv - mouse);

  uv += noiseValue * 0.1;

  float ripple = sin(dist * 30.0 - iTime * 4.0) * 0.5 + 0.5;
  ripple *= iMouseLeftDown;
  uv += ripple * 0.2 * smoothstep(0.5, 0.0, dist);

  vec3 color = Circles(uv, iterations, fractMultiplier, iTime2, waveLength, edgeBlur, contrast);

  // Animated gradient with mouse interaction
  
  // vec3 color = vec3(
  //   sin(uv.x * 6.0 + iTime) * 0.5 + 0.5,
  //   sin(uv.y * 6.0 + iTime * 1.3) * 0.5 + 0.5,
  //   sin((uv.x + uv.y) * 4.0 + iTime * 0.7) * 0.5 + 0.5
  // );

  // Add ripple effect from mouse position
  // float ripple = sin(dist * 30.0 - iTime * 4.0) * 0.5 + 0.5;
  // color += ripple * 0.2 * smoothstep(0.5, 0.0, dist);

  // color = vec3(1.0, 1.0, 1.0) - color;

  fragColor = vec4(color, 1.0);
}`
