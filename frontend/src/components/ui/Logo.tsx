import { cn } from '@/lib/utils'

/**
 * The mark: an "A" whose crossbar is a distinct accent stroke.
 *
 * Reads as ABTalks, and the separated crossbar doubles as a progress/level
 * indicator — which is what the product actually measures.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      className={cn('shrink-0', className)}
      aria-hidden
    >
      {/* A brand-tinted plate, not `fill-surface-raised`. Surface is white in
          light mode, which made the mark a white square on a warm off-white
          page — effectively invisible. A violet tint reads in both themes. */}
      <rect width="100" height="100" rx="24" className="fill-brand-500/[0.14]" />
      <rect
        width="100"
        height="100"
        rx="24"
        className="fill-transparent stroke-brand-500/25"
        strokeWidth="1.5"
      />
      <path
        d="M28 70 L50 30 L72 70"
        className="stroke-brand-400"
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line
        x1="38"
        y1="57"
        x2="62"
        y2="57"
        className="stroke-accent-cyan"
        strokeWidth="9"
        strokeLinecap="round"
      />
    </svg>
  )
}
