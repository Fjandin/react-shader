export default /*glsl*/ `
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
`
