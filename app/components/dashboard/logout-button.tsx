"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type LogoutButtonProps = {
  className?: string;
};

export function LogoutButton({
  className = "rounded-lg px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:bg-white/5 hover:text-white",
}: LogoutButtonProps) {
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  };

  return (
    <button type="button" onClick={handleLogout} className={className}>
      Log out
    </button>
  );
}
