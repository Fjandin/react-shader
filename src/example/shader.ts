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

  // uv = cartesianToPolar(uv, iTime * 10.0);

  // iMouse uses same coordinate system as gl_FragCoord (Y=0 at bottom)
  vec2 mouse = (iMouse - 0.5 * iResolution) / iResolution.y * scale;

  float noiseValueX = SimplexNoise(vec3(uv / noiseScale, iTime)) * noiseMultiplier;
  float noiseValueY = SimplexNoise(vec3(uv / noiseScale, -iTime)) * noiseMultiplier;
  vec2 noiseValue = vec2(noiseValueX, noiseValueY);

  float dist = length(uv - mouse);

  uv += noiseValue * 0.1;

  // for (int i = 0; i < ripples_count; i++) {
  //   vec4 ripple = ripples[i];
  //   vec2 ripplePos = ripple.xy;
  //   float intensity = ripple.z;
  //   float radius = ripple.w;

  //   vec2 toRipple = uv - ripplePos;
  //   float dist = length(toRipple);

  //   // Wave pattern radiating outward
  //   float wave = sin(dist * 30.0 - iTime2 * 4.0);

  //   // Falloff based on radius
  //   float falloff = smoothstep(radius, 0.0, dist);

  //   // Displace UV along the direction from ripple center
  //   vec2 dir = dist > 0.001 ? normalize(toRipple) : vec2(0.0);
  //   uv += dir * wave * intensity * falloff;
  // }
  // for (int i = 0; i < ripples_count; i++) {
  //   float ripple = sin(dist * 30.0 - iTime * 4.0) * 0.5 + 0.5;
  // }
  
  // ripple *= iMouseLeftDown;
  // uv += ripple * 0.2 * smoothstep(0.5, 0.0, dist);

  for (int i = 0; i < ripples_count; i++) {
    uv += RippleDistortion(uv, ripples[i].xy, ripples[i].z, ripples[i].w, 0.02);
  }
  
  vec3 color = Circles(uv, iterations, fractMultiplier, iTime, waveLength, edgeBlur, contrast);

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
