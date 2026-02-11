# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

@fjandin/react-shader is a React component library for rendering WebGPU fragment shaders using WGSL. It provides a `<ReactGpuShader>` component with automatic uniform handling, storage buffers, and audio reactivity.

## Commands

```bash
bun run build        # Build ESM, CJS, and TypeScript declarations
bun run lint         # Run Biome linter/formatter check
bun run lint --write # Run Biome linter/formatter fixer
bun run typecheck    # Type-check without emitting
bun run dev          # Start example dev server
bun run clean        # Remove dist/ directory
```

## Architecture

### Core Components

**ReactGpuShader.tsx** - Main React component that wraps a canvas and manages WebGPU rendering. Handles error display and fullscreen mode. Props include `fragment` (required WGSL shader), `uniforms`, `storageBuffers`, `fullscreen`, `timeScale`, and event callbacks.

**hooks/useWebGPU.ts** - Core WebGPU logic. Initializes GPU device and context, manages shader pipelines, runs the render loop via requestAnimationFrame, and tracks mouse/resize. Provides default uniforms every frame: `iTime`, `iMouse`, `iMouseNormalized`, `iMouseLeftDown`, `iResolution`.

**hooks/useAudio.ts** - Audio reactivity hook. Provides real-time frequency analysis from microphone, media elements, or display audio capture.

**shaders/*-gpu.ts** - Pre-built WGSL shader helper functions (simplex noise, color palette, distortion ripple, scene circles).

### Key Implementation Details

- Renders full-screen quad (two triangles) covering clip space (-1 to 1)
- Shaders define a `mainImage(uv: vec2f) -> vec4f` function; the component auto-generates the uniform struct and `@fragment` entry point
- Mouse Y-coordinate is inverted from DOM to match GPU convention (Y=0 at bottom)
- High-DPI support via devicePixelRatio scaling
- Storage buffers use over-allocation (1.5x growth) for efficient dynamic resizing

### Build Output

Produces ESM (`dist/index.js`), CJS (`dist/index.cjs`), and TypeScript declarations. Peer dependencies: React >=17.0.0.

## Code Style

- Biome for formatting and linting (configured in biome.json)
- 2-space indentation, 120 char line width, semicolons as needed
- TypeScript strict mode enabled
