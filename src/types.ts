export type Vec2 = [number, number]
export type Vec3 = [number, number, number]

export type UniformValue = number | Vec2 | Vec3

export interface ReactShaderProps {
  className?: string
  fragment: string
  vertex?: string
  uniforms?: Record<string, UniformValue>
}

export interface DefaultUniforms {
  iTime: number
  iMouse: Vec2
  iResolution: Vec2
}
