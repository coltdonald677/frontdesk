"use client";

import { useActionState } from "react";
import { saveBusinessProfile, type OnboardingState } from "@/app/onboarding/actions";

const inputClassName =
  "w-full rounded-lg border border-white/[0.06] bg-zinc-800/50 px-4 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-indigo-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/50";

const labelClassName = "mb-1.5 block text-sm font-medium text-zinc-300";

export function OnboardingForm() {
  const [state, formAction, pending] = useActionState<OnboardingState, FormData>(
    saveBusinessProfile,
    {},
  );

  return (
    <form action={formAction} className="space-y-4">
      {state.error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {state.error}
        </div>
      )}

      <div>
        <label htmlFor="business_name" className={labelClassName}>
          Business name
        </label>
        <input
          id="business_name"
          name="business_name"
          type="text"
          required
          placeholder="Acme Consulting"
          className={inputClassName}
        />
      </div>

      <div>
        <label htmlFor="industry" className={labelClassName}>
          Industry
        </label>
        <input
          id="industry"
          name="industry"
          type="text"
          required
          placeholder="Professional services, retail, healthcare..."
          className={inputClassName}
        />
      </div>

      <div>
        <label htmlFor="phone_number" className={labelClassName}>
          Phone number
        </label>
        <input
          id="phone_number"
          name="phone_number"
          type="tel"
          required
          placeholder="(555) 123-4567"
          className={inputClassName}
        />
      </div>

      <div>
        <label htmlFor="business_address" className={labelClassName}>
          Business address
        </label>
        <input
          id="business_address"
          name="business_address"
          type="text"
          required
          placeholder="123 Main St, Austin, TX 78701"
          className={inputClassName}
        />
      </div>

      <div>
        <label htmlFor="main_goal" className={labelClassName}>
          Main goal with Pluto
        </label>
        <textarea
          id="main_goal"
          name="main_goal"
          required
          rows={3}
          placeholder="What do you want Pluto to help you accomplish first?"
          className={`${inputClassName} resize-none`}
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-white py-2.5 text-sm font-semibold text-zinc-950 transition-colors hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Saving..." : "Continue to dashboard"}
      </button>
    </form>
  );
}
