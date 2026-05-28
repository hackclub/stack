const platformBackground = "https://cdn.hackclub.com/019e3e5a-908f-707d-9790-91f9ec414045/bkg.png";
const backBtn = "https://cdn.hackclub.com/019e3e5a-8541-7927-b209-5cca8c932fe6/Back_btn.png";
const stackTitle = "https://cdn.hackclub.com/019e3e5a-8745-7bee-a1ab-07b5743f98c7/Stack_title.png";
import { useAuth } from "../auth/AuthContext.jsx";
import { FaqList } from "./FaqList.jsx";
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
        <FaqList />
      </section>

      <a className="faq-page__back" href="/main" aria-label="Back to main menu">
        <img src={backBtn} alt="" aria-hidden="true" />
      </a>

      <img className="faq-page__brand" src={stackTitle} alt="Stack" />
    </main>
  );
}
