# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a keyboard typing training app built with React + TypeScript + Vite. The app presents sentences to users character-by-character, tracking accuracy and preventing progression on incorrect keystrokes.

## Development Commands

```bash
# Start development server (with hot reload)
npm run dev

# Build for production
npm run build

# Lint code
npm run lint

# Preview production build
npm run preview
```

## Architecture

### Core Application Logic

The main application (`src/App.tsx`) is a single-component typing trainer that:

- Uses global keyboard event listeners to capture all keystrokes
- Maintains three key state variables:
  - `currentSentenceIndex`: Tracks which sentence is active
  - `currentCharIndex`: Tracks position within current sentence  
  - `hasError`: Prevents progression when wrong key is pressed

### Character-by-Character Processing

The typing logic in `handleKeyPress`:
1. Compares typed character with expected character
2. Only advances on exact match (case-sensitive)
3. Shows error state until correct key is pressed
4. Automatically progresses through sentences and resets on completion

### Sentence Configuration

Sentences are hardcoded in the `sentences` array at the top of `App.tsx`. Each sentence is processed character-by-character with visual feedback:
- Green background: correctly typed characters
- Blue pulsing: current character to type
- Red shaking: current character when error occurs
- Gray: untyped characters

### Styling System

CSS classes in `src/App.css` provide visual feedback:
- `.char.typed`: Successfully typed characters (green)
- `.char.current`: Current typing position (blue, pulsing)
- `.char.current.error`: Error state (red, shaking animation)
- `.char.untyped`: Not yet typed (gray)

## Technology Stack

- **React 19.1.1** with TypeScript
- **Vite 7.1.0** for build tooling and development server
- **ESLint** for code linting (flat config format)
- **CSS3** animations and flexbox layout
- No external UI libraries or state management (pure React hooks)

## Development Notes

- Uses modern React patterns: `useState`, `useEffect`, `useCallback` hooks
- Global keyboard events are properly cleaned up in useEffect
- TypeScript strict mode enabled
- Hot module replacement (HMR) available in development mode