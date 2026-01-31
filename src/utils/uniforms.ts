import type { FloatArray, UniformValue, Vec2, Vec2Array, Vec3, Vec3Array, Vec4, Vec4Array } from "../types"

type WebGLContext = WebGLRenderingContext | WebGL2RenderingContext

export const MAX_ARRAY_LENGTH = 100

function isVec2(value: UniformValue): value is Vec2 {
  return Array.isArray(value) && value.length === 2 && typeof value[0] === "number"
}

function isVec3(value: UniformValue): value is Vec3 {
  return Array.isArray(value) && value.length === 3 && typeof value[0] === "number"
}

function isVec4(value: UniformValue): value is Vec4 {
  return Array.isArray(value) && value.length === 4 && typeof value[0] === "number"
}

function isFloatArray(value: UniformValue): value is FloatArray {
  return Array.isArray(value) && value.length > 4 && typeof value[0] === "number"
}

function isVec2Array(value: UniformValue): value is Vec2Array {
  return Array.isArray(value) && value.length > 0 && Array.isArray(value[0]) && value[0].length === 2
}

function isVec3Array(value: UniformValue): value is Vec3Array {
  return Array.isArray(value) && value.length > 0 && Array.isArray(value[0]) && value[0].length === 3
}

function isVec4Array(value: UniformValue): value is Vec4Array {
  return Array.isArray(value) && value.length > 0 && Array.isArray(value[0]) && value[0].length === 4
}

function isArrayUniform(value: UniformValue): value is FloatArray | Vec2Array | Vec3Array | Vec4Array {
  return isFloatArray(value) || isVec2Array(value) || isVec3Array(value) || isVec4Array(value)
}

export function setUniform(gl: WebGLContext, location: WebGLUniformLocation | null, value: UniformValue): void {
  if (location === null) {
    return
  }

  if (typeof value === "number") {
    gl.uniform1f(location, value)
  } else if (isVec4Array(value)) {
    gl.uniform4fv(location, value.flat())
  } else if (isVec3Array(value)) {
    gl.uniform3fv(location, value.flat())
  } else if (isVec2Array(value)) {
    gl.uniform2fv(location, value.flat())
  } else if (isFloatArray(value)) {
    gl.uniform1fv(location, value)
  } else if (isVec4(value)) {
    gl.uniform4f(location, value[0], value[1], value[2], value[3])
  } else if (isVec3(value)) {
    gl.uniform3f(location, value[0], value[1], value[2])
  } else if (isVec2(value)) {
    gl.uniform2f(location, value[0], value[1])
  }
}

export function getUniformLocation(gl: WebGLContext, program: WebGLProgram, name: string): WebGLUniformLocation | null {
  return gl.getUniformLocation(program, name)
}

export function setUniforms(
  gl: WebGLContext,
  program: WebGLProgram,
  uniforms: Record<string, UniformValue>,
  locationCache: Map<string, WebGLUniformLocation | null>,
): void {
  for (const [name, value] of Object.entries(uniforms)) {
    let location = locationCache.get(name)
    if (location === undefined) {
      location = getUniformLocation(gl, program, name)
      locationCache.set(name, location)
    }
    setUniform(gl, location, value)

    // Set array count uniform for array types
    if (isArrayUniform(value)) {
      const countName = `${name}_count`
      let countLocation = locationCache.get(countName)
      if (countLocation === undefined) {
        countLocation = getUniformLocation(gl, program, countName)
        locationCache.set(countName, countLocation)
      }
      if (countLocation !== null) {
        gl.uniform1i(countLocation, value.length)
      }
    }
  }
}

export function createUniformLocationCache(): Map<string, WebGLUniformLocation | null> {
  return new Map()
}

function getUniformType(value: UniformValue): string {
  if (typeof value === "number") {
    return "float"
  }
  if (isVec4Array(value)) {
    return `vec4[${MAX_ARRAY_LENGTH}]`
  }
  if (isVec3Array(value)) {
    return `vec3[${MAX_ARRAY_LENGTH}]`
  }
  if (isVec2Array(value)) {
    return `vec2[${MAX_ARRAY_LENGTH}]`
  }
  if (isFloatArray(value)) {
    return `float[${MAX_ARRAY_LENGTH}]`
  }
  if (isVec4(value)) {
    return "vec4"
  }
  if (isVec3(value)) {
    return "vec3"
  }
  if (isVec2(value)) {
    return "vec2"
  }
  return "float"
}

export function generateUniformDeclarations(uniforms: Record<string, UniformValue>): string {
  const lines: string[] = []
  for (const [name, value] of Object.entries(uniforms)) {
    const type = getUniformType(value)
    if (type.includes("[")) {
      const [baseType, arrayPart] = type.split("[")
      lines.push(`uniform ${baseType} ${name}[${arrayPart};`)
      lines.push(`uniform int ${name}_count;`)
    } else {
      lines.push(`uniform ${type} ${name};`)
    }
  }
  return lines.join("\n")
}

const UNIFORM_MARKER = "// @UNIFORM_VALUES"

export function injectUniformDeclarations(
  shaderSource: string,
  customUniforms: Record<string, UniformValue> | undefined,
  defaultUniforms: Record<string, UniformValue>,
): string {
  if (!shaderSource.includes(UNIFORM_MARKER)) {
    return shaderSource
  }

  const allUniforms = { ...defaultUniforms, ...customUniforms }
  const declarations = generateUniformDeclarations(allUniforms)
  return shaderSource.replace(UNIFORM_MARKER, declarations)
}
