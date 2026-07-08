import Link from "next/link";
import { AuthLayout } from "@/app/components/auth/auth-layout";
import { LoginForm } from "@/app/components/auth/login-form";

export const metadata = {
  title: "Sign In — Pluto",
};

export default function LoginPage() {
  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to your Pluto account"
      footer={
        <>
          <Link href="/" className="text-zinc-400 transition-colors hover:text-white">
            ← Back to home
          </Link>
        </>
      }
    >
      <LoginForm />
    </AuthLayout>
  );
}
