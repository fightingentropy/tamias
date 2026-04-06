"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@tamias/ui/card";
import { ComboboxDropdown, type ComboboxItem } from "@tamias/ui/combobox-dropdown";
import { useEffect, useState } from "react";
import { useUserMutation, useUserQuery } from "@/hooks/use-user";
import { useI18n } from "@/locales/client";

export function LocaleSettings() {
  const t = useI18n();
  const { data: user } = useUserQuery();
  const updateUserMutation = useUserMutation();
  const [localeItems, setLocaleItems] = useState<Array<ComboboxItem & { value: string }>>([]);

  useEffect(() => {
    let cancelled = false;

    void import("@tamias/location/countries-intl").then(({ countries }) => {
      if (cancelled) {
        return;
      }

      setLocaleItems(
        Object.values(countries).map((country, index) => ({
          id: index.toString(),
          label: `${country.name} (${country.default_locale})`,
          value: country.default_locale,
        })),
      );
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Card className="flex justify-between items-center">
      <CardHeader>
        <CardTitle>{t("locale.title")}</CardTitle>
        <CardDescription>{t("locale.description")}</CardDescription>
      </CardHeader>

      <CardContent>
        <div className="w-[250px]">
          <ComboboxDropdown
            placeholder={localeItems.length ? t("locale.placeholder") : "Loading locales..."}
            selectedItem={localeItems.find((item) => item.value === user?.locale)}
            searchPlaceholder={t("locale.searchPlaceholder")}
            items={localeItems}
            className="text-xs py-1"
            disabled={!localeItems.length}
            onSelect={(item) => {
              updateUserMutation.mutate({ locale: item.value });
            }}
          />
        </div>
      </CardContent>
    </Card>
  );
}
