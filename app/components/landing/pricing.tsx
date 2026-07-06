const plans = [
  {
    name: "Starter",
    price: "29",
    description: "For solo operators getting organized.",
    features: [
      "Up to 50 clients",
      "Smart scheduling",
      "Invoice reminders",
      "Daily action plan",
      "Email support",
    ],
    highlighted: false,
  },
  {
    name: "Pro",
    price: "79",
    description: "For growing teams that need an AI COO.",
    features: [
      "Unlimited clients",
      "Everything in Starter",
      "AI recommendations",
      "Customer follow-ups",
      "Business insights",
      "Priority support",
    ],
    highlighted: true,
  },
  {
    name: "Business",
    price: "149",
    description: "For established businesses scaling fast.",
    features: [
      "Everything in Pro",
      "Multi-location support",
      "Team permissions",
      "Custom integrations",
      "Dedicated account manager",
      "SLA guarantee",
    ],
    highlighted: false,
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="border-t border-white/[0.06] py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-medium uppercase tracking-widest text-indigo-400">
            Pricing
          </p>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Simple, transparent pricing
          </h2>
          <p className="mt-4 text-lg text-zinc-400">
            Start free for 14 days. No credit card required.
          </p>
        </div>

        <div className="mt-16 grid gap-8 lg:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative flex flex-col rounded-2xl border p-8 ${
                plan.highlighted
                  ? "border-indigo-500/50 bg-gradient-to-b from-indigo-500/10 to-zinc-900/50 shadow-xl shadow-indigo-500/10"
                  : "border-white/[0.06] bg-zinc-900/50"
              }`}
            >
              {plan.highlighted && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-indigo-500 px-3 py-1 text-xs font-medium text-white">
                  Most popular
                </span>
              )}
              <h3 className="text-lg font-semibold text-white">{plan.name}</h3>
              <p className="mt-1 text-sm text-zinc-400">{plan.description}</p>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-bold text-white">
                  ${plan.price}
                </span>
                <span className="text-zinc-500">/month</span>
              </div>
              <ul className="mt-8 flex-1 space-y-3">
                {plan.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-center gap-3 text-sm text-zinc-300"
                  >
                    <svg
                      className="h-4 w-4 shrink-0 text-indigo-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M4.5 12.75l6 6 9-13.5"
                      />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>
              <a
                href="#"
                className={`mt-8 block rounded-lg py-3 text-center text-sm font-semibold transition-colors ${
                  plan.highlighted
                    ? "bg-white text-zinc-950 hover:bg-zinc-200"
                    : "border border-white/10 bg-white/5 text-white hover:bg-white/10"
                }`}
              >
                Start free trial
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
