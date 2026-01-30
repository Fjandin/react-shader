export const cartesianToPolar = /*glsl*/ `
  vec2 cartesianToPolar(vec2 cartesian, float seamAngleDegrees) {
    float radius = length(cartesian);
    // Rotate input to move where the seam appears
    float rot = radians(seamAngleDegrees);
    vec2 rotated = vec2(
      cartesian.x * cos(rot) + cartesian.y * sin(rot),
      -cartesian.x * sin(rot) + cartesian.y * cos(rot)
    );
    float angle = atan(rotated.y, rotated.x);
    // Map angle from [-PI, PI] to [-0.5, 0.5] range
    return vec2(angle / 6.28318, radius);
  }
`
