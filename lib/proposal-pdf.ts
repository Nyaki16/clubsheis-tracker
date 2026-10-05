// Proposal PDF — ported unchanged from the Client Flow app. Layout copies the
// approved Khanyisa Phika / Luminara proposal; Helvetica by decision.
// Server-only (pdfkit + fs). Used by the PDF preview route and the send route.
import PDFDocument from 'pdfkit'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  PALETTE, WHO_WE_ARE, TERMS, FOOTER, SECTION_LABELS,
  type ProposalData, type PricingCard,
} from '@/lib/proposal-template'

const MARGIN = 60
const A4_WIDTH = 595.28
const A4_HEIGHT = 841.89
const CONTENT = A4_WIDTH - MARGIN * 2

type Doc = PDFKit.PDFDocument

/* ------------------------------------------------------------------ *
 * Primitives
 * ------------------------------------------------------------------ */

/** Break to a new page when `needed` points would overflow the bottom margin. */
function ensure(doc: Doc, needed: number) {
  if (doc.y + needed > A4_HEIGHT - MARGIN) doc.addPage()
}

/** Small letterspaced label. Used for section numbers and card phase labels. */
function eyebrow(doc: Doc, text: string, opts: { size?: number; spacing?: number; colour?: string; align?: 'left' | 'center' } = {}) {
  if (!text) return
  doc.font('Helvetica')
    .fontSize(opts.size ?? 9)
    .fillColor(opts.colour ?? PALETTE.accent)
    .text(text, { characterSpacing: opts.spacing ?? 0, align: opts.align ?? 'left', width: CONTENT })
}

/**
 * The signature heading: ink for the opening words, accent for the tail.
 * Rendered as one continued run so the two halves sit on the same baseline.
 */
function twoToneHeading(doc: Doc, lead: string, accent: string, size = 24) {
  doc.fontSize(size).font('Helvetica-Bold')
  doc.fillColor(PALETTE.ink).text(lead, { continued: true })
  doc.fillColor(PALETTE.accent).text(accent, { continued: false })
}

/** Larger muted intro paragraph that sits under a section heading. */
function leadPara(doc: Doc, text: string) {
  if (!text) return
  doc.moveDown(0.6)
  doc.font('Helvetica').fontSize(13.5).fillColor(PALETTE.muted)
    .text(text, { width: CONTENT, lineGap: 4 })
}

/** Standard body copy. */
function bodyPara(doc: Doc, text: string, opts: { gap?: number } = {}) {
  if (!text) return
  doc.font('Helvetica').fontSize(10).fillColor(PALETTE.ink)
    .text(text, { width: CONTENT, lineGap: opts.gap ?? 3.5 })
}

/** Full-width hairline rule. */
function hairline(doc: Doc, colour = PALETTE.hairline) {
  const y = doc.y
  doc.save().moveTo(MARGIN, y).lineTo(MARGIN + CONTENT, y)
    .lineWidth(0.75).strokeColor(colour).stroke().restore()
  doc.y = y + 1
}

/** A maroon sub-heading, e.g. "Our four core services" or a phase title. */
function subHeading(doc: Doc, text: string, size = 14) {
  doc.font('Helvetica-Bold').fontSize(size).fillColor(PALETTE.accent)
    .text(text, { width: CONTENT })
}

/**
 * A small accent diamond, standing in for the template's ✦ glyph.
 * Helvetica's WinAnsi encoding has no sparkle character, so we draw it.
 */
function diamond(doc: Doc, x: number, y: number, r = 2.6) {
  doc.save()
    .moveTo(x, y - r).lineTo(x + r, y).lineTo(x, y + r).lineTo(x - r, y)
    .closePath().fill(PALETTE.accent).restore()
}

/* ------------------------------------------------------------------ *
 * Composite blocks
 * ------------------------------------------------------------------ */

/** Section eyebrow + two-tone heading + optional lead paragraph. */
function sectionOpen(doc: Doc, label: string, lead: string, accent: string, leadText?: string) {
  eyebrow(doc, label)
  doc.moveDown(0.3)
  twoToneHeading(doc, lead, accent)
  if (leadText) leadPara(doc, leadText)
  doc.moveDown(0.8)
}

