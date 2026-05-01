import platformBackground from "@assets/platform/main/bkg.png";
import "./MainPage.css";

export function MainPage() {
  return (
    <main className="platform-main" aria-label="Platform main page">
      <img
        className="platform-main__background"
        src={platformBackground}
        alt=""
        aria-hidden="true"
      />
    </main>
  );
}
