import "./AdminShopPage.css";

export function AdminShopOrdersPage() {
  return (
    <main className="admin-shop-page">
      <section className="admin-shop-content">
        <a href="/admin/shop" className="admin-shop-back">
          ← Shop catalog & items
        </a>
        <h1>Shop orders</h1>
        <section className="admin-shop-card">
          <p>
            Order fulfillment is part of the Jackpot shop structure, but this Stack platform does not have a
            <code> shop_orders </code>
            table yet.
          </p>
          <p>
            Once purchases are wired up, this page can use the same queue/status structure from Jackpot against the
            current database.
          </p>
        </section>
      </section>
    </main>
  );
}
