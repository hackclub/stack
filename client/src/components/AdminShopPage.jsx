import { useEffect, useState } from "react";
import "./AdminShopPage.css";

const emptyForm = {
  name: "",
  price: "",
  priceUsd: "",
  dollarPerHour: "",
  maxPerPerson: "",
  itemLink: "",
  imageUrl: "",
  description: "",
  active: true,
};

export function AdminShopPage() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingItem, setEditingItem] = useState(null);
  const [showInactive, setShowInactive] = useState(true);
  const [status, setStatus] = useState("Loading shop items...");
  const [error, setError] = useState("");

  const visibleItems = showInactive ? items : items.filter((item) => item.active);

  useEffect(() => {
    loadItems();
  }, []);

  async function loadItems() {
    setStatus("Loading shop items...");
    setError("");
    try {
      const response = await fetch("/api/admin/shop/items", { credentials: "include" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to load shop items.");
      setItems(data.items || []);
      setStatus("");
    } catch (err) {
      setError(err.message);
      setStatus("");
    }
  }

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleAddItem(event) {
    event.preventDefault();
    setError("");
    try {
      const response = await fetch("/api/admin/shop/items", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to create item.");
      setForm(emptyForm);
      await loadItems();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleUpdateItem(event) {
    event.preventDefault();
    if (!editingItem) return;
    setError("");
    try {
      const response = await fetch(`/api/admin/shop/items/${editingItem.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingItem),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to update item.");
      setEditingItem(null);
      await loadItems();
    } catch (err) {
      setError(err.message);
    }
  }

  async function toggleItem(item) {
    const response = await fetch(`/api/admin/shop/items/${item.id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...item, active: !item.active }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Failed to update item.");
      return;
    }
    await loadItems();
  }

  async function deleteItem(item) {
    if (!window.confirm(`Delete ${item.name || "this item"}?`)) return;
    const response = await fetch(`/api/admin/shop/items/${item.id}`, {
      method: "DELETE",
      credentials: "include",
    });
    const data = response.headers.get("content-type")?.includes("application/json") ? await response.json() : {};
    if (!response.ok) {
      setError(data.error || "Failed to delete item.");
      return;
    }
    await loadItems();
  }

  async function bulkActive(active) {
    const response = await fetch("/api/admin/shop/items/bulk_active", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Failed to update items.");
      return;
    }
    await loadItems();
  }

  return (
    <main className="admin-shop-page">
      <section className="admin-shop-content">
        <a href="/admin" className="admin-shop-back">
          ← Admin Panel
        </a>
        <h1>Shop Admin</h1>

        <div className="admin-shop-orders-link">
          <a href="/admin/shop/orders">📦 Shop orders queue</a>
          <span>Fulfill purchases, refunds, and grouped pending lines.</span>
        </div>

        {error ? <p className="admin-shop-error">{error}</p> : null}
        {status ? <p>{status}</p> : null}

        <section className="admin-shop-card">
          <h2>Add New Item</h2>
          <ShopItemForm
            value={form}
            submitLabel="Add Item"
            onChange={updateForm}
            onSubmit={handleAddItem}
          />
        </section>

        <section className="admin-shop-card">
          <div className="admin-shop-table-header">
            <h2>Shop Items ({items.length})</h2>
            <div className="admin-shop-actions">
              <button type="button" onClick={() => bulkActive(true)}>
                Activate all
              </button>
              <button type="button" onClick={() => bulkActive(false)}>
                Deactivate all
              </button>
              <label>
                <input
                  type="checkbox"
                  checked={showInactive}
                  onChange={(event) => setShowInactive(event.target.checked)}
                />
                Show deactivated items
              </label>
            </div>
          </div>

          <div className="admin-shop-table-wrap">
            <table className="admin-shop-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Max / person</th>
                  <th>Coins</th>
                  <th>$ price</th>
                  <th>$/h</th>
                  <th>Link</th>
                  <th>Active</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleItems.length === 0 ? (
                  <tr>
                    <td colSpan="9">No shop items yet.</td>
                  </tr>
                ) : (
                  visibleItems.map((item) => (
                    <tr key={item.id} className={item.active ? "" : "is-inactive"}>
                      <td>{item.id}</td>
                      <td>{item.name || "—"}</td>
                      <td>{item.maxPerPerson ?? "None"}</td>
                      <td>{item.price ?? "—"}</td>
                      <td>{item.priceUsd ?? "—"}</td>
                      <td>{item.dollarPerHour ?? "—"}</td>
                      <td>{item.itemLink ? <a href={item.itemLink} target="_blank" rel="noreferrer">View</a> : "—"}</td>
                      <td>{item.active ? "Yes" : "No"}</td>
                      <td>
                        <div className="admin-shop-row-actions">
                          <button type="button" onClick={() => setEditingItem(item)}>
                            Modify
                          </button>
                          <button type="button" onClick={() => toggleItem(item)}>
                            {item.active ? "Deactivate" : "Activate"}
                          </button>
                          <button type="button" onClick={() => deleteItem(item)}>
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </section>

      {editingItem ? (
        <div className="admin-shop-modal" role="presentation" onClick={() => setEditingItem(null)}>
          <section role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <button className="admin-shop-modal-close" type="button" onClick={() => setEditingItem(null)}>
              ×
            </button>
            <h2>Modify Item</h2>
            <ShopItemForm
              value={editingItem}
              submitLabel="Save Item"
              onChange={(field, value) => setEditingItem((current) => ({ ...current, [field]: value }))}
              onSubmit={handleUpdateItem}
            />
          </section>
        </div>
      ) : null}
    </main>
  );
}

function ShopItemForm({ value, submitLabel, onChange, onSubmit }) {
  const coinValue = value.priceUsd ? Math.ceil(Number(value.priceUsd) * 10) : 0;

  return (
    <form className="admin-shop-form" onSubmit={onSubmit}>
      <label>
        Name *
        <input value={value.name || ""} onChange={(event) => onChange("name", event.target.value)} required />
      </label>
      <label>
        $ price *
        <input
          type="number"
          step="0.01"
          value={value.priceUsd || ""}
          onChange={(event) => onChange("priceUsd", event.target.value)}
        />
      </label>
      <label>
        $/h *
        <input
          type="number"
          step="0.01"
          value={value.dollarPerHour || ""}
          onChange={(event) => onChange("dollarPerHour", event.target.value)}
        />
      </label>
      <label>
        Coins
        <input type="number" value={coinValue || ""} readOnly />
      </label>
      <label>
        Max purchases per person
        <input type="number" value={value.maxPerPerson || ""} onChange={(event) => onChange("maxPerPerson", event.target.value)} />
      </label>
      <label>
        Item Link
        <input value={value.itemLink || ""} onChange={(event) => onChange("itemLink", event.target.value)} />
      </label>
      <label>
        Image URL
        <input value={value.imageUrl || ""} onChange={(event) => onChange("imageUrl", event.target.value)} />
      </label>
      <label>
        Active
        <input type="checkbox" checked={Boolean(value.active)} onChange={(event) => onChange("active", event.target.checked)} />
      </label>
      <label className="admin-shop-form-wide">
        Description
        <textarea value={value.description || ""} onChange={(event) => onChange("description", event.target.value)} />
      </label>

      <button type="submit">{submitLabel}</button>
    </form>
  );
}
