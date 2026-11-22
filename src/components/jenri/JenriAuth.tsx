import { useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import "@/styles/jenri.css";

const ASSETS = "/jenri/";

function BackButton({ className = "" }: { className?: string }) {
  const navigate = useNavigate();
  return <button className={`jenri-back ${className}`} type="button" aria-label="Go back"
    onClick={() => window.history.length > 1 ? navigate(-1) : navigate("/")}>
    <img src={ASSETS + "back.svg"} alt="" aria-hidden="true" />
  </button>;
}

export function JenriAuthLayout({ children, page }: { children: ReactNode; page: "sign-in" | "sign-up" }) {
  return <div className={`jenri jenri-auth-${page === "sign-in" ? "signin" : "signup"}`}>
    <div className="jenri-auth">
      <div className="jenri-auth-mobile-header">
        <BackButton className="jenri-back" />
        <img className="jenri-logo" src={ASSETS + "jenri-logo.svg"} alt="Jerin" />
      </div>
      <aside className="jenri-auth-photo" aria-label="Jerin — Plan, organise, and get work done together">
        <img className="jenri-logo" src={ASSETS + "jenri-logo.svg"} alt="Jerin" />
        <p className="jenri-photo-caption">Plan, organise, and get work done together.</p>
      </aside>
      <main className="jenri-auth-panel">
        <BackButton className="jenri-desktop-back" />
        <div className="jenri-auth-panel-inner">{children}</div>
      </main>
    </div>
  </div>;
}

export function JenriAuthIntro({
  title, mobileTitle, subtitle, accountSwitch,
}: {
  title: string;
  mobileTitle?: string;
  subtitle?: string;
  accountSwitch: ReactNode;
}) {
  return <header className="jenri-auth-intro">
    <h1>
      {mobileTitle ? <>
        <span className="jenri-mobile-heading">{mobileTitle}</span>
        <span className="jenri-desktop-heading">{title}</span>
      </> : title}
    </h1>
    <p className="jenri-auth-switch">{accountSwitch}</p>
    {subtitle && <p className="jenri-auth-subtitle">{subtitle}</p>}
  </header>;
}

export function JenriPasswordField(props: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { label?: string }) {
  const { label = "Password", id, ...inputProps } = props;
  const [visible, setVisible] = useState(false);
  return <div className="jenri-password-group">
    <input className="jenri-field" id={id} type={visible ? "text" : "password"} aria-label={label}
      placeholder={label} {...inputProps} />
    <button type="button" className="jenri-password-toggle"
      aria-label={visible ? "Hide password" : "Show password"} aria-pressed={visible} onClick={() => setVisible(v => !v)}>
      {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
    </button>
  </div>;
}

export function JenriSocialButton({ provider, busy, action = "Sign in", ...buttonProps }: ButtonHTMLAttributes<HTMLButtonElement> & {
  provider: "google" | "apple"; busy?: boolean; action?: "Sign in" | "Sign up";
}) {
  return <button type="button" className="jenri-social-button" data-provider={provider} disabled={busy || buttonProps.disabled} {...buttonProps}>
    {busy ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> :
      <img src={ASSETS + provider + ".svg"} alt="" aria-hidden="true" width={provider === "apple" ? 17 : 18} height={provider === "apple" ? 21 : 18} />}
    <span>{`${action} with ${provider === "apple" ? "Apple" : "Google"}`}</span>
  </button>;
}
