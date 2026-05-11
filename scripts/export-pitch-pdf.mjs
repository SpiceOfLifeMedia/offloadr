import puppeteer from "puppeteer";
import { writeFileSync } from "fs";
import { PDFDocument } from "pdf-lib";

const BASE = "http://localhost:19319/showup-pitch";
const SLIDE_COUNT = 15;
const OUT = "/home/runner/workspace/showup-pitch-deck.pdf";
const CHROMIUM_PATH = "/nix/store/qa9cnw4v5xkxyip6mb9kxqfq1z4x2dx1-chromium-138.0.7204.100/bin/chromium";

const browser = await puppeteer.launch({
  executablePath: CHROMIUM_PATH,
  args: [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
  ],
  headless: true,
});

const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 2 });

const merged = await PDFDocument.create();

for (let i = 1; i <= SLIDE_COUNT; i++) {
  const url = `${BASE}/slide${i}`;
  console.log(`Rendering slide ${i}: ${url}`);

  await page.goto(url, { waitUntil: "networkidle0", timeout: 30000 });
  await new Promise((r) => setTimeout(r, 1000));

  const slidePdfBytes = await page.pdf({
    width: "1280px",
    height: "720px",
    printBackground: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
  });

  const slideDoc = await PDFDocument.load(slidePdfBytes);
  const [copiedPage] = await merged.copyPages(slideDoc, [0]);
  merged.addPage(copiedPage);
}

await browser.close();

const pdfBytes = await merged.save();
writeFileSync(OUT, pdfBytes);

console.log(`PDF saved: ${OUT} (${Math.round(pdfBytes.length / 1024)}KB)`);
