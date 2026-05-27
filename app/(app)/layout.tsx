import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Nav from "@/components/nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("name, email, avatar_url")
    .eq("id", user.id)
    .single();

  return (
    <>
      <Nav
        profile={
          profile ?? {
            name: user.email ?? "Me",
            email: user.email ?? "",
            avatar_url: null,
          }
        }
      />
      <main className="max-w-7xl mx-auto px-6 py-8">{children}</main>
    </>
  );
}
