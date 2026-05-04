import platformBackground from "@assets/platform/main/bkg.png";
import profileFrame from "@assets/platform/main/pfp_bar_square.png";
import profilePicture from "@assets/platform/main/pfp.png";
import coinIcon from "@assets/platform/main/coin.png";
import heartsIcon from "@assets/platform/main/hearts.png";
import "./MainPage.css";

const navBlocks = [
  { label: "Shop", path: "/shop", className: "platform-main__block--shop" },
  { label: "User Area", path: "/user", className: "platform-main__block--user" },
  { label: "Projects", path: "/projects", className: "platform-main__block--projects" },
  { label: "FAQ", path: "/faq", className: "platform-main__block--faq" },
];

export function MainPage() {
  return (
    <main className="platform-main" aria-label="Platform main page">
      <img
        className="platform-main__background"
        src={platformBackground}
        alt=""
        aria-hidden="true"
      />
      <section className="platform-main__status" aria-label="User status">
        <img className="platform-main__status-frame" src={profileFrame} alt="" aria-hidden="true" />
        <img className="platform-main__status-avatar" src={profilePicture} alt="User avatar" />
        <div className="platform-main__status-content">
          <div className="platform-main__status-row">
            <img className="platform-main__icon platform-main__icon--coin" src={coinIcon} alt="" aria-hidden="true" />
            <span className="platform-main__status-text">1234</span>
          </div>
          <div className="platform-main__status-row">
            <img className="platform-main__icon platform-main__icon--hearts" src={heartsIcon} alt="" aria-hidden="true" />
          </div>
        </div>
      </section>
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
