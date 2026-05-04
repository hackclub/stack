import platformBackground from "@assets/platform/main/bkg.png";
import profileFrame from "@assets/platform/main/pfp_bar_square.png";
import profilePicture from "@assets/platform/main/pfp.png";
import coinIcon from "@assets/platform/main/coin.png";
import heartsIcon from "@assets/platform/main/hearts.png";
import shelfBox from "@assets/platform/shop/shelfBox.png";
import shopCoin from "@assets/platform/shop/shop_coin.png";
import buyBtn from "@assets/platform/shop/buy_btn.png";
import backBtn from "@assets/platform/common/Back_btn.png";
import nextBtn from "@assets/platform/common/nextPg_btn.png";
import stackTitle from "@assets/platform/common/Stack_title.png";
import legoCharacter from "@assets/mainPage/section_2/legoChar_1.png";
import "./ShopPage.css";

const shopItems = [
  { name: "Plant Kit", cost: "12" },
  { name: "Retro Set", cost: "8" },
  { name: "Mug + Key", cost: "6" },
  { name: "Robot Box", cost: "7" },
  { name: "Game Pack", cost: "10" },
  { name: "Rocket Kit", cost: "14" },
];

export function ShopPage() {
  return (
    <main className="shop-page" aria-label="Shop page">
      <img className="shop-page__background" src={platformBackground} alt="" aria-hidden="true" />

      <section className="shop-page__status" aria-label="User status">
        <img className="shop-page__status-frame" src={profileFrame} alt="" aria-hidden="true" />
        <img className="shop-page__status-avatar" src={profilePicture} alt="User avatar" />
        <div className="shop-page__status-content">
          <div className="shop-page__status-row">
            <img className="shop-page__icon shop-page__icon--coin" src={coinIcon} alt="" aria-hidden="true" />
            <span className="shop-page__status-text">1234</span>
          </div>
          <div className="shop-page__status-row">
            <img className="shop-page__icon shop-page__icon--hearts" src={heartsIcon} alt="" aria-hidden="true" />
          </div>
        </div>
      </section>

      <section className="shop-page__left-panel" aria-label="Inspiration panel">
        <p className="shop-page__inspired">Be inspired!</p>
        <img src={legoCharacter} alt="" aria-hidden="true" />
      </section>

      <section className="shop-page__grid" aria-label="Shop items">
        {shopItems.map((item, index) => (
          <article className="shop-page__card" key={`${item.name}-${index}`}>
            <img className="shop-page__shelf" src={shelfBox} alt="" aria-hidden="true" />
            <div className="shop-page__placeholder">{item.name}</div>
            <button className="shop-page__buy" type="button" aria-label={`Buy ${item.name}`}>
              <img src={buyBtn} alt="" aria-hidden="true" />
            </button>
            <span className="shop-page__cost">
              <img src={shopCoin} alt="" aria-hidden="true" />
              <strong>{item.cost}</strong>
            </span>
          </article>
        ))}
      </section>

      <nav className="shop-page__nav" aria-label="Shop navigation">
        <a className="shop-page__back" href="/main" aria-label="Go back to main page">
          <img src={backBtn} alt="" aria-hidden="true" />
          <span>Back</span>
        </a>
        <a className="shop-page__next" href="/shop?page=2" aria-label="Go to next shop page">
          <img src={nextBtn} alt="" aria-hidden="true" />
        </a>
      </nav>

      <img className="shop-page__brand" src={stackTitle} alt="Stack" />
    </main>
  );
}
