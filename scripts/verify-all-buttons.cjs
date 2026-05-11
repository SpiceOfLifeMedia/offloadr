const puppeteer = require("puppeteer");
(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: "/nix/store/qa9cnw4v5xkxyip6mb9kxqfq1z4x2dx1-chromium-138.0.7204.100/bin/chromium",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });

  await page.evaluateOnNewDocument(() => {
    window.__opens = [];
    const orig = window.open;
    window.open = function (url, target) {
      window.__opens.push({ url, target });
      return null;
    };
  });

  const checkAt = async (path, labels) => {
    console.log(`\n=== ${path} ===`);
    await page.goto(`http://localhost:80/gametime${path}`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await new Promise(r => setTimeout(r, 1200));
    await page.evaluate(() => { window.__opens = []; });
    for (const label of labels) {
      const startUrl = page.url();
      const handle = await page.evaluateHandle((l) => {
        return Array.from(document.querySelectorAll("button, a"))
          .find(b => (b.textContent || "").trim() === l && b.offsetParent !== null);
      }, label);
      const el = handle.asElement();
      if (!el) { console.log(`  - "${label}" NOT FOUND`); continue; }
      await el.click();
      await new Promise(r => setTimeout(r, 300));
      const opens = await page.evaluate(() => { const o = window.__opens.slice(); window.__opens = []; return o; });
      const endUrl = page.url();
      if (opens.length) console.log(`  - "${label}" → window.open: ${opens[0].url} (${opens[0].target})`);
      else if (endUrl !== startUrl) console.log(`  - "${label}" → navigated to: ${endUrl}`);
      else console.log(`  - "${label}" → NOTHING HAPPENED`);
      if (endUrl !== startUrl) await page.goto(`http://localhost:80/gametime${path}`, { waitUntil: "domcontentloaded" });
    }
  };

  await checkAt("/", ["View Menu", "Reserve a Table"]);
  await checkAt("/memberships", ["Join Basic", "Join Gold", "Join Platinum"]);
  await checkAt("/waiver", ["Sign Waiver Online Now"]);

  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
