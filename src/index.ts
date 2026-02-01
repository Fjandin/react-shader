export { useAudio } from "./hooks/useAudio"
export { ReactShader } from "./ReactShader"
export { generateColorPaletteFunction } from "./shaders/color-palette"
export { generateDistortionRippleFunction } from "./shaders/distortion-ripple"
export { generateSceneCirclesFunction } from "./shaders/scene-circles"
export { generateSimplexNoiseFunction } from "./shaders/simplex-noise"
export { generateUtilsFunction } from "./shaders/utils"
export type {
  AudioConnectionState,
  AudioLevels,
  AudioSourceType,
  DefaultUniforms,
  FloatArray,
  FrameInfo,
  ReactShaderProps,
  TextureMagFilter,
  TextureMinFilter,
  TextureOptions,
  TextureSource,
  TextureWrap,
  UniformValue,
  UseAudioOptions,
  UseAudioReturn,
  Vec2,
  Vec2Array,
  Vec3,
  Vec3Array,
  Vec4,
  Vec4Array,
} from "./types"
