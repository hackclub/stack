const platformBackground = "https://cdn.hackclub.com/019e3e5a-908f-707d-9790-91f9ec414045/bkg.png";
import { useEffect, useState } from "react";
import confetti from "canvas-confetti";
import { useAuth } from "../auth/AuthContext.jsx";
import { PlatformStatusBar } from "./PlatformStatusBar.jsx";
const shelfBox = "https://cdn.hackclub.com/019e3e5a-a3a2-7a84-90e5-43d56ce44873/shelfBox.png";
const shopCoin = "https://cdn.hackclub.com/019e3e5a-a63b-7b9d-84e1-1d78a8320ab7/shop_coin.png";
const buyBtn = "https://cdn.hackclub.com/019e3e5a-a103-7306-8df6-e6cd08b537ef/buy_btn.png";
const shopReference = "https://cdn.hackclub.com/019e3e5a-a8f3-7ba8-99e4-a1753d28f633/shop_reference.png";
const backBtn = "https://cdn.hackclub.com/019e3e5a-8541-7927-b209-5cca8c932fe6/Back_btn.png";
const nextBtn = "https://cdn.hackclub.com/019e3e5a-8982-762d-a87b-ab579f292394/nextPg_btn.png";
const stackTitle = "https://cdn.hackclub.com/019e3e5a-8745-7bee-a1ab-07b5743f98c7/Stack_title.png";
const legoCharacter = "https://cdn.hackclub.com/019e3e5a-6d71-79f0-9633-8668b69f464d/legoChar_1.png";
import "./ShopPage.css";

export function ShopPage() {
  const { user, reload } = useAuth();
  const [shopItems, setShopItems] = useState([]);
  const [status, setStatus] = useState("Loading shop items...");
  const [error, setError] = useState("");
  const [purchaseMessage, setPurchaseMessage] = useState("");
  const [selectedItem, setSelectedItem] = useState(null);
  const [purchaseQuantity, setPurchaseQuantity] = useState(1);
  const [shippingTaxUsd, setShippingTaxUsd] = useState("");
  const [rulesAccepted, setRulesAccepted] = useState(false);

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

  function openItem(item) {
    setSelectedItem(item);
    setPurchaseQuantity(1);
    setShippingTaxUsd("");
    setRulesAccepted(false);
    setPurchaseMessage("");
  }

  const baseBricks = selectedItem?.price ? Number(selectedItem.price) : 0;
  const quantity = Math.max(1, Number(purchaseQuantity) || 1);
  const shippingBricks = shippingTaxUsd ? Math.ceil(Number(shippingTaxUsd) * 10) : 0;
  const totalBricks = baseBricks * quantity + (Number.isFinite(shippingBricks) ? shippingBricks : 0);
  const userBricks = Number(user?.bricks ?? 0);
  const hasEnoughBricks = userBricks >= totalBricks;

  async function buySelectedItem() {
    if (!selectedItem || !rulesAccepted || !hasEnoughBricks) return;

    setPurchaseMessage("");
    try {
      const response = await fetch(`/api/shop/items/${selectedItem.id}/buy`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quantity,
          shippingTaxUsd: shippingTaxUsd || 0,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to buy item.");

      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });

      setPurchaseMessage(`Bought ${selectedItem.name}! Remaining balance: ${Math.floor(data.purchase.userBricks)} bricks.`);
      await reload?.();

      setTimeout(() => {
        setSelectedItem(null);
      }, 2000);
    } catch (err) {
      setPurchaseMessage(err.message);
    }
  }

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
              onClick={() => openItem(item)}
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
              <span>Item price</span>
              <strong>{selectedItem.price ?? "0"} bricks</strong>
            </div>
            <div className="shop-page__modal-price-row">
              <span>USD value</span>
              <strong>${selectedItem.priceUsd ?? "—"}</strong>
            </div>
            {selectedItem.maxPerPerson ? (
              <div className="shop-page__modal-price-row">
                <span>Limit</span>
                <strong>{selectedItem.maxPerPerson} per person</strong>
              </div>
            ) : null}

            {selectedItem.itemLink ? (
              <a className="shop-page__modal-link" href={selectedItem.itemLink} target="_blank" rel="noreferrer">
                View item link
              </a>
            ) : null}

            <label className="shop-page__modal-field">
              <span>Quantity</span>
              <input
                type="number"
                min="1"
                max={selectedItem.maxPerPerson || undefined}
                value={purchaseQuantity}
                onChange={(event) => setPurchaseQuantity(event.target.value)}
              />
            </label>

            <label className="shop-page__modal-field">
              <span>Shipping/Tax $ <small>(optional, USD)</small></span>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0"
                value={shippingTaxUsd}
                onChange={(event) => setShippingTaxUsd(event.target.value)}
              />
            </label>

            <div className="shop-page__modal-rules">
              <strong>Shop Rules</strong>
              <p>
                Fulfillment will be provided as a grant/card to buy this prize. If shipping, customs, or taxes cost extra,
                add the extra USD amount above before purchase.
              </p>
              <label>
                <input
                  type="checkbox"
                  checked={rulesAccepted}
                  onChange={(event) => setRulesAccepted(event.target.checked)}
                />
                I have read the shop rules and understand the conditions.
              </label>
            </div>

            <div className="shop-page__modal-total">
              <span>Total</span>
              <strong>{totalBricks} bricks</strong>
            </div>

            {!hasEnoughBricks ? (
              <p className="shop-page__modal-warning">
                Not enough bricks. You have {Math.floor(userBricks)} bricks, but this costs {totalBricks}.
              </p>
            ) : null}
            {purchaseMessage ? <p className="shop-page__modal-warning">{purchaseMessage}</p> : null}

            <button className="shop-page__modal-buy" type="button" disabled={!rulesAccepted || !hasEnoughBricks} onClick={buySelectedItem}>
              Buy
            </button>
          </section>
        </div>
      )}
    </main>
  );
}
