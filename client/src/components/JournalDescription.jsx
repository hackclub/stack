import { isVideoUrl, parseJournalDescription } from "../utils/mediaUrls.js";

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
        ) : isVideoUrl(part.url) ? (
          <video key={i} className={mediaClassName} src={part.url} controls preload="metadata" />
        ) : (
          <img key={i} className={mediaClassName} src={part.url} alt={part.alt || "Journal attachment"} loading="lazy" />
        )
      )}
    </div>
  );
}
