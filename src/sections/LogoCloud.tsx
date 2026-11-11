import { Container } from '../components/Container'
import type { ReactElement } from 'react'
import { Reveal } from '../components/Reveal'
import { logos } from '../content'

// Minimal geometric marks so the row reads as real products without
// borrowing anyone's identity. Swap for real product logos when you have them.
const marks: Record<string, ReactElement> = {
  'Orbit CRM': (
    <>
      <circle cx="12" cy="12" r="7" />
      <circle cx="12" cy="12" r="2.5" />
    </>
  ),
  Stackbill: <path d="M4 8h16M4 12h16M4 16h10" />,
  Nudge: <path d="M18 15a6 6 0 1 0-12 0l-1 3h14l-1-3M10 21h4" />,
  'Kaya Learn': <path d="M5 4h6a3 3 0 0 1 3 3v13a3 3 0 0 0-3-3H5zM19 4h-3a3 3 0 0 0-3 3v13a3 3 0 0 1 3-3h3z" />,
  Fleetline: <path d="M3 12h13l-3-3M16 12l-3 3M20 6v12" />,
  Ledgerly: <path d="M6 4h9l3 3v13H6zM9 9h6M9 13h6M9 17h4" />,
  Northstar: <path d="M12 3v18M3 12h18M6 6l12 12M18 6 6 18" />,
  DailyMint: <path d="M12 21c5-2 8-6 8-11-5 0-8 2-8 6 0-4-3-6-8-6 0 5 3 9 8 11z" />,
}

export function LogoCloud() {
  const doubled = [...logos, ...logos]
  return (
    <section className="py-12">
      <Container>
        <Reveal>
          <p className="text-center text-[13px] text-faint">Products and platforms we have shipped</p>
        </Reveal>
        <div className="section-mask relative mt-6 overflow-hidden [mask-image:linear-gradient(to_right,transparent,#000_12%,#000_88%,transparent)]">
          <ul className="flex w-max animate-marquee items-center gap-14 pr-14 hover:[animation-play-state:paused]">
            {doubled.map((name, i) => (
              <li key={`${name}-${i}`} className="flex items-center gap-2.5 text-[17px] font-semibold tracking-tight text-fg/45">
                <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  {marks[name]}
                </svg>
                {name}
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </section>
  )
}
