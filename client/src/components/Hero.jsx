import brandingLogo from "@assets/mainPage/section_1/branding_logo.png";
import toolbar from "@assets/mainPage/section_1/toolbar.png";
import block1 from "@assets/mainPage/section_1/block_1.png";
import block2 from "@assets/mainPage/section_1/block_2.png";
import arrow from "@assets/mainPage/section_1/arrow.png";
import miniLogo1 from "@assets/mainPage/section_1/miniLogo_1.png";
import miniLogo2 from "@assets/mainPage/section_1/miniLogo_2.png";
import stackTitle from "@assets/mainPage/section_1/Stack_title.png";
import pageBkg from "@assets/mainPage/Bkg.png";
import shelf from "@assets/mainPage/section_2/Shelf.png";
import joinButton from "@assets/mainPage/section_2/join_btn.png";
import legoChar1 from "@assets/mainPage/section_2/legoChar_1.png";
import shopButton from "@assets/mainPage/section_2/shop_btn.png";
import sectionThreeChar2 from "@assets/mainPage/section_3/Char2.png";
import sectionThreeChar3 from "@assets/mainPage/section_3/Char3.png";
import sectionThreeProject1 from "@assets/mainPage/section_3/prj1.png";
import sectionThreeProject2 from "@assets/mainPage/section_3/prj2.png";
import sectionThreeProject3 from "@assets/mainPage/section_3/prj3.png";
import faqText from "@assets/mainPage/section_4/faq_txt.png";
import { BrickModel } from "./BrickModel.jsx";
import "./Hero.css";

