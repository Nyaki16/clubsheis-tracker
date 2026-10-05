/**
 * Proposal template — shared shape, palette, and boilerplate.
 *
 * The proposal PDF is half generated and half fixed. Anything that describes
 * ClubSheIs rather than the client (who we are, the service list, the numbers,
 * the terms) lives here as a constant: it is the same for every client, so
 * generating it would only add cost and the risk of the model inventing a
 * different statistic or softening a payment term.
 *
 * Everything client-specific comes back from the model as `ProposalData`,
 * validated against PROPOSAL_JSON_SCHEMA via structured outputs.
 */

/** Colours sampled directly from the approved Khanyisa Phika proposal. */
export const PALETTE = {
  accent: '#70262D',   // deep burgundy — headings, prices, eyebrows
  ink: '#291F1F',      // warm near-black — headings and body
  muted: '#685B5A',    // lead paragraphs and closing prose
  hairline: '#E7DDDD', // rules between list rows
  panelWarm: '#F9F7F5',// "what happens once you say yes" panel
  panelBlush: '#F1E6E7',// "the numbers so far" panel
  cardBorder: '#E5DEDE',
} as const

/** A single pricing card. One per package, or one per phase on a phased build. */
export type PricingCard = {
  /** Letterspaced label above the name, e.g. "PHASE ONE · FOUNDATION · MONTHS 1 TO 3". Empty string for a single-package proposal. */
  eyebrow: string
  /** Package name exactly as listed in the price list, e.g. "Small Business Gold (OBM)". */
  name: string
  /** One line on what this phase buys, e.g. "System build, strategy, and launch readiness". */
  subtitle: string
  /** Headline price with the rand symbol and thousands separator, e.g. "R7,500". */
  price: string
  /** Billing cadence, e.g. "per month" or "once-off". */
  cadence: string
  /** Right-aligned total, e.g. "3 MONTHS · R22,500 TOTAL". Empty string when there is no meaningful total. */
  totalNote: string
  /** Deliverables included at this price. */
  features: string[]
}

/** A two-tone line in the closing statement: ink text then accent text. */
export type ClosingLine = { lead: string; accent: string }

/** The client-specific half of the proposal, produced by the model. */
export type ProposalData = {
  /** Cover headline, ink portion, e.g. "A strategy for launching". */
  headlineLead: string
  /** Cover headline, accent portion — normally the brand name. */
  headlineAccent: string
  /** Section One intro, larger and muted. */
  opportunityLead: string
  /** "What we heard": short points summarising what the client told us on the call. Older proposals don't have it. */
  heard?: string[]
  /** Section One body — the recap of the discovery call, in ClubSheIs' words. */
  opportunityParagraphs: string[]
  /** Section Three intro. */
  planLead: string
  /** Section Three phases. One entry for a single-package engagement. */
  phases: {
    title: string
    /** Which offering in the investment section this phase is (older proposals don't have it). */
    package?: string
    body: string
    /** What we'll create in this phase, each tied to something the client said. */
    creates?: { title: string; detail: string }[]
  }[]
  /** "What this gets you": the results the client can expect. */
  outcomes?: string[]
  /** Section Four intro. */
  investmentLead: string
  /** Section Four note under the intro, on commitment and billing shape. */
  investmentNote: string
  /** One card per package or phase. */
  cards: PricingCard[]
  /** Section Six numbered steps. */
  nextSteps: string[]
  /** Closing statement, one entry per line. */
  closingLines: ClosingLine[]
  /** Closing paragraph under the statement. */
  closingParagraph: string
}

/**
 * JSON Schema for structured outputs. Kept in step with ProposalData by hand —
 * the API rejects unsupported keywords, so no minLength/maxLength/recursion here.
 */
