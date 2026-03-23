"use client"

import { useReadingProgress } from '@/stores/readingProgressStore'

export function ReadingProgressBar() {
  const progress = useReadingProgress()

  return (
    <div className="h-[3px] bg-[#f4f4f4] w-full">
      <div
        className="h-full bg-[rgb(67,80,92)] transition-[width] duration-300"
        style={{ width: `${progress}%` }}
      />
    </div>
  )
}
