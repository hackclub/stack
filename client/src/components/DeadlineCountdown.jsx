import { useEffect, useState } from "react";
import { formatDeadlineCountdown, isDeadlineOpen } from "../utils/eventDeadlines.js";

export function useDeadlineState(deadlineMs) {
  const [nowMs, setNowMs] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  return {
    isOpen: isDeadlineOpen(deadlineMs, nowMs),
    countdown: formatDeadlineCountdown(deadlineMs, nowMs),
  };
}

export function DeadlineCountdown({ label, deadlineMs, className = "", layout = "inline" }) {
  const { isOpen, countdown } = useDeadlineState(deadlineMs);

  if (layout === "banner") {
    return (
      <section
        className={`${className}${isOpen ? " is-open" : " is-closed"}`.trim()}
        aria-live="polite"
        role="status"
      >
        <p className="shop-page__deadline-kicker">
          {isOpen ? "Limited time — shop is open!" : "Shop closed"}
        </p>
        {isOpen ? (
          <p className="shop-page__deadline-heading">
            <span className="shop-page__deadline-label">{label} closes in</span>
            <strong className="shop-page__deadline-time">{countdown}</strong>
          </p>
        ) : (
          <p className="shop-page__deadline-heading">
            <span className="shop-page__deadline-label">Purchases are unavailable</span>
          </p>
        )}
      </section>
    );
  }

  return (
    <p className={className} aria-live="polite">
      {isOpen ? `${label} closes in ${countdown}` : `${label} closed`}
    </p>
  );
}
