// Email-safe HTML rendering. Table-based, fully inline styles.
// All values are hex literals (CSS vars don't work in email clients).

export interface BaseTemplateInput {
  preheader: string;
  bodyHtml: string;       // pre-rendered inner HTML for the content area
  bodyText: string;       // plaintext fallback
  ctaUrl?: string;
  ctaLabel?: string;
  logoUrl?: string | null;
}

const BRAND = "#e04e01";
const BRAND_DARK = "#b53d00";
const TEXT = "#1a1a1a";
const MUTED = "#6b7280";
const BORDER = "#e5e7eb";
const BG = "#f8f7f4";
const SURFACE = "#ffffff";
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export function renderBaseTemplate(input: BaseTemplateInput): { html: string; text: string } {
  const logo = input.logoUrl
    ? `<img src="${escapeAttr(input.logoUrl)}" alt="Leaderei" width="120" style="display:block;border:0;outline:none;text-decoration:none;height:auto;max-width:120px" />`
    : `<div style="font-family:${FONT};font-size:20px;font-weight:700;color:${BRAND};letter-spacing:-0.02em">Leaderei</div>`;

  const cta = input.ctaUrl && input.ctaLabel
    ? `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0">
        <tr>
          <td align="center" bgcolor="${BRAND}" style="border-radius:8px">
            <a href="${escapeAttr(input.ctaUrl)}"
               style="display:inline-block;padding:13px 28px;font-family:${FONT};font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;background-color:${BRAND}">
              ${escapeHtml(input.ctaLabel)}
            </a>
          </td>
        </tr>
      </table>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<title>Leaderei</title>
</head>
<body style="margin:0;padding:0;background-color:${BG};font-family:${FONT};color:${TEXT}">
  <span style="display:none !important;opacity:0;color:transparent;visibility:hidden;mso-hide:all;font-size:1px;line-height:1px;max-height:0;max-width:0;overflow:hidden">
    ${escapeHtml(input.preheader)}
  </span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${BG}">
    <tr>
      <td align="center" style="padding:32px 16px">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:${SURFACE};border:1px solid ${BORDER};border-radius:12px;overflow:hidden">
          <tr>
            <td style="padding:28px 32px 8px">
              ${logo}
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px 32px;font-family:${FONT};font-size:15px;line-height:1.55;color:${TEXT}">
              ${input.bodyHtml}
              ${cta}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;border-top:1px solid ${BORDER};background-color:#fafaf8;font-family:${FONT};font-size:12px;line-height:1.5;color:${MUTED}">
              <div style="margin-bottom:6px"><strong style="color:${TEXT}">Leaderei</strong> — sua máquina de leads.</div>
              <div style="margin-bottom:6px">S7 — Curitiba, PR, Brasil</div>
              <div>
                <a href="#" style="color:${MUTED};text-decoration:underline">Cancelar inscrição</a>
                &nbsp;·&nbsp;
                <span style="color:${MUTED}">Você recebeu este email porque interage com o Leaderei.</span>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    "Leaderei",
    "",
    input.bodyText,
    input.ctaUrl && input.ctaLabel ? `\n${input.ctaLabel}: ${input.ctaUrl}` : "",
    "",
    "—",
    "Leaderei — sua máquina de leads",
    "S7 — Curitiba, PR, Brasil",
  ].filter(Boolean).join("\n");

  return { html, text };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
function escapeAttr(s: string): string {
  return s.replace(/["<>]/g, (c) => ({ '"': "&quot;", "<": "&lt;", ">": "&gt;" }[c]!));
}
