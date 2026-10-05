// Gmail SMTP sending (ported from the Client Flow app's /api/send-email).
// Server-only. Needs GMAIL_USER + GMAIL_APP_PASSWORD; GMAIL_FROM_NAME optional.
import nodemailer from "nodemailer";

export type Attachment = { filename: string; content: Buffer };

// The production address is used for anything a client opens from their inbox:
// preview deployments sit behind Vercel login, so links to them would fail.
export const PUBLIC_APP_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://clubsheis-tracker.vercel.app").replace(/\/$/, "");

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Light markdown → HTML, matching what the old app sent.
export function emailHtml(body: string, trackingPixelUrl?: string) {
  let html = body
    .split("\n")
    .map((raw) => {
      const line = esc(raw);
      if (line.startsWith("# ")) return `<h2 style="color:#1c1917;margin:16px 0 8px">${line.slice(2)}</h2>`;
      if (line.startsWith("## ")) return `<h3 style="color:#1c1917;margin:12px 0 4px">${line.slice(3)}</h3>`;
      if (line.startsWith("**") && line.endsWith("**")) return `<p style="font-weight:600;color:#1c1917;margin:8px 0">${line.replace(/\*\*/g, "")}</p>`;
      if (line.startsWith("- ")) return `<li style="color:#44403c;margin:2px 0 2px 16px">${line.slice(2).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")}</li>`;
      if (line === "---") return '<hr style="border:none;border-top:1px solid #e7e5e4;margin:16px 0">';
      if (line.trim() === "") return "<br>";
      return `<p style="color:#44403c;margin:4px 0">${line.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")}</p>`;
    })
    .join("\n");
  if (trackingPixelUrl) html += `<img src="${trackingPixelUrl}" width="1" height="1" style="display:none" alt="" />`;
  return html;
}

export async function sendGmail(opts: {
  to: string;
  subject: string;
  text: string;
  html: string;
  attachments?: Attachment[];
  /** Display name on the From line; the address is always GMAIL_USER. */
  fromName?: string;
  replyTo?: string;
  cc?: string;
}) {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) {
    throw new Error("Email isn't set up yet: add GMAIL_USER and GMAIL_APP_PASSWORD to the Tracker's Vercel environment variables.");
  }
  const transporter = nodemailer.createTransport({ service: "gmail", auth: { user, pass } });
  await transporter.sendMail({
    from: opts.fromName ? `${opts.fromName} <${user}>` : process.env.GMAIL_FROM_NAME ? `${process.env.GMAIL_FROM_NAME} <${user}>` : user,
    replyTo: opts.replyTo ?? user,
    to: opts.to,
    ...(opts.cc ? { cc: opts.cc } : {}),
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
    ...(opts.attachments?.length ? { attachments: opts.attachments } : {}),
  });
}
