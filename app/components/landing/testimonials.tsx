const testimonials = [
  {
    quote:
      "FrontDesk replaced four different tools for my salon. I save at least 10 hours a week and my no-show rate dropped 40%.",
    author: "Maria Chen",
    role: "Owner, Bloom Studio",
    initials: "MC",
  },
  {
    quote:
      "It's like having a operations manager who never sleeps. The daily action plan alone is worth every penny.",
    author: "James Okonkwo",
    role: "Founder, Okonkwo Consulting",
    initials: "JO",
  },
  {
    quote:
      "We went from chasing invoices manually to getting paid 12 days faster on average. The AI follow-ups are scary good.",
    author: "Rachel Torres",
    role: "CEO, Torres Property Group",
    initials: "RT",
  },
];

export function Testimonials() {
  return (
    <section id="testimonials" className="border-t border-white/[0.06] py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-medium uppercase tracking-widest text-indigo-400">
            Testimonials
          </p>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Loved by small business owners
          </h2>
          <p className="mt-4 text-lg text-zinc-400">
            Join thousands of owners who stopped managing chaos and started
            growing.
          </p>
        </div>

        <div className="mt-16 grid gap-8 md:grid-cols-3">
          {testimonials.map((t) => (
            <figure
              key={t.author}
              className="flex flex-col rounded-xl border border-white/[0.06] bg-zinc-900/50 p-6"
            >
              <div className="mb-4 flex gap-0.5 text-indigo-400">
                {Array.from({ length: 5 }).map((_, i) => (
                  <svg
                    key={i}
                    className="h-4 w-4 fill-current"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <blockquote className="flex-1 text-sm leading-relaxed text-zinc-300">
                &ldquo;{t.quote}&rdquo;
              </blockquote>
              <figcaption className="mt-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-semibold text-white">
                  {t.initials}
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{t.author}</p>
                  <p className="text-xs text-zinc-500">{t.role}</p>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
