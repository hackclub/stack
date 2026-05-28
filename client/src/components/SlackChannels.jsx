import "./SlackChannels.css";

export function SlackChannels({ className = "" }) {
  return (
    <section className={`stack-slack-channels ${className}`.trim()} aria-labelledby="slack-channels-heading">
      <h2 id="slack-channels-heading">Slack Channels</h2>
      <div className="stack-slack-channels__links">
        <a href="https://slack.com/archives/C0B6AFEA2J3" target="_blank" rel="noreferrer">
          Help channel
        </a>
        <a href="https://hackclub.enterprise.slack.com/archives/C0B6PSX2YR4" target="_blank" rel="noreferrer">
          Important updates channel
        </a>
        <a href="https://hackclub.enterprise.slack.com/archives/C0B6RUQJ1EW" target="_blank" rel="noreferrer">
          Just chatting channel
        </a>
      </div>
    </section>
  );
}