/**
 * Tinted panel with a left accent bar. The inner content is measured first so
 * the background can be drawn behind it — pdfkit has no z-index, so anything
 * painted after the rect would be covered by it.
 */
function tintedPanel(
  doc: Doc,
  tint: string,
  measure: () => number,
  render: (innerX: number, innerWidth: number) => void,
) {
  const padX = 34
  const padY = 22
  const innerWidth = CONTENT - padX * 2
  const innerHeight = measure()
  const total = innerHeight + padY * 2

  ensure(doc, Math.min(total, A4_HEIGHT - MARGIN * 2))
  const top = doc.y

  // Background, then the 3pt accent bar down the left edge.
  doc.save().rect(MARGIN, top, CONTENT, total).fill(tint).restore()
  doc.save().rect(MARGIN, top, 3, total).fill(PALETTE.accent).restore()

  doc.y = top + padY
  render(MARGIN + padX, innerWidth)
  doc.y = top + total
}

/**
 * One pricing card: maroon top rule, package name, price row, deliverables.
 *
 * The border has to be stroked before the content is drawn, so the exact height
 * is computed first. Measurement and drawing therefore walk the same offsets —
 * keep the two `y` sequences below in step or the box will not match its
 * contents. `moveDown` is deliberately avoided here for that reason: it resolves
 * against the current font size, which changes throughout the card.
 */
function pricingCard(doc: Doc, card: PricingCard) {
  const padX = 34
  const padY = 26
  const innerWidth = CONTENT - padX * 2
  const PRICE_SIZE = 32
  const priceRowH = 56

  // --- measure -------------------------------------------------------
  doc.font('Helvetica').fontSize(8)
  const hEyebrow = card.eyebrow
    ? doc.heightOfString(card.eyebrow.toUpperCase(), { width: innerWidth, characterSpacing: 1.5 }) + 10
    : 0
  doc.font('Helvetica').fontSize(22)
  const hName = doc.heightOfString(card.name, { width: innerWidth }) + 4
  doc.font('Helvetica').fontSize(11)
  const hSub = card.subtitle ? doc.heightOfString(card.subtitle, { width: innerWidth }) + 16 : 8
  doc.font('Helvetica').fontSize(10)
  const featureHeights = card.features.map(f => doc.heightOfString(f, { width: innerWidth - 16, lineGap: 3 }))
  const hFeatures = featureHeights.reduce((s, h) => s + h + 8, 0)
  const total = padY + hEyebrow + hName + hSub + priceRowH + 14 + hFeatures + padY - 8

  // A card that cannot fit in the remaining space starts a fresh page.
  ensure(doc, Math.min(total, A4_HEIGHT - MARGIN * 2))
  const top = doc.y
  const x = MARGIN + padX

  // --- draw ----------------------------------------------------------
  doc.save().rect(MARGIN, top, CONTENT, total)
    .lineWidth(0.75).strokeColor(PALETTE.cardBorder).stroke().restore()
  doc.save().rect(MARGIN, top, CONTENT, 2.5).fill(PALETTE.accent).restore()

  let y = top + padY

  if (card.eyebrow) {
    doc.font('Helvetica').fontSize(8).fillColor(PALETTE.accent)
      .text(card.eyebrow.toUpperCase(), x, y, { width: innerWidth, characterSpacing: 1.5 })
    y += hEyebrow
  }

  doc.font('Helvetica').fontSize(22).fillColor(PALETTE.ink)
    .text(card.name, x, y, { width: innerWidth })
  y += hName

  if (card.subtitle) {
    doc.font('Helvetica').fontSize(11).fillColor(PALETTE.accent)
      .text(card.subtitle, x, y, { width: innerWidth })
  }
  y += hSub

  // Price row, framed by hairlines above and below.
  const ruleTop = y
  doc.save().moveTo(x, ruleTop).lineTo(x + innerWidth, ruleTop)
    .lineWidth(0.75).strokeColor(PALETTE.hairline).stroke().restore()

  const priceY = ruleTop + 14
  doc.font('Helvetica').fontSize(PRICE_SIZE).fillColor(PALETTE.accent)
    .text(card.price, x, priceY, { lineBreak: false })
  const priceWidth = doc.widthOfString(card.price)

  // Sit "per month" on the price's baseline rather than its box top. Helvetica's
  // ascender is ~0.718em, so the offset is the difference between the two.
  doc.font('Helvetica').fontSize(10)
  const cadenceY = priceY + (PRICE_SIZE - 10) * 0.718
  doc.fillColor(PALETTE.muted).text(card.cadence, x + priceWidth + 3, cadenceY, { lineBreak: false })

  if (card.totalNote) {
    doc.font('Helvetica').fontSize(8).fillColor(PALETTE.muted)
      .text(card.totalNote.toUpperCase(), x, cadenceY + 1, {
        width: innerWidth, align: 'right', characterSpacing: 1,
      })
  }

  const ruleBottom = ruleTop + priceRowH
  doc.save().moveTo(x, ruleBottom).lineTo(x + innerWidth, ruleBottom)
    .lineWidth(0.75).strokeColor(PALETTE.hairline).stroke().restore()

  y = ruleBottom + 14
  doc.font('Helvetica').fontSize(10)
  card.features.forEach((f, i) => {
    diamond(doc, x + 4, y + 5)
    doc.fillColor(PALETTE.ink).text(f, x + 14, y, { width: innerWidth - 16, lineGap: 3 })
    y += featureHeights[i] + 8
  })

  doc.y = top + total
}

