import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import WelcomeForm from "./welcome-form";

export default async function WelcomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const name =
    (user.user_metadata?.name as string | undefined) ??
    user.email?.split("@")[0] ??
    "there";

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-8 max-w-sm w-full">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-semibold">
            CS
          </div>
          <div>
            <h1 className="font-bold leading-tight">ClubSheIs</h1>
            <p className="text-sm text-slate-500">Production Tracker</p>
          </div>
        </div>
        <h2 className="text-xl font-bold mb-1">Welcome, {name}.</h2>
        <p className="text-sm text-slate-500 mb-5">
          Set a password to finish signing up.
        </p>
        <WelcomeForm />
      </div>
    </div>
  );
}
