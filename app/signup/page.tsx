import Link from "next/link";
import { AuthLayout } from "@/app/components/auth/auth-layout";
import { SignupForm } from "@/app/components/auth/signup-form";

export const metadata = {
  title: "Sign Up — Pluto",
};

export default function SignupPage() {
  return (
    <AuthLayout
      title="Create your account"
      subtitle="Start your 14-day free trial"
      footer={
        <>
          <Link href="/" className="text-zinc-400 transition-colors hover:text-white">
            ← Back to home
          </Link>
        </>
      }
    >
      <SignupForm />
    </AuthLayout>
  );
}
