'use client';

export function ArticleColumnSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[720px] px-8 py-10">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="grid grid-cols-[60px_1fr] gap-x-6 py-6 border-b border-n-rule-2"
        >
          <div className="space-y-2">
            <div className="h-3 w-8 bg-n-rule-2 rounded animate-pulse" />
            <div className="h-7 w-12 bg-n-rule-2 rounded animate-pulse" />
          </div>
          <div className="space-y-2">
            <div className="h-4 w-3/4 bg-n-rule-2 rounded animate-pulse" />
            <div className="h-4 w-full bg-n-rule-2 rounded animate-pulse" />
            <div className="h-4 w-5/6 bg-n-rule-2 rounded animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}
