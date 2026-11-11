// All copy lives here so the page can be re-themed for a product without
// touching layout. Sections read from this file; remove a section by deleting
// it from App.tsx.

export const brand = {
  name: 'Noxzim',
  tagline: 'A SaaS studio from Assam, building for B2B and B2C',
}

export const nav = {
  links: [
    { label: 'What we do', href: '#features' },
    { label: 'Products', href: '#products' },
    { label: 'How we work', href: '#how' },
    { label: 'Founders', href: '#founders' },
    { label: 'Engagements', href: '#pricing' },
  ],
  signIn: { label: 'Client login', href: '#' },
  cta: { label: 'Start a project', href: '#cta' },
}

export const hero = {
  badge: '3+ SaaS products shipped · B2B and B2C',
  title: ['We design and build', 'SaaS that ships'],
  highlight: 'ships',
  description:
    'Noxzim is a small SaaS studio from Assam. We take products from idea to paying customers — multi-tenant B2B platforms and consumer apps people open every day.',
  primary: { label: 'Start a project', href: '#cta' },
  secondary: { label: 'See what we built', href: '#products' },
  footnote: 'Two founders. No account managers, no handoffs.',
}

export const logos = ['Orbit CRM', 'Stackbill', 'Nudge', 'Kaya Learn', 'Fleetline', 'Ledgerly', 'Northstar', 'DailyMint']

export const features = {
  eyebrow: 'What we do',
  title: 'One studio for B2B platforms and B2C apps',
  description: 'Strategy, design and engineering from the same two people. You talk to the people writing the code.',
  items: [
    {
      key: 'collab',
      title: 'Multi-tenant B2B platforms',
      description: 'Org accounts, roles, SSO and audit trails — the plumbing buyers check first.',
      span: 2,
    },
    {
      key: 'automation',
      title: 'Consumer apps that retain',
      description: 'Onboarding, reminders and fast first sessions, tuned for daily use.',
      span: 1,
    },
    {
      key: 'analytics',
      title: 'Analytics from day one',
      description: 'Dashboards, funnels and usage metering your team can actually read.',
      span: 1,
    },
    {
      key: 'integrations',
      title: 'Payments, auth and AI wired in',
      description: 'Stripe, Supabase, Clerk, OpenAI and the rest of a modern stack, set up properly.',
      span: 2,
    },
  ],
}

export const steps = {
  eyebrow: 'How we work',
  title: 'From idea to live product in weeks',
  items: [
    {
      title: 'Scope the wedge',
      description: 'One workshop to pick the workflow worth paying for. You leave with a plan, a price and a date.',
    },
    {
      title: 'Build in weekly drops',
      description: 'Working software every week in a shared preview. No status decks, no surprises.',
    },
    {
      title: 'Launch and grow',
      description: 'Payments, analytics and onboarding go live, then we iterate on what customers actually do.',
    },
  ],
}

export const showcase = {
  eyebrow: 'Products',
  title: 'Three products, three different markets',
  tabs: [
    {
      key: 'inbox',
      title: 'Orbit CRM',
      description: 'B2B pipeline for field sales teams. Deal rooms, follow-ups and forecasts.',
    },
    {
      key: 'board',
      title: 'Stackbill',
      description: 'Subscription billing for SaaS teams. Usage meters, dunning and taxes.',
    },
    {
      key: 'report',
      title: 'Nudge',
      description: 'B2C habit app. Streaks, gentle reminders and a weekly review.',
    },
  ],
}

export const metrics = [
  { value: 3, decimals: 0, suffix: '+', label: 'SaaS products shipped' },
  { value: 100, decimals: 0, suffix: '%', label: 'Designed and built in-house' },
  { value: 2, decimals: 0, suffix: '', label: 'Founders, based in Assam' },
  { value: 48, decimals: 0, suffix: 'h', label: 'Typical reply time' },
]

export const founders = {
  eyebrow: 'Founders',
  title: 'Two founders. One studio.',
  description: 'Based in Assam, working with teams everywhere. Every project is scoped, designed and built by the people you meet.',
  items: [
    {
      name: 'Noxz',
      initials: 'NX',
      role: 'Co-founder',
      bio: 'Leads the product side: what to build, how it should feel, and the first version customers actually use.',
      location: 'Assam, India',
      hue: 250,
    },
    {
      name: 'Nazim',
      initials: 'NZ',
      role: 'Co-founder',
      bio: 'Leads engineering: architecture, cloud and the systems that keep a product fast as it grows.',
      location: 'Assam, India',
      hue: 20,
    },
  ],
}

