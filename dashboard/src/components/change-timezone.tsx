"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@tamias/ui/card";
import { ComboboxDropdown } from "@tamias/ui/combobox-dropdown";
import { Label } from "@tamias/ui/label";
import { Switch } from "@tamias/ui/switch";
import { useEffect, useState } from "react";
import { useUserMutation, useUserQuery } from "@/hooks/use-user";
import { useI18n } from "@/locales/client";

type TimezoneItem = {
  id: string;
  label: string;
  value: string;
};

export function ChangeTimezone() {
  const t = useI18n();
  const { data: user } = useUserQuery();
  const updateUserMutation = useUserMutation();
  const [currentBrowserTimezone, setCurrentBrowserTimezone] = useState<string>("");
  const [timezoneItems, setTimezoneItems] = useState<TimezoneItem[]>([]);

  // Get browser timezone on mount
  useEffect(() => {
    try {
      const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      setCurrentBrowserTimezone(browserTz);
    } catch (error) {
      console.warn("Failed to detect browser timezone:", error);
    }
  }, []);

  const isAutoSyncEnabled = user?.timezoneAutoSync !== false;
  const currentTimezone = user?.timezone || currentBrowserTimezone;

  useEffect(() => {
    if (isAutoSyncEnabled || timezoneItems.length) {
      return;
    }

    let cancelled = false;

    void import("@tamias/location/timezones").then(({ getTimezones }) => {
      if (cancelled) {
        return;
      }

      setTimezoneItems(
        getTimezones().map((timezone, index) => ({
          id: index.toString(),
          label: timezone.name,
          value: timezone.tzCode,
        })),
      );
    });

    return () => {
      cancelled = true;
    };
  }, [isAutoSyncEnabled, timezoneItems.length]);

  const handleAutoSyncToggle = (enabled: boolean) => {
    updateUserMutation.mutate({
      timezoneAutoSync: enabled,
      // If enabling auto-sync, update to browser timezone
      ...(enabled &&
        currentBrowserTimezone && {
          timezone: currentBrowserTimezone,
        }),
    });
  };

  const handleManualTimezoneChange = (item: { value: string }) => {
    // When manually changing timezone, disable auto-sync
    updateUserMutation.mutate({
      timezone: item.value,
      timezoneAutoSync: false,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("timezone.title")}</CardTitle>
        <CardDescription>{t("timezone.description")}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Auto-sync toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="auto-sync">Use device timezone</Label>
            <div className="text-[0.8rem] text-muted-foreground">
              Automatically use your device's current timezone
              <div>Current: {currentBrowserTimezone}</div>
            </div>
          </div>
          <Switch
            id="auto-sync"
            checked={isAutoSyncEnabled}
            onCheckedChange={handleAutoSyncToggle}
          />
        </div>

        {/* Manual timezone selection - only show when auto-sync is disabled */}
        {!isAutoSyncEnabled && (
          <div className="space-y-2">
            <Label>Timezone</Label>
            <div className="w-full">
              <ComboboxDropdown
                placeholder={
                  timezoneItems.length ? t("timezone.placeholder") : "Loading timezones..."
                }
                selectedItem={timezoneItems.find((item) => item.value === currentTimezone)}
                searchPlaceholder={t("timezone.searchPlaceholder")}
                items={timezoneItems}
                className="text-xs py-1"
                disabled={!timezoneItems.length}
                onSelect={handleManualTimezoneChange}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
