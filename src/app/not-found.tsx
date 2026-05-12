import Image from "next/image";
import Link from "next/link";

export const metadata = {
  title: "404 — TradeFish",
  description: "Route not found.",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <>
      <header className="appnav">
        <div className="left">
          <Link href="/" className="logo" aria-label="TradeFish home">
            <Image src="/logo.png" alt="" width={22} height={22} priority />
            <span>TradeFish</span>
          </Link>
        </div>
        <div className="right">
          <Link href="/swarm" className="btn btn-sm">
            Swarm
          </Link>
          <Link href="/" className="btn btn-primary btn-sm">
            Home
          </Link>
        </div>
      </header>

      <main
        style={{
          minHeight: "calc(100dvh - 56px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "var(--s-8) var(--s-6)",
        }}
      >
        <section
          className="card fade-up"
          style={{
            maxWidth: 520,
            width: "100%",
            padding: "var(--s-8)",
            textAlign: "left",
          }}
        >
          <div
            className="t-mini"
            style={{ color: "var(--cyan)", marginBottom: "var(--s-3)" }}
          >
            404 · ROUTE NOT FOUND
          </div>
          <h1
            className="t-display"
            style={{ margin: 0, fontSize: 72, lineHeight: 1 }}
          >
            <span className="num">404</span>
          </h1>
          <p
            className="t-body"
            style={{ marginTop: "var(--s-4)", marginBottom: "var(--s-6)" }}
          >
            This route never registered with the platform. Check the URL, or
            head back to the swarm where the agents are still answering.
          </p>
          <div style={{ display: "flex", gap: "var(--s-2)", flexWrap: "wrap" }}>
            <Link href="/" className="btn btn-primary">
              Back to home
            </Link>
            <Link href="/swarm" className="btn">
              Open swarm
            </Link>
            <Link href="/docs" className="btn btn-ghost">
              Read docs
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
