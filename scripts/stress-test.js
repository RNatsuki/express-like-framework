const autocannon = require('autocannon');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const TEST_DURATION = 10; // seconds
const SERVER_STARTUP_WAIT = 2000; // ms
const SERVER_URL = 'http://localhost:3000';
const ROUTES = [
  '/',
  '/json',
  '/users/123'
];
const CONCURRENCY_LEVELS = [1, 10, 50, 100, 200];

// Create results directory if it doesn't exist
const resultsDir = path.join(__dirname, '../results');
if (!fs.existsSync(resultsDir)) {
  fs.mkdirSync(resultsDir);
}

// Start the server
console.log('🚀 Starting server...');
const server = spawn('node', ['dist/examples/stress-test-server.js', '--production']);

let serverReady = false;

server.stdout.on('data', (data) => {
  const output = data.toString();
  console.log(`Server: ${output.trim()}`);
  
  // Once server confirms it's running, start the stress test
  if (output.includes('Server is running') && !serverReady) {
    serverReady = true;
    console.log('Server is ready. Waiting a moment before starting tests...');
    
    // Give the server a moment to stabilize
    setTimeout(() => {
      runStressTests();
    }, SERVER_STARTUP_WAIT);
  }
});

server.stderr.on('data', (data) => {
  console.error(`Server error: ${data.toString().trim()}`);
});

server.on('close', (code) => {
  console.log(`Server process exited with code ${code}`);
});

// Handle cleanup
process.on('SIGINT', () => {
  console.log('Stopping test...');
  server.kill();
  process.exit(0);
});

// Function to run a single test with specific concurrency
function runSingleTest(route, concurrency) {
  return new Promise((resolve, reject) => {
    console.log(`\n🔥 Testing ${route} with ${concurrency} concurrent connections...`);
    
    const instance = autocannon({
      url: `${SERVER_URL}${route}`,
      connections: concurrency,
      duration: TEST_DURATION,
      pipelining: 1, // Number of pipelined requests
      workers: 4, // Splits the load between 4 processes
    }, (err, results) => {
      if (err) {
        console.error('Error during benchmark:', err);
        reject(err);
        return;
      }
      
      resolve(results);
    });
    
    // Track progress
    autocannon.track(instance, { renderProgressBar: true });
  });
}

// Run tests for all routes with all concurrency levels
async function runStressTests() {
  console.log('\n📊 Starting stress tests...');
  
  const allResults = {};
  
  // Test each route with different concurrency levels
  for (const route of ROUTES) {
    allResults[route] = {};
    
    for (const concurrency of CONCURRENCY_LEVELS) {
      try {
        const results = await runSingleTest(route, concurrency);
        allResults[route][concurrency] = {
          requestsPerSec: results.requests.average,
          latencyAvg: results.latency.average,
          latency50: results.latency.p50,
          latency99: results.latency.p99,
          throughput: results.throughput.average
        };
        
        // Print summary
        console.log('\n📝 Test Results:');
        console.log(`Route: ${route}`);
        console.log(`Concurrency: ${concurrency}`);
        console.log(`Requests/sec: ${results.requests.average.toFixed(2)}`);
        console.log(`Latency (avg): ${results.latency.average.toFixed(2)} ms`);
        console.log(`Latency (p99): ${results.latency.p99.toFixed(2)} ms`);
        console.log(`Throughput: ${(results.throughput.average / 1024 / 1024).toFixed(2)} MB/sec`);
      } catch (err) {
        console.error(`Failed to test ${route} with concurrency ${concurrency}:`, err);
      }
    }
  }
  
  // Save all results to a file
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const resultsFile = path.join(resultsDir, `stress-test-results-${timestamp}.json`);
  fs.writeFileSync(resultsFile, JSON.stringify(allResults, null, 2));
  
  console.log(`\n💾 Full results saved to: ${resultsFile}`);
  
  // Generate a simple report
  generateReport(allResults, timestamp);
  
  // All tests complete, shut down the server
  console.log('\n🏁 All stress tests completed! Shutting down server...');
  server.kill();
  process.exit(0);
}

// Generate a simple HTML report
function generateReport(results, timestamp) {
  const reportFile = path.join(resultsDir, `stress-test-report-${timestamp}.html`);
  
  let html = `
<!DOCTYPE html>
<html>
<head>
  <title>Express-like Framework Stress Test Results</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
    .container { max-width: 1200px; margin: 0 auto; }
    h1, h2, h3 { color: #333; }
    table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: right; }
    th { background-color: #f2f2f2; text-align: center; }
    tr:nth-child(even) { background-color: #f9f9f9; }
    .route-header { background-color: #e6f7ff; font-weight: bold; }
    .summary { margin: 20px 0; padding: 15px; background-color: #f8f8f8; border-radius: 5px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Express-like Framework Stress Test Results</h1>
    <div class="summary">
      <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>
      <p><strong>Test Duration:</strong> ${TEST_DURATION} seconds per test</p>
      <p><strong>Routes Tested:</strong> ${ROUTES.join(', ')}</p>
      <p><strong>Concurrency Levels:</strong> ${CONCURRENCY_LEVELS.join(', ')}</p>
    </div>
`;

  // Generate a table for each route
  for (const route of ROUTES) {
    html += `
    <h2>Route: ${route}</h2>
    <table>
      <tr>
        <th>Concurrency</th>
        <th>Requests/sec</th>
        <th>Avg Latency (ms)</th>
        <th>p50 Latency (ms)</th>
        <th>p99 Latency (ms)</th>
        <th>Throughput (MB/sec)</th>
      </tr>
`;

    for (const concurrency of CONCURRENCY_LEVELS) {
      const data = results[route][concurrency];
      if (data) {
        html += `
      <tr>
        <td>${concurrency}</td>
        <td>${data.requestsPerSec.toFixed(2)}</td>
        <td>${data.latencyAvg.toFixed(2)}</td>
        <td>${data.latency50.toFixed(2)}</td>
        <td>${data.latency99.toFixed(2)}</td>
        <td>${(data.throughput / 1024 / 1024).toFixed(2)}</td>
      </tr>`;
      }
    }

    html += `
    </table>`;
  }

  // Close HTML
  html += `
  </div>
</body>
</html>`;

  fs.writeFileSync(reportFile, html);
  console.log(`\n📊 HTML report generated: ${reportFile}`);
}

