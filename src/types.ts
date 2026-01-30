import type { FrameInfo } from "./hooks/useWebGL"

export type Vec2 = [number, number]
export type Vec3 = [number, number, number]
export type Vec4 = [number, number, number, number]

export type FloatArray = number[]
export type Vec2Array = Vec2[]
export type Vec3Array = Vec3[]
export type Vec4Array = Vec4[]

export type UniformValue = number | Vec2 | Vec3 | Vec4 | FloatArray | Vec2Array | Vec3Array | Vec4Array

export interface ReactShaderProps {
  className?: string
  fragment: string
  vertex?: string
  uniforms?: Record<string, UniformValue>
  fullscreen?: boolean
  timeScale?: number
  onFrame?: (info: FrameInfo) => void
}

export interface DefaultUniforms {
  iTime: number
  iMouse: Vec2
  iMouseLeftDown: number
  iResolution: Vec2
}
