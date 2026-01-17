precision mediump float;
uniform float iTime;
uniform vec2 iResolution;
uniform vec2 iMouse;
uniform float scale;

void main() {
  // Aspect-correct UVs: divide by height only to keep circles round
  vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution) / iResolution.y * scale;
  // iMouse uses same coordinate system as gl_FragCoord (Y=0 at bottom)
  vec2 mouse = (iMouse - 0.5 * iResolution) / iResolution.y * scale;

  // Animated gradient with mouse interaction
  float dist = length(uv - mouse);

  vec3 color = vec3(
    sin(uv.x * 6.0 + iTime) * 0.5 + 0.5,
    sin(uv.y * 6.0 + iTime * 1.3) * 0.5 + 0.5,
    sin((uv.x + uv.y) * 4.0 + iTime * 0.7) * 0.5 + 0.5
  );

  // Add ripple effect from mouse position
  float ripple = sin(dist * 30.0 - iTime * 4.0) * 0.5 + 0.5;
  color += ripple * 0.2 * smoothstep(0.5, 0.0, dist);

  gl_FragColor = vec4(color, 1.0);
}
