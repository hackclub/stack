import { pool } from "./db.js";

const SHOP_ITEM_COLUMNS = [
  "name",
  "price",
  "item_link",
  "image_url",
  "description",
  "active",
  "created_at",
  "updated_at",
  "max_per_person",
  "price_usd",
  "dollar_per_hour",
  "discount_percent",
  "airtable_id",
  "synced_at",
];

const REMOVED_SHOP_ITEM_COLUMNS = [
  "category",
  "grant_type",
  "shop_grant_type_id",
  "item_quantity",
  "shipping_tax_cents",
  "position",
];

const REMOVED_SHOP_ORDER_COLUMNS = ["total_coins"];

export async function ensureShopItemsTable() {
  if (!pool) {
    console.warn("[shop] DATABASE_URL not set; skipping shop_items table setup.");
    return;
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS shop_items (
      id BIGSERIAL PRIMARY KEY,
      name VARCHAR,
      price NUMERIC(10, 2),
      item_link VARCHAR,
      image_url VARCHAR,
      description TEXT,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP(6) WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP(6) WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
      max_per_person INTEGER,
      price_usd NUMERIC(10, 2),
      dollar_per_hour NUMERIC(10, 2),
      discount_percent NUMERIC(5, 2),
      airtable_id VARCHAR,
      synced_at DATE
    )
  `);

  for (const column of SHOP_ITEM_COLUMNS) {
    await ensureShopItemColumn(column);
  }

  await pool.query(`
    UPDATE shop_items
    SET price = CEIL(price_usd * 10)
    WHERE price_usd IS NOT NULL
      AND (price IS NULL OR price != CEIL(price_usd * 10))
  `);

  for (const column of REMOVED_SHOP_ITEM_COLUMNS) {
    await pool.query(`ALTER TABLE shop_items DROP COLUMN IF EXISTS ${column}`);
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS shop_orders (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      item_id BIGINT NOT NULL REFERENCES shop_items(id) ON DELETE CASCADE,
      quantity INTEGER NOT NULL DEFAULT 1,
      shipping_tax_usd NUMERIC(10, 2),
      total_bricks NUMERIC(10, 2) NOT NULL,
      fulfilled BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP(6) WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP(6) WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 1
  `);
  await pool.query(`
    ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS shipping_tax_usd NUMERIC(10, 2)
  `);
  await pool.query(`
    ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS total_bricks NUMERIC(10, 2) NOT NULL DEFAULT 0
  `);
  await pool.query(`
    ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS fulfilled BOOLEAN NOT NULL DEFAULT FALSE
  `);
  await pool.query(`
    ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS rejected BOOLEAN NOT NULL DEFAULT FALSE
  `);
  await pool.query(`
    ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP(6) WITHOUT TIME ZONE
  `);
  await pool.query(`
    ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP(6) WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
  `);

  for (const column of REMOVED_SHOP_ORDER_COLUMNS) {
    await pool.query(`ALTER TABLE shop_orders DROP COLUMN IF EXISTS ${column}`);
  }
}

async function ensureShopItemColumn(column) {
  const columnDefinitions = {
    name: "VARCHAR",
    price: "NUMERIC(10, 2)",
    item_link: "VARCHAR",
    image_url: "VARCHAR",
    description: "TEXT",
    active: "BOOLEAN NOT NULL DEFAULT TRUE",
    created_at: "TIMESTAMP(6) WITHOUT TIME ZONE NOT NULL DEFAULT NOW()",
    updated_at: "TIMESTAMP(6) WITHOUT TIME ZONE NOT NULL DEFAULT NOW()",
    max_per_person: "INTEGER",
    price_usd: "NUMERIC(10, 2)",
    dollar_per_hour: "NUMERIC(10, 2)",
    discount_percent: "NUMERIC(5, 2)",
    airtable_id: "VARCHAR",
    synced_at: "DATE",
  };

  await pool.query(`ALTER TABLE shop_items ADD COLUMN IF NOT EXISTS ${column} ${columnDefinitions[column]}`);
}

export async function listShopItems({ includeInactive = false } = {}) {
  if (!pool) throw new Error("DATABASE_URL is not set.");

  const where = includeInactive ? "" : "WHERE active IS TRUE";
  const result = await pool.query(`
    SELECT *
    FROM shop_items
    ${where}
    ORDER BY created_at DESC, id DESC
  `);
  return result.rows.map(toPublicShopItem);
}

