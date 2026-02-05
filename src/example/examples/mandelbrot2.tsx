import { useCallback, useMemo, useRef, useState } from "react"
import { type FrameInfo, generateColorPaletteFunctionGpu, ReactGpuShader, type Vec2, type Vec4 } from "../.."

// --- 1. WGSL Shader with Emulated Double Math ---
const dsMandelbrotShader = /*wgsl*/ `
// --- Robust Double-Precision (Emulated) Mandelbrot Shader ---

${generateColorPaletteFunctionGpu("colorPalette", "[[0.5 0.5 0.5] [0.5 0.5 0.5] [1.0 1.0 1.0] [0.263 0.416 0.557]]")}

// 1. Safe "TwoSum" - The foundation of high precision addition
// Prevents compiler from optimizing away the error term
fn ds_add(a: vec2f, b: vec2f) -> vec2f {
    let t1 = a.x + b.x;
    let e = t1 - a.x;
    let t2 = ((b.x - e) + (a.x - (t1 - e))) + a.y + b.y;
    let hi = t1 + t2;
    let lo = t2 - (hi - t1);
    return vec2f(hi, lo);
}

// 2. Robust Multiplication (Handles cross-products better)
fn ds_mul(a: vec2f, b: vec2f) -> vec2f {
    let cona = a.x * 8193.0;
    let conb = b.x * 8193.0;
    let a1 = cona - (cona - a.x);
    let a2 = a.x - a1;
    let b1 = conb - (conb - b.x);
    let b2 = b.x - b1;
    
    let c11 = a.x * b.x;
    let c21 = a.x * b.y + a.y * b.x;
    let c12 = a1 * b1 - c11 + a1 * b2 + a2 * b1 + a2 * b2;
    
    let t1 = c11 + c12;
    let t2 = c12 - (t1 - c11);
    
    let hi = t1 + c21;
    let lo = c21 - (hi - t1) + t2;
    
    return vec2f(hi, lo);
}

// 3. Optimized Square (z*z)
fn ds_sqr(a: vec2f) -> vec2f {
    let cona = a.x * 8193.0;
    let a1 = cona - (cona - a.x);
    let a2 = a.x - a1;
    
    let c11 = a.x * a.x;
    let c21 = 2.0 * a.x * a.y;
    let c12 = a1 * a1 - c11 + 2.0 * a1 * a2 + a2 * a2;
    
    let t1 = c11 + c12;
    let t2 = c12 - (t1 - c11);
    
    let hi = t1 + c21;
    let lo = c21 - (hi - t1) + t2;
    
    return vec2f(hi, lo);
}

fn ds_sub(a: vec2f, b: vec2f) -> vec2f {
    return ds_add(a, vec2f(-b.x, -b.y));
}

fn ds_set(a: f32) -> vec2f {
    return vec2f(a, 0.0);
}

fn mainImage(uv0: vec2f) -> vec4f {
    // Manually reconstruct scale from vec4 to ensure no component mixing
    let scale_ds = vec2f(uniforms.scale.x, uniforms.scale.y);
    
    // Calculate C = Center + UV * Scale
    // We treat UV as exact f32 (hi) with 0 low part.
    // This is the critical step where precision usually breaks.
    let uv_x_ds = ds_mul(ds_set(uv0.x), scale_ds);
    let uv_y_ds = ds_mul(ds_set(uv0.y), scale_ds);

    let c_real = ds_add(vec2f(uniforms.center.x, uniforms.center.y), uv_x_ds);
    let c_imag = ds_add(vec2f(uniforms.center.z, uniforms.center.w), uv_y_ds);

    var z_real = vec2f(0.0, 0.0);
    var z_imag = vec2f(0.0, 0.0);
    
    var i = 0;
    const max_iter = 500; // Deep zoom needs more iterations
    const esc = 4.0;

    while (i < max_iter) {
        let zr2 = ds_sqr(z_real);
        let zi2 = ds_sqr(z_imag);
        
        // Check escape using high parts only (sufficient for > 4.0 check)
        if ((zr2.x + zi2.x) > esc) { break; }

        let temp_real = ds_sub(zr2, zi2);
        
        // Z_imag = 2 * zr * zi
        let z_mul = ds_mul(z_real, z_imag);
        z_imag = ds_add(ds_add(z_mul, z_mul), c_imag);
        z_real = ds_add(temp_real, c_real);
        
        i++;
    }

    // Smooth coloring (optional, helps visualization)
    let t = f32(i) / f32(max_iter);
    
    // Fix for inside set
    if (i == max_iter) { return vec4f(0.0, 0.0, 0.0, 1.0); }
    
    return vec4f(colorPalette(t), 1.0);
}
`

