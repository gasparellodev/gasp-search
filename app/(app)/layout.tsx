import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Defesa redundante: o `proxy.ts` já redireciona, mas ler o user aqui é
  // requisito para passar dados ao Topbar e quaisquer Server Components
  // descendentes que precisem dele.
  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <div className="bg-background flex h-dvh overflow-hidden">
      <Sidebar />
      <div className="flex h-full min-w-0 flex-1 flex-col">
        <Topbar
          email={user.email ?? ""}
          name={profile?.full_name ?? null}
          avatarUrl={profile?.avatar_url ?? null}
        />
        <main className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-4 py-6 sm:px-6 sm:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