/**
 * The CSI logo, cropped to its artwork so the drawn box is the artwork.
 * Read from public/ the same way the About Us attachment is; if it is ever
 * missing the caller falls back to setting the brand as type rather than
 * failing the whole document.
 */
const LOGO_RATIO = 441 / 259
function logoBuffer(): Buffer | null {
  try {
    return readFileSync(join(process.cwd(), 'public', 'csi-logo.png'))
  } catch {
    return null
  }
}

/* ------------------------------------------------------------------ *
 * Pages
 * ------------------------------------------------------------------ */

function renderCover(doc: Doc, data: ProposalData, clientName: string, dateLabel: string) {
  // The logo already carries the wordmark, so only the tagline is set as type.
  const logo = logoBuffer()
  if (logo) {
    const w = 132
    doc.image(logo, MARGIN, MARGIN, { width: w })
    doc.y = MARGIN + w / LOGO_RATIO + 10
  } else {
    doc.font('Helvetica-Bold').fontSize(19).fillColor(PALETTE.ink)
      .text(FOOTER.brandName, MARGIN, MARGIN, { width: CONTENT })
    doc.moveDown(0.15)
  }
  doc.font('Helvetica').fontSize(8).fillColor(PALETTE.accent)
    .text(FOOTER.tagline, MARGIN, doc.y, { width: CONTENT, characterSpacing: 2 })

  // Headline block, positioned in the lower-middle third like the template.
  doc.y = A4_HEIGHT * 0.36
  eyebrow(doc, 'PROPOSAL · CONFIDENTIAL', { spacing: 2.4 })
  doc.moveDown(0.9)

  doc.fontSize(38).font('Helvetica-Bold')
  doc.fillColor(PALETTE.ink).text(data.headlineLead, { width: CONTENT * 0.82, lineGap: 2, continued: false })
  doc.fillColor(PALETTE.accent).text(data.headlineAccent, { width: CONTENT * 0.82, lineGap: 2 })

  doc.moveDown(1.4)
  eyebrow(doc, 'PREPARED FOR', { size: 8, spacing: 2 })
  doc.moveDown(0.2)
  doc.font('Helvetica').fontSize(15).fillColor(PALETTE.ink).text(clientName, { width: CONTENT })

  // Footer rules and the prepared-by / date columns.
  const footY = A4_HEIGHT - MARGIN - 64
  doc.save().moveTo(MARGIN, footY).lineTo(MARGIN + CONTENT, footY)
    .lineWidth(0.75).strokeColor(PALETTE.hairline).stroke().restore()
  doc.save().moveTo(MARGIN, footY + 10).lineTo(MARGIN + CONTENT, footY + 10)
    .lineWidth(0.75).strokeColor(PALETTE.hairline).stroke().restore()

  doc.font('Helvetica').fontSize(8).fillColor(PALETTE.accent)
    .text('PREPARED BY', MARGIN, footY + 30, { characterSpacing: 2, width: 160 })
  doc.text('DATE', MARGIN + 180, footY + 30, { characterSpacing: 2, width: 160 })

  doc.font('Helvetica').fontSize(11).fillColor(PALETTE.ink)
    .text(FOOTER.brandName, MARGIN, footY + 44, { width: 160 })
  doc.text(dateLabel, MARGIN + 180, footY + 44, { width: 160 })
}

