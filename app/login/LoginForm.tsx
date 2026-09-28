"use client";

import { useActionState, useState } from "react";
import { login, type LoginState } from "./actions";

export type LoginCopy = {
  label: string;
  placeholder: string;
  submit: string;
  submitting: string;
  show: string;
  hide: string;
  invalid: string;
  notConfigured: string;
};

const initialState: LoginState = { error: null };

export function LoginForm({ next, copy }: { next: string; copy: LoginCopy }) {
  const [state, formAction, pending] = useActionState(login, initialState);
  const [visible, setVisible] = useState(false);
  const error = state.error === "invalid" ? copy.invalid : state.error === "notConfigured" ? copy.notConfigured : null;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          {copy.label}
        </span>
        <div
          className="flex items-center rounded-xl transition-shadow focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--brand-red)_25%,transparent)]"
          style={{
            background: "var(--page-plane)",
            border: `1px solid ${error ? "var(--brand-red)" : "var(--border-hairline)"}`,
          }}
        >
          <input
            name="password"
            type={visible ? "text" : "password"}
            required
            autoFocus
            autoComplete="current-password"
            placeholder={copy.placeholder}
            aria-invalid={!!error}
            aria-describedby={error ? "login-error" : undefined}
            className="flex-1 min-w-0 bg-transparent px-4 py-3 text-base outline-none"
            style={{ color: "var(--text-primary)" }}
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            className="px-4 text-xs font-medium cursor-pointer shrink-0"
            style={{ color: "var(--text-muted)" }}
          >
            {visible ? copy.hide : copy.show}
          </button>
        </div>
      </label>

      {error && (
        <p id="login-error" role="alert" className="text-sm -mt-1" style={{ color: "var(--brand-red)" }}>
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-xl py-3 text-base font-semibold text-white transition-colors cursor-pointer disabled:opacity-70 disabled:cursor-wait bg-[var(--brand-red)] hover:bg-[var(--brand-red-strong)]"
      >
        {pending ? copy.submitting : copy.submit}
      </button>
    </form>
  );
}
