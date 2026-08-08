import { Logo } from '@/components/ui/Logo'

/**
 * Route-transition fallback.
 *
 * Deliberately minimal and centred rather than a full skeleton layout: route
 * chunks resolve in well under a second, and a detailed skeleton that flashes
 * for 200ms reads as jank. A calm mark holding the space reads as intentional.
 */
export function RouteFallback() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-base">
      <div className="flex flex-col items-center gap-4">
        <Logo className="size-10 animate-breathe" />
        <div className="h-0.5 w-24 overflow-hidden rounded-full bg-white/[0.07]">
          <div className="h-full w-1/2 animate-shimmer rounded-full bg-gradient-to-r from-transparent via-brand-500 to-transparent" />
        </div>
      </div>
    </div>
  )
}
