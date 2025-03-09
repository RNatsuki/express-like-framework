# ExpressLite

A lightweight, TypeScript-based framework inspired by Express.js for building web applications and APIs with a familiar API.

> **Note:** As of version 1.1.0, this package uses ES modules (not CommonJS).

## Features

- Express-like API with modern TypeScript support
- Middleware pipeline for request/response processing
- Flexible routing with support for HTTP methods and parameters
- Modular architecture using Router instances
- Built-in middleware for common tasks (body parsing, CORS, logging)

## Installation

```bash
# Using pnpm (recommended)
pnpm add @rnatsuki/express-lite

# Using npm
npm install @rnatsuki/express-lite

# Using yarn
yarn add @rnatsuki/express-lite
```

## Quick Start

```typescript
import express from '@rnatsuki/express-lite';
const app = express();

// Use middleware
app.use(express.json());
app.use(express.logger());

// Define routes
app.get('/', (req, res) => {
  res.send('Hello, ExpressLite!');
});

app.post('/api/users', (req, res) => {
  const user = req.body;
  // Process user data
  res.json({ message: 'User created', user });
});

// Start the server
app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

## Core Components

### Application

The main application instance that handles HTTP requests, middleware, and routing.

```typescript
// Create an application
const app = express();

// Add middleware
app.use(someMiddleware);

// Define routes
app.get('/path', handler);
app.post('/path', handler);
app.put('/path', handler);
app.delete('/path', handler);

// Start the server
app.listen(port, callback);
```

### Router

Used for creating modular route handlers that can be mounted to the main application.

```typescript
const router = express.Router();

// Add router-specific middleware
router.use(authMiddleware);

// Define routes on the router
router.get('/users', getAllUsers);
router.post('/users', createUser);
router.get('/users/:id', getUserById);

// Mount the router on the application
app.mount('/api', router);
```

### Middleware

Functions that have access to the request and response objects and can:
- Execute code
- Modify the request and response objects
- End the request-response cycle
- Call the next middleware in the stack

```typescript
// Custom middleware example
const myMiddleware = (req, res, next) => {
  // Do something with req or res
  console.log(`Request to ${req.path}`);
  
  // Continue to next middleware
  next();
};

app.use(myMiddleware);
```

## Built-in Middleware

- `express.json()` - Parses JSON request bodies
- `express.urlencoded()` - Parses URL-encoded request bodies
- `express.cors()` - Enables CORS for all routes
- `express.logger()` - Logs request information
- `express.static()` - Serves static files from a directory (added in v1.1.0)

## Version History

### v1.1.0
- Added static file middleware with support for serving static files from directories
- Migrated to ES modules
- Fixed type definitions
- Added more examples

### v1.0.0
- Initial release with core functionality
- Express-like API with middleware support
- Routing capabilities

## Common Examples

### Serving Static Files

ExpressLite includes a static file middleware that serves files from a specified directory. This was added in version 1.1.0.

```typescript
import express from '@rnatsuki/express-lite';
import path from 'path';

const app = express();

// Basic usage - serve files from the 'public' directory
app.use(express.static('public'));

// Advanced usage with options
app.use(express.static(new URL('./public', import.meta.url).pathname, {
  index: 'index.html',     // Default index file for directory requests
  dotfiles: 'ignore',      // How to handle dotfiles: 'allow', 'deny', or 'ignore'
  etag: true,              // Enable ETag header generation
  maxAge: 86400,          // Cache control max-age in seconds (1 day)
}));

app.listen(3000, () => {
  console.log('Server running at http://localhost:3000');
});
```

#### Content Type Detection

The static middleware automatically detects the appropriate content type based on file extension:

```typescript
// For example:
// http://localhost:3000/styles.css → Content-Type: text/css
// http://localhost:3000/image.png → Content-Type: image/png
// http://localhost:3000/data.json → Content-Type: application/json
```

### Route Parameters

```typescript
app.get('/users/:id', (req, res) => {
  const userId = req.params.id;
  res.send(`User ID: ${userId}`);
});
```

### API with JSON Responses

```typescript
import express from '@rnatsuki/express-lite';

const app = express();

app.get('/api/products', (req, res) => {
  const products = [/* product data */];
  res.json(products);
});
```

## Error Handling

```typescript
// Error handling middleware
import express from '@rnatsuki/express-lite';

const app = express();

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});
```

## Limitations Compared to Express.js

- Limited middleware ecosystem compared to Express.js
- Fewer features for advanced use cases like template engines
- Less mature and tested in production environments
- May not support all advanced routing patterns
- Limited documentation and community support
- No built-in view system
- Static file serving is more basic than Express.js

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

