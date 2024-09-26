import lighthouse, { Flags, Result, RunnerResult } from "npm:lighthouse";
import * as chromeLauncher from "npm:chrome-launcher";

// Chrome Options
const options: Flags = {
  formFactor: "desktop",
  screenEmulation: {
    mobile: false,
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    disabled: false,
  },
  onlyCategories: ["performance", "accessibility", "best-practices", "seo"],
};

// Define audits to analyze.
const auditsToAnalyze = [
  "first-contentful-paint",
  "speed-index",
  "largest-contentful-paint",
  "total-blocking-time",
  "cumulative-layout-shift",
  // "first-contentful-paint",
  // "speed-index",
  // "largest-contentful-paint",
  // "interactive",
  // "total-blocking-time",
  // "cumulative-layout-shift",
  // "server-response-time",
  // "first-meaningful-paint",
  // "estimated-input-latency",
  // "max-potential-fid",
  // "first-cpu-idle",
  // "performance-score",
  // "accessibility-score",
  // "best-practices-score",
  // "seo-score",
];

/**
 * Run Lighthouse on a collection of pages.
 *
 * @param pagesToAudit
 * @param chromeOptions
 * @returns
 */
const runBatchLighthouse = async (
  pagesToAudit: { [key: string]: string },
  chromeOptions?: Flags
) => {
  // Prepare Chrome and the options for Lighthouse.
  const chrome = await chromeLauncher.launch({ chromeFlags: ["--headless"] });
  const options = Object.assign(
    { logLevel: "error", output: ["html"], port: chrome.port },
    chromeOptions
  ) as Flags;

  // results.
  const results: { [key: string]: RunnerResult | undefined } = {};

  // Iterate over pagesToAudit.
  for (const [pageName, pageUrl] of Object.entries(pagesToAudit)) {
    // Start Lighthouse.
    const runnerResult = await lighthouse(pageUrl, options);

    // Store the results.
    results[pageName] = runnerResult;
  }

  // Kill Chrome.
  // For some reason calling `chrome.kill()` stalls and doesn't kill Chrome.
  try {
    chrome.process.kill();
  } catch (err) {
    console.error("Failed to kill Chrome:", err);
  }

  return results;
};

/**
 * Analyze a collection of results based on their shared domain.
 *
 * @param results
 * @param auditsToAnalyze
 * @returns
 */
const analyzeData = (
  results: { [key: string]: Result },
  auditsToAnalyze: string[]
) => {
  // Define the auditStats object.
  const auditStats: {
    [domainName: string]: {
      [auditName: string]: {
        min: number;
        max: number;
        avg: number;
        unit: string;
        score: number;
      };
    };
  } = {};

  for (const [_pageName, result] of Object.entries(results)) {
    if (result.mainDocumentUrl) {
      // Identify domain name.
      const domainName = result.mainDocumentUrl.split("/")[2];

      // Calculate auditStats for all pages.
      for (const auditName of auditsToAnalyze) {
        const audit = result.audits[auditName];
        const numericValue = audit.numericValue;
        const scoreValue = audit.score;
        if (numericValue) {
          const scoreStats = auditStats[domainName] || {};
          scoreStats[auditName] = scoreStats[auditName] || {};

          // Get unit.
          scoreStats[auditName].unit = audit.numericUnit || "";

          // Calculate min numeric value.
          scoreStats[auditName].min = Math.min(
            scoreStats[auditName].min || numericValue,
            numericValue
          );

          // Calculate max numeric value.
          scoreStats[auditName].max = Math.max(
            scoreStats[auditName].max || numericValue,
            numericValue
          );

          // Calculate avg numeric value.
          scoreStats[auditName].avg = scoreStats[auditName].avg
            ? (scoreStats[auditName].avg + numericValue) / 2
            : numericValue;

          // Calculate avg score.
          scoreStats[auditName].score = scoreStats[auditName].score
            ? (scoreStats[auditName].score + scoreValue) / 2
            : scoreValue;

          // Determine the number of decimal places.
          let decimalPlaces = 0;
          if (scoreStats[auditName].unit == "unitless") decimalPlaces = 3;
          const multiplier = Math.pow(10, decimalPlaces);

          // Round the values.
          scoreStats[auditName].min =
            Math.round(scoreStats[auditName].min * multiplier) / multiplier;
          scoreStats[auditName].max =
            Math.round(scoreStats[auditName].max * multiplier) / multiplier;
          scoreStats[auditName].avg =
            Math.round(scoreStats[auditName].avg * multiplier) / multiplier;

          auditStats[domainName] = scoreStats;
        }
      }
    }
  }

  return auditStats;
};

/**
 * Analyze Lighthouse Result data from files.
 *
 * @param sourceDir The source directory.
 * @returns The audit stats.
 */
const analyzeDataFromFiles = (sourceDir: string) => {
  // Get all json files in the output directory.
  const reportFiles = Array.from(Deno.readDirSync(sourceDir)).filter(
    (file) => file.name.endsWith(".json") && file.name !== "auditStats.json"
  );

  // Read all reports.
  const reports = reportFiles.map((report) => {
    const reportContent = Deno.readTextFileSync(`${sourceDir}/${report.name}`);
    return JSON.parse(reportContent);
  });

  // Array to object.
  const reportsObj = Object.fromEntries(
    reports.map((report) => [report.finalUrl, report])
  );

  return analyzeData(reportsObj, auditsToAnalyze);
};

/**
 * Command Line Default Behavior
 */
const mainCli = async () => {
  // Define input file path and read the content.
  const inputFilePath =
    Deno.args[0] ||
    prompt("Enter the input file path: (./input.csv)") ||
    "./input.csv";
  const inputFileContent = Deno.readTextFileSync(inputFilePath);
  const pagesToAudit: { [key: string]: string } = Object.fromEntries(
    inputFileContent
      .split("\n")
      .map((line) => line.split(",").map((part) => part.trim()))
      .filter(([key, value]) => key && value)
  );

  // Define jobID and output directory.
  const jobId =
    Deno.args[0] ||
    prompt("Enter the job ID (yyyy-mm-dd):") ||
    new Date().toISOString().split("T")[0];
  const outputDir = `output/${jobId}`;
  Deno.mkdirSync(outputDir, { recursive: true });

  // Process the pages.
  console.log(`🗼 Processing ${Object.keys(pagesToAudit).length} pages...`);
  const results = await runBatchLighthouse(pagesToAudit, options);
  const jsonResults: { [name: string]: Result } = {};

  // Store the results as HTML and JSON.
  console.log("💾 Storing the results...");
  for (const [pageName, runnerResult] of Object.entries(results)) {
    // Store the results.
    if (runnerResult) {
      const reportHtml = runnerResult.report;
      Deno.writeFileSync(
        `${outputDir}/${pageName}.html`,
        new TextEncoder().encode(reportHtml.toString())
      );

      const reportJson = runnerResult.lhr;
      Deno.writeFileSync(
        `${outputDir}/${pageName}.json`,
        new TextEncoder().encode(JSON.stringify(runnerResult.lhr, null, 2))
      );
      jsonResults[pageName] = reportJson;

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

  // Analyze the data.
  console.log("📊 Analyzing the results...");
  const auditStats = analyzeData(jsonResults, auditsToAnalyze);
  Deno.writeTextFileSync(
    `${outputDir}/auditStats.json`,
    JSON.stringify(auditStats, null, 2)
  );

  console.log(auditStats);
};

// if running from cli
if (import.meta.main) {
  mainCli();
}

export { runBatchLighthouse, analyzeData, analyzeDataFromFiles };
