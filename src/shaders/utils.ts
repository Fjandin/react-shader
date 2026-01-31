export function generateUtilsFunction() {
  return /*glsl*/ `
    vec2 GetUv(vec2 fragCoord, vec2 resolution) {
      return (fragCoord - 0.5 * resolution) / resolution.y;
    }

    vec2 GetMouse(vec2 mouse, vec2 resolution) {
      return (mouse - 0.5 * resolution) / resolution.y;
    }
  `
}