export const testimonials = {
  eyebrow: 'Clients',
  title: 'Teams that shipped with us',
  items: [
    {
      quote:
        'They rebuilt our onboarding in six weeks and trial-to-paid moved from 11% to 19%. Two people, no ceremony, no missed Fridays.',
      name: 'Ananya Baruah',
      role: 'Co-founder, Fleetline',
      hue: 250,
    },
    {
      quote: 'We came with a spreadsheet and a vague idea. We left with a billing product our customers actually pay for.',
      name: 'Rohan Mehta',
      role: 'Head of Revenue, Stackbill',
      hue: 170,
    },
    {
      quote: 'The only agency-style team I have worked with that pushed back on scope. That saved us a quarter.',
      name: 'Sarah Whitfield',
      role: 'VP Product, Northstar',
      hue: 20,
    },
    {
      quote: 'Our consumer app finally feels fast on cheap Android phones. Retention in the first week doubled.',
      name: 'Debojit Das',
      role: 'Founder, Nudge',
      hue: 300,
    },
    {
      quote: 'They set up tenant isolation and SSO before our first enterprise call. That is why the deal closed.',
      name: 'Priya Natarajan',
      role: 'CTO, Orbit CRM',
      hue: 120,
    },
    {
      quote: 'Clear updates every week, code we could read, and a handover document that was actually useful.',
      name: 'Lucas Ferreira',
      role: 'Founder, DailyMint',
      hue: 40,
    },
  ],
}

export const pricing = {
  eyebrow: 'Engagements',
  title: 'Simple ways to work with the studio',
  description: 'Fixed scope or an ongoing partnership. Both include design and engineering.',
  yearlyNote: 'Two months free',
  tiers: [
    {
      name: 'Launch',
      monthly: 4900,
      yearly: 4400,
      note: 'one project, fixed scope',
      description: 'For a first version you can put in front of customers.',
      cta: 'Book a kickoff',
      features: [
        '4 to 6 week build',
        'Design and engineering',
        'Auth, payments and analytics',
        'Launch support',
        'Handover with docs',
      ],
    },
    {
      name: 'Partner',
      monthly: 2900,
      yearly: 2400,
      note: 'per month, 3 month minimum',
      description: 'A product team on call for shipping and iterating.',
      cta: 'Start a partnership',
      popular: true,
      features: [
        'Weekly releases',
        'Shared Slack channel',
        'B2B or B2C roadmap',
        'Analytics and experiments',
        'Priority support',
      ],
    },
    {
      name: 'Enterprise',
      priceLabel: 'Custom',
      monthly: 0,
      yearly: 0,
      note: 'scoped per engagement',
      description: 'For platforms with security and scale requirements.',
      cta: 'Talk to the founders',
      features: [
        'Multi-tenant architecture',
        'Security review and SSO',
        'Data residency options',
        'Team onboarding',
        'Direct founder access',
      ],
    },
  ],
}

export const faq = {
  title: 'Questions, answered',
  items: [
    {
      q: 'Who are the founders?',
      a: 'Noxz and Nazim, two founders based in Assam. They scope, design and build every project themselves, so there is no agency layer between you and the work.',
    },
    {
      q: 'Do you build both B2B and B2C products?',
      a: 'Yes. Three of our own products cover B2B sales, B2B billing and a consumer habit app, and client work has spanned both. The architecture differs; the process does not.',
    },
    {
      q: 'Do we own the code and designs?',
      a: 'Always. Code, designs and infrastructure live in your accounts from day one, and handover includes a walkthrough and written docs.',
    },
    {
      q: 'How long does a build take?',
      a: 'A focused first version usually takes four to six weeks. Larger platforms run in weekly releases, so you can use the product while it is still being built.',
    },
    {
      q: 'Can you take over an existing product?',
      a: 'Yes. We start with a short audit of the code, the stack and the biggest risks, then agree on a plan before touching anything.',
    },
    {
      q: 'How do we start?',
      a: 'Send a note through the form below with what you are building and whether it is B2B or B2C. You will hear back from Noxz or Nazim within two working days.',
    },
  ],
}

export const cta = {
  title: "Have a SaaS idea? Let's build it",
  description: 'Tell us what you are working on and who it is for. You will hear back from Noxz or Nazim.',
  placeholder: 'you@company.com',
  button: 'Start a conversation',
  success: 'Thanks — we will reply from Assam within two working days.',
}

export const footer = {
  blurb: 'A SaaS studio from Assam, building B2B platforms and B2C apps.',
  columns: [
    { title: 'Products', links: ['Orbit CRM', 'Stackbill', 'Nudge', 'Custom builds', 'Changelog'] },
    { title: 'Studio', links: ['About', 'Founders', 'How we work', 'Careers', 'Contact'] },
    { title: 'Resources', links: ['Case studies', 'Blog', 'Guides', 'Status', 'Support'] },
    { title: 'Legal', links: ['Privacy', 'Terms', 'Cookies', 'Licenses'] },
  ],
  legal: `© ${new Date().getFullYear()} Noxzim Studio, Assam`,
}
