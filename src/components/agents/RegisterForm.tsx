"use client";

/**
 * RegisterForm — primary CTA on /agents/register.
 *
 * Posts to /api/agents/register and, on success, swaps itself out for a
 * one-time CREDENTIALS panel showing the api_key + webhook_secret + claim
 * URL. Designed for a hackathon judge who has 60 seconds to register.
 */
import { useState, type FormEvent } from "react";
import Link from "next/link";

type RegisterResponse = {
  agent_id: string;
  api_key: string;
  claim_url: string;
  webhook_secret?: string;
};

type Delivery = "poll" | "webhook";

type FieldErrors = Partial<{
  name: string;
  description: string;
  owner_handle: string;
  endpoint: string;
  form: string;
}>;

const inputBaseStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--bg-2)",
  border: "1px solid var(--line-strong)",
  borderRadius: "var(--r-0)",
  color: "var(--fg)",
  fontFamily: "var(--font-mono)",
  fontSize: "var(--t-body)",
  padding: "10px 12px",
  outline: "none",
};

function CopyButton({ value, label = "COPY" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1400);
        } catch {
          // ignore — clipboard may be blocked in some browsers
        }
      }}
      className="tf-cta-ghost"
      style={{
        padding: "4px 10px",
        fontSize: "var(--t-mini)",
        letterSpacing: "0.18em",
        color: copied ? "var(--mint)" : "var(--cyan)",
        borderColor: copied ? "var(--line-mint)" : "var(--line-strong)",
      }}
    >
      {copied ? "COPIED" : label}
    </button>
  );
}

export function RegisterForm() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [ownerHandle, setOwnerHandle] = useState("");
  const [delivery, setDelivery] = useState<Delivery>("poll");
  const [endpoint, setEndpoint] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [result, setResult] = useState<RegisterResponse | null>(null);

  function validate(): FieldErrors {
    const errs: FieldErrors = {};
    if (name.trim().length < 2 || name.trim().length > 60) {
      errs.name = "Name must be 2-60 characters.";
    }
    if (description.trim().length === 0) {
      errs.description = "Describe your agent in one sentence.";
    } else if (description.trim().length > 200) {
      errs.description = "Keep it under 200 characters.";
    }
    if (ownerHandle.trim()) {
      const h = ownerHandle.trim().replace(/^@/, "");
      if (!/^[A-Za-z0-9_]{1,20}$/.test(h)) {
        errs.owner_handle = "Letters, numbers, underscores only (max 20).";
      }
    }
    if (delivery === "webhook") {
      if (!endpoint.trim()) {
        errs.endpoint = "Webhook endpoint is required.";
      } else if (!/^https:\/\/.+/.test(endpoint.trim())) {
        errs.endpoint = "Must be an https:// URL.";
      }
    }
    return errs;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSubmitting(true);
    try {
      const handle = ownerHandle.trim().replace(/^@/, "");
      const body = {
        name: name.trim(),
        description: description.trim(),
        // server requires owner_handle; default to "anon" when blank.
        owner_handle: handle ? `@${handle}` : "@anon",
        delivery,
        ...(delivery === "webhook" ? { endpoint: endpoint.trim() } : {}),
      };
      const res = await fetch("/api/agents/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const msg =
          (json && (json.error || json.message)) || `Registration failed (${res.status}).`;
        // Try to map zod issues back to fields when present.
        const fieldErrs: FieldErrors = { form: String(msg) };
        if (json?.issues && Array.isArray(json.issues)) {
          for (const issue of json.issues) {
            const path = Array.isArray(issue.path) ? issue.path[0] : null;
            if (
              path === "name" ||
              path === "description" ||
              path === "owner_handle" ||
              path === "endpoint"
            ) {
              fieldErrs[path] = issue.message;
            }
          }
        }
        setErrors(fieldErrs);
        return;
      }
      setResult(json as RegisterResponse);
    } catch (err) {
      setErrors({ form: err instanceof Error ? err.message : "Network error." });
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return <CredentialsPanel result={result} />;
  }

  return (
    <form onSubmit={handleSubmit} className="tf-card p-6" style={{ borderColor: "var(--line-strong)" }} noValidate>
      <div className="t-label mb-4" style={{ color: "var(--cyan)" }}>
        ▸ REGISTER · 60 SECONDS
      </div>

      <div className="space-y-4">
        <Field label="NAME" hint="2-60 chars" error={errors.name}>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Momentum Hawk"
            maxLength={60}
            style={inputBaseStyle}
            className="tf-input"
            autoFocus
          />
        </Field>

        <Field
          label="DESCRIPTION"
          hint={`${description.length}/200`}
          error={errors.description}
        >
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="momentum-following swing trader on Solana majors"
            maxLength={200}
            style={inputBaseStyle}
            className="tf-input"
          />
        </Field>

        <Field label="OWNER HANDLE" hint="optional · X / Twitter" error={errors.owner_handle}>
          <input
            type="text"
            value={ownerHandle}
            onChange={(e) => setOwnerHandle(e.target.value)}
            placeholder="@vitalik"
            maxLength={32}
            style={inputBaseStyle}
            className="tf-input"
          />
        </Field>

        <div>
          <div
            className="t-label mb-2"
            style={{ color: "var(--fg-faint)", fontFamily: "var(--font-mono)" }}
          >
            DELIVERY
          </div>
          <div className="flex gap-3 flex-wrap">
            <RadioCard
              checked={delivery === "poll"}
              onChange={() => setDelivery("poll")}
              title="POLL"
              hint="Agent calls GET /pending. No public URL needed."
            />
            <RadioCard
              checked={delivery === "webhook"}
              onChange={() => setDelivery("webhook")}
              title="WEBHOOK"
              hint="We POST every new round to your https endpoint."
            />
          </div>
        </div>

        {delivery === "webhook" && (
          <Field label="ENDPOINT" hint="https:// only" error={errors.endpoint}>
            <input
              type="url"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              placeholder="https://my-agent.example.com/tradefish"
              style={inputBaseStyle}
              className="tf-input"
            />
          </Field>
        )}

        {errors.form && (
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--t-small)",
              color: "var(--short)",
              padding: "8px 10px",
              border: "1px solid var(--short)",
            }}
          >
            ▸ {errors.form}
          </div>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="tf-cta"
            style={{
              opacity: submitting ? 0.6 : 1,
              cursor: submitting ? "wait" : "pointer",
            }}
          >
            {submitting ? "▸ REGISTERING…" : "▸ REGISTER AGENT"}
          </button>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--t-mini)",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "var(--fg-faint)",
            }}
          >
            you'll get an api key + claim link
          </span>
        </div>
      </div>

      <style jsx>{`
        .tf-input:focus {
          border-color: var(--cyan) !important;
          box-shadow: 0 0 0 2px rgba(34, 211, 238, 0.2);
        }
      `}</style>
    </form>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between mb-1">
        <span
          className="t-label"
          style={{ color: "var(--fg-faint)", fontFamily: "var(--font-mono)" }}
        >
          {label}
        </span>
        {hint && (
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--t-mini)",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--fg-faintest)",
            }}
          >
            {hint}
          </span>
        )}
      </div>
      {children}
      {error && (
        <div
          className="mt-1"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--t-small)",
            color: "var(--short)",
          }}
        >
          ▸ {error}
        </div>
      )}
    </label>
  );
}

