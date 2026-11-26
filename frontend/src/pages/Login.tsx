import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Logo } from "../components/Logo";
import { Button, Tabs } from "../components/ui";
import { useAuth } from "../context/AppProviders";
import { errorMessage } from "../services/api";

const SAMPLE = [
  { text: "The location is perfect but the wifi kept dropping every night.", tags: [["Location", "positive"], ["Wi-Fi", "negative"]] },
  { text: "Staff were friendly and breakfast was excellent.", tags: [["Staff", "positive"], ["Breakfast/Food", "positive"]] },
  { text: "The lift was broken for our whole stay.", tags: [["Lift", "negative"]] },
];

export function LoginPage() {
  const { user, login, register } = useAuth();
  const nav = useNavigate();
  const loc = useLocation() as { state?: { from?: string } };
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("admin@vocanalytics.app");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to="/" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "login") await login(email, password);
      else await register(name, email, password);
      nav(loc.state?.from ?? "/", { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden flex-col justify-between overflow-hidden border-r border-line bg-surface p-12 lg:flex">
        <Logo />
        <div className="max-w-lg">
          <h1 className="text-[34px] font-semibold leading-[1.15]">Find out which part of the stay each guest is talking about.</h1>
          <p className="mt-4 text-[15px] leading-relaxed text-ink-2">
            Every review sentence is mapped to the 21 hotel aspects with One-vs-Rest Logistic Regression, scored as positive,
            negative or neutral, and rolled up into aspect frequency, negative rates and correlations.
          </p>
          <ul className="mt-8 space-y-3">
            {SAMPLE.map((s) => (
              <li key={s.text} className="rounded-panel border border-line bg-canvas/60 p-4">
                <p className="voice !text-[15.5px]">“{s.text}”</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {s.tags.map(([a, sent]) => (
                    <span key={a} className={`rounded-full px-2 py-0.5 text-[11.5px] font-medium ${sent === "positive" ? "bg-pos/15 text-pos" : "bg-neg/15 text-neg"}`}>
                      {a} · {sent}
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-[12.5px] text-ink-3">KL University capstone · DSCI-12 · Team C2C-160</p>
      </section>

      <section className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm space-y-4">
          <div className="lg:hidden"><Logo /></div>
          <h2 className="text-2xl font-semibold">{mode === "login" ? "Sign in" : "Create an account"}</h2>
          <Tabs value={mode} onChange={(v) => { setMode(v); setError(""); }}
            items={[{ value: "login", label: "Sign in" }, { value: "register", label: "Register" }]} />
          {mode === "register" && (
            <label className="block text-sm">
              <span className="mb-1 block text-ink-2">Full name</span>
              <input className="field" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} autoComplete="name" />
            </label>
          )}
          <label className="block text-sm">
            <span className="mb-1 block text-ink-2">Email</span>
            <input className="field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-ink-2">Password</span>
            <input className="field" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6}
              autoComplete={mode === "login" ? "current-password" : "new-password"} />
          </label>
          {error && <p role="alert" className="rounded-control bg-neg/12 px-3 py-2 text-sm text-neg">{error}</p>}
          <Button type="submit" variant="primary" className="w-full" loading={busy}>
            {mode === "login" ? "Sign in" : "Create account"}
          </Button>
          {mode === "login" && (
            <p className="text-[12.5px] text-ink-3">Demo admin account is pre-filled: admin@vocanalytics.app / admin123</p>
          )}
        </form>
      </section>
    </div>
  );
}
