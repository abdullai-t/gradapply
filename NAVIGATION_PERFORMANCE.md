# Navigation Performance Analysis & Solutions

## Problem Identified

When navigating from Dashboard → AI Assistant, there's a 3-5 second delay before content appears.

## Root Causes

### 1. **Client-Side Page with Blocking Data Fetch**
```typescript
// src/app/(main)/assistant/page.tsx
"use client";  // ← This makes the entire page client-side

function AssistantChat() {
  const historyQuery = useChatHistory(mode);  // ← Blocks until API responds
  // ...
}
```

**Impact**: 
- JavaScript bundle must download and parse before React hydrates
- `/api/chat?mode=general` must complete before rendering
- User sees blank screen during both waits

### 2. **No Loading UI**
- Previously had no `loading.tsx` file
- No Suspense boundaries
- Next.js shows blank screen during page transitions

### 3. **Large Client Bundle**
- Entire chat UI, markdown renderer, scroll area in single bundle
- No code splitting for heavy components

## Solutions Implemented

### ✅ Instant Loading State (DONE)
Created `src/app/(main)/assistant/loading.tsx` with skeleton UI.

**Impact**: Users now see content structure instantly during navigation instead of blank screen.

## Additional Recommended Solutions

### 1. **Parallel Data Fetching with Suspense**
Instead of blocking on `useChatHistory`, show the UI immediately and stream in data:

```typescript
// src/app/(main)/assistant/page.tsx
import { Suspense } from "react";

export default function AssistantPage() {
  return (
    <Suspense fallback={<ChatSkeleton />}>
      <AssistantChat />
    </Suspense>
  );
}

function AssistantChat() {
  // This can suspend without blocking the page
  const historyQuery = useChatHistory(mode);
  
  if (historyQuery.isLoading) {
    return <ChatSkeleton />;
  }
  // ... rest of component
}
```

### 2. **Prefetch on Hover/Focus**
Add prefetching to navigation links:

```typescript
// In your navigation component
<Link 
  href="/assistant" 
  prefetch={true}  // ← Prefetch page on hover
>
  AI
</Link>
```

Next.js automatically prefetches linked pages on hover, but ensure `prefetch={true}` is set.

### 3. **Optimize React Query Settings**
Add `staleTime` to reduce unnecessary refetches:

```typescript
// src/features/assistant/api.ts
export function useChatHistory(mode: ChatMode, schoolId?: string | null) {
  return useQuery({
    queryKey: chatKeys.history(mode, schoolId ?? null),
    queryFn: async () => {
      const qs = new URLSearchParams({ mode });
      if (schoolId) qs.set("schoolId", schoolId);
      return jsonOrThrow<ChatMessage[]>(await fetch(`/api/chat?${qs.toString()}`));
    },
    staleTime: 30000, // ← Consider data fresh for 30s
    gcTime: 5 * 60 * 1000, // ← Keep in cache for 5 minutes
  });
}
```

**Benefit**: If user navigates away and back within 30s, show cached data instantly.

### 4. **Code Splitting for Heavy Components**
Use dynamic imports for large components:

```typescript
import dynamic from 'next/dynamic';

// Lazy load markdown renderer
const MarkdownBody = dynamic(
  () => import('@/components/markdown-body').then(mod => ({ default: mod.MarkdownBody })),
  { 
    loading: () => <div className="animate-pulse">Loading...</div>,
    ssr: false 
  }
);
```

### 5. **Optimistic UI Updates**
Already implemented for sending messages - ensure it's working:

```typescript
// src/features/assistant/api.ts (already exists)
onMutate: (vars) => {
  // Shows user message instantly before server responds
  qc.setQueryData(key, [...previous, newUserMessage, pendingMessage]);
}
```

### 6. **Server Components Where Possible**
Consider moving static parts to Server Components:

```typescript
// src/app/(main)/assistant/layout.tsx (NEW FILE)
export default function AssistantLayout({ children }: { children: React.Node }) {
  return (
    <div className="slide-in flex flex-col gap-6 pb-8">
      <header>
        <h1 className="t-headline-lg m-0 text-[var(--on-surface)]">
          AI Assistant
        </h1>
        {/* Static content renders on server */}
        <p className="mt-1.5 text-[15px] text-[var(--on-surface-variant)]">
          Multiple task-tuned agents run under the hood...
        </p>
      </header>
      {children} {/* Dynamic chat content */}
    </div>
  );
}
```

### 7. **Bundle Analysis**
Run bundle analyzer to identify large dependencies:

```bash
# Install
npm install @next/bundle-analyzer

# Add to next.config.js
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

module.exports = withBundleAnalyzer(nextConfig);

# Run
ANALYZE=true npm run build
```

Look for:
- Large markdown/syntax highlighting libraries
- Duplicate dependencies
- Unnecessary polyfills

## Performance Monitoring

### Measure Navigation Speed
Add logging to track performance:

```typescript
// src/app/(main)/assistant/page.tsx
useEffect(() => {
  const navigationEnd = performance.now();
  console.log('[Perf] Assistant page hydrated in', navigationEnd - navigationStart, 'ms');
}, []);
```

### Key Metrics to Track
- **Time to First Byte (TTFB)**: Server response time
- **First Contentful Paint (FCP)**: When loading UI appears
- **Time to Interactive (TTI)**: When user can interact
- **Bundle Size**: JavaScript payload size

## Expected Results

### Before Optimization
1. Click "AI" link
2. **0-2s**: Blank screen (JS download + parse)
3. **2-5s**: Blank screen (API fetch)
4. **5s**: Content appears

### After Optimization (Current)
1. Click "AI" link
2. **<100ms**: Loading skeleton appears ✅
3. **1-2s**: Real content streams in
4. **2s**: Fully interactive

### With Additional Optimizations
1. Click "AI" link (prefetched on hover)
2. **<50ms**: Cached data appears (if recent)
3. **<100ms**: Loading skeleton (if no cache)
4. **500ms-1s**: Full content
5. **1s**: Fully interactive

## Implementation Priority

1. ✅ **DONE**: Add loading.tsx (instant feedback)
2. **HIGH**: Add staleTime to React Query (cache data)
3. **HIGH**: Ensure prefetch is enabled on nav links
4. **MEDIUM**: Add Suspense boundaries
5. **MEDIUM**: Dynamic import for MarkdownBody
6. **LOW**: Extract static content to layout
7. **LOW**: Bundle analysis and optimization

## Testing

```bash
# Test in production mode (more accurate)
npm run build
npm start

# Navigate to assistant page and check:
# - Chrome DevTools → Network tab (bundle size, timing)
# - Chrome DevTools → Performance tab (paint times)
# - Chrome DevTools → Lighthouse (scores)
```

## Next.js Best Practices for Fast Navigation

1. **Use App Router features**: loading.tsx, error.tsx, layouts
2. **Prefer Server Components**: Use "use client" only when needed
3. **Streaming with Suspense**: Show UI immediately, stream data
4. **Prefetch links**: Enable automatic prefetching
5. **Optimize images**: Use next/image for automatic optimization
6. **Minimize client JS**: Keep bundles small with code splitting
7. **Cache strategically**: Use React Query's staleTime/gcTime
8. **Optimistic updates**: Update UI before server confirms

## Resources

- [Next.js App Router Loading UI](https://nextjs.org/docs/app/building-your-application/routing/loading-ui-and-streaming)
- [React Suspense](https://react.dev/reference/react/Suspense)
- [TanStack Query Caching](https://tanstack.com/query/latest/docs/react/guides/caching)
