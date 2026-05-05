import platformBackground from "@assets/platform/main/bkg.png";
import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext.jsx";
import { PlatformStatusBar } from "./PlatformStatusBar.jsx";
import shelfBox from "@assets/platform/shop/shelfBox.png";
import shopCoin from "@assets/platform/shop/shop_coin.png";
import buyBtn from "@assets/platform/shop/buy_btn.png";
import shopReference from "@assets/platform/shop/shop_reference.png";
import backBtn from "@assets/platform/common/Back_btn.png";
import nextBtn from "@assets/platform/common/nextPg_btn.png";
import stackTitle from "@assets/platform/common/Stack_title.png";
import legoCharacter from "@assets/mainPage/section_2/legoChar_1.png";
import "./ShopPage.css";

const shopItems = [
  {
    name: "Plant Kit",
    cost: "12",
    spriteX: 327,
    spriteY: 180,
    description: "A cozy desk bundle to brighten your build station.",
    shippingCost: "3",
  },
  {
    name: "Retro Set",
    cost: "8",
    spriteX: 501,
    spriteY: 188,
    description: "Classic throwback pieces with instant nostalgia.",
    shippingCost: "4",
  },
  {
    name: "Mug + Key",
    cost: "6",
    spriteX: 697,
    spriteY: 186,
    description: "A fun daily combo for coffee breaks and keys.",
    shippingCost: "2",
  },
  {
    name: "Robot Box",
    cost: "7",
    spriteX: 321,
    spriteY: 356,
    description: "A compact build set packed with motion and fun.",
    shippingCost: "5",
  },
  {
    name: "Game Pack",
    cost: "10",
    spriteX: 517,
    spriteY: 356,
    description: "A gamer-ready bundle for quick co-op energy.",
    shippingCost: "4",
  },
  {
    name: "Rocket Kit",
    cost: "14",
    spriteX: 706,
    spriteY: 345,
    description: "A launch-themed collector set for big dreamers.",
    shippingCost: "6",
  },
];

export function ShopPage() {
  const { user } = useAuth();
  const [selectedItem, setSelectedItem] = useState(null);

  useEffect(() => {
    function handleEscape(event) {
      if (event.key === "Escape") {
        setSelectedItem(null);
      }
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, []);

  return (
    <main className="shop-page" aria-label="Shop page">
      <img className="shop-page__background" src={platformBackground} alt="" aria-hidden="true" />

      <PlatformStatusBar user={user} />

      <section className="shop-page__left-panel" aria-label="Inspiration panel">
        <p className="shop-page__inspired">Be inspired!</p>
        <img src={legoCharacter} alt="" aria-hidden="true" />
      </section>

      <section className="shop-page__grid" aria-label="Shop items">
        {shopItems.map((item, index) => (
          <article className="shop-page__card" key={`${item.name}-${index}`}>
            <img className="shop-page__shelf" src={shelfBox} alt="" aria-hidden="true" />
            <div
              className="shop-page__item-art"
              role="img"
              aria-label={item.name}
              style={{
                backgroundImage: `url(${shopReference})`,
                backgroundPosition: `-${item.spriteX}px -${item.spriteY}px`,
              }}
            />
            <button
              className="shop-page__buy"
              type="button"
              aria-label={`Buy ${item.name}`}
              onClick={() => setSelectedItem(item)}
            >
              <img src={buyBtn} alt="" aria-hidden="true" />
            </button>
            <span className="shop-page__cost">
              <img src={shopCoin} alt="" aria-hidden="true" />
              <strong>{item.cost}</strong>
            </span>
          </article>
        ))}
      </section>

      <div className="shop-page__actions" aria-label="Shop pagination">
        <a className="shop-page__next" href="/shop?page=2" aria-label="Go to next shop page">
          <img src={nextBtn} alt="" aria-hidden="true" />
        </a>
      </div>

      <nav className="shop-page__nav" aria-label="Shop navigation">
        <a className="shop-page__back" href="/main" aria-label="Go back to main page">
          <img src={backBtn} alt="" aria-hidden="true" />
        </a>
      </nav>

      <img className="shop-page__brand" src={stackTitle} alt="Stack" />

      {selectedItem && (
        <div
          className="shop-page__modal-overlay"
          role="presentation"
          onClick={() => setSelectedItem(null)}
        >
          <section
            className="shop-page__modal"
            role="dialog"
            aria-modal="true"
            aria-label={`${selectedItem.name} details`}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="shop-page__modal-close"
              type="button"
              aria-label="Close item details"
              onClick={() => setSelectedItem(null)}
            >
              x
            </button>

            <div
              className="shop-page__modal-image"
              role="img"
              aria-label={selectedItem.name}
              style={{
                backgroundImage: `url(${shopReference})`,
                backgroundPosition: `-${selectedItem.spriteX}px -${selectedItem.spriteY}px`,
              }}
            />

            <h2 className="shop-page__modal-title">{selectedItem.name}</h2>
            <p className="shop-page__modal-description">{selectedItem.description}</p>

            <div className="shop-page__modal-price-row">
              <span>Price</span>
              <strong>{selectedItem.cost} coins</strong>
            </div>
            <div className="shop-page__modal-price-row">
              <span>Shipping</span>
              <strong>{selectedItem.shippingCost} coins</strong>
            </div>

            <button className="shop-page__modal-buy" type="button">
              Buy
            </button>
          </section>
        </div>
      )}
    </main>
  );
}
