import { generateColorPaletteFunctionGpu } from "./color-palette-gpu"

/**
 *
 * @param paletteString
 * @returns wgsl function for rendering circles
 *
 * uv0: vec2f - uv coordinates
 *
 * iterations: f32 - number of iterations
 *
 * fractMultiplier: f32 - fract multiplier
 *
 * time: f32 - time
 *
 * waveLength: f32 - wave length
 *
 * edgeBlur: f32 - edge blur
 *
 * contrast: f32 - contrast
 */
export function generateSceneCirclesFunctionGpu(
  paletteString = "[[0.5 0.5 0.5] [0.5 0.5 0.5] [1.0 1.0 1.0] [0.263 0.416 0.557]]",
) {
  return /*wgsl*/ `
${generateColorPaletteFunctionGpu("circlesPalette", paletteString)}

fn glsl_fract(x: vec2f) -> vec2f {
  return x - floor(x);
}

fn SceneCircles(
  uv0: vec2f,
  iterations: f32,
  fractMultiplier: f32,
  time: f32,
  waveLength: f32,
  edgeBlur: f32,
  contrast: f32
) -> vec3f {
  var col = vec3f(0.0);
  var uv = uv0;

  for (var i = 0.0; i < iterations; i += 1.0) {
    uv = fract(uv * fractMultiplier) - 0.5;

    var d = length(uv) * exp(-length(uv0));

    let color = circlesPalette(length(uv0) + i * 0.4 + time * 0.4);

    d = sin(d * waveLength + time) / waveLength;
    d = abs(d);
    d = pow(edgeBlur / d, contrast);

    col += color * d;
  }
  return col;
}
`
}
