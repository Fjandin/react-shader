/**
 *
 * @returns glsl function for distortion ripple
 *
 * vec2 uv: uv coordinates
 *
 * vec2 center: center of the ripple
 *
 * float radius: radius of the ripple
 *
 * float intensity: intensity of the ripple
 *
 * float thickness: thickness of the ripple
 */
export function generateDistortionRippleFunction() {
  return /*glsl*/ `
      vec2 DistortionRipple(vec2 uv, vec2 center, float radius, float intensity, float thickness) {
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
    `
}
