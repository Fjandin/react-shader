/**
 *
 * @returns wgsl function for distortion ripple
 *
 * uv: vec2f - uv coordinates
 *
 * center: vec2f - center of the ripple
 *
 * radius: f32 - radius of the ripple
 *
 * intensity: f32 - intensity of the ripple
 *
 * thickness: f32 - thickness of the ripple
 */
export function generateDistortionRippleFunctionGpu() {
  return /*wgsl*/ `
fn DistortionRipple(uv: vec2f, center: vec2f, radius: f32, intensity: f32, thickness: f32) -> vec2f {
  // 1. Calculate vector and distance from center
  let dir = uv - center;
  let dist = length(dir);

  // 2. Create a mask so the ripple only exists near the radius
  // Using smoothstep creates a soft edge for the ripple
  let mask = smoothstep(radius + thickness, radius, dist) * smoothstep(radius - thickness, radius, dist);

  // 3. Calculate the displacement amount using a Sine wave
  // We subtract dist from radius to orient the wave correctly
  let wave = sin((dist - radius) * 20.0);

  // 4. Apply intensity and mask, then offset the UV
  let offset = normalize(dir) * wave * intensity * mask;

  return offset;
}
`
}
