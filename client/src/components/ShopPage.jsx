const platformBackground = "https://cdn.hackclub.com/019e3e5a-908f-707d-9790-91f9ec414045/bkg.png";
import { useEffect, useState } from "react";
import confetti from "canvas-confetti";
import { useAuth } from "../auth/AuthContext.jsx";
import { PlatformStatusBar } from "./PlatformStatusBar.jsx";
import { DeadlineCountdown, useDeadlineState } from "./DeadlineCountdown.jsx";
import { SHOP_CLOSE_MS, SHOP_CLOSED_MESSAGE } from "../utils/eventDeadlines.js";
const shelfBox = "https://cdn.hackclub.com/019e3e5a-a3a2-7a84-90e5-43d56ce44873/shelfBox.png";
const shopCoin = "https://cdn.hackclub.com/019e3e5a-a63b-7b9d-84e1-1d78a8320ab7/shop_coin.png";
const buyBtn = "https://cdn.hackclub.com/019e3e5a-a103-7306-8df6-e6cd08b537ef/buy_btn.png";
const shopReference = "https://cdn.hackclub.com/019e3e5a-a8f3-7ba8-99e4-a1753d28f633/shop_reference.png";
const backBtn = "https://cdn.hackclub.com/019e3e5a-8541-7927-b209-5cca8c932fe6/Back_btn.png";
const stackTitle = "https://cdn.hackclub.com/019e3e5a-8745-7bee-a1ab-07b5743f98c7/Stack_title.png";
const legoCharacter = "https://cdn.hackclub.com/019e3e5a-6d71-79f0-9633-8668b69f464d/legoChar_1.png";
import "./ShopPage.css";

function formatBricks(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.round(numeric).toString() : "0";
}

function formatDiscount(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return Math.round(numeric);
}

