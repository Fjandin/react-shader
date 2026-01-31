// Palettes are created on: http://dev.thi.ng/gradients/

// Nice one
// [[0.5 0.5 0.5] [0.5 0.5 0.5] [1.0 1.0 1.0] [0.263 0.416 0.557]]

// Flowcore Colors
// [[1.728 0.500 0.500] [0.500 0.500 0.500] [1.000 1.000 1.000] [0.000 0.333 0.667]]

export function generateColorPaletteFunction(name: string, paletteString: string) {
  const paletteArray = paletteString
    .replace("[[", "")
    .replace("]]", "")
    .split("] [")
    .map((s) => s.split(" "))

  return /*glsl*/ `
        vec3 ${name}( float t ) {
          vec3 a = vec3(${paletteArray[0].join(",")});
          vec3 b = vec3(${paletteArray[1].join(",")});
          vec3 c = vec3(${paletteArray[2].join(",")});
          vec3 d = vec3(${paletteArray[3].join(",")});
          return a + b * cos(6.28318 * (c * t + d));
        }
      `
}
