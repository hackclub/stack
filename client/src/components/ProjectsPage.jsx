import platformBackground from "@assets/platform/main/bkg.png";
import { useEffect, useState } from "react";
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
  {
    name: "PrjName",
    status: "Pending",
    hours: "123 hours",
    hoursLogged: "--",
    hoursApproved: "--",
    hackatimeLoggedTime: "--",
    journalingLoggedTime: "--",
    hackatimeName: "--",
  },
  {
    name: "PrjName",
    status: "Approved",
    hours: "123 hours",
    hoursLogged: "--",
    hoursApproved: "--",
    hackatimeLoggedTime: "--",
    journalingLoggedTime: "--",
    hackatimeName: "--",
  },
  {
    name: "PrjName",
    status: "Pending",
    hours: "123 hours",
    hoursLogged: "--",
    hoursApproved: "--",
    hackatimeLoggedTime: "--",
    journalingLoggedTime: "--",
    hackatimeName: "--",
  },
  {
    name: "PrjName",
    status: "Rejected",
    hours: "123 hours",
    hoursLogged: "--",
    hoursApproved: "--",
    hackatimeLoggedTime: "--",
    journalingLoggedTime: "--",
    hackatimeName: "--",
  },
];

export function ProjectsPage() {
  const { user } = useAuth();
  const [selectedProject, setSelectedProject] = useState(null);

  useEffect(() => {
    function handleEscape(event) {
      if (event.key === "Escape") {
        setSelectedProject(null);
      }
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, []);

  return (
    <main className="projects-page" aria-label="Projects page">
      <img className="projects-page__background" src={platformBackground} alt="" aria-hidden="true" />

      <PlatformStatusBar user={user} />

      <section className="projects-page__grid" aria-label="Project list">
        {projectCards.map((project, index) => (
          <button
            className="projects-page__card"
            key={`${project.name}-${index}`}
            type="button"
            aria-label={`Open details for ${project.name}`}
            onClick={() => setSelectedProject(project)}
          >
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
          </button>
        ))}
      </section>

      <nav className="projects-page__nav" aria-label="Projects navigation">
        <a className="projects-page__back" href="/main" aria-label="Go back to main page">
          <img src={backBtn} alt="" aria-hidden="true" />
        </a>
        <a className="projects-page__next" href="/projects?page=2" aria-label="Go to next projects page">
          <img src={nextBtn} alt="" aria-hidden="true" />
        </a>
      </nav>

      <img className="projects-page__brand" src={stackTitle} alt="Stack" />

      {selectedProject && (
        <div
          className="projects-page__modal-overlay"
          role="presentation"
          onClick={() => setSelectedProject(null)}
        >
          <section
            className="projects-page__modal"
            role="dialog"
            aria-modal="true"
            aria-label={`${selectedProject.name} details`}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="projects-page__modal-close"
              type="button"
              aria-label="Close project details"
              onClick={() => setSelectedProject(null)}
            >
              x
            </button>

            <h2 className="projects-page__modal-title">{selectedProject.name}</h2>

            <div className="projects-page__modal-row">
              <span>Hours logged</span>
              <strong>{selectedProject.hoursLogged}</strong>
            </div>
            <div className="projects-page__modal-row">
              <span>Hours approved</span>
              <strong>{selectedProject.hoursApproved}</strong>
            </div>
            <div className="projects-page__modal-row">
              <span>Hackatime logged time</span>
              <strong>{selectedProject.hackatimeLoggedTime}</strong>
            </div>
            <div className="projects-page__modal-row">
              <span>Journaling logged time</span>
              <strong>{selectedProject.journalingLoggedTime}</strong>
            </div>
            <div className="projects-page__modal-row">
              <span>Hackatime name</span>
              <strong>{selectedProject.hackatimeName}</strong>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
