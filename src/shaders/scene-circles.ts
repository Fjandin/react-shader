import { generateColorPaletteFunction } from "./color-palette"

/**
 *
 * @param paletteString
 * @returns glsl function for rendering circles
 *
 * vec2 uv0: uv coordinates
 *
 * float iterations: number of iterations
 *
 * float fractMultiplier: fract multiplier
 *
 * float time: time
 *
 * float waveLength: wave length
 *
 * float edgeBlur: edge blur
 *
 * float contrast: contrast
 */
export function generateSceneCirclesFunction(
  paletteString = "[[0.5 0.5 0.5] [0.5 0.5 0.5] [1.0 1.0 1.0] [0.263 0.416 0.557]]",
) {
  return /*glsl*/ `
        ${generateColorPaletteFunction("circlesPalette", paletteString)}

        vec3 SceneCircles(
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
    `
}