export async function createShopItem(input) {
  if (!pool) throw new Error("DATABASE_URL is not set.");

  const values = normalizeShopItemInput(input);
  const result = await pool.query(
    `
      INSERT INTO shop_items (
        name, price, item_link, image_url, description, active, max_per_person,
        price_usd, dollar_per_hour, discount_percent, airtable_id, synced_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12
      )
      RETURNING *
    `,
    shopItemValues(values)
  );
  return toPublicShopItem(result.rows[0]);
}

export async function updateShopItem(id, input) {
  if (!pool) throw new Error("DATABASE_URL is not set.");

  const values = normalizeShopItemInput(input);
  const result = await pool.query(
    `
      UPDATE shop_items
      SET
        name = $1,
        price = $2,
        item_link = $3,
        image_url = $4,
        description = $5,
        active = $6,
        max_per_person = $7,
        price_usd = $8,
        dollar_per_hour = $9,
        discount_percent = $10,
        airtable_id = $11,
        synced_at = $12,
        updated_at = NOW()
      WHERE id = $13
      RETURNING *
    `,
    [...shopItemValues(values), id]
  );

  return result.rows[0] ? toPublicShopItem(result.rows[0]) : null;
}

export async function deleteShopItem(id) {
  if (!pool) throw new Error("DATABASE_URL is not set.");
  const result = await pool.query("DELETE FROM shop_items WHERE id = $1", [id]);
  return result.rowCount > 0;
}

export async function setAllShopItemsActive(active) {
  if (!pool) throw new Error("DATABASE_URL is not set.");
  await pool.query("UPDATE shop_items SET active = $1, updated_at = NOW()", [Boolean(active)]);
}

