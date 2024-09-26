const outputDir = "./output";

const handler: Deno.ServeHandler = (req) => {
  const url = new URL(req.url);
  if (url.pathname === "/") {
    const dirs = [];
    for (const dirEntry of Deno.readDirSync(outputDir)) {
      if (dirEntry.isDirectory) {
        dirs.push(dirEntry.name);
      }
    }
    // Sort directories in descending order
    dirs.sort((a, b) => b.localeCompare(a));

    const html = `
      <html>
        <body>
          <h1>Lighthouse Reports</h1>
          <p>Choose a job to view the Lighthouse report:</p>
          <select id="directorySelect">
            ${dirs
              .map((dir) => `<option value="${dir}">${dir}</option>`)
              .join("")}
          </select>
          <div id="stats"></div>
          <script>
            async function fetchStats(dir) {
              const response = await fetch('/stats?dir=' + dir);
              const stats = await response.json();
              const statsDiv = document.getElementById('stats');
              statsDiv.innerHTML = ''; // Clear previous stats
              for (const domain in stats) {
                const domainBlock = document.createElement('div');
                const domainHeading = document.createElement('h2');
                domainHeading.textContent = domain;
                domainBlock.appendChild(domainHeading);
                const metrics = stats[domain];
                const sortedMetricsKeys = Object.keys(metrics).sort();
                for (const metric of sortedMetricsKeys) {
                  const metricBlock = document.createElement('div');
                  const metricHeading = document.createElement('p');
                
                  const unit = metrics[metric].unit === 'unitless' ? '' : 's';
                  const score = metrics[metric].score.toFixed(1);

                  const min = (metrics[metric].min / 1000).toFixed(1);
                  const max = (metrics[metric].max / 1000).toFixed(1);
                  const avg = (metrics[metric].avg / 1000).toFixed(1);

                  const rangeString = min === max ? \`\${min}\${unit}\` : \`(\${min}-\${max}\${unit})\`;
                  const avgString = \`\${avg}\${unit}\`;
                  const mainString = avgString === rangeString ? avgString : \`\${avgString} \${rangeString}\`;

                  const indicator = score < 0.33 ? '\\u{1F534}' : score < 0.66 ? '\\u{1F7E1}' : '\\u{1F7E2}';

                  metricHeading.textContent = \`\${indicator} \${metric}: \${mainString}\`;
                  metricBlock.appendChild(metricHeading);
                  domainBlock.appendChild(metricBlock);
                }
                statsDiv.appendChild(domainBlock);
              }
            }
            document.getElementById('directorySelect').addEventListener('change', function() {
              fetchStats(this.value);
            });
            // Automatically load the latest report
            fetchStats('${dirs[0]}');
          </script>
        </body>
      </html>
    `;
    return new Response(html, { headers: { "content-type": "text/html" } });
  } else if (url.pathname === "/stats") {
    const dir = url.searchParams.get("dir");
    if (dir) {
      const statsPath = `${outputDir}/${dir}/auditStats.json`;
      try {
        const stats = Deno.readTextFileSync(statsPath);
        return new Response(stats, {
          headers: { "content-type": "application/json" },
        });
      } catch (e) {
        return new Response("File not found", { status: 404 });
      }
    }
  }
  return new Response("Not found", { status: 404 });
};

console.log("Server running on http://localhost:8000");
await Deno.serve({ port: 8000 }, handler);
