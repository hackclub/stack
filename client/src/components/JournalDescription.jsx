import { useState } from "react";
import {
  isVideoUrl,
  journalDisplaySrc,
  parseJournalDescription,
} from "../utils/mediaUrls.js";

function JournalMedia({ url, rawUrl, alt, className }) {
  const displaySrc = journalDisplaySrc({ resolved: url, rawUrl, alt });
  const [failed, setFailed] = useState(false);

  if (!displaySrc) {
    return (
      <span className="journal-media-fallback">
        {alt || "Attachment unavailable"}
      </span>
    );
  }

  if (failed) {
    return (
      <span className="journal-media-fallback">
        {alt ? `${alt} — ` : ""}
        Could not load attachment.
      </span>
    );
  }

  if (isVideoUrl(rawUrl || url || alt)) {
    return <video className={className} src={displaySrc} controls preload="metadata" />;
  }

  return (
    <img
      className={className}
      src={displaySrc}
      alt={alt || "Journal attachment"}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

export function JournalDescription({ text, className = "journal-description", mediaClassName = "journal-media-item" }) {
  const parts = parseJournalDescription(text);
  if (parts.length === 0) return null;

  return (
    <div className={className}>
      {parts.map((part, i) =>
        part.type === "text" ? (
          <span key={i} style={{ whiteSpace: "pre-wrap" }}>
            {part.value}
          </span>
        ) : (
          <JournalMedia
            key={i}
            url={part.url}
            rawUrl={part.rawUrl}
            alt={part.alt}
            className={mediaClassName}
          />
        )
      )}
    </div>
  );
}
