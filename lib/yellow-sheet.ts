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
};

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
      { key: "business_name", label: "Business trading name", placeholder: "The name your clients know, e.g. Glow Studio", rows: 1, half: true },
      { key: "website", label: "Website", placeholder: "https://yourwebsite.co.za", rows: 1, type: "url", half: true },
      { key: "business", label: "What your business does and who you serve", placeholder: "In a few sentences: what you do, for whom, and where.", rows: 3 },
      { key: "story", label: "Your story", placeholder: "Why you started, what you've been through, what you believe.", rows: 4 },
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