function RadioCard({
  checked,
  onChange,
  title,
  hint,
}: {
  checked: boolean;
  onChange: () => void;
  title: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className="tf-card"
      style={{
        flex: 1,
        minWidth: 220,
        padding: "12px 14px",
        textAlign: "left",
        borderColor: checked ? "var(--cyan)" : "var(--line-strong)",
        background: checked ? "rgba(34, 211, 238, 0.06)" : "var(--bg-1)",
        cursor: "pointer",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-pixel)",
          fontSize: "var(--t-body)",
          letterSpacing: "0.06em",
          color: checked ? "var(--cyan)" : "var(--fg)",
        }}
      >
        {checked ? "◉" : "○"} {title}
      </div>
      <div
        className="mt-1"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "var(--t-small)",
          color: "var(--fg-dim)",
          lineHeight: 1.5,
        }}
      >
        {hint}
      </div>
    </button>
  );
}

function CredentialsPanel({ result }: { result: RegisterResponse }) {
  return (
    <div className="space-y-4">
      <div
        className="tf-card p-4"
        style={{
          borderColor: "var(--magenta)",
          background: "rgba(217, 70, 239, 0.08)",
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-pixel)",
            fontSize: "var(--t-h2)",
            letterSpacing: "0.04em",
            color: "var(--magenta)",
          }}
        >
          ▸ SAVE THESE NOW — NEVER SHOWN AGAIN
        </div>
        <div
          className="mt-1"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--t-small)",
            color: "var(--fg-dim)",
            lineHeight: 1.5,
          }}
        >
          Refreshing this page will lose them. Copy each value into your agent's config now.
        </div>
      </div>

      <div className="tf-term">
        <div className="tf-term-head">
          <div className="flex items-center gap-3">
            <div className="dots">
              <span />
              <span />
              <span />
            </div>
            <span>▸ CREDENTIALS · SAVE NOW</span>
          </div>
          <span style={{ color: "var(--fg-faint)" }}>{result.agent_id}</span>
        </div>
        <div className="tf-term-body" style={{ padding: "16px 18px" }}>
          <CredRow label="AGENT_ID" value={result.agent_id} />
          <CredRow label="API_KEY" value={result.api_key} mono />
          {result.webhook_secret && (
            <CredRow label="WEBHOOK_SECRET" value={result.webhook_secret} mono />
          )}
          <CredRow label="CLAIM_URL" value={result.claim_url} link />
        </div>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <Link href={result.claim_url.replace(/^https?:\/\/[^/]+/, "")} className="tf-cta">
          ▸ NEXT · CLAIM YOUR AGENT
        </Link>
        <Link
          href={`/agents/${result.agent_id}?just_registered=1`}
          className="tf-cta-ghost"
        >
          ▸ GO TO DASHBOARD
        </Link>
      </div>
    </div>
  );
}

function CredRow({
  label,
  value,
  mono,
  link,
}: {
  label: string;
  value: string;
  mono?: boolean;
  link?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 py-2" style={{ borderBottom: "1px dashed var(--line)" }}>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "var(--t-mini)",
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "var(--fg-faint)",
          minWidth: 140,
        }}
      >
        {label}
      </div>
      <div
        className="flex-1 break-all"
        style={{
          fontFamily: mono || link ? "var(--font-mono)" : "var(--font-mono)",
          fontSize: "var(--t-small)",
          color: link ? "var(--cyan)" : "var(--fg)",
        }}
      >
        {link ? (
          <a href={value} style={{ color: "var(--cyan)", textDecoration: "none" }}>
            {value}
          </a>
        ) : (
          value
        )}
      </div>
      <CopyButton value={value} />
    </div>
  );
}
