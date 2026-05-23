import { renderBaseTemplate } from "./base";

export interface InvitationEmailInput {
  org_name: string;
  inviter_name: string;
  role_label: "membro" | "administrador";
  invite_url: string;
  expires_at: string;     // ISO date
  logo_url?: string | null;
}

export function renderInvitationEmail(input: InvitationEmailInput): {
  subject: string;
  html: string;
  text: string;
} {
  const expiresDate = new Date(input.expires_at).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "long", year: "numeric",
  });

  const subject = `Você foi convidado para ${input.org_name} no Leaderei`;
  const preheader = `${input.inviter_name} convidou você para entrar como ${input.role_label}.`;

  const bodyHtml = `
    <h1 style="margin:0 0 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:22px;font-weight:700;color:#1a1a1a;line-height:1.25">
      Olá!
    </h1>
    <p style="margin:0 0 14px">
      <strong>${escape(input.inviter_name)}</strong> convidou você para fazer parte de
      <strong>${escape(input.org_name)}</strong> no Leaderei como <strong>${input.role_label}</strong>.
    </p>
    <p style="margin:0 0 8px;color:#4b5563">
      Clique no botão abaixo para aceitar o convite e criar sua conta.
    </p>
  `;

  const bodyText = `Olá!

${input.inviter_name} convidou você para fazer parte de ${input.org_name} no Leaderei como ${input.role_label}.

Clique no link abaixo para aceitar o convite e criar sua conta.

Este link expira em ${expiresDate}. Se você não esperava esse convite, ignore este email.`;

  const { html: baseHtml, text } = renderBaseTemplate({
    preheader,
    bodyHtml: bodyHtml + `
      <p style="margin:24px 0 0;font-size:12px;color:#6b7280">
        Este link expira em <strong>${expiresDate}</strong>. Se você não esperava esse convite, ignore este email.
      </p>`,
    bodyText,
    ctaUrl: input.invite_url,
    ctaLabel: "Aceitar convite",
    logoUrl: input.logo_url,
  });

  return { subject, html: baseHtml, text };
}

function escape(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
