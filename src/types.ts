export type Vec2 = [number, number]
export type Vec3 = [number, number, number]
export type Vec4 = [number, number, number, number]

export type Vec2Array = Vec2[]
export type Vec3Array = Vec3[]
export type Vec4Array = Vec4[]

// Supported GPU uniform types
export type GpuUniformValue = number | Vec2 | Vec3 | Vec4

// Storage buffers for large array data
export type GpuStorageBuffers = Record<string, Vec4Array>

export interface FrameInfo {
  deltaTime: number
  time: number
  resolution: [number, number]
  mouse: [number, number]
  mouseNormalized: [number, number]
  mouseLeftDown: boolean
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
