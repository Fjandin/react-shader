import { useCallback, useRef, useState } from "react"
import type { AudioConnectionState, AudioLevels, UseAudioOptions, UseAudioReturn } from "../types"

const DEFAULT_FFT_SIZE = 2048
const DEFAULT_SMOOTHING_TIME_CONSTANT = 0.8
const DEFAULT_SMOOTHING = 0.9
const NUM_BANDS = 16
const MIN_FREQ = 20
const MAX_FREQ = 20000
const DEFAULT_BANDS = {
  low: [20, 250] as [number, number],
  mid: [250, 4000] as [number, number],
  high: [4000, 20000] as [number, number],
}

const EMPTY_BANDS = Array(NUM_BANDS).fill(0) as number[]

interface AudioState {
  context: AudioContext
  analyser: AnalyserNode
  source: MediaStreamAudioSourceNode | MediaElementAudioSourceNode
  stream?: MediaStream
}

function hzToBin(hz: number, sampleRate: number, fftSize: number): number {
  const binFrequency = sampleRate / fftSize
  return Math.round(hz / binFrequency)
}

function calculateBandLevel(data: Uint8Array, startBin: number, endBin: number): number {
  if (startBin >= endBin || startBin >= data.length) return 0

  const clampedStart = Math.max(0, startBin)
  const clampedEnd = Math.min(data.length, endBin)

  let sum = 0
  for (let i = clampedStart; i < clampedEnd; i++) {
    sum += data[i]
  }

  const count = clampedEnd - clampedStart
  return count > 0 ? sum / count / 255 : 0
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

// Generate logarithmically spaced frequency boundaries for 16 bands
function getLogFrequencyBands(): number[] {
  const logMin = Math.log10(MIN_FREQ)
  const logMax = Math.log10(MAX_FREQ)
  const step = (logMax - logMin) / NUM_BANDS
  const frequencies: number[] = []
  for (let i = 0; i <= NUM_BANDS; i++) {
    frequencies.push(10 ** (logMin + step * i))
  }
  return frequencies
}

const LOG_FREQ_BANDS = getLogFrequencyBands()

export function useAudio(options: UseAudioOptions = {}): UseAudioReturn {
  const {
    source = "microphone",
    mediaElement = null,
    fftSize = DEFAULT_FFT_SIZE,
    smoothingTimeConstant = DEFAULT_SMOOTHING_TIME_CONSTANT,
    smoothing = DEFAULT_SMOOTHING,
    frequencyBands = {},
  } = options

  const bands = {
    low: frequencyBands.low ?? DEFAULT_BANDS.low,
    mid: frequencyBands.mid ?? DEFAULT_BANDS.mid,
    high: frequencyBands.high ?? DEFAULT_BANDS.high,
  }

  const [state, setState] = useState<AudioConnectionState>("disconnected")
  const [error, setError] = useState<Error | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [levels, setLevels] = useState<AudioLevels>({ low: 0, mid: 0, high: 0, bands: [...EMPTY_BANDS] })
  const [frequencyData, setFrequencyData] = useState<Uint8Array<ArrayBuffer> | null>(null)

  const audioStateRef = useRef<AudioState | null>(null)
  const animationFrameRef = useRef<number>(0)
  const dataArrayRef = useRef<Uint8Array<ArrayBuffer> | null>(null)
  const smoothedLevelsRef = useRef<AudioLevels>({ low: 0, mid: 0, high: 0, bands: [...EMPTY_BANDS] })

  const analyze = useCallback(() => {
    const audioState = audioStateRef.current
    if (!audioState) return

    const { analyser } = audioState
    const dataArray = dataArrayRef.current

    if (!dataArray) return

    analyser.getByteFrequencyData(dataArray)

    const sampleRate = audioState.context.sampleRate
    const fftBins = analyser.fftSize

    const lowBins: [number, number] = [
      hzToBin(bands.low[0], sampleRate, fftBins),
      hzToBin(bands.low[1], sampleRate, fftBins),
    ]
    const midBins: [number, number] = [
      hzToBin(bands.mid[0], sampleRate, fftBins),
      hzToBin(bands.mid[1], sampleRate, fftBins),
    ]
    const highBins: [number, number] = [
      hzToBin(bands.high[0], sampleRate, fftBins),
      hzToBin(bands.high[1], sampleRate, fftBins),
    ]

    // Calculate 16 frequency bands
    const rawBands: number[] = []
    for (let i = 0; i < NUM_BANDS; i++) {
      const startBin = hzToBin(LOG_FREQ_BANDS[i], sampleRate, fftBins)
      const endBin = hzToBin(LOG_FREQ_BANDS[i + 1], sampleRate, fftBins)
      rawBands.push(calculateBandLevel(dataArray, startBin, endBin))
    }

    const rawLevels: AudioLevels = {
      low: calculateBandLevel(dataArray, lowBins[0], lowBins[1]),
      mid: calculateBandLevel(dataArray, midBins[0], midBins[1]),
      high: calculateBandLevel(dataArray, highBins[0], highBins[1]),
      bands: rawBands,
    }

    // Apply smoothing via lerp (t = 1 - smoothing, so higher smoothing = slower change)
    const t = 1 - smoothing
    const prev = smoothedLevelsRef.current
    const smoothedBands = rawBands.map((raw, i) => lerp(prev.bands[i] ?? 0, raw, t))
    const smoothedLevels: AudioLevels = {
      low: lerp(prev.low, rawLevels.low, t),
      mid: lerp(prev.mid, rawLevels.mid, t),
      high: lerp(prev.high, rawLevels.high, t),
      bands: smoothedBands,
    }
    smoothedLevelsRef.current = smoothedLevels

    setLevels(smoothedLevels)
    const dataCopy = new Uint8Array(dataArray.length)
    dataCopy.set(dataArray)
    setFrequencyData(dataCopy)

    animationFrameRef.current = requestAnimationFrame(analyze)
  }, [bands.low, bands.mid, bands.high, smoothing])

  const start = useCallback(async () => {
    if (audioStateRef.current) return

    setState("connecting")
    setError(null)

    try {
      const AudioContextClass =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (!AudioContextClass) {
        throw new Error("AudioContext not supported")
      }

      const context = new AudioContextClass()

      if (context.state === "suspended") {
        await context.resume()
      }

      const analyser = context.createAnalyser()
      analyser.fftSize = fftSize
      analyser.smoothingTimeConstant = smoothingTimeConstant

      let audioSource: MediaStreamAudioSourceNode | MediaElementAudioSourceNode
      let stream: MediaStream | undefined

      if (source === "microphone") {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        audioSource = context.createMediaStreamSource(stream)
      } else if (source === "display") {
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: true, // Required, but we only use audio
          audio: true,
        })
        // Check if audio track was actually shared
        const audioTracks = stream.getAudioTracks()
        if (audioTracks.length === 0) {
          for (const track of stream.getTracks()) {
            track.stop()
          }
          throw new Error("No audio track available. Make sure to share a tab with audio enabled.")
        }
        audioSource = context.createMediaStreamSource(stream)
      } else if (source === "element" && mediaElement) {
        audioSource = context.createMediaElementSource(mediaElement)
        audioSource.connect(context.destination)
      } else {
        throw new Error("Invalid audio source configuration")
      }

      audioSource.connect(analyser)

      audioStateRef.current = {
        context,
        analyser,
        source: audioSource,
        stream,
      }

      dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount)

      setState("connected")
      setIsRunning(true)

      animationFrameRef.current = requestAnimationFrame(analyze)
    } catch (err) {
      const audioError = err instanceof Error ? err : new Error(String(err))
      setError(audioError)
      setState("error")
      setIsRunning(false)
    }
  }, [source, mediaElement, fftSize, smoothingTimeConstant, analyze])

  const stop = useCallback(() => {
    cancelAnimationFrame(animationFrameRef.current)

    const audioState = audioStateRef.current
    if (audioState) {
      audioState.source.disconnect()

      if (audioState.stream) {
        for (const track of audioState.stream.getTracks()) {
          track.stop()
        }
      }

      audioState.analyser.disconnect()
      audioState.context.close()

      audioStateRef.current = null
    }

    dataArrayRef.current = null
    smoothedLevelsRef.current = { low: 0, mid: 0, high: 0, bands: [...EMPTY_BANDS] }
    setState("disconnected")
    setIsRunning(false)
    setLevels({ low: 0, mid: 0, high: 0, bands: [...EMPTY_BANDS] })
    setFrequencyData(null)
  }, [])

  return {
    levels,
    frequencyData,
    state,
    error,
    start,
    stop,
    isRunning,
  }
}