export function Hero() {
  return (
    <section className="hero" aria-label="Stack hero">
      <img
        className="hero__page-bkg"
        src={pageBkg}
        alt=""
        aria-hidden="true"
        width={512}
        height={1024}
      />

      <div className="hero__shell">
        <header className="hero__header">
          <a
            href="https://hackclub.com"
            aria-label="Go to Hack Club"
            target="_blank"
            rel="noopener noreferrer"
          >
            <img
              className="hero__brand"
              src={brandingLogo}
              width={130}
              height={72}
              alt="Hack Club"
            />
          </a>

          <nav className="hero__nav" aria-label="Primary">
            <img className="hero__nav-bg" src={toolbar} alt="" width={420} height={56} />
            <div className="hero__nav-links">
              <a href="#build">Build</a>
              <a href="#prizes">Prizes</a>
              <a href="#learn">Learn</a>
            </div>
          </nav>

          <div className="hero__blocks">
            <img src={block1} width={260} height={120} alt="Code fun projects" />
            <img src={block2} width={260} height={120} alt="Get free LEGO sets" />
          </div>
        </header>

        <div className="hero__main">
          <div className="hero__copy">
            <div className="hero__lead">
              <h1 className="hero__headline">
                <span className="line--cream">Code.</span>
                <span className="line--red">Build.</span>
                <span className="line--cream">Get LEGO.</span>
              </h1>
            </div>
            <div className="hero__cta">
              <img
                className="hero__arrow"
                src={arrow}
                width={120}
                height={120}
                alt=""
                aria-hidden="true"
              />
              <p className="hero__build-now">
                <span className="word-build">Build </span>
                <span className="word-now">Now!</span>
              </p>
            </div>
          </div>

          <div className="hero__visual">
            <img
              className="hero__float hero__float--slash"
              src={miniLogo1}
              alt=""
              aria-hidden="true"
            />
            <img
              className="hero__float hero__float--brace"
              src={miniLogo2}
              alt=""
              aria-hidden="true"
            />
            <BrickModel />
          </div>

          <img
            className="hero__stack-title"
            src={stackTitle}
            width={420}
            height={120}
            alt="Stack"
          />
        </div>
      </div>

      <section className="section-two" aria-labelledby="section-two-heading">
        <h2 id="section-two-heading" className="section-two__headline">
          <span>Create a </span>
          <span className="text-yellow">fun</span>
          <span> open-source program,</span>
          <br />
          <span>get a </span>
          <span className="text-red">free LEGO sets</span>
          <span> of your choice</span>
        </h2>

        <div className="section-two__shelf">
          <img className="section-two__shelf-image" src={shelf} width={768} height={640} alt="Shelf of LEGO prizes" />
          <a className="section-two__shop" href="URL/shop" aria-label="See the full prize listing">
            <img src={shopButton} width={536} height={113} alt="See the full listing..." />
          </a>
        </div>

        <a className="section-two__join" href="URL/main" aria-label="Join Stack">
          <img src={joinButton} width={580} height={300} alt="Join!" />
        </a>

        <img
          className="section-two__character"
          src={legoChar1}
          width={510}
          height={720}
          alt="LEGO character holding a laptop"
        />

        <p className="section-two__footer">
          The goal isn’t to be <span className="text-yellow">useful </span>or{" "}
          <span className="text-yellow">perfect</span>
        </p>
      </section>

      <section className="section-bridge" aria-label="Section transition message">
        <p className="section-bridge__line section-bridge__line--one">
          The goal isn’t to be <span className="text-yellow">useful</span> or
          <br />
          <span className="text-yellow">perfect</span>
        </p>

        <p className="section-bridge__line section-bridge__line--two">
          but to make people <span className="text-red">laugh</span>,
          <br />
          surprise them
        </p>

        <p className="section-bridge__line section-bridge__line--three">
          or simply create something
          <br />
          <span className="text-yellow">stupid</span> but brilliant.
        </p>

        <p className="section-bridge__limits">
          There are <span className="text-red">no limits</span>...
        </p>
      </section>

      <section className="section-three" aria-label="Project examples">
        <a
          href="https://what-the-duck-ten.vercel.app/"
          aria-label="Open joke website example"
          target="_blank"
          rel="noopener noreferrer"
        >
          <img
            className="section-three__asset section-three__project section-three__project--jokes"
            src={sectionThreeProject1}
            width={772}
            height={555}
            alt="Joke Websites project example"
          />
        </a>
        <img
          className="section-three__asset section-three__character section-three__character--player"
          src={sectionThreeChar2}
          width={820}
          height={837}
          alt="LEGO character holding a game controller"
        />
        <a
          href="https://fatsermint.itch.io/food-delivery"
          aria-label="Open absurd game example"
          target="_blank"
          rel="noopener noreferrer"
        >
          <img
            className="section-three__asset section-three__project section-three__project--games"
            src={sectionThreeProject2}
            width={716}
            height={536}
            alt="Absurd games project example"
          />
        </a>
        <a
          href="https://youtu.be/M7OH803nQkw?si=8bFbovESammWmdY8"
          aria-label="Open little robots example video"
          target="_blank"
          rel="noopener noreferrer"
        >
          <img
            className="section-three__asset section-three__project section-three__project--robots"
            src={sectionThreeProject3}
            width={729}
            height={591}
            alt="Chaotic little robots project example"
          />
        </a>
        <img
          className="section-three__asset section-three__character section-three__character--builder"
          src={sectionThreeChar3}
          width={782}
          height={782}
          alt="LEGO character building with a robot"
        />
      </section>

      <section className="section-four" aria-labelledby="faq-heading">
        <div className="section-four__faq-strip" aria-hidden="true">
          <img className="section-four__faq-title section-four__faq-title--left" src={faqText} width={623} height={380} alt="" />
          <img className="section-four__faq-title section-four__faq-title--center" src={faqText} width={623} height={380} alt="" />
          <img className="section-four__faq-title section-four__faq-title--right" src={faqText} width={623} height={380} alt="" />
        </div>

        <h2 id="faq-heading" className="section-four__heading">
          FAQ
        </h2>

        <div className="section-four__questions">
          <button className="section-four__question" type="button">
            What can I build for Stack?
          </button>
          <button className="section-four__question" type="button">
            How do I submit my project?
          </button>
          <button className="section-four__question" type="button">
            When do I get my LEGO set?
          </button>
        </div>
      </section>
    </section>
  );
}
