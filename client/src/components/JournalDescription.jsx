import { useEffect, useState } from "react";
import {
  isVideoUrl,
  journalDisplaySrc,
  parseJournalDescription,
} from "../utils/mediaUrls.js";

function JournalMedia({ url, rawUrl, alt, className, mediaEndpoint }) {
  const apiSrc = journalDisplaySrc({ resolved: url, rawUrl, alt, mediaEndpoint });
  const [objectUrl, setObjectUrl] = useState(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(Boolean(apiSrc));

  useEffect(() => {
    if (!apiSrc) {
      setObjectUrl(null);
      setFailed(false);
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    let blobUrl = null;
    setLoading(true);
    setFailed(false);
    setObjectUrl(null);

    fetch(apiSrc, { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Media request failed (${response.status})`);
        }
        const blob = await response.blob();
        if (cancelled) return;
        blobUrl = URL.createObjectURL(blob);
        setObjectUrl(blobUrl);
        setFailed(false);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [apiSrc]);

  if (!apiSrc) {
    return (
      <span className="journal-media-fallback">
        {alt || "Attachment unavailable"}
      </span>
    );
  }

  if (loading) {
    return <span className="journal-media-loading">Loading attachment…</span>;
  }

  if (failed || !objectUrl) {
    return (
      <span className="journal-media-fallback">
        {alt ? `${alt} — ` : ""}
        Could not load attachment.
      </span>
    );
  }

  if (isVideoUrl(rawUrl || url || alt)) {
    return <video className={className} src={objectUrl} controls preload="metadata" />;
  }

  return (
    <img
      className={className}
      src={objectUrl}
      alt={alt || "Journal attachment"}
    />
  );
}

export function JournalDescription({
  text,
  className = "journal-description",
  mediaClassName = "journal-media-item",
  mediaEndpoint,
}) {
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
            key={`${i}-${part.rawUrl || part.url || part.alt}`}
            url={part.url}
            rawUrl={part.rawUrl}
            alt={part.alt}
            className={mediaClassName}
            mediaEndpoint={mediaEndpoint}
          />
        )
      )}
    </div>
  );
}
