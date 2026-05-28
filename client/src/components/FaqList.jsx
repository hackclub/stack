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
          </ul>
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
    </div>
  );
}
