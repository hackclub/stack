import platformBackground from "@assets/platform/main/bkg.png";
import backBtn from "@assets/platform/common/Back_btn.png";
import stackTitle from "@assets/platform/common/Stack_title.png";
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