function renderOpportunity(doc: Doc, data: ProposalData) {
  doc.addPage()
  sectionOpen(doc, SECTION_LABELS[0], 'The ', 'opportunity', data.opportunityLead)
  if (data.heard?.length) whatWeHeard(doc, data.heard)
  for (const p of data.opportunityParagraphs) {
    ensure(doc, 60)
    bodyPara(doc, p)
    doc.moveDown(0.7)
  }
  doc.moveDown(0.4)
  hairline(doc)
}

/** "What we heard": the call in short points, in a warm panel above the recap. */
function whatWeHeard(doc: Doc, points: string[]) {
  const innerW = CONTENT - 68
  doc.font('Helvetica').fontSize(9)
  const hLabel = doc.heightOfString('WHAT WE HEARD', { width: innerW, characterSpacing: 2 }) + 12
  doc.font('Helvetica').fontSize(10)
  const heights = points.map(p => Math.max(doc.heightOfString(p, { width: innerW - 18, lineGap: 3 }), 12))
  const hPoints = heights.reduce((sum, h, i) => sum + h + (i < heights.length - 1 ? 8 : 0), 0)

  tintedPanel(
    doc,
    PALETTE.panelWarm,
    () => hLabel + hPoints,
    (x, w) => {
      let y = doc.y
      doc.font('Helvetica').fontSize(9).fillColor(PALETTE.accent)
        .text('WHAT WE HEARD', x, y, { width: w, characterSpacing: 2 })
      y += hLabel
      points.forEach((p, i) => {
        diamond(doc, x + 3, y + 6)
        doc.font('Helvetica').fontSize(10).fillColor(PALETTE.ink)
          .text(p, x + 18, y, { width: w - 18, lineGap: 3 })
        y += heights[i] + 8
      })
    },
  )
  doc.x = MARGIN
  doc.moveDown(1.2)
}

function renderWhoWeAre(doc: Doc) {
  doc.addPage()
  sectionOpen(doc, SECTION_LABELS[1], 'Who ', 'we are', WHO_WE_ARE.lead)
  bodyPara(doc, WHO_WE_ARE.body)
  doc.moveDown(1.4)

  subHeading(doc, WHO_WE_ARE.servicesHeading)
  doc.moveDown(0.9)

  // Em-dash + accent title + description, separated by hairlines.
  for (const s of WHO_WE_ARE.services) {
    doc.font('Helvetica').fontSize(10)
    const hBody = doc.heightOfString(s.body, { width: CONTENT - 34, lineGap: 3 })
    ensure(doc, hBody + 44)

    const top = doc.y
    doc.font('Helvetica').fontSize(10).fillColor(PALETTE.accent)
      .text('—', MARGIN, top, { width: 20 })
    doc.font('Helvetica').fontSize(10.5).fillColor(PALETTE.accent)
      .text(s.title, MARGIN + 34, top, { width: CONTENT - 34 })
    doc.moveDown(0.25)
    doc.font('Helvetica').fontSize(10).fillColor(PALETTE.ink)
      .text(s.body, MARGIN + 34, doc.y, { width: CONTENT - 34, lineGap: 3 })

    doc.moveDown(0.8)
    hairline(doc)
    doc.moveDown(0.8)
  }

  doc.moveDown(0.6)
  tintedPanel(
    doc,
    PALETTE.panelBlush,
    () => {
      doc.font('Helvetica').fontSize(10)
      return doc.heightOfString(`${WHO_WE_ARE.numbersLabel} ${WHO_WE_ARE.numbersBody}`, {
        width: CONTENT - 68, lineGap: 3.5,
      })
    },
    (x, w) => {
      doc.font('Helvetica').fontSize(10)
      doc.fillColor(PALETTE.accent).text(WHO_WE_ARE.numbersLabel, x, doc.y, { continued: true, lineGap: 3.5 })
      doc.fillColor(PALETTE.ink).text(` ${WHO_WE_ARE.numbersBody}`, { width: w, lineGap: 3.5, continued: false })
    },
  )
}

