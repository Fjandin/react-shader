export type Vec2 = [number, number]
export type Vec3 = [number, number, number]
export type Vec4 = [number, number, number, number]

export type FloatArray = number[]
export type Vec2Array = Vec2[]
export type Vec3Array = Vec3[]
export type Vec4Array = Vec4[]

// Supported GPU uniform types (no textures)
export type GpuUniformValue = number | Vec2 | Vec3 | Vec4 | Vec4Array

export type TextureSource =
  | HTMLImageElement
  | HTMLCanvasElement
  | HTMLVideoElement
  | ImageBitmap
  | ImageData
  | OffscreenCanvas

export type TextureWrap = "repeat" | "clamp" | "mirror"
export type TextureMinFilter = "nearest" | "linear" | "mipmap"
export type TextureMagFilter = "nearest" | "linear"

export interface TextureOptions {
  source: TextureSource
  wrapS?: TextureWrap
  wrapT?: TextureWrap
  minFilter?: TextureMinFilter
  magFilter?: TextureMagFilter
  flipY?: boolean
}

export type UniformValue =
  | number
  | Vec2
  | Vec3
  | Vec4
  | FloatArray
  | Vec2Array
  | Vec3Array
  | Vec4Array
  | TextureSource
  | TextureOptions

export interface FrameInfo {
  deltaTime: number
  time: number
  resolution: [number, number]
  mouse: [number, number]
  mouseNormalized: [number, number]
  mouseLeftDown: boolean
}
export interface ReactShaderProps {
  className?: string
  fragment: string
  vertex?: string
  uniforms?: Record<string, UniformValue>
  fullscreen?: boolean
  timeScale?: number
  onFrame?: (info: FrameInfo) => void
  onClick?: (info: FrameInfo) => void
  onMouseMove?: (info: FrameInfo) => void
  onMouseDown?: (info: FrameInfo) => void
  onMouseUp?: (info: FrameInfo) => void
  onMouseWheel?: (info: FrameInfo, wheelDelta: number) => void
}

export interface DefaultUniforms {
  iTime: number
  iMouse: Vec2
  iMouseNormalized: Vec2
  iMouseLeftDown: number
  iResolution: Vec2
}

// Audio types
export interface AudioLevels {
  low: number
  mid: number
  high: number
  bands: number[] // 16 frequency bands from low to high
}

export type AudioSourceType = "microphone" | "element" | "display"
export type AudioConnectionState = "disconnected" | "connecting" | "connected" | "error"

export interface UseAudioOptions {
  source?: AudioSourceType
  mediaElement?: HTMLAudioElement | HTMLVideoElement | null
  fftSize?: number
  smoothingTimeConstant?: number
  smoothing?: number // 0-1, lerp factor between frames (0 = instant, 0.9 = very smooth)
  frequencyBands?: Partial<{
    low: [number, number]
    mid: [number, number]
    high: [number, number]
  }>
}

export interface UseAudioReturn {
  levels: AudioLevels
  frequencyData: Uint8Array<ArrayBuffer> | null
  state: AudioConnectionState
  error: Error | null
  start: () => Promise<void>
  stop: () => void
  isRunning: boolean
}
