import { type ReactNode } from "react";
import { Check } from "lucide-react";
import "@/styles/jenri.css";

const STEPS = ["Your workspace", "Your first project", "You're all set"];

export function JenriOnboardingShell({
  step, onBack, children,
}: {
  step: 1 | 2 | 3;
  onBack: () => void;
  children: ReactNode;
}) {
  return <div className="jenri">
    <div className="jenri-onboard">
      <header className="jenri-onboard-head">
        <img className="jenri-logo" src="/jenri/jenri-logo.svg" alt="Jerin" />
      </header>
      <div className="jenri-onboard-frame">
        <aside className="jenri-sidebar">
          <img className="jenri-logo" src="/jenri/jenri-logo.svg" alt="Jerin" />
          <h2>Set up your workspace</h2>
          <p>A few quick steps to get you started.</p>
          <ol className="jenri-sidebar-steps" aria-label="Setup progress">
            {STEPS.map((title, index) => {
              const number = index + 1;
              return <li key={title} className={number === step ? "is-active" : number < step ? "is-complete" : ""}
                aria-current={number === step ? "step" : undefined}>
                <span className="jenri-step-bubble">{number < step ? <Check size={16} /> : number}</span>
                {title}
              </li>;
            })}
          </ol>
        </aside>
        <main className="jenri-onboard-sheet">
          <div className="jenri-onboard-inner">
            <div className="jenri-onboard-top">
              <button type="button" className="jenri-back" aria-label="Previous step" onClick={onBack}>
                <img src="/jenri/back.svg" alt="" aria-hidden="true" />
              </button>
              <span className="jenri-step-count">Step {step} of 3</span>
            </div>
            <div className="jenri-onboard-progress" role="progressbar" aria-label="Setup progress"
              aria-valuemin={0} aria-valuemax={3} aria-valuenow={step}>
              {STEPS.map((title, index) => <span key={title} className={index < step ? "is-done" : ""} />)}
            </div>
            {children}
          </div>
        </main>
      </div>
    </div>
  </div>;
}
