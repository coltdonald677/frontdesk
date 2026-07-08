import { Nav } from "./components/landing/nav";
import { Hero } from "./components/landing/hero";
import { Features } from "./components/landing/features";
import { Pricing } from "./components/landing/pricing";
import { Testimonials } from "./components/landing/testimonials";
import { FAQ } from "./components/landing/faq";
import { Footer } from "./components/landing/footer";

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <Nav />
      <main>
        <Hero />
        <Features />
        <Pricing />
        <Testimonials />
        <FAQ />

        {/* Final CTA */}
        <section className="border-t border-white/[0.06] py-24">
          <div className="mx-auto max-w-3xl px-6 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Ready to hire your AI COO?
            </h2>
            <p className="mt-4 text-lg text-zinc-400">
              Join 2,400+ small businesses already running smarter with
              Pluto.
            </p>
            <a
              href="#"
              className="mt-8 inline-flex h-12 items-center justify-center rounded-lg bg-white px-8 text-sm font-semibold text-zinc-950 transition-all hover:bg-zinc-200 hover:shadow-lg hover:shadow-white/10"
            >
              Start your free trial
            </a>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
