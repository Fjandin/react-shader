export type Vec2 = [number, number]
export type Vec3 = [number, number, number]
export type Vec4 = [number, number, number, number]

export type UniformValue = number | Vec2 | Vec3 | Vec4

export interface ReactShaderProps {
  className?: string
  fragment: string
  vertex?: string
  uniforms?: Record<string, UniformValue>
  debug?: boolean
  fullscreen?: boolean
  /** Whether the shader is running. Defaults to true. Set to false to pause rendering. */
  running?: boolean
}

export interface DefaultUniforms {
  iTime: number
  iMouse: Vec2
  iResolution: Vec2
}
