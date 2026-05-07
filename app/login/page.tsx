import LoginForm from "./login-form";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center text-white font-bold">
            CS
          </div>
          <div>
            <h1 className="font-semibold leading-tight">ClubSheIs</h1>
            <p className="text-xs text-slate-500 leading-tight">Production Tracker</p>
          </div>
        </div>
        <h2 className="text-lg font-semibold mb-1">Welcome</h2>
        <p className="text-sm text-slate-500 mb-4">
          Sign in with your email and password.
        </p>
        <LoginForm />
      </div>
    </div>
  );
}
