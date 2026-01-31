import noise from "./glsl/noise.glsl"
import { generatePaletteFunction } from "./glsl/palette.glsl"

export const fragment = /*glsl*/ `#version 300 es
precision mediump float;

// @UNIFORM_VALUES 

out vec4 fragColor;

${noise}

${generatePaletteFunction("circlesPalette", "[[0.5 0.5 0.5] [0.5 0.5 0.5] [1.0 1.0 1.0] [0.263 0.416 0.557]]")}

vec2 RippleDistortion(vec2 uv, vec2 center, float radius, float intensity, float thickness) {
  // 1. Calculate vector and distance from center
  vec2 dir = uv - center;
  float dist = length(dir);
  
  // 2. Create a mask so the ripple only exists near the radius Z
  // Using smoothstep creates a soft edge for the ripple
  float mask = smoothstep(radius + thickness, radius, dist) * smoothstep(radius - thickness, radius, dist);

  // 3. Calculate the displacement amount using a Sine wave
  // We subtract dist from radius to orient the wave correctly
  float wave = sin((dist - radius) * 20.0); 
  
  // 4. Apply intensity and mask, then offset the UV
  vec2 offset = normalize(dir) * wave * intensity * mask;
  
  return offset;
}

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

  vec2 uv0 = uv;

  // uv = cartesianToPolar(uv, iTime * 10.0);

  // iMouse uses same coordinate system as gl_FragCoord (Y=0 at bottom)
  vec2 mouse = (iMouse - 0.5 * iResolution) / iResolution.y * scale;

  float noiseValueX = SimplexNoise(vec3(uv / noiseScale, iTime)) * noiseMultiplier;
  float noiseValueY = SimplexNoise(vec3(uv / noiseScale, -iTime)) * noiseMultiplier;
  vec2 noiseValue = vec2(noiseValueX, noiseValueY);

  float dist = length(uv - mouse);

  

  for (int i = 0; i < ripples_count; i++) {
    uv += RippleDistortion(uv, ripples[i].xy, ripples[i].z, ripples[i].w, 0.03);
  }

  uv += noiseValue * 0.1;
  
  vec3 color = Circles(uv, iterations, fractMultiplier, iTime, waveLength, edgeBlur, contrast);

  // Small white circle at mouse position
 
  float mouseDist = length(uv0 - mouse);
  float circle = smoothstep(0.02, 0.015, mouseDist);
  color = mix(color, vec3(1.0), circle);

  fragColor = vec4(color, 1.0);
}`
