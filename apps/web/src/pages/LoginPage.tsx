import {
  Activity,
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  ShieldCheck,
  Siren,
} from "lucide-react";
import { useState, type FormEvent } from "react";

import { useAuth } from "@/context/AuthContext";

const demoAccounts = [
  { label: "Admin", email: "admin@opsmind.local" },
  { label: "Responder", email: "responder@opsmind.local" },
  { label: "Viewer", email: "viewer@opsmind.local" },
];

export function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("admin@opsmind.local");
  const [password, setPassword] = useState("OpsMind!2026");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await login(email, password);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to sign in");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-context" aria-label="Product context">
        <div className="login-brand">
          <div className="brand-mark brand-mark-large">
            <Activity size={22} strokeWidth={2.4} />
          </div>
          <div>
            <strong>OpsMind</strong>
            <span>AI OPERATIONS</span>
          </div>
        </div>
        <div className="login-message">
          <div className="eyebrow eyebrow-light">INCIDENT INTELLIGENCE</div>
          <h1>Turn operational evidence into a clear next action.</h1>
          <p>
            A governed workspace for incident response, retrieval-backed analysis and
            controlled remediation.
          </p>
        </div>
        <div className="login-proof">
          <div>
            <Siren size={18} />
            <span>Incident command</span>
          </div>
          <div>
            <ShieldCheck size={18} />
            <span>Approval controls</span>
          </div>
          <div>
            <LockKeyhole size={18} />
            <span>Auditable actions</span>
          </div>
        </div>
      </section>

      <section className="login-panel">
        <div className="login-form-wrap">
          <div className="mobile-login-brand">
            <div className="brand-mark">
              <Activity size={18} />
            </div>
            <strong>OpsMind</strong>
          </div>
          <div className="eyebrow">ACME CLOUD WORKSPACE</div>
          <h2>Sign in</h2>
          <p className="login-subtitle">Use your operations workspace credentials.</p>

          <div className="demo-roles" aria-label="Demo roles">
            {demoAccounts.map((account) => (
              <button
                key={account.email}
                className={email === account.email ? "role-chip active" : "role-chip"}
                type="button"
                onClick={() => setEmail(account.email)}
              >
                {account.label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            <label>
              <span>Email address</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="username"
                required
              />
            </label>
            <label>
              <span>Password</span>
              <div className="password-field">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="icon-button password-toggle"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </label>
            {error ? <div className="form-error">{error}</div> : null}
            <button className="button button-primary login-submit" type="submit" disabled={submitting}>
              {submitting ? "Opening workspace" : "Enter workspace"}
              <ArrowRight size={16} />
            </button>
          </form>
          <p className="login-footnote">
            Demo accounts share the password <code>OpsMind!2026</code>.
          </p>
        </div>
      </section>
    </main>
  );
}
