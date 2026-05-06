import { useEffect, useRef, useState } from "react";
import profileFrame from "@assets/platform/main/pfp_bar_square.png";
import defaultAvatar from "@assets/platform/main/pfp.png";
import coinIcon from "@assets/platform/main/coin.png";
import heartsIcon from "@assets/platform/main/hearts.png";
import "./PlatformStatusBar.css";

/**
 * Top-left HUD: avatar opens a menu (logout). Coin/hearts are decorative for now.
 */
export function PlatformStatusBar({ user, className = "" }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const rootRef = useRef(null);

  const avatarSrc = user?.profileImageUrl || defaultAvatar;
  const username = user?.name || user?.slug || user?.email?.split("@")[0] || "User";
  const isAdmin = user?.role === "admin";

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
          {isAdmin ? (
            <a className="platform-status__menu-item" role="menuitem" href="/admin">
              Admin Panel
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
          <span className="platform-status__text">1234</span>
        </div>
        <div className="platform-status__row">
          <img className="platform-status__icon platform-status__icon--hearts" src={heartsIcon} alt="" aria-hidden="true" />
          <span className="platform-status__username">{username}</span>
        </div>
      </div>
    </section>
  );
}
