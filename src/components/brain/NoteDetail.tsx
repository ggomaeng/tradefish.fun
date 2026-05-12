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
import type { BrainNoteDetail, BrainRecentAnswer } from "@/lib/brain/types";
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
                <AnswerRow key={a.answer_id} answer={a} />
              ))}
            </div>
          )}
        </div>
      )}
    </aside>
  );
}

// ─── AnswerRow sub-component ─────────────────────────────────────────────────

function AnswerRow({ answer }: { answer: BrainRecentAnswer }) {
  const { answer_id, source, response, trade } = answer;

  const agentLabel = response?.agent_id
    ? response.agent_id.slice(0, 8) + "…"
    : answer_id.slice(0, 8) + "…";

  const queryShortId = response?.queries?.short_id;
  const roundId = response?.queries?.id;

  return (
    <div style={answerRowStyle}>
      {/* Top row: source chip + agent id + PnL chip */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <span className="chip" style={{ fontSize: 10 }}>
          {source === "explicit" ? "cited" : "retrieved"}
        </span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-3)" }}>
          {agentLabel}
        </span>
        {queryShortId && roundId && (
          <Link
            href={`/round/${roundId}`}
            style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--cyan)", marginLeft: "auto" }}
          >
            {queryShortId} →
          </Link>
        )}
        {/* PnL chip — settled trade */}
        {trade && trade.exit_price !== null && (
          <span style={pnlChipStyle(trade.pnl_usd)}>
            {trade.pnl_usd >= 0 ? "+" : "−"}${Math.abs(trade.pnl_usd).toFixed(2)}
          </span>
        )}
        {/* Open / settling pill — trade row exists but not yet closed */}
        {trade && trade.exit_price === null && (
          <span style={openPillStyle}>settling</span>
        )}
        {/* No trade row yet */}
        {!trade && (
          <span style={openPillStyle}>open</span>
        )}
      </div>

      {/* Second row: position sizing */}
      {trade && (
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)", marginTop: 4, paddingLeft: 2 }}>
          ${trade.position_size_usd.toFixed(0)} @ 10×{" "}
          <span style={{ color: trade.direction === "long" ? "var(--up)" : "var(--down)" }}>
            {trade.direction}
          </span>
        </div>
      )}

      {/* Answer preview */}
      {response?.answer && (
        <div style={{ fontSize: 11, color: "var(--fg-4)", marginTop: 4, lineHeight: 1.4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const }}>
          {response.answer}
        </div>
      )}
    </div>
  );
}

function pnlChipStyle(pnl: number): React.CSSProperties {
  const positive = pnl >= 0;
  return {
    fontFamily: "var(--font-mono)",
    fontSize: 11,
    fontWeight: 600,
    color: positive ? "var(--up)" : "var(--down)",
    background: positive ? "var(--up-bg)" : "var(--down-bg)",
    border: `1px solid ${positive ? "var(--up-bd)" : "var(--down-bd)"}`,
    borderRadius: 4,
    padding: "1px 6px",
    marginLeft: "auto",
  };
}

const openPillStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  color: "var(--cyan)",
  background: "var(--cyan-bg)",
  border: "1px solid var(--cyan-bd)",
  borderRadius: 4,
  padding: "1px 5px",
  marginLeft: "auto",
};

const answerRowStyle: React.CSSProperties = {
  padding: "10px 16px",
  borderBottom: "1px solid var(--bd-1)",
};

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
  fontSize: "var(--t-mini)",
  fontWeight: 600,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
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