function renderPlan(doc: Doc, data: ProposalData) {
  doc.addPage()
  sectionOpen(doc, SECTION_LABELS[2], "What we'll ", 'do together', data.planLead)

  for (const phase of data.phases) {
    ensure(doc, 120)
    if (phase.package) {
      eyebrow(doc, phase.package.toUpperCase(), { size: 8, spacing: 1.5 })
      doc.moveDown(0.3)
    }
    subHeading(doc, phase.title)
    doc.moveDown(0.5)
    bodyPara(doc, phase.body)
    if (phase.creates?.length) {
      doc.moveDown(0.9)
      ensure(doc, 50)
      eyebrow(doc, "WHAT WE'LL CREATE", { size: 8, spacing: 2 })
      doc.moveDown(0.5)
      for (const c of phase.creates) createdItem(doc, c.title, c.detail)
    }
    doc.moveDown(1.3)
  }
  if (data.outcomes?.length) outcomesPanel(doc, data.outcomes)
  hairline(doc)
}

/** One deliverable in Section Three: diamond, bold title, then what it does for the client. */
function createdItem(doc: Doc, title: string, detail: string) {
  const x = MARGIN + 18
  const w = CONTENT - 18
  doc.font('Helvetica-Bold').fontSize(10.5)
  const hTitle = doc.heightOfString(title, { width: w })
  doc.font('Helvetica').fontSize(10)
  const hDetail = detail ? doc.heightOfString(detail, { width: w, lineGap: 3 }) : 0
  ensure(doc, hTitle + hDetail + 14)
  const y = doc.y
  diamond(doc, MARGIN + 3, y + 6)
  doc.font('Helvetica-Bold').fontSize(10.5).fillColor(PALETTE.ink).text(title, x, y, { width: w })
  if (detail) {
    doc.font('Helvetica').fontSize(10).fillColor(PALETTE.muted).text(detail, x, y + hTitle + 3, { width: w, lineGap: 3 })
  }
  doc.x = MARGIN
  doc.y = y + hTitle + (detail ? hDetail + 3 : 0) + 12
}

/** "What this gets you": the results, in a blush panel at the end of Section Three. */
function outcomesPanel(doc: Doc, outcomes: string[]) {
  const innerW = CONTENT - 68
  doc.font('Helvetica').fontSize(9)
  const hLabel = doc.heightOfString('WHAT THIS GETS YOU', { width: innerW, characterSpacing: 2 }) + 12
  doc.font('Helvetica').fontSize(10.5)
  const heights = outcomes.map(o => Math.max(doc.heightOfString(o, { width: innerW - 18, lineGap: 3 }), 12))
  const hItems = heights.reduce((sum, h, i) => sum + h + (i < heights.length - 1 ? 8 : 0), 0)
  tintedPanel(
    doc,
    PALETTE.panelBlush,
    () => hLabel + hItems,
    (x, w) => {
      let y = doc.y
      doc.font('Helvetica').fontSize(9).fillColor(PALETTE.accent)
        .text('WHAT THIS GETS YOU', x, y, { width: w, characterSpacing: 2 })
      y += hLabel
      outcomes.forEach((o, i) => {
        diamond(doc, x + 3, y + 6)
        doc.font('Helvetica').fontSize(10.5).fillColor(PALETTE.ink)
          .text(o, x + 18, y, { width: w - 18, lineGap: 3 })
        y += heights[i] + 8
      })
    },
  )
  doc.x = MARGIN
  doc.moveDown(1.2)
}

