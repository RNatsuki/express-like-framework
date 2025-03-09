# ExpressLite

A lightweight, TypeScript-based framework inspired by Express.js for building web applications and APIs with a familiar API.

## Features

- Express-like API with modern TypeScript support
- Middleware pipeline for request/response processing
- Flexible routing with support for HTTP methods and parameters
- Modular architecture using Router instances
- Built-in middleware for common tasks (body parsing, CORS, logging)

## Installation

```bash
# Using pnpm (recommended)
pnpm add @ibarra/express-lite

# Using npm
npm install @ibarra/express-lite

# Using yarn
yarn add @ibarra/express-lite
```

## Quick Start

```typescript
import express from '@ibarra/express-lite';

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

## Common Examples

### Serving Static Files

```typescript
// Serving static files from a directory
app.use(express.static('public'));
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
app.get('/api/products', (req, res) => {
  const products = [/* product data */];
  res.json(products);
});
```

## Error Handling

```typescript
// Error handling middleware
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

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

