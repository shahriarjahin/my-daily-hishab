import { useEffect, useState } from "react";

export function LoadingScreen() {
  const [extended, setExtended] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setExtended(true), 1200);
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <main className={`startup-screen${extended ? " startup-extended" : ""}`} aria-busy="true">
      <div className="startup-brand" role="status" aria-label="Loading Hishab">
        <div className="startup-logo"><img src="/static/hishab-icon-v2-192.png" alt="" /></div>
        <strong>Hishab</strong>
        <span className="startup-sr">Loading your account</span>
      </div>
      {extended && <div className="startup-placeholder" aria-hidden="true">
        <div className="startup-line" /><div className="startup-balance" />
        <div className="startup-chart" />
        <div className="startup-pair"><div /><div /></div>
        <div className="startup-row" /><div className="startup-row" /><div className="startup-row" />
      </div>}
    </main>
  );
}