// --- 2. Helper to split JS Double into [High, Low] ---
function splitDouble(val: number): [number, number] {
  // Math.fround returns the nearest 32-bit float representation
  const high = Math.fround(val)
  const low = val - high
  return [high, low]
}

export function WebGpuMandelbrotDemo2() {
  // We keep state as standard JS numbers (Doubles)
  const [center, setCenter] = useState<Vec2>([0, 0])
  const [scale, setScale] = useState<number>(1)

  const lastMousePosRef = useRef<Vec2 | null>(null)

  // Memoize uniforms to prevent jitter and unnecessary calculations
  const uniforms = useMemo(() => {
    const [scaleHi, scaleLo] = splitDouble(scale)
    const [cxHi, cxLo] = splitDouble(center[0])
    const [cyHi, cyLo] = splitDouble(center[1])

    return {
      scale: [scaleHi, scaleLo, 0, 0] as Vec4, // Maps to vec2f in WGSL
      center: [cxHi, cxLo, cyHi, cyLo] as Vec4, // Maps to vec4f in WGSL
    }
  }, [scale, center])

  const onMouseWheel = useCallback(
    (info: FrameInfo, wheelDelta: number) => {
      const zoomFactor = wheelDelta > 0 ? 0.9 : 1.1

      // Standard JS math is 64-bit, so we do logic normally here
      const mouseWorld: Vec2 = [
        info.mouseNormalized[0] * scale + center[0],
        info.mouseNormalized[1] * scale + center[1],
      ]

      const newScale = scale * zoomFactor
      const newCenter: Vec2 = [
        mouseWorld[0] - info.mouseNormalized[0] * newScale,
        mouseWorld[1] - info.mouseNormalized[1] * newScale,
      ]

      setScale(newScale)
      setCenter(newCenter)
    },
    [scale, center],
  )

  const onMouseMove = useCallback(
    (info: FrameInfo) => {
      if (!info.mouseLeftDown) {
        lastMousePosRef.current = null
        return
      }
      const currentPos: Vec2 = [info.mouseNormalized[0] * scale, info.mouseNormalized[1] * scale]
      if (lastMousePosRef.current) {
        const deltaX = currentPos[0] - lastMousePosRef.current[0]
        const deltaY = currentPos[1] - lastMousePosRef.current[1]
        setCenter((prev) => [prev[0] - deltaX, prev[1] - deltaY])
      }
      lastMousePosRef.current = currentPos
    },
    [scale],
  )

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <ReactGpuShader
        fragment={dsMandelbrotShader}
        uniforms={uniforms}
        timeScale={0.5}
        onMouseWheel={onMouseWheel}
        onMouseMove={onMouseMove}
      />
      <div
        style={{
          position: "absolute",
          bottom: 20,
          right: 20,
          color: "white",
          fontSize: "14px",
          background: "rgba(0,0,0,0.5)",
          padding: "8px 12px",
          borderRadius: "4px",
        }}
      >
        Scale: {scale.toExponential(2)}
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 20,
          left: 20,
          color: "white",
          fontSize: "14px",
          background: "rgba(0,0,0,0.5)",
          padding: "8px 12px",
          borderRadius: "4px",
        }}
      >
        WebGPU Demo - Mandelbrot with WGSL shader and emulated double math
      </div>
    </div>
  )
}
