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
      { key: "offer", label: "Your offer: name, price and what's included", placeholder: "e.g. 8-week programme, R2,500, weekly group calls + community", rows: 4 },
      { key: "audience", label: "Who it's for and the problem it solves", placeholder: "Describe your ideal client and what they're struggling with.", rows: 4 },
      { key: "results", label: "Results, testimonials or proof", placeholder: "Client wins, numbers, quotes you're allowed to share.", rows: 3 },
      { key: "cta", label: "What should people do next?", placeholder: "e.g. Book a call, buy now, join the waitlist. Add the link if you have one.", rows: 2 },
    ],
  },
  {
    title: "Your brand voice",
    fields: [
      { key: "voice", label: "How you sound", placeholder: "e.g. Warm, direct, a bit playful. Never salesy.", rows: 3 },
      { key: "words", label: "Words and phrases you love, and ones you never use", placeholder: "e.g. Love: 'sis', 'let's go'. Never: 'hustle', 'boss babe'.", rows: 3 },
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
