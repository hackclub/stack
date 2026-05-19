import { useEffect, useState } from "react";
import "./AdminShopPage.css";

export function AdminShopOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadOrders() {
      try {
        const response = await fetch("/api/admin/shop/orders");
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Failed to load orders.");
        setOrders(data.orders || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadOrders();
  }, []);

  async function markAsFulfilled(orderId) {
    try {
      const response = await fetch(`/api/admin/shop/orders/${orderId}/fulfill`, {
        method: "POST",
        credentials: "include",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to fulfill order.");

      setOrders((prev) =>
        prev.map((order) => (order.id === orderId ? { ...order, fulfilled: true } : order))
      );
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  }

  const groupedOrders = orders.reduce((acc, order) => {
    const key = order.email;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(order);
    return acc;
  }, {});

  const sortedEmails = Object.keys(groupedOrders).sort();

  return (
    <main className="admin-shop-page">
      <section className="admin-shop-content">
        <a href="/admin/shop" className="admin-shop-back">
          ← Shop catalog & items
        </a>
        <h1>Shop orders</h1>

        {error && <p className="admin-shop-error">{error}</p>}
        {loading && <p>Loading orders...</p>}

        {!loading && !error && orders.length === 0 && <p>No orders yet.</p>}

        {!loading && !error && orders.length > 0 && (
          <div className="admin-shop-orders">
            {sortedEmails.map((email) => (
              <div key={email} className="admin-shop-order-group">
                <h2>{email}</h2>
                <table className="admin-shop-orders-table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Quantity</th>
                      <th>Total Cost</th>
                      <th>Date</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupedOrders[email].map((order) => (
                      <tr key={order.id} className={order.fulfilled ? "fulfilled" : ""}>
                        <td>{order.itemName}</td>
                        <td className="text-center">{order.quantity}</td>
                        <td className="text-right">
                          {order.totalCoins} coins
                          {order.shippingTaxUsd ? ` (+$${order.shippingTaxUsd})` : ""}
                        </td>
                        <td>{new Date(order.createdAt).toLocaleDateString()}</td>
                        <td className="text-center">
                          <span className={`status-badge ${order.fulfilled ? "fulfilled" : "pending"}`}>
                            {order.fulfilled ? "Fulfilled" : "Pending"}
                          </span>
                        </td>
                        <td className="text-center">
                          {!order.fulfilled && (
                            <button
                              className="admin-shop-fulfill-btn"
                              onClick={() => markAsFulfilled(order.id)}
                            >
                              Mark Fulfilled
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
