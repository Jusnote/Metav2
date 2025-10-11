# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Next.js-based flashcard application with spaced repetition learning, built with React 19, TypeScript, and Supabase. The app uses the FSRS (Free Spaced Repetition Scheduler) algorithm for intelligent card scheduling and supports multiple flashcard types including traditional, word-hiding, and true-false formats.

## Key Technologies

- **Framework**: Next.js 15 with App Router
- **Database**: Supabase (PostgreSQL)
- **UI**: shadcn/ui components with Radix UI primitives
- **Styling**: Tailwind CSS v4 with PostCSS
- **Rich Text**: Plate Editor (BlockNote for flashcards)
- **State Management**: React Query (@tanstack/react-query) + Context API
- **Spaced Repetition**: ts-fsrs library

## Development Commands

```bash
# Install dependencies
npm i

# Development server (runs on http://localhost:3000)
npm run dev

# Build for production (increases memory for large build)
npm run build

# Build without memory optimization
npm run build:dev

# Start production server
npm start

# Lint code
npm run lint
```

## Architecture Patterns

### Server-First Data Pattern

The app uses a **Server-First** architecture pattern via `useServerFirst` hook (src/hooks/useServerFirst.ts):
- Supabase is the single source of truth
- In-memory cache with configurable timeout (default 5 min)
- Optimistic updates for responsive UX
- Offline queue for operations without internet
- Real-time sync via Supabase subscriptions
- Clear loading/syncing/error states

Key hooks using this pattern:
- `useBlockNoteFlashcards` - Flashcard CRUD operations
- `useNotes` - Notes management
- `useDocuments` - Document organization

### Context Providers

Wrap the app in this order (see src/App.tsx):
1. `QueryClientProvider` - React Query
2. `TooltipProvider` - Radix UI tooltips
3. `TimerProvider` - Study timer context
4. `StudyModeProvider` - Study mode state (dirigido/manual)
5. `QuestionsProvider` - Questions management

### Routing

Uses Next.js App Router with client-side navigation via react-router-dom (hybrid approach):
- Server entry: `src/app/[[...slug]]/page.tsx`
- Client routing: `src/App.tsx` (BrowserRouter)
- All routes require authentication (via `PrivateRoute` wrapper)
- Study mode (`/flashcards?study`) uses focus UI without header/sidebar

### Type Aliases

The project uses `@/*` path alias:
```typescript
// tsconfig.json
"paths": {
  "@/*": ["./src/*"]
}
```

## Data Models

### Flashcard Structure

Flashcards use FSRS algorithm fields (src/types/flashcard.ts):
```typescript
interface Flashcard {
  id: string;
  front: string;
  back: string;
  type: 'traditional' | 'word-hiding' | 'true-false';

  // FSRS fields
  difficulty: number;
  stability: number;
  state: State; // 0=new, 1=learning, 2=review, 3=relearning
  due: Date;
  last_review?: Date;
  review_count: number;

  // Hierarchy
  parentId?: string;
  childIds: string[];
  level: number;
  order: number;
}
```

### BlockNote Flashcards

Flashcards use BlockNote editor with **quote-based parsing** (src/lib/flashcard-parser.ts):
- Content **before** first quote block = front
- Quote block and **after** = back
- Strategy: `quote-based` or `single-side`

## Important Implementation Details

### FSRS Integration

- FSRS library: `ts-fsrs`
- Implementation: `src/lib/fsrs.ts` (FSRSSpacedRepetition class)
- Difficulty mapping: again → Again, hard → Hard, medium → Good, easy → Easy

### Native Binary Configuration

The project requires native binaries for Vercel deployment (next.config.mjs):
```javascript
optionalDependencies: {
  "@rollup/rollup-linux-x64-gnu": "^4.46.2",
  "lightningcss-linux-x64-gnu": "^1.30.2",
  "@tailwindcss/oxide-linux-x64-gnu": "^4.1.13"
}
```

### Client-Side Only Rendering

App.tsx checks `typeof window !== 'undefined'` before rendering BrowserRouter to prevent SSR hydration issues.

### Study Modes

Two study modes controlled by StudyModeContext:
- **Dirigido** (Guided): Sequential section-based study with question prompts
- **Manual**: Free-form study

## Supabase Integration

- Client: `src/integrations/supabase/client.ts`
- Auth: localStorage-based session persistence
- Realtime: Enabled for flashcards and notes tables
- Types: Auto-generated in `src/types/database.ts`

Environment variables required:
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

## Component Patterns

### Plate Editor Components

Plate editor kits are organized by feature (src/components/):
- `editor-kit.tsx` - Main editor configuration
- `floating-toolbar-kit.tsx` - Floating toolbar
- `slash-kit.tsx` - Slash commands
- `ai-kit.tsx` - AI integration
- `*-base-kit.tsx` - Base implementations

### Study Components

- `StudyCard.tsx` - Displays flashcard during study
- `StudyCardBlockNote.tsx` - BlockNote-based study card
- `FlashcardEditor.tsx` - Create/edit traditional flashcards
- `BlockNoteFlashcardEditor.tsx` - BlockNote editor for flashcards

## Common Development Tasks

### Adding a New Flashcard Type

1. Add type to `src/types/flashcard.ts`
2. Update database schema in Supabase
3. Create editor component in `src/components/`
4. Update `EditorSelector.tsx` to include new type
5. Add display logic to `StudyCard.tsx`

### Creating a New Server-First Hook

```typescript
const { data, isLoading, create, update, remove } = useServerFirst<YourType>({
  tableName: 'your_table',
  realtime: true,
  cacheTimeout: 5 * 60 * 1000,
  enableOfflineQueue: true
});
```

### Working with BlockNote Content

Use parser utilities from `src/lib/flashcard-parser.ts`:
- `parseFlashcardContent(content)` - Split front/back by quote
- `extractTitle(content)` - Get title from heading
- `isValidFlashcard(parsed)` - Validate content

## Build Configuration

- ESLint ignores build errors in production (`ignoreDuringBuilds: true`)
- TypeScript strict mode enabled
- Webpack configured for native binary compatibility
- PostCSS with Tailwind CSS v4 (@tailwindcss/postcss)
