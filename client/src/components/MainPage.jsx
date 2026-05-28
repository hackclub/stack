const platformBackground = "https://cdn.hackclub.com/019e3e5a-908f-707d-9790-91f9ec414045/bkg.png";
import { useAuth } from "../auth/AuthContext.jsx";
import { PlatformStatusBar } from "./PlatformStatusBar.jsx";
import "./MainPage.css";

const navBlocks = [
  { label: "Shop", path: "/shop", className: "platform-main__block--shop" },
  { label: "User Area", path: "/user", className: "platform-main__block--user" },
  { label: "Projects", path: "/projects", className: "platform-main__block--projects" },
  { label: "FAQ", path: "/faq", className: "platform-main__block--faq" },
];

export function MainPage() {
  const { user } = useAuth();

  return (
    <main className="platform-main" aria-label="Platform main page">
      <img
        className="platform-main__background"
        src={platformBackground}
        alt=""
        aria-hidden="true"
      />
      <PlatformStatusBar user={user} />
      <nav className="platform-main__nav" aria-label="Main navigation">
        {navBlocks.map((block) => (
          <a key={block.path} className={`platform-main__block ${block.className}`} href={block.path}>
            <span>{block.label}</span>
          </a>
        ))}
      </nav>
    </main>
  );
}
