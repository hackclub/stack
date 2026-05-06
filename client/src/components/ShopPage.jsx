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

export function ShopPage() {
  const { user } = useAuth();
  const [shopItems, setShopItems] = useState([]);
  const [status, setStatus] = useState("Loading shop items...");
  const [error, setError] = useState("");
  const [selectedItem, setSelectedItem] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function loadShopItems() {
      try {
        const response = await fetch("/api/shop/items");
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Failed to load shop items.");
        if (isMounted) {
          setShopItems(data.items || []);
          setStatus("");
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message);
          setStatus("");
        }
      }
    }

    loadShopItems();
    return () => {
      isMounted = false;
    };
  }, []);

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
        {status ? <p className="shop-page__status">{status}</p> : null}
        {error ? <p className="shop-page__status shop-page__status--error">{error}</p> : null}
        {!status && !error && shopItems.length === 0 ? <p className="shop-page__status">No shop items yet.</p> : null}
        {shopItems.map((item, index) => (
          <article className="shop-page__card" key={item.id ?? `${item.name}-${index}`}>
            <img className="shop-page__shelf" src={shelfBox} alt="" aria-hidden="true" />
            {item.imageUrl ? (
              <img className="shop-page__item-image" src={item.imageUrl} alt={item.name || "Shop item"} />
            ) : (
              <div
                className="shop-page__item-art"
                role="img"
                aria-label={item.name}
                style={{
                  backgroundImage: `url(${shopReference})`,
                  backgroundPosition: `-${327 + (index % 3) * 185}px -${180 + Math.floor(index / 3) * 170}px`,
                }}
              />
            )}
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
              <strong>{item.price ?? "0"}</strong>
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

            {selectedItem.imageUrl ? (
              <img className="shop-page__modal-image-img" src={selectedItem.imageUrl} alt={selectedItem.name || "Shop item"} />
            ) : (
              <div className="shop-page__modal-image" role="img" aria-label={selectedItem.name} />
            )}

            <h2 className="shop-page__modal-title">{selectedItem.name}</h2>
            <p className="shop-page__modal-description">{selectedItem.description}</p>

            <div className="shop-page__modal-price-row">
              <span>Price</span>
              <strong>{selectedItem.price ?? "0"} coins</strong>
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
