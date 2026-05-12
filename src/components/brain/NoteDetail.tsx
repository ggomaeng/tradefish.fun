"use client";

/**
 * NoteDetail — replaces the SidePanel content when a node is clicked.
 *
 * Fetches /api/brain/note/:slug and renders:
 *   - Title, tokens, PnL, source round link
 *   - Markdown content (rendered as plain text paragraphs for now)
 *   - Related notes (click to focus)
 *   - Recent citing responses
 */

import { useEffect, useState } from "react";
import type { BrainNoteDetail } from "@/lib/brain/types";
import Link from "next/link";

interface NoteDetailProps {
  slug: string;
  onClose: () => void;
  onFocusSlug: (slug: string) => void;
}

export function NoteDetail({ slug, onClose, onFocusSlug }: NoteDetailProps) {
  const [data, setData] = useState<BrainNoteDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const r = await fetch(`/api/brain/note/${encodeURIComponent(slug)}`);
        if (cancelled) return;
        if (!r.ok) throw new Error(`${r.status}`);
        const d = (await r.json()) as BrainNoteDetail;
        if (!cancelled) {
          setData(d);
          setError(null);
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setError((e as Error).message);
          setLoading(false);
        }
      }
    }

    void load();
    return () => { cancelled = true; };
  }, [slug]);

  return (
    <aside style={asideStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="t-mini" style={{ marginBottom: 4 }}>NOTE DETAIL</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fg)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {loading ? "Loading…" : (data?.note.title ?? slug)}
          </div>
        </div>
        <button onClick={onClose} style={closeBtnStyle} aria-label="Close note">✕</button>
      </div>

      {loading && <div style={emptyStyle}>Loading…</div>}
      {error && <div style={{ ...emptyStyle, color: "var(--down)" }}>Error: {error}</div>}

      {data && !loading && (
        <div style={{ flex: 1, overflowY: "auto" }} className="no-scrollbar">
          {/* Meta row */}
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--bd-1)", display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            {data.note.tokens.map((t) => (
              <span key={t} className="chip">{t}</span>
            ))}
            {data.note.pnl_attributed_usd !== 0 && (
              <span
                style={{
                  marginLeft: "auto",
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  color: data.note.pnl_attributed_usd >= 0 ? "var(--up)" : "var(--down)",
                }}
              >
                {data.note.pnl_attributed_usd >= 0 ? "+" : "−"}$
                {Math.abs(data.note.pnl_attributed_usd).toFixed(2)} PnL
              </span>
            )}
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-4)", display: "block", width: "100%" }}>
              {data.note.cite_count} citations
              {data.note.source_round_id && (
                <>
                  {" · "}
                  <Link href={`/round/${data.note.source_round_id}`} style={{ color: "var(--cyan)" }}>
                    view source round →
                  </Link>
                </>
              )}
            </span>
          </div>

          {/* Content */}
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--bd-1)" }}>
            <div style={{ fontSize: 13, color: "var(--fg-2)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
              {data.note.content}
            </div>
          </div>

          {/* Related notes */}
          {data.related_notes.length > 0 && (
            <div style={{ borderBottom: "1px solid var(--bd-1)" }}>
              <div style={subHeadStyle}>RELATED NOTES</div>
              {data.related_notes.map((rn) => (
                <button
                  key={rn.slug}
                  onClick={() => onFocusSlug(rn.slug)}
                  style={relatedRowStyle}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--bg-2)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                >
                  <span style={{ flex: 1, fontSize: 12, color: "var(--fg-2)", textAlign: "left" }}>{rn.slug}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-4)" }}>
                    {(rn.similarity * 100).toFixed(0)}% sim
                  </span>
                  {rn.pnl_flow_usd > 0 && (
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--up)", marginLeft: 6 }}>
                      +${rn.pnl_flow_usd.toFixed(0)}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Recent citing responses */}
          {data.recent_answers.length > 0 && (
            <div>
              <div style={subHeadStyle}>CITED IN</div>
              {data.recent_answers.slice(0, 5).map((a) => (
                <div
                  key={a.answer_id}
                  style={{ padding: "8px 16px", borderBottom: "1px solid var(--bd-1)", fontSize: 12, color: "var(--fg-3)" }}
                >
                  <span className="chip" style={{ fontSize: 10, marginRight: 6 }}>
                    {a.source === "explicit" ? "cited" : "retrieved"}
                  </span>
                  {a.answer_id.slice(0, 8)}…
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </aside>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const asideStyle: React.CSSProperties = {
  width: 360,
  flexShrink: 0,
  background: "var(--bg-1)",
  borderLeft: "1px solid var(--bd-1)",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  height: "100%",
};

const headerStyle: React.CSSProperties = {
  padding: "12px 16px",
  borderBottom: "1px solid var(--bd-1)",
  display: "flex",
  gap: 8,
  alignItems: "flex-start",
  flexShrink: 0,
};

const closeBtnStyle: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "var(--fg-3)",
  cursor: "pointer",
  fontSize: 14,
  padding: "2px 4px",
  flexShrink: 0,
};

const emptyStyle: React.CSSProperties = {
  padding: 24,
  fontSize: 13,
  color: "var(--fg-4)",
  textAlign: "center",
};

const subHeadStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.06em",
  color: "var(--fg-3)",
  padding: "10px 16px 6px",
};

const relatedRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  width: "100%",
  padding: "8px 16px",
  background: "transparent",
  border: "none",
  borderBottom: "1px solid var(--bd-1)",
  cursor: "pointer",
  transition: "background 120ms ease",
};
