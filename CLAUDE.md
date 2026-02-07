# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

@fjandin/react-shader is a React component library for rendering WebGL fragment and vertex shaders. It provides a `<ReactShader>` component with automatic uniform handling, designed to work with Shadertoy-style shaders.

## Commands

```bash
bun run build        # Build ESM, CJS, and TypeScript declarations
bun run lint         # Run Biome linter/formatter check
bun run lint --write # Run Biome linter/formatter fixer
bun run typecheck    # Type-check without emitting
bun run example      # Start example dev server
bun run clean        # Remove dist/ directory
```

## Architecture

### Core Components

**ReactShader.tsx** - Main React component that wraps a canvas and manages WebGL rendering. Handles error display, debug overlay, and fullscreen mode. Props include `fragment` (required shader), `vertex` (optional), `uniforms`, `running` (pause/resume), `debug`, and `fullscreen`.

**hooks/useWebGL.ts** - Core WebGL logic. Initializes context (WebGL2 with WebGL1 fallback), manages shader programs, runs the render loop via requestAnimationFrame, and tracks mouse/resize. Provides default uniforms every frame: `iTime`, `iMouse`, `iResolution`.

**utils/shader.ts** - Shader compilation and program linking with error reporting.

**utils/uniforms.ts** - Uniform value setting with type detection and location caching.

### Key Implementation Details

- Renders full-screen quad (two triangles) covering clip space (-1 to 1)
- Mouse Y-coordinate is inverted from DOM to match WebGL convention (Y=0 at bottom)
- High-DPI support via devicePixelRatio scaling
- Uniform locations are cached to avoid repeated lookups
- Context loss/restoration is handled gracefully

### Build Output

Produces ESM (`dist/index.js`), CJS (`dist/index.cjs`), and TypeScript declarations. Peer dependencies: React >=17.0.0.

## Code Style

- Biome for formatting and linting (configured in biome.json)
- 2-space indentation, 120 char line width, semicolons as needed
- TypeScript strict mode enabled
