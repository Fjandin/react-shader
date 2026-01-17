import type { UniformValue, Vec2, Vec3, Vec4 } from '../types'

type WebGLContext = WebGLRenderingContext | WebGL2RenderingContext

function isVec2(value: UniformValue): value is Vec2 {
  return Array.isArray(value) && value.length === 2
}

function isVec3(value: UniformValue): value is Vec3 {
  return Array.isArray(value) && value.length === 3
}

function isVec4(value: UniformValue): value is Vec4 {
  return Array.isArray(value) && value.length === 4
}

export function setUniform(
  gl: WebGLContext,
  location: WebGLUniformLocation | null,
  value: UniformValue
): void {
  if (location === null) {
    return
  }

  if (typeof value === 'number') {
    gl.uniform1f(location, value)
  } else if (isVec4(value)) {
    gl.uniform4f(location, value[0], value[1], value[2], value[3])
  } else if (isVec3(value)) {
    gl.uniform3f(location, value[0], value[1], value[2])
  } else if (isVec2(value)) {
    gl.uniform2f(location, value[0], value[1])
  }
}

export function getUniformLocation(
  gl: WebGLContext,
  program: WebGLProgram,
  name: string
): WebGLUniformLocation | null {
  return gl.getUniformLocation(program, name)
}

export function setUniforms(
  gl: WebGLContext,
  program: WebGLProgram,
  uniforms: Record<string, UniformValue>,
  locationCache: Map<string, WebGLUniformLocation | null>
): void {
  for (const [name, value] of Object.entries(uniforms)) {
    let location = locationCache.get(name)
    if (location === undefined) {
      location = getUniformLocation(gl, program, name)
      locationCache.set(name, location)
    }
    setUniform(gl, location, value)
  }
}

export function createUniformLocationCache(): Map<
  string,
  WebGLUniformLocation | null
> {
  return new Map()
}