export function ShopPage() {
  const { user, reload } = useAuth();
  const [shopItems, setShopItems] = useState([]);
  const [status, setStatus] = useState("Loading shop items...");
  const [error, setError] = useState("");
  const [purchaseMessage, setPurchaseMessage] = useState("");
  const [selectedItem, setSelectedItem] = useState(null);
  const [purchaseQuantity, setPurchaseQuantity] = useState(1);
  const [showPurchaseConfirm, setShowPurchaseConfirm] = useState(false);
  const [isFromUsa, setIsFromUsa] = useState(false);
  const { isOpen: shopOpen } = useDeadlineState(SHOP_CLOSE_MS);

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
    setShowPurchaseConfirm(false);
    setIsFromUsa(false);
    setPurchaseMessage("");
  }

  const baseBricks = selectedItem?.price ? Number(selectedItem.price) : 0;
  const quantity = Math.max(1, Number(purchaseQuantity) || 1);
  const totalBricks = baseBricks * quantity;
  const userBricks = Number(user?.bricks ?? 0);
  const hasEnoughBricks = userBricks >= totalBricks;

  async function buySelectedItem() {
    if (!selectedItem || !hasEnoughBricks || !shopOpen) return;

    setPurchaseMessage("");
    try {
      const response = await fetch(`/api/shop/items/${selectedItem.id}/buy`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quantity,
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
      setShowPurchaseConfirm(false);
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
        if (showPurchaseConfirm) {
          setShowPurchaseConfirm(false);
        } else {
          setSelectedItem(null);
        }
      }
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [showPurchaseConfirm]);

  return (
    <main className="shop-page" aria-label="Shop page">
      <img className="shop-page__background" src={platformBackground} alt="" aria-hidden="true" />

      <PlatformStatusBar user={user} />

      <DeadlineCountdown
        label="Shop"
        deadlineMs={SHOP_CLOSE_MS}
        layout="banner"
        className="shop-page__deadline"
      />

      <section className="shop-page__left-panel" aria-label="Inspiration panel">
        <p className="shop-page__inspired">1 hour = 20 Coins!</p>
        <img src={legoCharacter} alt="" aria-hidden="true" />
      </section>

      <section className="shop-page__grid" aria-label="Shop items">
        {status ? <p className="shop-page__status">{status}</p> : null}
        {error ? <p className="shop-page__status shop-page__status--error">{error}</p> : null}
        {!status && !error && shopItems.length === 0 ? <p className="shop-page__status">No shop items yet.</p> : null}
        {shopItems.map((item, index) => {
          const discount = formatDiscount(item.discountPercent);
          return (
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
              {discount ? <span className="shop-page__discount">{discount}% off!</span> : null}
              <button
                className="shop-page__buy"
                type="button"
                aria-label={`Buy ${item.name}`}
                disabled={!shopOpen}
                title={shopOpen ? `Buy ${item.name}` : SHOP_CLOSED_MESSAGE}
                onClick={() => openItem(item)}
              >
                <img src={buyBtn} alt="" aria-hidden="true" />
              </button>
              <span className="shop-page__cost">
                <img src={shopCoin} alt="" aria-hidden="true" />
                <strong>{formatBricks(item.price)}</strong>
              </span>
            </article>
          );
        })}
      </section>

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
              <strong>{formatBricks(selectedItem.price)} bricks</strong>
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

            <div className="shop-page__modal-total">
              <span>Total</span>
              <strong>{formatBricks(totalBricks)} bricks</strong>
            </div>

            {!hasEnoughBricks ? (
              <p className="shop-page__modal-warning">
                Not enough bricks. You have {Math.floor(userBricks)} bricks, but this costs {formatBricks(totalBricks)}.
              </p>
            ) : null}
            {purchaseMessage ? <p className="shop-page__modal-warning">{purchaseMessage}</p> : null}
            {!shopOpen ? <p className="shop-page__modal-warning">{SHOP_CLOSED_MESSAGE}</p> : null}

            <button
              className="shop-page__modal-buy"
              type="button"
              disabled={!hasEnoughBricks || !shopOpen}
              onClick={() => setShowPurchaseConfirm(true)}
            >
              Buy
            </button>

            {showPurchaseConfirm ? (
              <div className="shop-page__confirm-backdrop" role="presentation" onClick={() => setShowPurchaseConfirm(false)}>
                <section
                  className="shop-page__confirm"
                  role="dialog"
                  aria-modal="true"
                  aria-label="Confirm purchase"
                  onClick={(event) => event.stopPropagation()}
                >
                  <button
                    className="shop-page__modal-close"
                    type="button"
                    aria-label="Close purchase confirmation"
                    onClick={() => setShowPurchaseConfirm(false)}
                  >
                    x
                  </button>
                  <h3>Confirm purchase</h3>
                  <label className="shop-page__confirm-toggle">
                    <input
                      type="checkbox"
                      checked={isFromUsa}
                      onChange={(event) => setIsFromUsa(event.target.checked)}
                    />
                    <span>I'm from USA</span>
                  </label>
                  <p>
                    {isFromUsa ? (
                      <>
                        The gift card will be issued through the{" "}
                        <a href="https://www.lego.com/en-us/gift-cards/buy" target="_blank" rel="noreferrer">
                          official LEGO online store
                        </a>{" "}
                        and delivered to your address. If the physical delivery doesn’t work out, we’ll instead provide a virtual gift card from the website.
                      </>
                    ) : (
                      <>
                        The Gift card will be issued virtually on the{" "}
                        <a href="https://www.lego.com/en-us/gift-cards/buy" target="_blank" rel="noreferrer">
                          official LEGO online store
                        </a>
                        . If the activation turns out not to work, we'll issue an{" "}
                        <a href="https://hcb.hackclub.com/" target="_blank" rel="noreferrer">
                          HCB grant
                        </a>{" "}
                        (prepaid Hack Club virtual card), which you can use to buy the same item in your country
                      </>
                    )}
                  </p>
                  <div className="shop-page__confirm-total">
                    {formatBricks(totalBricks)} bricks
                  </div>
                  <button className="shop-page__modal-buy" type="button" disabled={!shopOpen} onClick={buySelectedItem}>
                    Confirm purchase
                  </button>
                </section>
              </div>
            ) : null}
          </section>
        </div>
      )}
    </main>
  );
}
