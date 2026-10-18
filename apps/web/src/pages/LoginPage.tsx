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
  { label: "管理员", email: "admin@opsmind.local" },
  { label: "响应者", email: "responder@opsmind.local" },
  { label: "只读用户", email: "viewer@opsmind.local" },
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
      setError(cause instanceof Error ? cause.message : "登录失败，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-context" aria-label="平台介绍">
        <div className="login-brand">
          <div className="brand-mark brand-mark-large">
            <Activity size={22} strokeWidth={2.4} />
          </div>
          <div>
            <strong>OpsMind</strong>
            <span>AI 运维平台</span>
          </div>
        </div>
        <div className="login-message">
          <div className="eyebrow eyebrow-light">企业事故智能分析</div>
          <h1>把复杂运维证据，转化为清晰的下一步行动。</h1>
          <p>
            面向 SRE 与值班团队的事故处置工作台，统一进行证据检索、故障分析和受控处置。
          </p>
        </div>
        <div className="login-proof">
          <div>
            <Siren size={18} />
            <span>事故指挥</span>
          </div>
          <div>
            <ShieldCheck size={18} />
            <span>审批控制</span>
          </div>
          <div>
            <LockKeyhole size={18} />
            <span>全程审计</span>
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
          <div className="eyebrow">云启科技工作区</div>
          <h2>登录系统</h2>
          <p className="login-subtitle">使用运维工作区账号进入事故处置平台。</p>

          <div className="demo-roles" aria-label="演示角色">
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
              <span>邮箱地址</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="username"
                required
              />
            </label>
            <label>
              <span>密码</span>
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
                  aria-label={showPassword ? "隐藏密码" : "显示密码"}
                  title={showPassword ? "隐藏密码" : "显示密码"}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </label>
            {error ? <div className="form-error">{error}</div> : null}
            <button className="button button-primary login-submit" type="submit" disabled={submitting}>
              {submitting ? "正在进入工作区" : "进入工作区"}
              <ArrowRight size={16} />
            </button>
          </form>
          <p className="login-footnote">
            演示账号统一密码：<code>OpsMind!2026</code>
          </p>
        </div>
      </section>
    </main>
  );
}
