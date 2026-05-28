import "./FaqList.css";

export function FaqList({ className = "" }) {
  return (
    <div className={`stack-faq-list ${className}`.trim()}>
      <details className="stack-faq-list__item">
        <summary>Where can I get support or more information?</summary>
        <div className="stack-faq-list__answer">
          <p>Join us on Slack!</p>
          <ul>
            <li>
              Questions &amp; support {"->"}{" "}
              <a href="https://hackclub.enterprise.slack.com/archives/C0B6AFEA2J3" target="_blank" rel="noreferrer">
                #stack-help
              </a>
            </li>
            <li>
              Important updates &amp; announcements {"->"}{" "}
              <a href="https://hackclub.enterprise.slack.com/archives/C0B6PSX2YR4" target="_blank" rel="noreferrer">
                #stack-bulletin
              </a>
            </li>
            <li>
              General chatting {"->"}{" "}
              <a href="https://hackclub.enterprise.slack.com/archives/C0B6RUQJ1EW" target="_blank" rel="noreferrer">
                #stack
              </a>
            </li>
            <li>Bug report {"->"} canvas</li>
          </ul>
        </div>
      </details>

      <details className="stack-faq-list__item">
        <summary>When will STACK end?</summary>
        <div className="stack-faq-list__answer">
          <p>
            The ending date hasn't been decided yet, but it definitely won't end before June 12. If people enjoy the program
            and lots of hackers participate, we'll surely extend it!
          </p>
        </div>
      </details>

      <details className="stack-faq-list__item">
        <summary>What's the hour rate?</summary>
        <div className="stack-faq-list__answer">
          <p>Starting from $5/h up to $7.5/h!</p>
          <p>1 approved hour = 20 coins. Higher gift cards cost less!</p>
        </div>
      </details>

      <details className="stack-faq-list__item">
        <summary>What can be classified as "fun"?</summary>
        <div className="stack-faq-list__answer">
          <p>
            The idea is simple: don't build something overly serious or productivity-focused. We're looking for projects that
            are goofy, chaotic, entertaining, or just genuinely funny.
          </p>
          <p>Some examples of projects that are probably too serious:</p>
          <ul>
            <li>❌ Portfolio website</li>
            <li>❌ AI shopping list</li>
            <li>❌ Pomodoro timer</li>
            <li>❌ Habit tracker</li>
          </ul>
          <p>And examples of projects that fit perfectly:</p>
          <ul>
            <li>✅ An app made to annoy your brother</li>
            <li>✅ A stupid little game</li>
            <li>✅ A meme website</li>
            <li>✅ Something completely useless but hilarious</li>
          </ul>
          <p>There's no strict checklist, usually, you can just feel when a project has the right vibe :)</p>
        </div>
      </details>

      <details className="stack-faq-list__item">
        <summary>How do I receive my LEGO set?</summary>
        <div className="stack-faq-list__answer">
          <p>To reduce shipping costs, taxes, and customs issues, prizes are distributed differently depending on where you live:</p>
          <p>
            🇺🇸 In the US: We'll try to send a physical LEGO gift card when possible. Otherwise, you'll receive a virtual gift
            card for the{" "}
            <a href="https://www.lego.com/en-us/gift-cards/buy" target="_blank" rel="noreferrer">
              official LEGO website
            </a>
            .
          </p>
          <p>
            🌍 Outside the US: You'll usually receive a virtual gift card for the{" "}
            <a href="https://www.lego.com/en-us/gift-cards/buy" target="_blank" rel="noreferrer">
              official LEGO website
            </a>
            . If that isn't possible in your country, we'll send the reward through an HCB grant instead.
          </p>
        </div>
      </details>

      <details className="stack-faq-list__item">
        <summary>What tracking system should I use?</summary>
        <div className="stack-faq-list__answer">
          <p>
            Software projects should use{" "}
            <a href="https://hackatime.hackclub.com/" target="_blank" rel="noreferrer">
              Hackatime
            </a>
            . Hardware projects should use the journaling system and/or{" "}
            <a href="https://lapse.hackclub.com/" target="_blank" rel="noreferrer">
              Lapse
            </a>
            .
          </p>
          <p>
            If the tool you are using supports Hackatime, you must use Hackatime. For example, VS Code work cannot be
            tracked only with Lapse or journal entries.
          </p>
        </div>
      </details>

      <details className="stack-faq-list__item">
        <summary>How should I journal my work?</summary>
        <div className="stack-faq-list__answer">
          <p>For each new feature, ideally around every hour of work:</p>
          <ul>
            <li>Take photos or screenshots of your improvements.</li>
            <li>Record quick update videos when useful.</li>
            <li>Write a brief description of what changed.</li>
            <li>Keep proof connected to your GitHub commits.</li>
          </ul>
        </div>
      </details>

      <details className="stack-faq-list__item">
        <summary>What do I need before shipping?</summary>
        <div className="stack-faq-list__answer">
          <p>Your shipped project needs:</p>
          <ul>
            <li>A public open-source GitHub page.</li>
            <li>Frequent commits, roughly every 30 minutes to 1 hour.</li>
            <li>A mandatory tracking system.</li>
            <li>A working live demo.</li>
          </ul>
          <p>
            You can read the full submission field explanation{" "}
            <a href="https://hackclub.gitbook.io/ysws-project-submission-guidelines/BLBRN8LIfoCZhFV6oMNR/required-submission-fields" target="_blank" rel="noreferrer">
              here
            </a>
            .
          </p>
        </div>
      </details>

      <details className="stack-faq-list__item">
        <summary>How many coins do I get per hour?</summary>
        <div className="stack-faq-list__answer">
          <p>You get 20 coins/bricks per approved hour.</p>
          <p>
            Only approved hours count. Rejected hours do not become coins, and activity before the official event start does
            not count unless an organizer gave you written permission.
          </p>
        </div>
      </details>

      <details className="stack-faq-list__item">
        <summary>Can art count toward my project?</summary>
        <div className="stack-faq-list__answer">
          <p>
            Yes, but only as an optional add-on to a base project. Art can count for up to an additional 15% of your base
            project hours.
          </p>
          <p>
            The art must meaningfully add to your existing project. Examples include assets, music/audio FX, drawings,
            Blender or 3D modeling, CAD, Figma, and video editing. Random unrelated drawings or general research do not
            count.
          </p>
          <p>
            If you are not sure, ask first in{" "}
            <a href="https://slack.com/archives/C0B6AFEA2J3" target="_blank" rel="noreferrer">
              #stack-help
            </a>
            .
          </p>
        </div>
      </details>

      <details className="stack-faq-list__item">
        <summary>Can I use AI?</summary>
        <div className="stack-faq-list__answer">
          <p>AI is allowed only as support, with a maximum of 30% of the codebase.</p>
          <p>Your project should still clearly be your own work and reviewers may reject hours that do not look justified.</p>
        </div>
      </details>

      <details className="stack-faq-list__item">
        <summary>Can I double-dip with other programs?</summary>
        <div className="stack-faq-list__answer">
          <p>No. Do not double-dip the same work or same hours with other programs.</p>
        </div>
      </details>

      <details className="stack-faq-list__item">
        <summary>What counts as fraud?</summary>
        <div className="stack-faq-list__answer">
          <p>
            Do not cheat the time tracking system. No bots, fake key presses, fake activity, or UI manipulation. If you do,
            you can be banned from Hackatime and other participating YSWS events/programs.
          </p>
        </div>
      </details>
    </div>
  );
}
