import platformBackground from "@assets/platform/main/bkg.png";
import backBtn from "@assets/platform/common/Back_btn.png";
import stackTitle from "@assets/platform/common/Stack_title.png";
import { useAuth } from "../auth/AuthContext.jsx";
import { PlatformStatusBar } from "./PlatformStatusBar.jsx";
import "./FaqPage.css";

export function FaqPage() {
  const { user } = useAuth();

  return (
    <main className="faq-page" aria-label="FAQ page">
      <img className="faq-page__background" src={platformBackground} alt="" aria-hidden="true" />

      <PlatformStatusBar user={user} />

      <section className="faq-page__content">
        <h1 className="faq-page__heading">FAQ</h1>
        <p className="faq-page__note">Full FAQ content coming soon.</p>
      </section>

      <a className="faq-page__back" href="/main" aria-label="Back to main menu">
        <img src={backBtn} alt="" aria-hidden="true" />
        <span>Back</span>
      </a>

      <img className="faq-page__brand" src={stackTitle} alt="Stack" />
    </main>
  );
}
