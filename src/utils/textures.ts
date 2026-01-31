import type { TextureMagFilter, TextureMinFilter, TextureOptions, TextureSource, TextureWrap } from "../types"

type WebGLContext = WebGLRenderingContext | WebGL2RenderingContext

interface TextureEntry {
  texture: WebGLTexture
  unit: number
  source: TextureSource
}

export interface TextureManager {
  cache: Map<string, TextureEntry>
  nextUnit: number
  maxUnits: number
}

export function isTextureSource(value: unknown): value is TextureSource {
  if (typeof window === "undefined") return false
  return (
    value instanceof HTMLImageElement ||
    value instanceof HTMLCanvasElement ||
    value instanceof HTMLVideoElement ||
    (typeof ImageBitmap !== "undefined" && value instanceof ImageBitmap) ||
    value instanceof ImageData ||
    (typeof OffscreenCanvas !== "undefined" && value instanceof OffscreenCanvas)
  )
}

export function isTextureOptions(value: unknown): value is TextureOptions {
  return (
    typeof value === "object" &&
    value !== null &&
    "source" in value &&
    isTextureSource((value as TextureOptions).source)
  )
}

export function isTexture(value: unknown): value is TextureSource | TextureOptions {
  return isTextureSource(value) || isTextureOptions(value)
}

function getWrapMode(gl: WebGLContext, wrap: TextureWrap): number {
  switch (wrap) {
    case "repeat":
      return gl.REPEAT
    case "mirror":
      return gl.MIRRORED_REPEAT
    default:
      return gl.CLAMP_TO_EDGE
  }
}

function getMinFilter(gl: WebGLContext, filter: TextureMinFilter): number {
  switch (filter) {
    case "nearest":
      return gl.NEAREST
    case "mipmap":
      return gl.LINEAR_MIPMAP_LINEAR
    default:
      return gl.LINEAR
  }
}

function getMagFilter(gl: WebGLContext, filter: TextureMagFilter): number {
  switch (filter) {
    case "nearest":
      return gl.NEAREST
    default:
      return gl.LINEAR
  }
}

function isPowerOfTwo(value: number): boolean {
  return (value & (value - 1)) === 0 && value !== 0
}

function getSourceDimensions(source: TextureSource): { width: number; height: number } {
  if (source instanceof HTMLImageElement) {
    return { width: source.naturalWidth, height: source.naturalHeight }
  }
  if (source instanceof HTMLVideoElement) {
    return { width: source.videoWidth, height: source.videoHeight }
  }
  if (source instanceof ImageData) {
    return { width: source.width, height: source.height }
  }
  // HTMLCanvasElement, ImageBitmap, OffscreenCanvas all have width/height
  return { width: (source as HTMLCanvasElement).width, height: (source as HTMLCanvasElement).height }
}

export function createTextureManager(gl: WebGLContext): TextureManager {
  const maxUnits = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS) as number
  return {
    cache: new Map(),
    nextUnit: 0,
    maxUnits,
  }
}

export function createTexture(
  gl: WebGLContext,
  source: TextureSource,
  options: Partial<TextureOptions> = {},
): WebGLTexture {
  const texture = gl.createTexture()
  if (!texture) {
    throw new Error("Failed to create WebGL texture")
  }

  const { wrapS = "clamp", wrapT = "clamp", minFilter = "linear", magFilter = "linear", flipY = true } = options

  gl.bindTexture(gl.TEXTURE_2D, texture)

  // Set flip Y before uploading
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, flipY)

  // Upload texture data
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source as TexImageSource)

  // Check if we can use mipmaps and non-POT features
  const { width, height } = getSourceDimensions(source)
  const pot = isPowerOfTwo(width) && isPowerOfTwo(height)
  const isWebGL2 = "texStorage2D" in gl

  // Generate mipmaps if requested and possible
  const actualMinFilter =
    minFilter === "mipmap" && (pot || isWebGL2) ? minFilter : minFilter === "mipmap" ? "linear" : minFilter

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, getWrapMode(gl, wrapS))
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, getWrapMode(gl, wrapT))
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, getMinFilter(gl, actualMinFilter))
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, getMagFilter(gl, magFilter))

  if (actualMinFilter === "mipmap") {
    gl.generateMipmap(gl.TEXTURE_2D)
  }

  gl.bindTexture(gl.TEXTURE_2D, null)

  return texture
}

export function updateTexture(gl: WebGLContext, texture: WebGLTexture, source: TextureSource, flipY = true): void {
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, flipY)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source as TexImageSource)
  gl.bindTexture(gl.TEXTURE_2D, null)
}

export function needsVideoUpdate(source: TextureSource): boolean {
  if (!(source instanceof HTMLVideoElement)) return false
  return !source.paused && !source.ended && source.readyState >= 2
}

export function bindTextureUniform(
  gl: WebGLContext,
  program: WebGLProgram,
  name: string,
  value: TextureSource | TextureOptions,
  manager: TextureManager,
  locationCache: Map<string, WebGLUniformLocation | null>,
): void {
  const source = isTextureOptions(value) ? value.source : value
  const options = isTextureOptions(value) ? value : {}

  let entry = manager.cache.get(name)

  // Check if source has changed
  if (entry && entry.source !== source) {
    gl.deleteTexture(entry.texture)
    entry = undefined
  }

  // Create new texture if needed
  if (!entry) {
    if (manager.nextUnit >= manager.maxUnits) {
      console.warn(`Maximum texture units (${manager.maxUnits}) exceeded for uniform "${name}"`)
      return
    }

    const texture = createTexture(gl, source, options)
    entry = {
      texture,
      unit: manager.nextUnit++,
      source,
    }
    manager.cache.set(name, entry)
  }

  // Update video textures every frame
  if (needsVideoUpdate(source)) {
    const flipY = isTextureOptions(value) ? (value.flipY ?? true) : true
    updateTexture(gl, entry.texture, source, flipY)
  }

  // Bind texture to its unit
  gl.activeTexture(gl.TEXTURE0 + entry.unit)
  gl.bindTexture(gl.TEXTURE_2D, entry.texture)

  // Set sampler uniform
  let location = locationCache.get(name)
  if (location === undefined) {
    location = gl.getUniformLocation(program, name)
    locationCache.set(name, location)
  }
  if (location !== null) {
    gl.uniform1i(location, entry.unit)
  }
}

export function cleanupTextures(gl: WebGLContext, manager: TextureManager): void {
  for (const entry of manager.cache.values()) {
    gl.deleteTexture(entry.texture)
  }
  manager.cache.clear()
  manager.nextUnit = 0
}
