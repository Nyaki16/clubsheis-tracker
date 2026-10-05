// Copy generators for flow tasks. Adapted from the Client Flow app's proven
// copy-element prompts; they now read the client's Yellow Sheet (and earlier
// approved drafts) instead of the retired strategy documents.

const AGENCY = "ClubSheIs, a digital marketing and content production agency in South Africa";
const COMPLETE =
  "Write COMPLETE copy, not outlines or placeholders. Use the client's own language from the Yellow Sheet, reference their actual offer, and keep their brand voice throughout. Where the Yellow Sheet leaves something out, write the best version you can and mark the assumption inline as [GAP: what to confirm with the client]. South African English. There is NO word limit.";

export type GeneratorSpec = {
  /** Earlier tasks (by title) whose approved or latest draft is passed in. */
  uses: string[];
  /** Live page links field on the task itself (internal check, hand over). */
  usesLinks?: boolean;
  maxTokens: number;
  prompt: string;
};

export const GENERATORS: Record<string, GeneratorSpec> = {
  "Sales page copy": {
    uses: [],
    maxTokens: 48000,
    prompt: `You are writing production-ready SALES PAGE COPY for the client's main offer, for ${AGENCY}.

ClubSheIs builds the MARKETING ASSETS that sell the client's product. We do not build the product itself. Our job is to write the copy that SELLS it.

STRUCTURE FOR THE PAGE:

### Above the Fold
- **Headline** (3 variations): the main promise. Speak to the core pain or desire.
- **Subheadline**: add specificity, credibility, or urgency.
- **Hero CTA**: the primary button text (3 variations).
- **Supporting text**: 1-2 sentences that reduce friction.

### Problem Section
- **Section headline**: name the problem they're feeling right now.
- **Problem bullets** (3-5): specific, emotional pain points in their language.
- **Bridge statement**: from "I feel this" to "there's a better way."

### Solution Section
- **Section headline**: introduce the offer.
- **How it works** (3-5 steps): numbered, simple, concrete.
- **Key benefit statements** (3-5): what changes for them.

### What's Included
- Every component of the offer, each with a one-line benefit.

### Social Proof Section
- **Section headline** and up to 3 testimonials or proof points from the Yellow Sheet, framed for the page.

### About Me Section
- **Section headline** (e.g. "Hi, if we've never met before...")
- **Personal intro**, **why this matters to them**, **why you should listen** (positioned as "I've been where you are", not a cold CV), and a **bridge to the CTA**. Use their story from the Yellow Sheet.

### Price & CTA Section
- **Final headline**, the price presented with its value, **CTA button text** (3 variations), and an urgency or scarcity element if it fits.

### FAQ Section
- **5-8 FAQs** with answers that overcome objections.

${COMPLETE}`,
  },

  "7-email sequence": {
    uses: ["Sales page copy"],
    maxTokens: 48000,
    prompt: `You are writing a production-ready 7-EMAIL SALES SEQUENCE for the client's main offer, for ${AGENCY}.

Write exactly SEVEN emails, in this order:
1. Welcome + story: who they are and why this offer exists
2. The problem: name it in the reader's own words
3. The solution reveal: introduce the offer and how it works
4. Proof: results, testimonials, a client story
5. Objection handling: time, money, "will this work for me?"
6. Doors closing / urgency
7. Last chance

If approved sales page copy is provided, keep the messaging, promises and price consistent with it.

FOR EACH EMAIL write:
- **Email #X — [Purpose]**
- **Send timing** (e.g. "Immediately", "Day 2")
- **Subject line** (3 variations)
- **Preview text**
- **Body copy**: the full email, conversational and benefit-driven
- **CTA**: the action and button text
- **P.S.** (often the most-read line)

${COMPLETE}`,
  },

  "1 month of content": {
    uses: ["Sales page copy"],
    maxTokens: 64000,
    prompt: `You are writing ONE MONTH of production-ready SOCIAL MEDIA CONTENT (Instagram, Facebook, TikTok) for the client, for ${AGENCY}.

Start with a **CONTENT CALENDAR**: a table of 4 weeks × 3-4 posts a week (12-16 posts), each row with week, day, format (Reel, Carousel, Static, Stories), pillar, and working title. Build the month from awareness (weeks 1-2), to trust (week 3), to the offer (week 4).

Then write EVERY post in full:

FOR REELS: the hook (first 3 seconds), a timestamped script, on-screen text, visual direction, full caption with hashtags, and the CTA.
FOR CAROUSELS: 7-10 slides with the exact text for each slide plus layout notes, the final CTA slide, and the full caption.
FOR STATIC POSTS: visual direction, full caption, 15-20 hashtags grouped broad/niche/branded, and the CTA.
FOR STORIES: 3-5 frames with text, stickers or polls, and the CTA.

A content creator should be able to produce every post without another briefing.

${COMPLETE}`,
  },

  "Ad copy": {
    uses: ["Sales page copy"],
    maxTokens: 32000,
    prompt: `You are writing production-ready META AD COPY for the client's main offer, for ${AGENCY}.

### AD SET 1 — Primary angle
- **Primary text** (3 variations: short, medium, long)
- **Headline** (40 chars max, 3 variations)
- **Description** (30 chars max, 2 variations)
- **CTA button** (Learn More, Sign Up, Book Now, Shop Now, etc.)
- **Link destination**

### AD SET 2 — A completely different hook and angle
Same structure.

### CREATIVE BRIEF (for each ad set)
- **Format** and why (single image, video, carousel)
- **Visual direction**: what the image or video shows, colours, mood, text overlays
- **Video script** with timestamps if video (15-30 seconds)
- **Aspect ratios**: Feed 1:1 and/or Story 9:16

### AUDIENCE TARGETING
- Target audience (demographics, interests, behaviours), retargeting and lookalike suggestions, placements.

The ads team should be able to paste this straight into Meta Ads Manager.

${COMPLETE}`,
  },

  "Email newsletters": {
    uses: ["7-email sequence"],
    maxTokens: 32000,
    prompt: `You are writing this month's TWO production-ready EMAIL NEWSLETTERS for the client, for ${AGENCY}. These are standalone newsletters that nurture the relationship, not automated sequence emails.

FOR EACH NEWSLETTER:
- **Subject line** (3 variations: curiosity, benefit, urgency)
- **Preview text**
- **Opening**: a personal, story-driven hook (2-3 sentences)
- **Main content**: the core insight or lesson, like advice from a trusted friend, with actionable takeaways
- **Secondary section**: a tip, resource, client spotlight or behind-the-scenes
- **CTA section** tied to the main offer, with button text (3 variations)
- **Sign-off** in the client's voice
- **Design notes**: layout and any images

Make the two newsletters different in topic and angle.

${COMPLETE}`,
  },

  "Content plan + scripts": {
    uses: ["1 month of content"],
    maxTokens: 48000,
    prompt: `You are planning a CONTENT DAY (a studio shoot) for the client, for ${AGENCY}. The shoot produces long-form and short-form video.

Write:
1. **Shoot overview**: goals for the day, the core message, and what the content should drive people towards.
2. **Long-form video** (1-2 videos, 8-20 minutes each): title options, a hook, a full talking-point outline section by section, B-roll ideas, and the CTA.
3. **Short-form scripts** (8-10 Reels/TikToks): for each, the hook, a timestamped script, on-screen text, and the caption.
4. **Shot list**: every setup in shooting order, with location or backdrop, wardrobe changes, and props.
5. **Run sheet** for the day with timings.
6. **What the client must bring or prepare.**

${COMPLETE}`,
  },

  "Pre-production prompts": {
    uses: ["Sales page copy"],
    maxTokens: 32000,
    prompt: `You are writing PRE-PRODUCTION BUILD PROMPTS for the client's full funnel, for ${AGENCY}. The team pastes these into an AI page builder or hands them to a designer to build each page in Ghutte.

Write one self-contained prompt for each page: the LEAD MAGNET page, the OTO (one-time offer) page, and the MAIN PRODUCT sales page. Each prompt must include:
- The page's job in the funnel and where it sends people next
- The section-by-section structure with the actual copy to use (take it from the approved sales page copy where it fits; write what's missing)
- Visual direction: mood, layout, imagery, and how the brand voice should feel visually
- Mobile notes and the exact CTA buttons

Keep each prompt under about 4,000 characters so it fits page-builder input limits.

${COMPLETE}`,
  },

  "Internal check": {
    uses: ["Sales page copy", "7-email sequence"],
    usesLinks: true,
    maxTokens: 24000,
    prompt: `You are a QA Analyst for ${AGENCY}, reviewing a client's build before it goes to the client.

You receive the APPROVED copy, the Yellow Sheet, and LIVE PAGE CONTENT scraped from the built pages.

SECTION 1: LIVE PAGE vs APPROVED COPY — for each live page: headline, body, About Me, CTAs, missing or extra sections. Quote the exact differences.
SECTION 2: BRAND CONSISTENCY — does the copy tone match the brand voice?
SECTION 3: FUNNEL FLOW — does each page lead to the next step? Any dead ends? Do CTAs match the flow?
SECTION 4: COMPLETENESS — is every approved asset represented? Email workflows live in Ghutte and can't be scraped: list them for manual review, don't fail them.
SECTION 5: SUMMARY & VERDICT — PASS / WARNINGS / FAIL, with prioritised action items.

Mark items ✅ pass, ⚠️ warning (should fix), ❌ critical (must fix before hand-over). Pages that couldn't be fetched go to manual review. If no live pages were provided, check completeness of the approved deliverables only and say so.`,
  },

  "Hand over": {
    uses: [],
    usesLinks: true,
    maxTokens: 16000,
    prompt: `You are writing a professional CLIENT HAND-OVER DOCUMENT for ${AGENCY}. The client receives this when their build is complete. Make it clear, warm, professional and easy to follow.

Structure:
1. WELCOME — "Hi [Client], your build is complete! Here's everything we've created for you." plus a short summary.
2. WHAT WE BUILT — each deliverable with a one-line, non-technical description, grouped logically.
3. YOUR ACCESS LINKS — every link with a clear label and a one-line "what to do with this".
4. HOW IT ALL WORKS — a plain-English walkthrough of the customer journey.
5. NEXT STEPS — what the client should do now, and any ongoing support.
6. NOTES — anything the team added.

Use the client's name. This is a celebration: they've invested in their business and now they have a complete system. Use clean formatting: section headings in CAPS and bullet points with dashes, no ** or ## markdown.`,
  },
};

export function generatorFor(title: string) {
  return GENERATORS[title] ?? null;
}
