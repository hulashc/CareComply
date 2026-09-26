"use client";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export function LogoutButton() {
  const router = useRouter();

  const logout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth/login");
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-9 w-9 rounded-xl text-white/70 hover:text-destructive hover:bg-red-50/20"
      onClick={logout}
      title="Sign out"
    >
      <LogOut className="h-4 w-4" />
    </Button>
  );
}
