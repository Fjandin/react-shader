// Palettes are created on: http://dev.thi.ng/gradients/

// Nice one
// [[0.5 0.5 0.5] [0.5 0.5 0.5] [1.0 1.0 1.0] [0.263 0.416 0.557]]

// Flowcore Colors
// [[1.728 0.500 0.500] [0.500 0.500 0.500] [1.000 1.000 1.000] [0.000 0.333 0.667]]

export function generateColorPaletteFunctionGpu(name: string, paletteString: string) {
  const paletteArray = paletteString
    .replace("[[", "")
    .replace("]]", "")
    .split("] [")
    .map((s) => s.split(" "))

  return /*wgsl*/ `
fn ${name}(t: f32) -> vec3f {
  let a = vec3f(${paletteArray[0].join(", ")});
  let b = vec3f(${paletteArray[1].join(", ")});
  let c = vec3f(${paletteArray[2].join(", ")});
  let d = vec3f(${paletteArray[3].join(", ")});
  return a + b * cos(6.28318 * (c * t + d));
}
`
}
