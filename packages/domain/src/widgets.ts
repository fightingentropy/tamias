export const WIDGET_TYPES = [
  "runway",
  "cash-flow",
  "account-balances",
  "profit-analysis",
  "revenue-forecast",
  "revenue-summary",
  "growth-rate",
  "net-position",
  "customer-lifetime-value",
  "top-customer",
  "outstanding-invoices",
  "overdue-invoices-alert",
  "invoice-payment-score",
  "monthly-spending",
  "recurring-expenses",
  "category-expenses",
  "profit-margin",
  "time-tracker",
  "billable-hours",
  "inbox",
  "vault",
  "tax-summary",
] as const;

export type WidgetType = (typeof WIDGET_TYPES)[number];

export type WidgetPreferences = {
  primaryWidgets: WidgetType[];
  availableWidgets: WidgetType[];
};

export const DEFAULT_WIDGET_ORDER: WidgetType[] = [...WIDGET_TYPES];

export const DEFAULT_WIDGET_PREFERENCES: WidgetPreferences = {
  primaryWidgets: DEFAULT_WIDGET_ORDER.slice(0, 7),
  availableWidgets: DEFAULT_WIDGET_ORDER.slice(7),
};

export function isWidgetType(value: string): value is WidgetType {
  return (WIDGET_TYPES as readonly string[]).includes(value);
}

export function validateWidgetPreferences(preferences: WidgetPreferences): void {
  const allWidgets = [...preferences.primaryWidgets, ...preferences.availableWidgets];

  if (allWidgets.length !== DEFAULT_WIDGET_ORDER.length) {
    throw new Error("Invalid widget preferences: incorrect number of widgets");
  }

  const missingWidgets = DEFAULT_WIDGET_ORDER.filter((widget) => !allWidgets.includes(widget));
  const extraWidgets = allWidgets.filter((widget) => !DEFAULT_WIDGET_ORDER.includes(widget));

  if (missingWidgets.length > 0) {
    throw new Error(`Invalid widget preferences: missing widgets ${missingWidgets.join(", ")}`);
  }

  if (extraWidgets.length > 0) {
    throw new Error(`Invalid widget preferences: unknown widgets ${extraWidgets.join(", ")}`);
  }

  if (preferences.primaryWidgets.length > 7) {
    throw new Error("Invalid widget preferences: primary widgets cannot exceed 7");
  }

  const duplicates = allWidgets.filter((widget, index) => allWidgets.indexOf(widget) !== index);

  if (duplicates.length > 0) {
    throw new Error(`Invalid widget preferences: duplicate widgets ${duplicates.join(", ")}`);
  }
}

export function normalizeWidgetPreferences(preferences: {
  primaryWidgets: string[];
  availableWidgets: string[];
}): WidgetPreferences {
  const seen = new Set<WidgetType>();
  const primaryWidgets = preferences.primaryWidgets.filter((widget) => {
    if (!isWidgetType(widget) || seen.has(widget)) {
      return false;
    }

    seen.add(widget);
    return true;
  }) as WidgetType[];
  const availableWidgets = preferences.availableWidgets.filter((widget) => {
    if (!isWidgetType(widget) || seen.has(widget)) {
      return false;
    }

    seen.add(widget);
    return true;
  }) as WidgetType[];
  const allWidgets = [...primaryWidgets, ...availableWidgets];
  const missingWidgets = DEFAULT_WIDGET_ORDER.filter((widget) => !allWidgets.includes(widget));
  const extraWidgets = allWidgets.filter((widget) => !DEFAULT_WIDGET_ORDER.includes(widget));

  if (missingWidgets.length === 0 && extraWidgets.length === 0) {
    return {
      primaryWidgets,
      availableWidgets,
    };
  }

  return {
    primaryWidgets: primaryWidgets.filter((widget) => !extraWidgets.includes(widget)),
    availableWidgets: [
      ...availableWidgets.filter((widget) => !extraWidgets.includes(widget)),
      ...missingWidgets,
    ],
  };
}

export function buildWidgetPreferencesFromPrimaryWidgets(
  primaryWidgets: WidgetType[],
): WidgetPreferences {
  if (primaryWidgets.length > 7) {
    throw new Error("Primary widgets cannot exceed 7");
  }

  return {
    primaryWidgets,
    availableWidgets: DEFAULT_WIDGET_ORDER.filter((widget) => !primaryWidgets.includes(widget)),
  };
}
