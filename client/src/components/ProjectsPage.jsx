import platformBackground from "@assets/platform/main/bkg.png";
import { useAuth } from "../auth/AuthContext.jsx";
import { PlatformStatusBar } from "./PlatformStatusBar.jsx";
import sideBrick from "@assets/platform/projects/side_brick.png";
import statusBtn from "@assets/platform/projects/status_btn.png";
import hoursBtn from "@assets/platform/projects/hours_btn.png";
import backBtn from "@assets/platform/common/Back_btn.png";
import nextBtn from "@assets/platform/common/nextPg_btn.png";
import stackTitle from "@assets/platform/common/Stack_title.png";
import "./ProjectsPage.css";

const projectCards = [
  { name: "PrjName", status: "Pending", hours: "123 hours" },
  { name: "PrjName", status: "Approved", hours: "123 hours" },
  { name: "PrjName", status: "Pending", hours: "123 hours" },
  { name: "PrjName", status: "Rejected", hours: "123 hours" },
];

export function ProjectsPage() {
  const { user } = useAuth();

  return (
    <main className="projects-page" aria-label="Projects page">
      <img className="projects-page__background" src={platformBackground} alt="" aria-hidden="true" />

      <PlatformStatusBar user={user} />

      <section className="projects-page__grid" aria-label="Project list">
        {projectCards.map((project, index) => (
          <article className="projects-page__card" key={`${project.name}-${index}`}>
            <img className="projects-page__studs" src={sideBrick} alt="" aria-hidden="true" />
            <h2 className="projects-page__title">{project.name}</h2>
            <div className="projects-page__meta">
              <div className="projects-page__meta-chip">
                <img src={statusBtn} alt="" aria-hidden="true" />
                <span>{project.status}</span>
              </div>
              <div className="projects-page__meta-chip">
                <img src={hoursBtn} alt="" aria-hidden="true" />
                <span>{project.hours}</span>
              </div>
            </div>
          </article>
        ))}
      </section>

      <nav className="projects-page__nav" aria-label="Projects navigation">
        <a className="projects-page__back" href="/main" aria-label="Go back to main page">
          <img src={backBtn} alt="" aria-hidden="true" />
          <span>Back</span>
        </a>
        <a className="projects-page__next" href="/projects?page=2" aria-label="Go to next projects page">
          <img src={nextBtn} alt="" aria-hidden="true" />
        </a>
      </nav>

      <img className="projects-page__brand" src={stackTitle} alt="Stack" />
    </main>
  );
}
