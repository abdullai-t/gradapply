import { appOrigin } from "@/lib/app-origin";

export type EmailContent = {
  subject: string;
  text: string;
  html: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function supportEmail(): string | null {
  return process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || null;
}

export function buildEmailLayout(opts: {
  preheader?: string;
  title: string;
  bodyHtml: string;
  cta?: { label: string; href: string };
}): string {
  const origin = appOrigin();
  const preheader = opts.preheader ? escapeHtml(opts.preheader) : "";
  const title = escapeHtml(opts.title);
  const support = supportEmail();
  const ctaBlock = opts.cta
    ? `<tr>
        <td style="padding:28px 32px 8px;">
          <a href="${escapeHtml(opts.cta.href)}" style="display:inline-block;background:#1a4d8f;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 28px;border-radius:8px;">${escapeHtml(opts.cta.label)}</a>
        </td>
      </tr>`
    : "";

  const supportBlock = support
    ? `<p style="margin:16px 0 0;font-size:13px;color:#64748b;line-height:1.5;">
        Questions? Reply to this email or contact
        <a href="mailto:${escapeHtml(support)}" style="color:#1a4d8f;text-decoration:none;">${escapeHtml(support)}</a>.
      </p>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <span style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</span>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
          <tr>
            <td style="padding:28px 32px 12px;border-bottom:1px solid #e2e8f0;">
              <a href="${escapeHtml(origin)}" style="font-size:20px;font-weight:700;color:#0f172a;text-decoration:none;letter-spacing:-0.02em;">GradApply</a>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px 8px;">
              <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#0f172a;line-height:1.3;">${title}</h1>
              ${opts.bodyHtml}
            </td>
          </tr>
          ${ctaBlock}
          <tr>
            <td style="padding:16px 32px 32px;">
              ${supportBlock}
              <p style="margin:24px 0 0;font-size:12px;color:#94a3b8;line-height:1.5;">
                You received this transactional message from GradApply.
                <a href="${escapeHtml(origin)}" style="color:#64748b;text-decoration:underline;">${escapeHtml(origin.replace(/^https?:\/\//, ""))}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function paragraphHtml(text: string): string {
  const lines = text.split("\n").filter((l) => l.length > 0);
  return lines
    .map(
      (line) =>
        `<p style="margin:0 0 14px;font-size:15px;color:#334155;line-height:1.6;">${escapeHtml(line)}</p>`,
    )
    .join("");
}

export function listHtml(items: string[]): string {
  if (items.length === 0) return "";
  const lis = items
    .map(
      (item) =>
        `<li style="margin:0 0 8px;font-size:15px;color:#334155;line-height:1.5;">${escapeHtml(item)}</li>`,
    )
    .join("");
  return `<ul style="margin:0 0 16px;padding-left:20px;">${lis}</ul>`;
}

export function detailRowHtml(label: string, value: string): string {
  return `<p style="margin:0 0 10px;font-size:14px;color:#334155;line-height:1.5;"><strong style="color:#0f172a;">${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>`;
}