function renderInvestment(doc: Doc, data: ProposalData) {
  doc.addPage()
  sectionOpen(doc, SECTION_LABELS[3], 'The ', 'investment', data.investmentLead)
  if (data.investmentNote) {
    bodyPara(doc, data.investmentNote)
    doc.moveDown(1.2)
  }

  data.cards.forEach((card, i) => {
    pricingCard(doc, card)
    if (i < data.cards.length - 1) doc.moveDown(1.4)
  })
}

function renderTerms(doc: Doc) {
  doc.addPage()
  sectionOpen(doc, SECTION_LABELS[4], 'Terms & ', 'conditions')

  for (const t of TERMS) {
    doc.font('Helvetica').fontSize(9.5)
    const h = doc.heightOfString(t.body, { width: CONTENT, lineGap: 3 })
    ensure(doc, h + 34)
    doc.font('Helvetica-Bold').fontSize(10.5).fillColor(PALETTE.accent)
      .text(t.title, MARGIN, doc.y, { width: CONTENT })
    doc.moveDown(0.2)
    doc.font('Helvetica').fontSize(9.5).fillColor(PALETTE.ink)
      .text(t.body, MARGIN, doc.y, { width: CONTENT, lineGap: 3 })
    doc.moveDown(0.85)
  }
}

function renderReadyToBegin(doc: Doc, data: ProposalData) {
  doc.addPage()
  eyebrow(doc, SECTION_LABELS[5])
  doc.moveDown(0.3)
  twoToneHeading(doc, 'Ready to ', 'begin')
  doc.moveDown(1)

  const introLine = "Here's what happens once you say yes:"
  const innerW = CONTENT - 68

  // Measure once and reuse in the renderer, so the panel background is exactly
  // as tall as its contents (see the note on pricingCard).
  doc.font('Helvetica').fontSize(12)
  const hIntro = doc.heightOfString(introLine, { width: innerW }) + 16
  doc.font('Helvetica').fontSize(10)
  const stepHeights = data.nextSteps.map(s =>
    Math.max(doc.heightOfString(s, { width: innerW - 42, lineGap: 3 }), 12),
  )
  const hSteps = stepHeights.reduce((sum, h, i) => sum + h + 9 + (i < stepHeights.length - 1 ? 9 : 0), 0)

  tintedPanel(
    doc,
    PALETTE.panelWarm,
    () => hIntro + hSteps,
    (x, w) => {
      let y = doc.y
      doc.font('Helvetica').fontSize(12).fillColor(PALETTE.accent)
        .text(introLine, x, y, { width: w })
      y += hIntro

      data.nextSteps.forEach((step, i) => {
        doc.font('Helvetica').fontSize(10).fillColor(PALETTE.accent)
          .text(String(i + 1).padStart(2, '0'), x, y, { width: 30 })
        doc.font('Helvetica').fontSize(10).fillColor(PALETTE.ink)
          .text(step, x + 42, y, { width: w - 42, lineGap: 3 })
        y += stepHeights[i] + 9

        // Hairline between rows, but not after the last one.
        if (i < data.nextSteps.length - 1) {
          doc.save().moveTo(x, y).lineTo(x + w, y)
            .lineWidth(0.6).strokeColor(PALETTE.hairline).stroke().restore()
          y += 9
        }
      })
    },
  )

  // Closing statement — centred, two-tone, then the credits block. Measured as
  // one unit so the statement and the credits never split across a page break.
  doc.moveDown(1.0)
  doc.font('Helvetica').fontSize(11)
  const hClosingPara = doc.heightOfString(data.closingParagraph, {
    width: CONTENT * 0.8, lineGap: 4,
  })
  // Summed from the actual advances below rather than rounded up: an inflated
  // estimate here forces a page break the content does not need, stranding the
  // closing statement on a page of its own.
  const hClosingBlock =
    16 +                                 // hairline + gap
    22 +                                 // eyebrow + gap
    data.closingLines.length * 24 +      // statement lines
    9 + hClosingPara +                   // gap + closing paragraph
    18 + 16 +                            // gap + hairline + gap
    (logoBuffer() ? 46 / LOGO_RATIO + 10 : 25) + // logo mark (or its type fallback) + gap
    42                                   // three credit lines

  // Whether this fits under the steps panel depends on how long the generated
  // copy runs, so handle both outcomes deliberately: keep it on this page when
  // there is room, otherwise give it a page and centre it vertically so it
  // reads as a closing page rather than an overflow.
  if (doc.y + hClosingBlock > A4_HEIGHT - MARGIN) {
    doc.addPage()
    doc.y = Math.max(MARGIN, (A4_HEIGHT - hClosingBlock) / 2)
  }
  hairline(doc)
  doc.moveDown(1.4)

  eyebrow(doc, "LET'S GET TO WORK", { size: 9, spacing: 3, align: 'center' })
  doc.moveDown(1)

  doc.fontSize(20).font('Helvetica-Bold')
  for (const line of data.closingLines) {
    const y = doc.y
    // Centre the pair by measuring both halves and offsetting from the middle.
    const wLead = doc.widthOfString(line.lead)
    const wAccent = doc.widthOfString(line.accent)
    const startX = MARGIN + (CONTENT - (wLead + wAccent)) / 2
    doc.fillColor(PALETTE.ink).text(line.lead, startX, y, { continued: true, lineBreak: false })
    doc.fillColor(PALETTE.accent).text(line.accent, { continued: false, lineBreak: false })
    doc.y = y + 24
  }

  doc.moveDown(0.8)
  doc.font('Helvetica').fontSize(11).fillColor(PALETTE.muted)
    .text(data.closingParagraph, MARGIN + CONTENT * 0.1, doc.y, {
      width: CONTENT * 0.8, align: 'center', lineGap: 4,
    })

  doc.moveDown(1.6)
  hairline(doc)
  doc.moveDown(1.4)

  const footLogo = logoBuffer()
  if (footLogo) {
    const w = 46
    doc.image(footLogo, MARGIN + (CONTENT - w) / 2, doc.y, { width: w })
    doc.y += w / LOGO_RATIO + 12
  } else {
    doc.font('Helvetica-Bold').fontSize(11).fillColor(PALETTE.accent)
      .text('CSI', MARGIN, doc.y, { width: CONTENT, align: 'center', characterSpacing: 1 })
    doc.moveDown(1)
  }
  doc.font('Helvetica').fontSize(10).fillColor(PALETTE.ink)
    .text(FOOTER.preparedBy, MARGIN, doc.y, { width: CONTENT, align: 'center' })
  doc.moveDown(0.3)
  doc.font('Helvetica').fontSize(9).fillColor(PALETTE.muted)
    .text(FOOTER.founders, MARGIN, doc.y, { width: CONTENT, align: 'center' })
  doc.moveDown(0.3)
  doc.text(FOOTER.contact, MARGIN, doc.y, { width: CONTENT, align: 'center' })
}

