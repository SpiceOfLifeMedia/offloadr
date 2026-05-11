/**
 * Creates the ShowUp Reservation Fee product in Stripe (idempotent).
 * Run: pnpm --filter @workspace/scripts exec tsx src/seed-stripe-products.ts
 */
import Stripe from "stripe";

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;

  if (!xReplitToken) throw new Error("X-Replit-Token not found");

  const url = new URL(`https://${hostname}/api/v2/connection`);
  url.searchParams.set("include_secrets", "true");
  url.searchParams.set("connector_names", "stripe");
  url.searchParams.set("environment", "development");

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json", "X-Replit-Token": xReplitToken },
  });
  const data = await res.json();
  const settings = data.items?.[0]?.settings;
  if (!settings?.secret) throw new Error("Stripe connection not found");
  return settings.secret as string;
}

async function run() {
  const secretKey = await getCredentials();
  const stripe = new Stripe(secretKey, { apiVersion: "2025-04-30.basil" });

  const existing = await stripe.products.search({
    query: "name:'ShowUp Reservation Fee' AND active:'true'",
  });

  if (existing.data.length > 0) {
    const prices = await stripe.prices.list({ product: existing.data[0].id, active: true });
    console.log("Product already exists:", existing.data[0].id);
    console.log("Price ID:", prices.data[0]?.id);
    return;
  }

  const product = await stripe.products.create({
    name: "ShowUp Reservation Fee",
    description: "Secures an item while pickup is arranged. Fully refundable.",
    metadata: { type: "reservation_fee" },
  });

  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: 199,
    currency: "aud",
  });

  console.log("Created product:", product.id);
  console.log("Created price:", price.id, "— AUD $1.99");
  console.log("\nSet this as STRIPE_RESERVATION_PRICE_ID if needed.");
}

run().catch((err) => { console.error(err); process.exit(1); });