export async function purchaseShopItemForUser(userId, itemId, input = {}) {
  if (!pool) throw new Error("DATABASE_URL is not set.");

  const quantity = Math.max(1, integerOrNull(input.quantity) || 1);
  const shippingTaxUsd = Math.max(0, numberOrNull(input.shippingTaxUsd ?? input.shipping_tax_usd) || 0);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const itemResult = await client.query(
      `
        SELECT *
        FROM shop_items
        WHERE id = $1
          AND active IS TRUE
        FOR UPDATE
      `,
      [itemId]
    );
    const item = itemResult.rows[0];
    if (!item) throw new Error("Shop item not found.");

    if (item.max_per_person && quantity > item.max_per_person) {
      throw new Error(`Limit is ${item.max_per_person} per person.`);
    }

    const itemBricks = Number(item.price ?? 0);
    const shippingBricks = Math.ceil(shippingTaxUsd * 10);
    const totalBricks = itemBricks * quantity + shippingBricks;

    const userResult = await client.query(
      `
        UPDATE users
        SET bricks = bricks - $1,
            updated_at = NOW()
        WHERE id = $2
          AND bricks >= $1
        RETURNING id, bricks
      `,
      [totalBricks, userId]
    );

    if (!userResult.rows[0]) {
      const currentUser = await client.query("SELECT bricks FROM users WHERE id = $1", [userId]);
      const availableBricks = Number(currentUser.rows[0]?.bricks ?? 0);
      throw new Error(`Not enough bricks. You have ${Math.floor(availableBricks)} bricks, but this costs ${totalBricks}.`);
    }

    const orderResult = await client.query(
      `
        INSERT INTO shop_orders (user_id, item_id, quantity, shipping_tax_usd, total_bricks)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `,
      [userId, itemId, quantity, shippingTaxUsd || null, totalBricks]
    );

    await client.query("COMMIT");

    return {
      item: toPublicShopItem(item),
      quantity,
      shippingTaxUsd,
      totalBricks,
      userBricks: Number(userResult.rows[0].bricks ?? 0),
      orderId: orderResult.rows[0].id,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function safeHttpUrl(value) {
  const text = textOrNull(value);
  if (!text) return null;
  try {
    const parsed = new URL(text);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error(`URL must use http or https (got ${parsed.protocol})`);
    }
    return text;
  } catch (e) {
    throw new Error(e.message || "Invalid URL.");
  }
}

function normalizeShopItemInput(input = {}) {
  const priceUsd = numberOrNull(input.priceUsd ?? input.price_usd);
  return {
    name: textOrNull(input.name),
    price: priceUsd === null ? integerOrNull(input.price) : Math.ceil(priceUsd * 10),
    itemLink: safeHttpUrl(input.itemLink ?? input.item_link),
    imageUrl: safeHttpUrl(input.imageUrl ?? input.image_url),
    description: textOrNull(input.description),
    active: input.active === undefined ? true : Boolean(input.active),
    maxPerPerson: integerOrNull(input.maxPerPerson ?? input.max_per_person),
    priceUsd,
    dollarPerHour: numberOrNull(input.dollarPerHour ?? input.dollar_per_hour),
    discountPercent: discountPercentOrNull(input.discountPercent ?? input.discount_percent),
    airtableId: textOrNull(input.airtableId ?? input.airtable_id),
    syncedAt: dateOrNull(input.syncedAt ?? input.synced_at),
  };
}

function shopItemValues(item) {
  return [
    item.name,
    item.price,
    item.itemLink,
    item.imageUrl,
    item.description,
    item.active,
    item.maxPerPerson,
    item.priceUsd,
    item.dollarPerHour,
    item.discountPercent,
    item.airtableId,
    item.syncedAt,
  ];
}

function textOrNull(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text ? text : null;
}

function numberOrNull(value) {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function integerOrNull(value) {
  const number = numberOrNull(value);
  return number === null ? null : Math.trunc(number);
}

function discountPercentOrNull(value) {
  const number = numberOrNull(value);
  if (number === null || number <= 0) return null;
  return Math.min(100, Number(number.toFixed(2)));
}

function dateOrNull(value) {
  const text = textOrNull(value);
  return text;
}

export async function listShopOrders() {
  if (!pool) throw new Error("DATABASE_URL is not set.");

  const result = await pool.query(`
    SELECT
      o.id,
      o.user_id,
      u.email,
      u.name,
      o.item_id,
      i.name as item_name,
      i.price as item_bricks,
      i.price_usd as item_price_usd,
      o.quantity,
      o.shipping_tax_usd,
      o.total_bricks,
      o.fulfilled,
      o.rejected,
      o.created_at
    FROM shop_orders o
    JOIN users u ON o.user_id = u.id
    JOIN shop_items i ON o.item_id = i.id
    ORDER BY o.created_at DESC
  `);

  return result.rows.map(toPublicShopOrder);
}

export async function markShopOrderFulfilled(orderId) {
  if (!pool) throw new Error("DATABASE_URL is not set.");

  const result = await pool.query(
    `
      UPDATE shop_orders
      SET fulfilled = TRUE, updated_at = NOW()
      WHERE id = $1
        AND rejected IS NOT TRUE
      RETURNING *
    `,
    [orderId]
  );

  return result.rows[0] ? toPublicShopOrder(result.rows[0]) : null;
}

export async function rejectShopOrderWithRefund(orderId) {
  if (!pool) throw new Error("DATABASE_URL is not set.");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const orderResult = await client.query(
      `
        SELECT *
        FROM shop_orders
        WHERE id = $1
        FOR UPDATE
      `,
      [orderId]
    );
    const order = orderResult.rows[0];
    if (!order) throw new Error("Order not found.");
    if (order.fulfilled) throw new Error("Fulfilled orders cannot be rejected.");
    if (order.rejected) throw new Error("Order is already rejected.");

    await client.query("UPDATE users SET bricks = bricks + $1, updated_at = NOW() WHERE id = $2", [
      Number(order.total_bricks ?? 0),
      order.user_id,
    ]);

    const result = await client.query(
      `
        UPDATE shop_orders
        SET rejected = TRUE,
            rejected_at = NOW(),
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [orderId]
    );

    await client.query("COMMIT");
    return toPublicShopOrder(result.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function toPublicShopItem(row) {
  return {
    id: row.id,
    name: row.name,
    price: row.price,
    itemLink: row.item_link,
    imageUrl: row.image_url,
    description: row.description,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    maxPerPerson: row.max_per_person,
    priceUsd: row.price_usd,
    dollarPerHour: row.dollar_per_hour,
    discountPercent: row.discount_percent,
    airtableId: row.airtable_id,
    syncedAt: row.synced_at,
  };
}

function toPublicShopOrder(row) {
  return {
    id: row.id,
    userId: row.user_id,
    email: row.email,
    name: row.name,
    itemId: row.item_id,
    itemName: row.item_name,
    itemBricks: row.item_bricks,
    itemPriceUsd: row.item_price_usd,
    quantity: row.quantity,
    shippingTaxUsd: row.shipping_tax_usd,
    totalBricks: row.total_bricks,
    fulfilled: row.fulfilled,
    rejected: row.rejected,
    createdAt: row.created_at,
  };
}
