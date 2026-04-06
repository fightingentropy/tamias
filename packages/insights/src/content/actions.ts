import type { InsightContent } from "../types";
import type { InsightSlots } from "./prompts/index";

type InsightAction = InsightContent["actions"][number];

function buildOverdueActions(slots: InsightSlots): InsightAction[] {
  return slots.overdue.map((invoice) => ({
    text: invoice.isUnusual
      ? `Collect ${invoice.amount} from ${invoice.company} - unusual delay, they typically pay faster`
      : `Collect ${invoice.amount} from ${invoice.company}`,
    type: "overdue",
    entityType: "invoice",
    entityId: invoice.id,
  }));
}

function buildUrgentExtraActions(slots: InsightSlots): InsightAction[] {
  const actions: InsightAction[] = [];

  const sortedDrafts = [...slots.drafts].sort((left, right) => right.rawAmount - left.rawAmount);

  for (const draft of sortedDrafts) {
    if (actions.length >= 2) {
      break;
    }

    actions.push({
      text: `Send ${draft.amount} invoice to ${draft.company}`,
      type: "draft",
      entityType: "invoice",
      entityId: draft.id,
    });
  }

  for (const spike of slots.expenseSpikes) {
    if (actions.length >= 2) {
      break;
    }

    actions.push({
      text: `Review ${spike.category} spend (+${spike.change}%)`,
      type: "expense_spike",
    });
  }

  if (slots.concentrationWarning && actions.length < 2) {
    actions.push({
      text: `Diversify - ${slots.concentrationWarning.percentage}% revenue from ${slots.concentrationWarning.customerName}`,
      type: "concentration",
      entityType: "customer",
    });
  }

  return actions;
}

function buildProactiveActions(slots: InsightSlots): InsightAction[] {
  const actions: InsightAction[] = [];

  if (slots.hoursTracked > 0 && slots.revenueRaw === 0) {
    actions.push({
      text: `Review ${slots.hoursTracked} hours tracked this week for any unbilled work that could be invoiced.`,
    });
  }

  if (slots.runway < 6) {
    actions.push({
      text: `With ${slots.runway} months of runway, prioritize closing pending deals or following up with prospects this week.`,
    });
  }

  if (slots.weekType === "quiet" && slots.revenueRaw === 0) {
    actions.push({
      text: "Quiet week - review upcoming client work and follow up on open conversations to keep revenue moving.",
    });
  }

  return actions.slice(0, 2);
}

export function deriveActions(slots: InsightSlots): InsightAction[] {
  const hasUrgentActions =
    slots.hasOverdue || slots.hasDrafts || slots.hasExpenseSpikes || !!slots.concentrationWarning;

  if (hasUrgentActions) {
    return [...buildOverdueActions(slots), ...buildUrgentExtraActions(slots)];
  }

  return buildProactiveActions(slots);
}
