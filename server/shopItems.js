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
  "position",
  "airtable_id",
  "synced_at",
];

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
      position INTEGER,
      airtable_id VARCHAR,
      synced_at DATE
    )
  `);

  for (const column of SHOP_ITEM_COLUMNS) {
    await ensureShopItemColumn(column);
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
    position: "INTEGER",
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
    ORDER BY position ASC NULLS LAST, created_at DESC, id DESC
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
        price_usd, dollar_per_hour, position, airtable_id, synced_at
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
        position = $10,
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

function normalizeShopItemInput(input = {}) {
  const priceUsd = numberOrNull(input.priceUsd ?? input.price_usd);
  return {
    name: textOrNull(input.name),
    price: priceUsd === null ? numberOrNull(input.price) : priceUsd * 10,
    itemLink: textOrNull(input.itemLink ?? input.item_link),
    imageUrl: textOrNull(input.imageUrl ?? input.image_url),
    description: textOrNull(input.description),
    active: input.active === undefined ? true : Boolean(input.active),
    maxPerPerson: integerOrNull(input.maxPerPerson ?? input.max_per_person),
    priceUsd,
    dollarPerHour: numberOrNull(input.dollarPerHour ?? input.dollar_per_hour),
    position: integerOrNull(input.position),
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
    item.position,
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

function dateOrNull(value) {
  const text = textOrNull(value);
  return text;
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
    position: row.position,
    airtableId: row.airtable_id,
    syncedAt: row.synced_at,
  };
}
