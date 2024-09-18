import lighthouse, { Flags } from "npm:lighthouse";
import * as chromeLauncher from "npm:chrome-launcher";

// Define the pages to audit.
const inputFilePath = "input.csv";
const inputFileContent = Deno.readTextFileSync(inputFilePath);

// Read pagesToAudit from text file
const pagesToAudit = Object.fromEntries(
  inputFileContent
    .split("\n")
    .map((line) => line.split(",").map((part) => part.trim()))
    .filter(([key, value]) => key && value)
);

// Prepare Chrome and the options for Lighthouse.
const chrome = await chromeLauncher.launch({ chromeFlags: ["--headless"] });
const options: Flags = {
  formFactor: "desktop",
  screenEmulation: {
    mobile: false,
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    disabled: false,
  },
  logLevel: "info",
  output: ["html", "json"],
  onlyCategories: ["performance", "accessibility", "best-practices", "seo"],
  port: chrome.port,
};

// Iterate over pagesToAudit.
for (const [pageName, pageUrl] of Object.entries(pagesToAudit)) {
  // Start Lighthouse.
  const runnerResult = await lighthouse(pageUrl, options);

  // `.report` is the HTML report as a string.
  if (runnerResult) {
    // Make an `output` directory and a directory based on today's date `yyyy-mm-dd`.
    const outputDir = `output/${new Date().toISOString().split("T")[0]}`;
    Deno.mkdirSync(outputDir, { recursive: true });

    const reportHtml = runnerResult.report[0];
    Deno.writeFileSync(
      `${outputDir}/${pageName}.html`,
      new TextEncoder().encode(reportHtml.toString())
    );

    const reportJson = runnerResult.report[1];
    Deno.writeFileSync(
      `${outputDir}/${pageName}.json`,
      new TextEncoder().encode(reportJson.toString())
    );

    // `.lhr` is the Lighthouse Result as a JS object.
    console.log("Report is done for", runnerResult.lhr.finalDisplayedUrl);
    console.log(
      "Performance score was",
      runnerResult.lhr.categories.performance.score
        ? runnerResult.lhr.categories.performance.score * 100
        : "not available."
    );
  } else {
    console.error("Lighthouse runnerResult is undefined");
  }
}

// Kill Chrome.
// For some reason calling `chrome.kill()` stalls and doesn't kill Chrome.
try {
  chrome.process.kill();
} catch (err) {
  console.error("Failed to kill Chrome:", err);
}
