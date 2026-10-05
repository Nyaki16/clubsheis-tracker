import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Nav from "@/components/nav";
import { ToastProvider } from "@/components/flow/ui";
import { PackagesProvider } from "@/components/flow/packages-context";
import { loadPackages } from "@/lib/packages";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, packages] = await Promise.all([
    supabase.from("profiles").select("name, email, avatar_url").eq("id", user.id).single(),
    loadPackages(supabase),
  ]);

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
      <div className="lg:pl-60">
        <ToastProvider>
          <PackagesProvider packages={packages}>
            <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">{children}</main>
          </PackagesProvider>
        </ToastProvider>
      </div>
    </>
  );
}