export const PROPOSAL_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'headlineLead', 'headlineAccent', 'opportunityLead', 'heard', 'opportunityParagraphs',
    'planLead', 'phases', 'outcomes', 'investmentLead', 'investmentNote', 'cards',
    'nextSteps', 'closingLines', 'closingParagraph',
  ],
  properties: {
    headlineLead: { type: 'string', description: 'Cover headline lead, e.g. "A strategy for launching". No brand name here.' },
    headlineAccent: { type: 'string', description: 'Cover headline accent — normally the brand name.' },
    opportunityLead: { type: 'string', description: 'One or two sentences framing the call recap.' },
    heard: {
      type: 'array',
      description: 'What we heard: four to seven short points summarising what the client told us on the call, in plain words and close to how they said it. One idea per point, under 25 words each.',
      items: { type: 'string' },
    },
    opportunityParagraphs: {
      type: 'array',
      description: 'Three to five paragraphs recapping the discovery call in our own words. Never paste their notes back.',
      items: { type: 'string' },
    },
    planLead: { type: 'string', description: 'The strategy in two or three sentences: the angle we will take for this client and why it fits what they told us.' },
    phases: {
      type: 'array',
      description: 'One entry for a single-package engagement, two for a phased build.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'package', 'body', 'creates'],
        properties: {
          title: { type: 'string', description: 'e.g. "Phase One · Foundation · Months 1 to 3", or a name for the work when unphased, e.g. "Your sales page".' },
          package: { type: 'string', description: 'The offering this phase is, exactly as named in the pricing, e.g. "Ghutte Page Build".' },
          body: { type: 'string', description: 'The strategy for this phase: what we will do, in what order, and why, tied to what the client said. Four to six sentences.' },
          creates: {
            type: 'array',
            description: 'Three to six concrete things we will create in this phase.',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['title', 'detail'],
              properties: {
                title: { type: 'string', description: 'The thing we will make, e.g. "A sales page for the Glow Reset programme".' },
                detail: { type: 'string', description: 'One or two sentences: what it contains and the problem it solves for this client, referring to what they told us.' },
              },
            },
          },
        },
      },
    },
    outcomes: {
      type: 'array',
      description: 'What this gets you: three to five concrete results the client can expect, tied to the goal they named. No guarantees of specific revenue.',
      items: { type: 'string' },
    },
    investmentLead: { type: 'string' },
    investmentNote: { type: 'string', description: 'A sentence or two on commitment length and billing shape.' },
    cards: {
      type: 'array',
      description: 'One card per package. Prices must be copied exactly from the price list — never invent or round a price.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['eyebrow', 'name', 'subtitle', 'price', 'cadence', 'totalNote', 'features'],
        properties: {
          eyebrow: { type: 'string', description: 'Letterspaced phase label, or an empty string for a single package.' },
          name: { type: 'string', description: 'Package name exactly as it appears in the price list.' },
          subtitle: { type: 'string' },
          price: { type: 'string', description: 'e.g. "R7,500" — exactly as in the price list.' },
          cadence: { type: 'string', description: '"per month" or "once-off".' },
          totalNote: { type: 'string', description: 'e.g. "3 MONTHS · R22,500 TOTAL", or an empty string.' },
          features: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    nextSteps: {
      type: 'array',
      description: 'Five to seven concrete steps, in order, starting from signing.',
      items: { type: 'string' },
    },
    closingLines: {
      type: 'array',
      description: 'Two to three short lines. Each splits into ink text then an accent word or phrase.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['lead', 'accent'],
        properties: {
          lead: { type: 'string', description: 'e.g. "Build the " — keep the trailing space.' },
          accent: { type: 'string', description: 'e.g. "system." — the emphasised tail of the line.' },
        },
      },
    },
    closingParagraph: { type: 'string', description: 'Two to four sentences. Warm, direct, no hard sell.' },
  },
} as const

/* ------------------------------------------------------------------ *
 * Fixed content — identical for every client.
 * ------------------------------------------------------------------ */

