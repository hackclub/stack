const platformBackground = "https://cdn.hackclub.com/019e3e5a-908f-707d-9790-91f9ec414045/bkg.png";
const backBtn = "https://cdn.hackclub.com/019e3e5a-8541-7927-b209-5cca8c932fe6/Back_btn.png";
const stackTitle = "https://cdn.hackclub.com/019e3e5a-8745-7bee-a1ab-07b5743f98c7/Stack_title.png";
import { useAuth } from "../auth/AuthContext.jsx";
import { PlatformStatusBar } from "./PlatformStatusBar.jsx";
import { SlackChannels } from "./SlackChannels.jsx";
import "./RulesPage.css";

export function RulesPage() {
  const { user } = useAuth();

  return (
    <main className="rules-page" aria-label="Project ship rules">
      <img className="rules-page__background" src={platformBackground} alt="" aria-hidden="true" />
      <PlatformStatusBar user={user} />

      <section className="rules-page__content">
        <header className="rules-page__header">
          <p className="rules-page__eyebrow">Stack</p>
          <h1>Project Ship Rules</h1>
          <p>
            Read this before shipping. Your project must be fun, properly tracked, and easy for reviewers to verify.
          </p>
        </header>

        <nav className="rules-page__index" aria-label="Rules index">
          <a href="#project-type">Project Type</a>
          <a href="#journaling">Journaling System</a>
          <a href="#ship-requirements">Ship Requirements</a>
          <a href="#rules">Rules</a>
          <a href="#questions">Questions</a>
        </nav>

        <section className="rules-page__card rules-page__theme">
          <h2>Theme Required</h2>
          <p>Remember, your project needs to be fun. Read the FAQ for examples of what fits the Stack vibe.</p>
        </section>

        <section id="project-type" className="rules-page__card">
          <h2>Project Type</h2>
          <div className="rules-page__grid">
            <article>
              <h3>Base Project</h3>
              <ul>
                <li>
                  <strong>Software:</strong> track time with{" "}
                  <a href="https://hackatime.hackclub.com/" target="_blank" rel="noreferrer">Hackatime</a>. If setup is
                  broken, ask for help in{" "}
                  <a href="https://slack.com/archives/C08MDGUPJ6A" target="_blank" rel="noreferrer">#hackatime-dev</a>.
                </li>
                <li>
                  <strong>Hardware:</strong> track time with the{" "}
                  <a href="#journaling">journaling system</a> and/or{" "}
                  <a href="https://lapse.hackclub.com/" target="_blank" rel="noreferrer">Lapse</a>.
                </li>
              </ul>
              <p className="rules-page__callout">
                If the tool you are using supports{" "}
                <a href="https://hackatime.hackclub.com/" target="_blank" rel="noreferrer">Hackatime</a>, you must use
                Hackatime. For example, you cannot track VS Code work only with{" "}
                <a href="https://lapse.hackclub.com/" target="_blank" rel="noreferrer">Lapse</a> or{" "}
                <a href="#journaling">journaling</a>.
              </p>
            </article>
            <article>
              <h3>Optional Base Project Add-on</h3>
              <p>
                Art can count for up to an additional 15% of your base project hours, tracked with the journaling system.
              </p>
              <p>
                Example: if your non-art base project is 10 hours, you can add up to 1.5 hours of related art work, for
                11.5 countable hours total.
              </p>
            </article>
          </div>
        </section>

        <section className="rules-page__card">
          <h2>What Counts As Art?</h2>
          <p>
            Art should be a meaningful plus to your existing base project. Reviewers judge based on quality and whether the
            work is clearly related to the project.
          </p>
          <div className="rules-page__table-wrap">
            <table className="rules-page__table">
              <thead>
                <tr>
                  <th>ART examples</th>
                  <th>Hardware examples</th>
                  <th>Not-shippable</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Blender or 3D modeling only</td>
                  <td>PCB design</td>
                  <td>Google research for your project</td>
                </tr>
                <tr>
                  <td>Assets, music, drawings, Figma, Video editing</td>
                  <td>CAD/3D modeling associated with a hardware component*</td>
                  <td>Random external work unrelated to the project</td>
                </tr>
                <tr>
                  <td>Anything that includes design only</td>
                  <td>Schematics</td>
                  <td>General planning or browsing</td>
                </tr>
              </tbody>
            </table>
          </div>
          <aside className="rules-page__footnote" aria-label="CAD and 3D modeling note">
            <p>
              <em>
                * CAD/3D modeling is not considered as art only if you associate that to a hardware project. Eg. if
                you&apos;re 3D modeling a Raspberry case, that will be considered as non-art only if you ship some
                hardware with it (like a PCB schematic). Otherwise, the case only, is just art.
              </em>
            </p>
          </aside>
          <p className="rules-page__callout">
            Not sure if your add-on art will count? Ask first in{" "}
            <a href="https://slack.com/archives/C0B6AFEA2J3" target="_blank" rel="noreferrer">#stack-help</a>.
          </p>
        </section>

        <section id="journaling" className="rules-page__card">
          <h2>Journaling System</h2>
          <ul className="rules-page__checklist">
            <li>Take photos or screenshots of your improvements.</li>
            <li>Record quick update videos when helpful.</li>
            <li>Write a brief description of what changed.</li>
            <li>Do this for each new feature, ideally around every hour of work.</li>
            <li>Put your work and proof into your GitHub commits.</li>
          </ul>
          <p>
            Until the website is ready, work normally on hardware, take notes, and keep pictures. You can upload everything
            to the platform once it is released.
          </p>
        </section>

        <section id="ship-requirements" className="rules-page__card">
          <h2>Ship Requirements</h2>
          <p>
            Find the full list and explanation{" "}
            <a href="https://hackclub.gitbook.io/ysws-project-submission-guidelines/BLBRN8LIfoCZhFV6oMNR/required-submission-fields" target="_blank" rel="noreferrer">
              here
            </a>.
          </p>
          <ul className="rules-page__checklist">
            <li>GitHub open-source page with frequent commits, around every 30 minutes to 1 hour.</li>
            <li>Mandatory tracking system.</li>
            <li>Working live demo.</li>
          </ul>
          <p className="rules-page__callout">
            You get 20 coins per approved hour. Activity logged before the official event start does not count unless an
            organizer gave written permission.
          </p>
        </section>

        <section id="rules" className="rules-page__card">
          <h2>Rules</h2>
          <ul className="rules-page__checklist">
            <li>AI is allowed only as support, with a max of 30% of the codebase.</li>
            <li>No double-dipping with other programs.</li>
            <li>
              No fraud. Do not cheat the tracking system: no bots, fake key presses, or UI manipulation. If you do, you can
              be banned from Hackatime and other participating YSWS events/programs.
            </li>
          </ul>
        </section>

        <section id="questions" className="rules-page__card rules-page__help">
          <h2>Still Have Questions?</h2>
          <p>
            Ask directly in the Hack Club Slack channel{" "}
            <a href="https://slack.com/archives/C0B6AFEA2J3" target="_blank" rel="noreferrer">
              <strong>#stack-help</strong>
            </a>.
          </p>
          <a href="/faq">Open FAQ</a>
        </section>

        <SlackChannels />
      </section>

      <a className="rules-page__back" href="/main" aria-label="Back to main menu">
        <img src={backBtn} alt="" aria-hidden="true" />
      </a>
      <img className="rules-page__brand" src={stackTitle} alt="Stack" />
    </main>
  );
}
