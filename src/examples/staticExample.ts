import Application from '../Application.js';
import { serveStatic as staticMiddleware } from '../middleware.js';
import path from 'path';
import fs from 'fs';

/**
 * This example demonstrates how to use the static middleware
 * to serve static files from a directory while also handling
 * dynamic routes in your application.
 */

// Create a new application instance
const app = new Application();

/**
 * Setting up the static middleware
 * 
 * The static middleware:
 * 1. Serves files from the specified directory
 * 2. Automatically determines the correct content type based on file extension
 * 3. Handles directory index files (default: index.html)
 * 4. Properly handles file streams for efficient delivery
 * 5. Skips to the next middleware if the file isn't found
 */
app.use(staticMiddleware(new URL('./public', import.meta.url).pathname, {
  // Configuration options (all optional):
  index: 'index.html',     // Default index file for directories
  dotfiles: 'ignore',      // How to handle dotfiles ('allow', 'deny', 'ignore')
  etag: true,              // Enable/disable etag generation
  maxAge: 86400           // Max-age for Cache-Control header in seconds (1 day)
}));

// Create the public directory if it doesn't exist
const publicDir = new URL('./public', import.meta.url).pathname;
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
  
  // Create a simple index.html file for testing
  const indexPath = path.join(publicDir, 'index.html');
  const indexContent = `
<!DOCTYPE html>
<html>
<head>
  <title>Static Middleware Example</title>
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <h1>Static File Server</h1>
  <p>This file is being served by the static middleware.</p>
  <p>Try accessing the <a href="/api/hello">API route</a>.</p>
</body>
</html>
  `;
  fs.writeFileSync(indexPath, indexContent);
  
  // Create a simple CSS file
  const cssPath = path.join(publicDir, 'styles.css');
  const cssContent = `
body {
  font-family: Arial, sans-serif;
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
  line-height: 1.6;
}

h1 {
  color: #333;
  border-bottom: 1px solid #eee;
  padding-bottom: 10px;
}

a {
  color: #0066cc;
  text-decoration: none;
}

a:hover {
  text-decoration: underline;
}
  `;
  fs.writeFileSync(cssPath, cssContent);
}

/**
 * Define a route handler
 * 
 * This demonstrates how route handlers work alongside static middleware.
 * If a request doesn't match a static file, it continues to route handlers.
 */
app.get('/api/hello', (req, res) => {
  res.json({ 
    message: 'Hello from the API!',
    time: new Date().toISOString()
  });
});

/**
 * Custom 404 handler for when neither static files nor route handlers match
 */
app.setNotFoundHandler((req, res) => {
  res.status(404).send(`
    <h1>404 - Not Found</h1>
    <p>The requested resource "${req.path}" could not be found.</p>
    <p><a href="/">Go back to home page</a></p>
  `);
});

// Start the server
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
app.listen(PORT, () => {
  console.log(`
==========================================
 Static middleware example
==========================================
 - Static files are served from: ${publicDir}
 - Try visiting: http://localhost:${PORT}/
 - API endpoint: http://localhost:${PORT}/api/hello
 - Any other path will show the 404 page
==========================================
  `);
});

