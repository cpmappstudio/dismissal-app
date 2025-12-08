---
applyTo: "**/*"
---

# Code Style & Architecture Guidelines

## Core Principles

1. **Simplicity over complexity** - Avoid over-engineering. Clean, readable code is priority.
2. **DRY (Don't Repeat Yourself)** - Single source of truth for logic and components.
3. **Separation of concerns** - Each file/folder has one clear responsibility.
4. **Progressive optimization** - Only optimize when it doesn't add complexity. Defer complex optimizations to future phases.

---

## Project Structure

### Directory Responsibilities

| Directory | Purpose | Rules |
|-----------|---------|-------|
| `app/` | Next.js pages (server-first) | Pages load data and compose components. No business logic. |
| `components/` | React components | Organized by feature/location. Atomic components in `ui/`. |
| `components/ui/` | Atomic UI primitives | Import from shadcn. Do NOT create custom unless instructed. |
| `convex/` | Backend logic & database | All Convex functions. Organize by feature. |
| `lib/` | Domain logic & utilities | Each domain has its folder with `types.ts` and `utils.ts`. |
| `hooks/` | Custom React hooks | All hooks. File names start with `use-`. |

### File Naming

- **All files**: `kebab-case-in-english.ts` or `.tsx`
- **Hooks**: `use-feature-name.ts`
- **Components**: `kebab-case.tsx` (file) but `PascalCase` (export)

---

## Pages (`app/`)

### Server-First Approach

Pages should be **server components** that:
1. Fetch data
2. Compose section components
3. Pass data as props

```tsx
// CORRECT: Page shows intent through component composition
export default async function LandingPage() {
  const data = await fetchData();
  
  return (
    <>
      <Hero data={data.hero} />
      <Features items={data.features} />
      <Footer />
    </>
  );
}

// WRONG: Page hides structure behind single component
export default function LandingPage() {
  return <Landing />;
}
```

### When to Use Client Components

Only add `"use client"` when the component needs:
- React hooks (`useState`, `useEffect`, etc.)
- Event handlers
- Browser APIs

---

## Components (`components/`)

### Organization

```
components/
├── sections/           # Page-specific sections
│   ├── landing/        # Landing page sections
│   │   ├── hero.tsx
│   │   ├── scoreboard.tsx
│   │   └── footer.tsx
│   └── match/          # Match page sections
├── forms/              # Form components
├── layouts/            # Layout wrappers
├── skeletons/          # Loading states
└── ui/                 # Atomic primitives (shadcn)
```

### Rules

1. **Section components** live in `sections/{page-name}/`
2. **Shared components** live at `components/` root or appropriate subfolder
3. **Atomic UI** stays in `ui/` - primarily shadcn imports
4. Components should be **small and focused** - split if exceeding ~150 lines

### Abstracting Reusable Components

When a pattern repeats (e.g., data tables), abstract it:

```tsx
// CORRECT: Reusable table with column definitions
<DataTable
  columns={playerColumns}
  data={players}
  onRowClick={handlePlayerClick}
  searchable
/>

// WRONG: Repeating table implementation in every page
```

---

## Library (`lib/`)

### Structure

Each domain gets its own folder:

```
lib/
├── routes.ts           # Centralized route definitions (REQUIRED)
├── navigation/
│   ├── types.ts        # Type definitions
│   ├── utils.ts        # Utility functions
│   ├── config.ts       # Static configuration
│   └── index.ts        # Public exports (optional)
├── scoreboard/
│   ├── types.ts
│   └── utils.ts
└── auth/
    ├── types.ts
    └── utils.ts
```

### Rules

1. **Only `.ts` files** in `lib/` (no React components)
2. **Types** go in `types.ts`
3. **Functions** go in `utils.ts` (or more specific names like `config.ts`)
4. Keep files reasonable in length - split when needed

---

## Hooks (`hooks/`)

- All custom hooks in this folder
- File names: `use-{feature-name}.ts`
- Export single hook per file (usually)

```typescript
// hooks/use-scoreboard-filters.ts
export function useScoreboardFilters() {
  // ...
}
```

---

## Backend (`convex/`)

### Structure

```
convex/
├── schema.ts           # Database schema
├── http.ts             # HTTP endpoints (webhooks)
├── {feature}.ts        # Feature modules (users.ts, leagues.ts)
└── lib/                # Shared utilities
    ├── auth.ts
    └── permissions.ts
```

### Rules

1. One feature per file (e.g., `players.ts`, `clubs.ts`)
2. Keep functions small and focused
3. Shared logic goes in `lib/`
4. See `convex.instructions.md` for function syntax

---

## Code Quality

### No Comments (with exceptions)

Code should be self-documenting through:
- Clear variable/function names
- Small, focused functions
- Logical structure

**When comments ARE allowed:**
- Complex algorithms that need explanation
- Non-obvious workarounds with context
- TODO markers for planned work

**Comment format (when needed):**
```typescript
// Brief explanation of why, not what
const result = complexCalculation();
```

### No Emojis

- No emojis in code
- No emojis in comments
- No emojis in logs
- No emojis anywhere in the codebase

### Logging

```typescript
// CORRECT: Professional, academic language
console.log("[Auth] User session validated");

// WRONG: Casual or emoji-laden
console.log("🎉 User logged in!");
```

**Production safety**: Ensure logs don't execute in production. Use environment checks or logging utilities.

---

## Optimization Guidelines

### Do Optimize When

- Server components can replace client components
- Memoization prevents expensive recalculations
- The optimization is clean and readable

### Don't Optimize When

- It adds significant complexity
- The code becomes harder to understand
- It requires extensive abstraction layers

**Rule**: If optimization requires more than ~20 lines of additional code or creates confusing patterns, defer to future phases.

---

## Anti-Patterns to Avoid

| Anti-Pattern | What to Do Instead |
|--------------|---------------------|
| Hardcoded route strings | Use `ROUTES` from `lib/routes.ts` |
| Deeply nested conditionals | Extract to small functions |
| Files > 300 lines | Split by responsibility |
| Duplicated logic | Abstract to shared utility |
| Complex prop drilling | Consider composition or context |
| Over-abstraction | Keep it simple until repetition proves need |
| Premature optimization | Wait for actual performance issues |
| Magic numbers/strings | Use constants or config files |

---

## Centralized Routes (`lib/routes.ts`)

**NEVER hardcode route paths.** All routes must be defined in `lib/routes.ts` and imported where needed.

### Usage

```typescript
import { ROUTES } from "@/lib/routes";

// Static routes
ROUTES.home                        // "/"
ROUTES.auth.signIn                 // "/sign-in"
ROUTES.admin.root                  // "/admin"
ROUTES.admin.leagues.list          // "/admin/leagues"

// League routes (with single parameter)
ROUTES.league.root(leagueSlug)                    // "/liga-valle"
ROUTES.league.clubs.list(leagueSlug)              // "/liga-valle/clubs"
ROUTES.league.divisions.list(leagueSlug)          // "/liga-valle/divisions"

// Club routes (with two parameters: league + club)
ROUTES.club.root(leagueSlug, clubSlug)                      // "/liga-valle/club-name"
ROUTES.club.players.list(leagueSlug, clubSlug)              // "/liga-valle/club-name/players"
ROUTES.club.players.detail(leagueSlug, clubSlug, playerId)  // "/liga-valle/club-name/players/abc123"

// For navigation config segments
import { ROUTE_SEGMENTS } from "@/lib/routes";
ROUTE_SEGMENTS.players             // "players"
ROUTE_SEGMENTS.categories          // "categories"
```

### Rules

1. **All `href` props** must use `ROUTES.*`
2. **All `router.push()` calls** must use `ROUTES.*`
3. **Navigation config** uses `ROUTE_SEGMENTS` for relative paths
4. When adding new pages, **add the route to `lib/routes.ts` first**

```tsx
// CORRECT
<Link href={ROUTES.club.players.list(leagueSlug, clubSlug)}>Players</Link>
router.push(ROUTES.club.categories.detail(leagueSlug, clubSlug, categoryId));

// WRONG - hardcoded strings
<Link href={`/${leagueSlug}/${clubSlug}/players`}>Players</Link>
router.push(`/${leagueSlug}/${clubSlug}/categories/${categoryId}`);
```

---

## Quick Reference

### Creating New Features

1. **Page**: `app/(group)/feature/page.tsx` - Server component, compose sections
2. **Sections**: `components/sections/feature/` - Feature-specific components
3. **Logic**: `lib/feature/` - Types in `types.ts`, functions in `utils.ts`
4. **Hooks**: `hooks/use-feature.ts` - Client-side state logic
5. **Backend**: `convex/feature.ts` - Queries and mutations

### Checklist Before Committing

- [ ] No duplicate logic (check for existing utilities)
- [ ] No emojis in code, comments, or logs
- [ ] No unnecessary comments
- [ ] Files are reasonably sized
- [ ] Components are in correct location
- [ ] Server components where possible
