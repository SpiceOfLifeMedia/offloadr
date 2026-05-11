const puppeteer = require("puppeteer");
(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: "/nix/store/qa9cnw4v5xkxyip6mb9kxqfq1z4x2dx1-chromium-138.0.7204.100/bin/chromium",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  console.log("Loading https://gss.golf918.net/ ...");
  await page.goto("https://gss.golf918.net/", { waitUntil: "networkidle0", timeout: 30000 });
  await new Promise(r => setTimeout(r, 2000));

  // List all buttons/links visible to a customer
  const interactives = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll("a, button").forEach(el => {
      const text = (el.textContent || "").trim().slice(0, 40);
      const href = el.getAttribute("href");
      if (text) out.push({ tag: el.tagName, text, href });
    });
    return out;
  });
  console.log("INTERACTIVES:", JSON.stringify(interactives, null, 2));

  // Click "Book Now" and see where we land
  const target = await page.evaluateHandle(() => {
    return Array.from(document.querySelectorAll("a, button")).find(el =>
      /book\s*now/i.test(el.textContent || "")
    );
  });
  const el = target.asElement();
  if (el) {
    await Promise.all([
      page.waitForNavigation({ waitUntil: "networkidle0", timeout: 15000 }).catch(() => null),
      el.click(),
    ]);
    await new Promise(r => setTimeout(r, 1500));
    console.log("AFTER CLICK URL:", page.url());
  } else {
    console.log("No Book Now button found");
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
