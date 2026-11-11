import { MapPin } from 'lucide-react'

import { Container } from '../components/Container'
import { Monogram } from '../components/DashboardMock'
import { Reveal } from '../components/Reveal'
import { SectionHeading } from '../components/SectionHeading'
import { founders } from '../content'

export function Founders() {
  return (
    <section id="founders" className="scroll-mt-24 border-t border-line py-24 sm:py-32">
      <Container>
        <SectionHeading eyebrow={founders.eyebrow} title={founders.title} description={founders.description} />
        <div className="mt-14 grid gap-4 sm:grid-cols-2">
          {founders.items.map((person, i) => (
            <Reveal key={person.name} delay={i * 0.08} className="h-full">
              <article className="depth relative flex h-full flex-col rounded-card bg-surface p-7 shadow-glow">
                <div className="flex items-center gap-3">
                  <Monogram initials={person.initials} hue={person.hue} className="size-11 text-[14px]" />
                  <div>
                    <h3 className="text-[17px] font-semibold tracking-tight">{person.name}</h3>
                    <p className="text-[13px] text-muted">{person.role}</p>
                  </div>
                </div>
                <p className="mt-5 text-[15px] leading-relaxed text-muted">{person.bio}</p>
                <p className="mt-6 inline-flex items-center gap-1.5 text-[13px] text-faint">
                  <MapPin className="size-3.5" />
                  {person.location}
                </p>
              </article>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  )
}