export const WHO_WE_ARE = {
  lead: 'Club She Is is an AI-powered digital sales and marketing partner for women entrepreneurs, built by Kopano Shimange and Nyaki Tshabangu.',
  body: 'We operate as two things at once. We are a community of 14,000 women across 51 countries learning to build businesses with sales and marketing automation, and we are an agency that builds and runs those systems for the businesses ready to go faster. You are getting the agency side: strategy, system, and execution, handled by a team that has done this for women in finance, coaching, and consulting before.',
  servicesHeading: 'Our four core services',
  services: [
    { title: 'Sales Funnel Automation', body: 'Designing and optimising sales funnels at every stage of the customer journey, from awareness through to sales page optimisation, automated follow-ups, and payment automation.' },
    { title: 'AI-Driven Marketing & Lead Generation', body: 'Hyper-personalised campaigns, AI-powered lead qualification, predictive analytics, and automated follow-ups, so you only spend time on high-intent leads.' },
    { title: 'Media Buying & Retargeting Ads', body: 'Precision-targeted advertising on Facebook, Instagram, TikTok, and Google Ads, attracting and converting the right audience.' },
    { title: 'Database Management & CRM Integration', body: 'Customer relationship management systems that nurture leads, segment your list, and drive conversions automatically.' },
  ],
  numbersLabel: 'The numbers so far.',
  numbersBody: 'A community of 14,000+ women across 51 countries. Clients who implement our automation see an average 42% increase in sales within six months. Our most recent masterclass series for HerVenture pulled 1,179 registrations at a 49.9% landing page conversion rate.',
} as const

export const TERMS = [
  { title: 'Payment terms', body: 'Invoicing happens on the 1st of each month, payable within 7 days. First month is invoiced at signing to kick off onboarding.' },
  { title: 'Late payment', body: 'Accounts more than 14 days overdue are paused until settled. We will always communicate before this happens.' },
  { title: 'Contract length', body: 'Monthly packages run month-to-month unless a minimum term is stated in the investment section above. Where a minimum applies, a 30-day cancellation notice follows it.' },
  { title: 'Cancellation', body: '30 days written notice from month four onwards. No early termination fees beyond honouring any stated minimum term.' },
  { title: 'Ad spend', body: 'Ad spend is separate from our management fee and paid directly by you to the platform. We recommend R150 to R300 per day to start, scaled based on performance.' },
  { title: 'Ownership & usage', body: 'Everything we build (funnels, copy, automations, assets) is owned by you. You retain full rights to all deliverables.' },
  { title: 'Revisions', body: 'Two rounds of revisions included on each major deliverable. Additional revisions billed at agreed hourly rate.' },
  { title: 'Confidentiality', body: 'Everything you share with us (business plans, financials, strategy) stays between us. NDA available on request.' },
  { title: 'Tools & subscriptions', body: 'Ghutte access is included in your monthly fee. Third-party tools (domain, email provider, etc.) are billed to your accounts directly.' },
] as const

export const FOOTER = {
  preparedBy: 'Prepared with care by',
  founders: 'Kopano Shimange & Nyaki Tshabangu · Co-Founders, Club She Is',
  contact: 'info@clubsheis.co.za · clubsheis.com',
  brandName: 'Club She Is',
  tagline: 'MARKETING PARTNER FOR WOMEN IN BUSINESS',
} as const

/** Section eyebrows, in document order. */
export const SECTION_LABELS = [
  'Section One', 'Section Two', 'Section Three',
  'Section Four', 'Section Five', 'Section Six',
] as const

/**
 * Flatten a proposal to markdown.
 *
 * The PDF is the deliverable, but the public proposal page and the plain-text
 * part of the email still read a single markdown field, so every generated
 * proposal is stored in both shapes from the same source.
 */
