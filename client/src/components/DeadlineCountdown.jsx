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

export function DeadlineCountdown({ label, deadlineMs, className = "" }) {
  const { isOpen, countdown } = useDeadlineState(deadlineMs);

  return (
    <p className={className} aria-live="polite">
      {isOpen ? `${label} closes in ${countdown}` : `${label} closed`}
    </p>
  );
}
