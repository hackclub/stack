import { useEffect, useRef, useState } from "react";
const profileFrame = "https://cdn.hackclub.com/019e3e5a-994b-736e-9af4-8f33b629a229/pfp_bar_square.png";
const defaultAvatar = "https://cdn.hackclub.com/019e3e5a-976c-79a3-8474-9087ea96a5a2/pfp.png";
const coinIcon = "https://cdn.hackclub.com/019e3e5a-92de-76d8-89cf-0598cf9946db/coin.png";
const heartsIcon = "https://cdn.hackclub.com/019e3e5a-951b-7b7e-ab83-9324d8fc3c10/hearts.png";
import "./PlatformStatusBar.css";

/**
 * Top-left HUD: avatar opens a menu (logout). Coin/hearts are decorative for now.
 */
export function PlatformStatusBar({ user, className = "" }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const rootRef = useRef(null);

  const avatarSrc = user?.profileImageUrl || defaultAvatar;
  const username = user?.slug ? `@${user.slug}` : user?.email?.split("@")[0] || "User";
  const isFullAdmin = user?.role === "admin" || user?.role === "superadmin";
  const isReviewerOnly = user?.role === "reviewer";
  const bricks = Math.floor(Number(user?.bricks ?? 0));

  useEffect(() => {
    function onDocClick(event) {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  async function handleLogout() {
    setMenuOpen(false);
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch {
      // Still send the user home even if the API round-trip fails.
    }
    window.location.href = "/";
  }

  return (
    <section className={`platform-status ${className}`.trim()} ref={rootRef} aria-label="User status">
      <img className="platform-status__frame" src={profileFrame} alt="" aria-hidden="true" />
      <button
        type="button"
        className="platform-status__avatar-btn"
        onClick={(e) => {
          e.stopPropagation();
          setMenuOpen((open) => !open);
        }}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-label="Account menu"
      >
        <img className="platform-status__avatar" src={avatarSrc} alt="" />
      </button>
      {menuOpen && (
        <div className="platform-status__menu" role="menu">
          {isFullAdmin ? (
            <a className="platform-status__menu-item" role="menuitem" href="/admin">
              Admin Panel
            </a>
          ) : null}
          {isReviewerOnly ? (
            <a className="platform-status__menu-item" role="menuitem" href="/admin/review">
              Project Review
            </a>
          ) : null}
          <button type="button" className="platform-status__menu-item" role="menuitem" onClick={handleLogout}>
            Log out
          </button>
        </div>
      )}
      <div className="platform-status__content">
        <div className="platform-status__row">
          <img className="platform-status__icon platform-status__icon--coin" src={coinIcon} alt="" aria-hidden="true" />
          <span className="platform-status__text">{bricks}</span>
        </div>
        <div className="platform-status__row">
          <img className="platform-status__icon platform-status__icon--hearts" src={heartsIcon} alt="" aria-hidden="true" />
          <span className="platform-status__username">{username}</span>
        </div>
      </div>
    </section>
  );
}