export function proposalToMarkdown(data: ProposalData, clientName: string, brandName?: string | null): string {
  const out: string[] = []

  out.push(`# ${data.headlineLead}${data.headlineAccent}`)
  out.push(`Prepared for ${clientName}${brandName ? ` · ${brandName}` : ''}`)

  out.push('## The opportunity')
  if (data.opportunityLead) out.push(data.opportunityLead)
  if (data.heard?.length) {
    out.push('### What we heard')
    for (const h of data.heard) out.push(`- ${h}`)
  }
  out.push(...data.opportunityParagraphs)

  out.push('## Who we are')
  out.push(WHO_WE_ARE.lead)
  out.push(WHO_WE_ARE.body)
  out.push(`### ${WHO_WE_ARE.servicesHeading}`)
  for (const s of WHO_WE_ARE.services) out.push(`- **${s.title}** — ${s.body}`)
  out.push(`**${WHO_WE_ARE.numbersLabel}** ${WHO_WE_ARE.numbersBody}`)

  out.push("## What we'll do together")
  if (data.planLead) out.push(data.planLead)
  for (const p of data.phases) {
    out.push(`### ${p.title}`)
    if (p.package) out.push(`*${p.package}*`)
    out.push(p.body)
    for (const c of p.creates ?? []) out.push(`- **${c.title}** — ${c.detail}`)
  }
  if (data.outcomes?.length) {
    out.push('### What this gets you')
    for (const o of data.outcomes) out.push(`- ${o}`)
  }

  out.push('## The investment')
  if (data.investmentLead) out.push(data.investmentLead)
  if (data.investmentNote) out.push(data.investmentNote)
  for (const c of data.cards) {
    out.push(`### ${c.name}${c.eyebrow ? ` — ${c.eyebrow}` : ''}`)
    if (c.subtitle) out.push(c.subtitle)
    out.push(`**${c.price}** ${c.cadence}${c.totalNote ? ` · ${c.totalNote}` : ''}`)
    for (const f of c.features) out.push(`- ${f}`)
  }

  out.push('## Terms & conditions')
  for (const t of TERMS) out.push(`- **${t.title}** — ${t.body}`)

  out.push('## Ready to begin')
  data.nextSteps.forEach((s, i) => out.push(`${i + 1}. ${s}`))
  out.push(data.closingLines.map(l => `${l.lead}${l.accent}`).join(' '))
  out.push(data.closingParagraph)

  out.push('---')
  out.push(`${FOOTER.preparedBy} ${FOOTER.founders}`)
  out.push(FOOTER.contact)

  return out.join('\n\n')
}

/**
 * Build the covering email for a proposal that travels as a PDF.
 *
 * The email must not restate the proposal — it summarises the recommendation
 * and points at the attachment. Derived from the same structured data rather
 * than generated separately, so the package and price in the email can never
 * drift from the ones in the PDF.
 */
export function buildProposalEmailBody(
  data: ProposalData,
  opts: { clientName: string; brandName?: string | null; proposalLink?: string },
): string {
  const { clientName, proposalLink } = opts
  const out: string[] = [`Hi ${clientName},`]

  out.push('Thank you again for taking the time to meet with us. Your full proposal is attached as a PDF.')

  // One line per package so the money is visible without opening the attachment.
  if (data.cards.length) {
    const lines = data.cards.map(c => {
      // The card eyebrow is set in letterspaced caps for the PDF; the email is
      // prose, so take just the phase name and give it sentence casing.
      const phase = c.eyebrow
        ? `${c.eyebrow.split('·')[0].trim().replace(/\w\S*/g, w => w[0].toUpperCase() + w.slice(1).toLowerCase())}: `
        : ''
      const total = c.totalNote ? ` (${c.totalNote})` : ''
      return `- ${phase}**${c.name}** — ${c.price} ${c.cadence}${total}`
    })
    out.push(
      data.cards.length > 1
        ? 'In short, we are recommending a phased engagement:'
        : 'In short, here is what we are recommending:',
    )
    out.push(lines.join('\n'))
  }

  out.push(
    'The attached PDF covers what we took away from our call, what we would do together, the full scope of each phase, and our terms.',
  )

  // First few steps only — the rest are in the PDF.
  if (data.nextSteps.length) {
    out.push('**What happens next?**')
    out.push(data.nextSteps.slice(0, 3).map((s, i) => `${i + 1}. ${s}`).join('\n'))
  }

  if (proposalLink) {
    out.push('You can also review and accept the proposal online here:')
    out.push(proposalLink)
  }

  out.push('Any questions at all, just reply to this email.')
  out.push('Warm regards,\nNyaki & Kopano — ClubSheIs')

  return out.join('\n\n')
}
