type WebGLContext = WebGLRenderingContext | WebGL2RenderingContext

export function compileShader(
  gl: WebGLContext,
  type: number,
  source: string
): WebGLShader {
  const shader = gl.createShader(type)
  if (!shader) {
    throw new Error(
      `Failed to create shader of type ${type === gl.VERTEX_SHADER ? 'VERTEX' : 'FRAGMENT'}`
    )
  }

  gl.shaderSource(shader, source)
  gl.compileShader(shader)

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader)
    gl.deleteShader(shader)
    const shaderType = type === gl.VERTEX_SHADER ? 'Vertex' : 'Fragment'
    throw new Error(`${shaderType} shader compilation failed:\n${info}`)
  }

  return shader
}

export function createProgram(
  gl: WebGLContext,
  vertexShader: WebGLShader,
  fragmentShader: WebGLShader
): WebGLProgram {
  const program = gl.createProgram()
  if (!program) {
    throw new Error('Failed to create WebGL program')
  }

  gl.attachShader(program, vertexShader)
  gl.attachShader(program, fragmentShader)
  gl.linkProgram(program)

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program)
    gl.deleteProgram(program)
    throw new Error(`Program linking failed:\n${info}`)
  }

  return program
}

export function createShaderProgram(
  gl: WebGLContext,
  vertexSource: string,
  fragmentSource: string
): WebGLProgram {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexSource)
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource)

  try {
    return createProgram(gl, vertexShader, fragmentShader)
  } finally {
    // Shaders can be deleted after linking - they're copied into the program
    gl.deleteShader(vertexShader)
    gl.deleteShader(fragmentShader)
  }
}