/* ------------------------------------------------------------------ *
 * Entry point
 * ------------------------------------------------------------------ */

/** Build the whole proposal PDF and return it as a buffer. */
export async function buildProposalPdf(
  data: ProposalData,
  clientName: string,
  brandName: string | null,
  dateLabel: string,
): Promise<Buffer> {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
    autoFirstPage: false,
    info: {
      Title: `${brandName || clientName} — Proposal`,
      Author: 'Club She Is',
      Subject: 'Proposal · Confidential',
    },
  })

  // Match the other ClubSheIs PDFs: strip kerning so Canva's PDF importer keeps
  // spaces intact (its importer reads pdfkit's positional TJ offsets as breaks).
  for (const name of ['Helvetica', 'Helvetica-Bold']) {
    doc.font(name)
    const internal = (doc as unknown as { _font?: { font?: { kernPairs?: Record<string, number> } } })._font
    if (internal?.font?.kernPairs) internal.font.kernPairs = {}
  }

  doc.addPage()
  renderCover(doc, data, clientName, dateLabel)
  renderOpportunity(doc, data)
  renderWhoWeAre(doc)
  renderPlan(doc, data)
  renderInvestment(doc, data)
  renderTerms(doc)
  renderReadyToBegin(doc, data)

  const chunks: Buffer[] = []
  doc.on('data', (c: Buffer) => chunks.push(c))
  const done = new Promise<void>(resolve => doc.on('end', () => resolve()))
  doc.end()
  await done
  return Buffer.concat(chunks)
}
