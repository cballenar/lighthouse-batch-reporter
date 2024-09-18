# Run Lighthouse Report on Multiple Pages

This script runs a Lighthouse report on multiple pages and saves the results in HTML and JSON.

The reports will be saved in an output directory with a subdirectory with today's date. Use this script to obtain consistent reports on multiple pages, on multiple dates.

## Setup

The files are pulled from an `input.csv` file which expects a 'key' and 'url' for each entry.

```csv
page-identifier-001,https://example.com
page-identifier-002,https://example.com/about
```

The 'key' will be used to identify each of the output files.

```
- page-identifier-001.html
- page-identifier-001.json
- ...
```

Modify the `options` in main.ts to configure the Lighthouse report and screen size.

## Usage

`deno run report`

## Sources

- https://github.com/GoogleChrome/lighthouse/blob/main/docs/readme.md#using-programmatically
