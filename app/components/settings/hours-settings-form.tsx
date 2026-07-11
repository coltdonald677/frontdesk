"use client";

import { useState, useTransition } from "react";
import { saveBusinessHoursAction } from "@/app/dashboard/settings/actions";
import {
  SettingsField,
  SettingsFormShell,
  SettingsTextInput,
  SettingsToggle,
  useSettingsSection,
} from "@/app/components/settings/settings-form-shell";
import type { BusinessSettings } from "@/lib/business-settings/types";
import { WEEKDAYS } from "@/lib/business-settings/types";

const DAY_LABELS: Record<string, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};

export function HoursSettingsForm({ settings }: { settings: BusinessSettings }) {
  const section = useSettingsSection(settings.businessHours);
  const [isPending, startTransition] = useTransition();
  const [saveState, setSaveState] = useState<{ error?: string; success?: boolean; message?: string }>({});

  function handleSave() {
    startTransition(async () => {
      const result = await saveBusinessHoursAction(section.value);
      setSaveState(result);
      if (!result.error) section.markSaved();
    });
  }

  return (
    <SettingsFormShell
      title="Business Hours"
      description="When your business is open. Used for warnings and Pluto Brain context."
      onSave={handleSave}
      saving={isPending}
      state={saveState}
      dirty={section.dirty}
    >
      {WEEKDAYS.map((day) => {
        const dayHours = section.value.days[day];
        return (
          <div key={day} className="rounded-lg border border-white/[0.06] bg-zinc-950/30 p-4">
            <SettingsToggle
              label={DAY_LABELS[day]}
              checked={dayHours.open}
              onChange={(open) =>
                section.setValue((current) => ({
                  ...current,
                  days: {
                    ...current.days,
                    [day]: {
                      open,
                      shifts: open
                        ? dayHours.shifts.length
                          ? dayHours.shifts
                          : [{ start: "09:00", end: "17:00" }]
                        : [],
                    },
                  },
                }))
              }
            />
            {dayHours.open && (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <SettingsField label="Opens">
                  <SettingsTextInput
                    type="time"
                    value={dayHours.shifts[0]?.start ?? "09:00"}
                    onChange={(e) =>
                      section.setValue((current) => ({
                        ...current,
                        days: {
                          ...current.days,
                          [day]: {
                            ...current.days[day],
                            shifts: [
                              {
                                start: e.target.value,
                                end: current.days[day].shifts[0]?.end ?? "17:00",
                              },
                            ],
                          },
                        },
                      }))
                    }
                  />
                </SettingsField>
                <SettingsField label="Closes">
                  <SettingsTextInput
                    type="time"
                    value={dayHours.shifts[0]?.end ?? "17:00"}
                    onChange={(e) =>
                      section.setValue((current) => ({
                        ...current,
                        days: {
                          ...current.days,
                          [day]: {
                            ...current.days[day],
                            shifts: [
                              {
                                start: current.days[day].shifts[0]?.start ?? "09:00",
                                end: e.target.value,
                              },
                            ],
                          },
                        },
                      }))
                    }
                  />
                </SettingsField>
              </div>
            )}
          </div>
        );
      })}

      <SettingsField
        label="Closed holidays"
        hint="Placeholder for future holiday scheduling. Comma-separated ISO dates."
      >
        <SettingsTextInput
          value={section.value.closedHolidays.join(", ")}
          onChange={(e) =>
            section.setValue((current) => ({
              ...current,
              closedHolidays: e.target.value
                .split(",")
                .map((item) => item.trim())
                .filter(Boolean),
            }))
          }
          placeholder="2026-12-25, 2027-01-01"
        />
      </SettingsField>
    </SettingsFormShell>
  );
}
