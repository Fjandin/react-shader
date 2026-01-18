import type { FrameInfo } from "./hooks/useWebGL"

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
  timeScale?: number
  onFrame?: (info: FrameInfo) => void
}

export interface DefaultUniforms {
  iTime: number
  iMouse: Vec2
  iMouseLeftDown: number
  iResolution: Vec2
}
