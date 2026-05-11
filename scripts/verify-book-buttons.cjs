const puppeteer = require("puppeteer");
(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: "/nix/store/qa9cnw4v5xkxyip6mb9kxqfq1z4x2dx1-chromium-138.0.7204.100/bin/chromium",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });

  // Intercept window.open to capture the URL it would open
  await page.evaluateOnNewDocument(() => {
    window.__opens = [];
    const orig = window.open;
    window.open = function (url, target, features) {
      window.__opens.push({ url, target, features });
      return null;
    };
  });

  await page.goto("http://localhost:80/gametime/", { waitUntil: "networkidle0", timeout: 30000 });
  await new Promise(r => setTimeout(r, 1500));

  const buttons = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("button"))
      .map(b => ({ text: (b.textContent || "").trim().slice(0, 40), visible: b.offsetParent !== null }))
      .filter(b => /book/i.test(b.text));
  });
  console.log("BOOK BUTTONS FOUND:", JSON.stringify(buttons, null, 2));

  // Click each visible booking button
  const labels = ["Book Simulator", "Book an Event", "Book a Batting Cage", "Book Now"];
  for (const label of labels) {
    const handle = await page.evaluateHandle((l) => {
      return Array.from(document.querySelectorAll("button"))
        .find(b => (b.textContent || "").trim() === l && b.offsetParent !== null);
    }, label);
    const el = handle.asElement();
    if (el) {
      await el.click();
      await new Promise(r => setTimeout(r, 200));
    }
  }
  const opens = await page.evaluate(() => window.__opens);
  console.log("WINDOW.OPEN CALLS:", JSON.stringify(opens, null, 2));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
