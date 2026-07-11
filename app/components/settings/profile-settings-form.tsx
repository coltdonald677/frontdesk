"use client";

import { useActionState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  saveBusinessProfileAction,
  uploadBusinessLogoAction,
} from "@/app/dashboard/settings/actions";
import {
  SettingsField,
  SettingsFormShell,
  SettingsSelect,
  SettingsTextInput,
  SettingsTextarea,
  useSettingsSection,
} from "@/app/components/settings/settings-form-shell";
import type { BusinessSettings, SettingsActionState } from "@/lib/business-settings/types";

export function ProfileSettingsForm({ settings }: { settings: BusinessSettings }) {
  const router = useRouter();
  const section = useSettingsSection(settings.profile);
  const [saveState, saveAction, saving] = useActionState<SettingsActionState, FormData>(
    saveBusinessProfileAction,
    {},
  );
  const [logoState, logoAction, uploading] = useActionState<SettingsActionState, FormData>(
    uploadBusinessLogoAction,
    {},
  );
  const [, startTransition] = useTransition();

  function handleSave() {
    const formData = new FormData();
    const p = section.value;
    formData.set("business_name", p.businessName);
    formData.set("legal_business_name", p.legalBusinessName);
    formData.set("industry", p.industry);
    formData.set("business_description", p.businessDescription);
    formData.set("business_address", p.address);
    formData.set("city", p.city);
    formData.set("state_province", p.stateProvince);
    formData.set("postal_code", p.postalCode);
    formData.set("country", p.country);
    formData.set("phone_number", p.phone);
    formData.set("email", p.email);
    formData.set("website", p.website);
    formData.set("timezone", p.timezone);
    formData.set("currency", p.currency);
    formData.set("date_format", p.dateFormat);
    formData.set("time_format", p.timeFormat);
    formData.set("week_start_day", p.weekStartDay);
    formData.set("tax_registration_number", p.taxRegistrationNumber);
    formData.set("default_tax_rate", String(p.defaultTaxRate));
    formData.set("main_goal", p.mainGoal);
    startTransition(() => saveAction(formData));
    section.markSaved();
  }

  function handleLogoUpload(file: File | null) {
    if (!file) return;
    const formData = new FormData();
    formData.set("logo", file);
    startTransition(() => {
      logoAction(formData);
      router.refresh();
    });
  }

  const p = section.value;

  return (
    <SettingsFormShell
      title="Business Profile"
      description="Who your business is and how it appears across Pluto."
      onSave={handleSave}
      saving={saving}
      state={saveState.error ? saveState : logoState.error ? logoState : saveState}
      dirty={section.dirty}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl border border-white/[0.08] bg-zinc-950/50">
          {p.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.logoUrl} alt="Business logo" className="h-full w-full object-cover" />
          ) : (
            <span className="text-xs text-zinc-500">No logo</span>
          )}
        </div>
        <SettingsField label="Logo" hint="PNG or JPG, max 2 MB. Stored privately in Supabase.">
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={uploading}
            onChange={(event) => handleLogoUpload(event.target.files?.[0] ?? null)}
            className="block w-full text-sm text-zinc-400 file:mr-3 file:rounded-md file:border-0 file:bg-indigo-500/20 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-indigo-200"
          />
        </SettingsField>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <SettingsField label="Business name">
          <SettingsTextInput
            value={p.businessName}
            onChange={(e) => section.setValue((c) => ({ ...c, businessName: e.target.value }))}
          />
        </SettingsField>
        <SettingsField label="Legal business name">
          <SettingsTextInput
            value={p.legalBusinessName}
            onChange={(e) => section.setValue((c) => ({ ...c, legalBusinessName: e.target.value }))}
          />
        </SettingsField>
        <SettingsField label="Industry">
          <SettingsTextInput
            value={p.industry}
            onChange={(e) => section.setValue((c) => ({ ...c, industry: e.target.value }))}
          />
        </SettingsField>
        <SettingsField label="Phone">
          <SettingsTextInput
            value={p.phone}
            onChange={(e) => section.setValue((c) => ({ ...c, phone: e.target.value }))}
          />
        </SettingsField>
        <SettingsField label="Email">
          <SettingsTextInput
            type="email"
            value={p.email}
            onChange={(e) => section.setValue((c) => ({ ...c, email: e.target.value }))}
          />
        </SettingsField>
        <SettingsField label="Website">
          <SettingsTextInput
            value={p.website}
            onChange={(e) => section.setValue((c) => ({ ...c, website: e.target.value }))}
          />
        </SettingsField>
      </div>

      <SettingsField label="Business description">
        <SettingsTextarea
          value={p.businessDescription}
          onChange={(e) => section.setValue((c) => ({ ...c, businessDescription: e.target.value }))}
        />
      </SettingsField>

      <SettingsField label="Street address">
        <SettingsTextInput
          value={p.address}
          onChange={(e) => section.setValue((c) => ({ ...c, address: e.target.value }))}
        />
      </SettingsField>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SettingsField label="City">
          <SettingsTextInput value={p.city} onChange={(e) => section.setValue((c) => ({ ...c, city: e.target.value }))} />
        </SettingsField>
        <SettingsField label="Province / state">
          <SettingsTextInput value={p.stateProvince} onChange={(e) => section.setValue((c) => ({ ...c, stateProvince: e.target.value }))} />
        </SettingsField>
        <SettingsField label="Postal / ZIP">
          <SettingsTextInput value={p.postalCode} onChange={(e) => section.setValue((c) => ({ ...c, postalCode: e.target.value }))} />
        </SettingsField>
        <SettingsField label="Country">
          <SettingsTextInput value={p.country} onChange={(e) => section.setValue((c) => ({ ...c, country: e.target.value }))} />
        </SettingsField>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SettingsField label="Time zone">
          <SettingsTextInput value={p.timezone} onChange={(e) => section.setValue((c) => ({ ...c, timezone: e.target.value }))} />
        </SettingsField>
        <SettingsField label="Currency">
          <SettingsTextInput value={p.currency} onChange={(e) => section.setValue((c) => ({ ...c, currency: e.target.value.toUpperCase() }))} />
        </SettingsField>
        <SettingsField label="Date format">
          <SettingsSelect value={p.dateFormat} onChange={(e) => section.setValue((c) => ({ ...c, dateFormat: e.target.value }))}>
            <option value="medium">Medium (Jul 10, 2026)</option>
            <option value="short">Short (7/10/26)</option>
            <option value="long">Long (Friday, July 10, 2026)</option>
          </SettingsSelect>
        </SettingsField>
        <SettingsField label="Time format">
          <SettingsSelect value={p.timeFormat} onChange={(e) => section.setValue((c) => ({ ...c, timeFormat: e.target.value }))}>
            <option value="12h">12-hour</option>
            <option value="24h">24-hour</option>
          </SettingsSelect>
        </SettingsField>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <SettingsField label="Week starts on">
          <SettingsSelect value={p.weekStartDay} onChange={(e) => section.setValue((c) => ({ ...c, weekStartDay: e.target.value as typeof p.weekStartDay }))}>
            <option value="monday">Monday</option>
            <option value="sunday">Sunday</option>
          </SettingsSelect>
        </SettingsField>
        <SettingsField label="Tax registration #">
          <SettingsTextInput value={p.taxRegistrationNumber} onChange={(e) => section.setValue((c) => ({ ...c, taxRegistrationNumber: e.target.value }))} />
        </SettingsField>
        <SettingsField label="Default tax rate (%)">
          <SettingsTextInput type="number" min={0} max={100} step={0.01} value={p.defaultTaxRate} onChange={(e) => section.setValue((c) => ({ ...c, defaultTaxRate: Number(e.target.value) }))} />
        </SettingsField>
      </div>

      <SettingsField label="Main goal">
        <SettingsTextarea value={p.mainGoal} onChange={(e) => section.setValue((c) => ({ ...c, mainGoal: e.target.value }))} />
      </SettingsField>
    </SettingsFormShell>
  );
}
