const faqs = [
  {
    question: "What exactly does FrontDesk do?",
    answer:
      "FrontDesk acts as your AI Chief Operating Officer — it manages scheduling, customer relationships, invoicing, follow-ups, and daily priorities from one dashboard. Think of it as the operational brain of your business.",
  },
  {
    question: "How is this different from a CRM or calendar app?",
    answer:
      "CRMs and calendars are single-purpose tools. FrontDesk connects everything together and uses AI to prioritize what you should do next, proactively suggest actions, and automate repetitive operational work.",
  },
  {
    question: "Do I need technical skills to set it up?",
    answer:
      "Not at all. Most businesses are fully onboarded in under 15 minutes. Connect your calendar, import your contacts, and FrontDesk starts learning your business patterns immediately.",
  },
  {
    question: "Is my business data secure?",
    answer:
      "Yes. All data is encrypted in transit and at rest. We are SOC 2 Type II compliant and never sell or share your data with third parties.",
  },
  {
    question: "Can I cancel anytime?",
    answer:
      "Absolutely. There are no long-term contracts. Cancel your subscription anytime from your account settings with no cancellation fees.",
  },
  {
    question: "What kind of businesses use FrontDesk?",
    answer:
      "FrontDesk is built for small service businesses — salons, consultants, contractors, property managers, fitness studios, and any owner-operator juggling clients, schedules, and invoices.",
  },
];

export function FAQ() {
  return (
    <section id="faq" className="border-t border-white/[0.06] py-24">
      <div className="mx-auto max-w-3xl px-6">
        <div className="text-center">
          <p className="text-sm font-medium uppercase tracking-widest text-indigo-400">
            FAQ
          </p>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Frequently asked questions
          </h2>
        </div>

        <div className="mt-12 divide-y divide-white/[0.06]">
          {faqs.map((faq) => (
            <details key={faq.question} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between text-left font-medium text-white transition-colors hover:text-indigo-300 [&::-webkit-details-marker]:hidden">
                {faq.question}
                <svg
                  className="ml-4 h-5 w-5 shrink-0 text-zinc-500 transition-transform group-open:rotate-180"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19.5 8.25l-7.5 7.5-7.5-7.5"
                  />
                </svg>
              </summary>
              <p className="mt-4 pr-8 text-sm leading-relaxed text-zinc-400">
                {faq.answer}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
