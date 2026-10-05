// The Yellow Sheet: what a client tells us once they've paid for Ghutte —
// their business, their offer and their brand voice. Shared by the public
// form, the task panel and the copy generators.

export type YsField = {
  key: string;
  label: string;
  placeholder: string;
  rows: number;
  /** Input type for one-line fields. */
  type?: "text" | "email" | "tel" | "url";
  /** Sits next to another half-width field on wider screens. */
  half?: boolean;
  required?: boolean;
  /** Small print under the field. */
  hint?: string;
  /** Pre-filled when empty. */
  initial?: string;
  /** Questions shown under the label to draw out detail. */
  guide?: string[];
  /** The answer can't be sent shorter than this. */
  minWords?: number;
  /** What a really useful answer looks like. */
  targetWords?: number;
};

export const countWords = (t: string) => t.split(/\s+/).filter(Boolean).length;

export const YS_SECTIONS: { title: string; fields: YsField[] }[] = [
  {
    title: "Your details",
    fields: [
      { key: "first_name", label: "First name", placeholder: "Your first name", rows: 1, half: true },
      { key: "last_name", label: "Last name", placeholder: "Your last name", rows: 1, half: true },
      { key: "phone", label: "Phone", placeholder: "e.g. 082 123 4567", rows: 1, type: "tel", half: true, required: true },
      { key: "email", label: "Business email", placeholder: "you@yourbusiness.co.za", rows: 1, type: "email", half: true, required: true },
      { key: "address", label: "Street address", placeholder: "e.g. 12 Jan Smuts Avenue, Rosebank", rows: 1 },
      { key: "city", label: "City", placeholder: "e.g. Johannesburg", rows: 1, half: true },
      { key: "state", label: "Province", placeholder: "e.g. Gauteng", rows: 1, half: true },
      { key: "country", label: "Country", placeholder: "e.g. South Africa", rows: 1, half: true, initial: "South Africa" },
      { key: "postal_code", label: "Postal code", placeholder: "e.g. 2196", rows: 1, half: true },
    ],
  },
  {
    title: "Your business",
    fields: [
      { key: "company_name", label: "Company name", placeholder: "Your registered company name", rows: 1, hint: "The legal registered name, as on your CIPC documents." },
      { key: "business_name", label: "Business trading name", placeholder: "e.g. Glow Studio", hint: "The name your clients know you by.", rows: 1, half: true },
      { key: "website", label: "Website", placeholder: "https://yourwebsite.co.za", rows: 1, type: "url", half: true },
      {
        key: "business",
        label: "What your business does and who you serve",
        placeholder: "Tell us everything, in your own words. The more detail, the better your copy.",
        rows: 8,
        required: true,
        minWords: 80,
        targetWords: 200,
        guide: [
          "What exactly do you sell: products, services, programmes?",
          "Who buys from you: age, life stage, where they live, what they care about?",
          "What problem do you solve for them, and what changes after they work with you?",
          "Where do you operate (online, which city or country) and how do people find you now?",
          "How long have you been running, and roughly how many clients or customers have you served?",
          "What makes you different from others who do what you do?",
        ],
      },
      {
        key: "story",
        label: "Your story",
        placeholder: "Write it like you'd tell a friend over coffee. Don't worry about polish; we'll shape it.",
        rows: 10,
        required: true,
        minWords: 100,
        targetWords: 250,
        guide: [
          "Why did you start this business? What was happening in your life at the time?",
          "What have you been through (setbacks, turning points) that shaped how you work?",
          "What do you believe that others in your industry don't?",
          "What experience, qualifications or results give you authority?",
          "Tell us about a client moment that made it all worth it.",
          "Where are you taking this business in the next year?",
        ],
      },
    ],
  },
  {
    title: "Your offer",
    fields: [
      {
        key: "offer",
        label: "Your offer: name, price and what's included",
        placeholder: "e.g. The Glow Reset: a 6-week skin programme, R2,500 or 3 × R900, with a consultation, weekly check-ins and…",
        rows: 8,
        required: true,
        minWords: 60,
        targetWords: 150,
        guide: [
          "What's it called, and what is it: a product, programme, service or membership?",
          "What does it cost, and are there payment plans, deposits or packages?",
          "Exactly what's included: sessions, duration, materials, support, bonuses?",
          "How does it work from the moment someone pays to the end?",
          "What result or transformation does someone walk away with?",
          "Is there a guarantee, deadline, limited spots or launch date?",
        ],
      },
      {
        key: "audience",
        label: "Who it's for and the problem it solves",
        placeholder: "Describe one real person you'd love more of: who she is, what keeps her up at night, what she's tried…",
        rows: 8,
        required: true,
        minWords: 60,
        targetWords: 150,
        guide: [
          "Who is your ideal client: age, job or life stage, where she lives, what she earns?",
          "What is she struggling with right now, in her own words?",
          "What has she already tried that didn't work, and why?",
          "What stops her from buying: price, time, doubt, fear?",
          "What does her life look like once the problem is solved?",
        ],
      },
      {
        key: "results",
        label: "Results, testimonials or proof",
        placeholder: "Client wins, numbers, before-and-afters, quotes you're allowed to share. Paste testimonials word for word.",
        rows: 6,
        targetWords: 100,
        guide: [
          "Specific client wins, with numbers if you have them (e.g. “lost 8 kg in 6 weeks”).",
          "Testimonials, pasted word for word, with the client's first name if we can use it.",
          "Your own credentials, awards, media features or years of experience.",
          "New and no results yet? Tell us your own transformation or why people trust you.",
        ],
      },
      {
        key: "cta",
        label: "What should people do next?",
        placeholder: "e.g. Book a free 15-minute call, or buy the programme now.",
        rows: 3,
        required: true,
        minWords: 8,
        targetWords: 30,
        guide: [
          "The one action you want: buy, book a call, join the waitlist, DM you?",
          "Anything they need to know first, like a deadline or limited spots?",
        ],
      },
    ],
  },
  {
    title: "Your brand voice",
    fields: [
      {
        key: "voice",
        label: "How you sound",
        placeholder: "e.g. Warm and direct, like a big sister who tells you the truth. A bit playful, never salesy…",
        rows: 6,
        required: true,
        minWords: 30,
        targetWords: 100,
        guide: [
          "Three to five words that describe how you talk to your clients.",
          "Formal or casual? Do you use humour, slang, emojis, isiZulu or Afrikaans phrases?",
          "Brands, creators or people whose voice you love, and why.",
          "Anything that would make you cringe if we wrote it?",
        ],
      },
      {
        key: "words",
        label: "Words and phrases you love, and ones you never use",
        placeholder: "e.g. Love: 'sis', 'let's go', 'soft life'. Never: 'hustle', 'boss babe', 'cheap'.",
        rows: 4,
        targetWords: 40,
        guide: [
          "Phrases you say all the time, or that your clients say back to you.",
          "Words you never want to see in your copy.",
          "How you refer to your clients (e.g. “my ladies”, “the community”, “clients”).",
        ],
      },
    ],
  },
];

export const YS_FIELDS: YsField[] = YS_SECTIONS.flatMap((s) => s.fields);
export type YsKey = string;

// The minimum we need before generating anything useful.
export const YS_REQUIRED: YsKey[] = ["business", "offer", "voice"];

export function yellowSheetText(state: Record<string, unknown> | null | undefined) {
  if (!state) return "";
  return YS_SECTIONS.map((s) => {
    const lines = s.fields
      .map((f) => {
        const v = typeof state[f.key] === "string" ? (state[f.key] as string).trim() : "";
        return v ? `${f.label}:\n${v}` : "";
      })
      .filter(Boolean);
    return lines.length ? `## ${s.title}\n${lines.join("\n\n")}` : "";
  })
    .filter(Boolean)
    .join("\n\n");
}
