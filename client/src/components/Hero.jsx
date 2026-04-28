import brandingLogo from "@assets/mainPage/section_1/branding_logo.png";
import toolbar from "@assets/mainPage/section_1/toolbar.png";
import block1 from "@assets/mainPage/section_1/block_1.png";
import block2 from "@assets/mainPage/section_1/block_2.png";
import arrow from "@assets/mainPage/section_1/arrow.png";
import miniLogo1 from "@assets/mainPage/section_1/miniLogo_1.png";
import miniLogo2 from "@assets/mainPage/section_1/miniLogo_2.png";
import stackTitle from "@assets/mainPage/section_1/Stack_title.png";
import pageBkg from "@assets/mainPage/Bkg.png";
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
          <img
            className="hero__brand"
            src={brandingLogo}
            width={130}
            height={72}
            alt="Hack Club"
          />

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
    </section>
  );
}
