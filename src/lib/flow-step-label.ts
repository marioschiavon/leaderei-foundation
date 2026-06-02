// Pretty label for a flow_step row. Used by the campaigns UI in several
// places (card "Nó atual", executions dialog, manage-leads dialog).

export type FlowStepLike = {
  type: string | null;
  config?: any;
} | null | undefined;

export function stepLabel(step: FlowStepLike): string {
  if (!step || !step.type) return "—";
  const cfg = (step.config ?? {}) as any;
  switch (step.type) {
    case "message_whatsapp": {
      const body = String(cfg.body ?? "").trim();
      return body ? `WhatsApp: ${body.slice(0, 40)}${body.length > 40 ? "…" : ""}` : "WhatsApp";
    }
    case "message_email": {
      const subj = String(cfg.subject ?? "").trim();
      return subj ? `Email: ${subj.slice(0, 40)}` : "Email";
    }
    case "wait": {
      const v = cfg.duration_value ?? 1;
      const u = cfg.duration_unit ?? "days";
      const uPt: Record<string, string> = {
        minutes: "min", hours: "h", days: "dia(s)", weeks: "sem",
      };
      return `Espera ${v} ${uPt[u] ?? u}`;
    }
    case "wait_for_reply":
      return `Aguarda resposta (${cfg.timeout_value ?? 3} ${cfg.timeout_unit ?? "days"})`;
    case "branch":
    case "condition":
      return "Condição";
    case "update_lead":
      return "Atualizar lead";
    case "end": {
      const reason = String(cfg.reason ?? "").trim();
      return reason ? `Fim: ${reason}` : "Fim do fluxo";
    }
    default:
      return step.type;
  }
}

// Compact label for chips in the card view — shorter than stepLabel().
export function stepLabelShort(step: FlowStepLike): string {
  if (!step || !step.type) return "—";
  switch (step.type) {
    case "message_whatsapp": return "WhatsApp";
    case "message_email": return "Email";
    case "wait": {
      const cfg = (step.config ?? {}) as any;
      const v = cfg.duration_value ?? 1;
      const u = cfg.duration_unit ?? "days";
      const uPt: Record<string, string> = { minutes: "min", hours: "h", days: "d", weeks: "sem" };
      return `Espera ${v}${uPt[u] ?? u}`;
    }
    case "wait_for_reply": return "Aguarda resposta";
    case "branch":
    case "condition": return "Condição";
    case "update_lead": return "Atualizar lead";
    case "end": return "Fim";
    default: return step.type;
  }
}
