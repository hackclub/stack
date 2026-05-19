const platformBackground = "https://cdn.hackclub.com/019e3e5a-908f-707d-9790-91f9ec414045/bkg.png";
const backBtn = "https://cdn.hackclub.com/019e3e5a-8541-7927-b209-5cca8c932fe6/Back_btn.png";
const stackTitle = "https://cdn.hackclub.com/019e3e5a-8745-7bee-a1ab-07b5743f98c7/Stack_title.png";
import { useAuth } from "../auth/AuthContext.jsx";
import { PlatformStatusBar } from "./PlatformStatusBar.jsx";
import "./UserAreaPage.css";

export function UserAreaPage() {
  const { user } = useAuth();

  return (
    <main className="user-area-page" aria-label="User area">
      <img className="user-area-page__background" src={platformBackground} alt="" aria-hidden="true" />

      <PlatformStatusBar user={user} />

      <section className="user-area-page__panel">
        <h1 className="user-area-page__heading">Your account</h1>
        <dl className="user-area-page__details">
          <div>
            <dt>Name</dt>
            <dd>{user?.name || "—"}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{user?.email || "—"}</dd>
          </div>
          <div>
            <dt>Role</dt>
            <dd>{user?.role || "member"}</dd>
          </div>
        </dl>
      </section>

      <a className="user-area-page__back" href="/main" aria-label="Back to main menu">
        <img src={backBtn} alt="" aria-hidden="true" />
        <span>Back</span>
      </a>

      <img className="user-area-page__brand" src={stackTitle} alt="Stack" />
    </main>
  );
}
