import express, { Router, middleware, Application, DebugCategory, isValidCategory } from '../index';

// Parse command line arguments
const args = process.argv.slice(2);

// Define the type for our options object
interface ServerOptions {
  debug: boolean;
  debugCategories: Record<DebugCategory, boolean>;
  production: boolean;
  help: boolean;
}

// Initialize options with default values
const options: ServerOptions = {
  debug: true,
  debugCategories: {
    request: true,
    route: true,
    handler: true,
    response: true,
    error: true
  },
  production: false,
  help: false
};

// Process command line arguments
args.forEach(arg => {
  if (arg === '--production' || arg === '-p') {
    options.production = true;
    options.debug = false;
  } else if (arg === '--debug' || arg === '-d') {
    options.debug = true;
    options.production = false;
  } else if (arg === '--no-debug') {
    options.debug = false;
  } else if (arg.startsWith('--debug-')) {
    // Handle specific debug categories
    const category = arg.replace('--debug-', '');
    if (isValidCategory(category)) {
      // Now TypeScript knows category is a valid DebugCategory
      options.debugCategories[category] = true;
    } else {
      console.warn(`Warning: Unknown debug category '${category}'`);
    }
  } else if (arg.startsWith('--no-debug-')) {
    // Handle disabling specific debug categories
    const category = arg.replace('--no-debug-', '');
    if (isValidCategory(category)) {
      // Now TypeScript knows category is a valid DebugCategory
      options.debugCategories[category] = false;
    } else {
      console.warn(`Warning: Unknown debug category '${category}'`);
    }
  } else if (arg === '--help' || arg === '-h') {
    options.help = true;
  }
});

// Show help if requested
if (options.help) {
  console.log('Usage: node simple-server.js [options]');
  console.log('');
  console.log('Options:');
  console.log('  --debug, -d          Enable all debug output (default)');
  console.log('  --no-debug           Disable all debug output');
  console.log('  --debug-request      Enable request debug output');
  console.log('  --debug-route        Enable route matching debug output');
  console.log('  --debug-handler      Enable handler execution debug output');
  console.log('  --debug-response     Enable response debug output');
  console.log('  --debug-error        Enable error debug output');
  console.log('  --no-debug-request   Disable request debug output');
  console.log('  --no-debug-route     Disable route matching debug output');
  console.log('  --no-debug-handler   Disable handler execution debug output');
  console.log('  --no-debug-response  Disable response debug output');
  console.log('  --no-debug-error     Disable error debug output');
  console.log('  --production, -p     Enable production mode (disables all debugging)');
  console.log('  --help, -h           Show this help message');
  process.exit(0);
}

// Apply debug configuration
Application.setDebugMode(options.debug);
// Pass options.debugCategories as a properly typed Record<DebugCategory, boolean>
Application.configureDebug(options.debugCategories);

// Enable production mode if requested
if (options.production) {
  Application.enableProductionMode();
  console.log('Running in production mode - all debugging disabled');
}

// Display current debug configuration
console.log('Debug Configuration:');
const debugConfig = Application.getDebugConfig();
console.log(`  Enabled: ${debugConfig.enabled}`);
console.log(`  Categories:`);
console.log(`    - request: ${debugConfig.request}`);
console.log(`    - route: ${debugConfig.route}`);
console.log(`    - handler: ${debugConfig.handler}`);
console.log(`    - response: ${debugConfig.response}`);
console.log(`    - error: ${debugConfig.error}`);
console.log(`  NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
console.log('');

// Create a new application
const app = express();

// Add middleware
app.use(middleware.logger());
app.use(middleware.bodyParser.json());
app.use(middleware.cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE']
}));

// Define a simple route with better debugging
app.get('/', (req, res) => {
  Application.logger.debug('handler', 'Root route handler is executing');
  
  // Simpler approach with direct method chaining
  try {
    Application.logger.debug('handler', 'About to send response');
    res.status(200).send('Hello World!');
    Application.logger.debug('handler', 'Response sent successfully');
  } catch (err) {
    Application.logger.error('Error in root handler:', err);
    // If there's an error sending the response, try with a simpler approach
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/plain');
    res.end('Hello World!');
    Application.logger.debug('handler', 'Fallback response sent');
  }
});

// Add JSON response example
app.get('/api/info', (req, res) => {
  res.json({
    name: 'Express-like Framework',
    version: '1.0.0',
    description: 'A simple Express-like framework built with TypeScript'
  });
});

// Route with URL parameters
app.get('/users/:id', (req, res) => {
  const userId = req.params.id;
  res.json({
    id: userId,
    name: `User ${userId}`,
    email: `user${userId}@example.com`
  });
});

// POST route example
app.post('/api/data', (req, res) => {
  // Body parser middleware allows us to access req.body
  const data = req.body;
  res.status(201).json({
    message: 'Data received successfully',
    data
  });
});

// Create a modular router for products
const productsRouter = new Router();

// Router middleware specific to products
productsRouter.use((req, res, next) => {
  Application.logger.debug('handler', 'Product router middleware executed');
  next();
});

// Define routes on the router
productsRouter.get('/', (req, res) => {
  res.json([
    { id: 1, name: 'Product 1', price: 99.99 },
    { id: 2, name: 'Product 2', price: 149.99 },
    { id: 3, name: 'Product 3', price: 199.99 }
  ]);
});

productsRouter.get('/:id', (req, res) => {
  const productId = req.params.id;
  res.json({
    id: productId,
    name: `Product ${productId}`,
    price: Math.floor(Math.random() * 100) + 50
  });
});

productsRouter.post('/', (req, res) => {
  const newProduct = req.body;
  res.status(201).json({
    message: 'Product created',
    product: {
      id: Date.now(),
      ...newProduct
    }
  });
});

// Mount the router on the main application
// Note: Our framework doesn't have the exact same router mounting as Express,
// so we'll simulate it by adding routes from the router to the app
productsRouter.routes.forEach(route => {
  const path = `/api/products${route.path === '/' ? '' : route.path}`;

  // Process each handler individually
  route.handlers.forEach(handler => {
    switch (route.method.toUpperCase()) {
      case 'GET':
        app.get(path, handler);
        break;
      case 'POST':
        app.post(path, handler);
        break;
      case 'PUT':
        app.put(path, handler);
        break;
      case 'DELETE':
        app.delete(path, handler);
        break;
      case 'PATCH':
        app.patch(path, handler);
        break;
      default:
        Application.logger.warn(`Unsupported HTTP method: ${route.method}`);
    }
  });
});

// Error handling route
app.get('/error', (req, res) => {
  throw new Error('This is a test error');
});

// Add a custom 404 handler
app.setNotFoundHandler((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.url}`,
    path: req.url
  });
});

// Add a debug route that shows current debug configuration
app.get('/debug', (req, res) => {
  res.json({
    debugConfig: Application.getDebugConfig(),
    environment: process.env.NODE_ENV || 'development',
    startupOptions: options
  });
});

// Add a route to change debug settings at runtime
app.post('/debug', (req, res) => {
  const { enabled, categories } = req.body;
  
  if (typeof enabled === 'boolean') {
    Application.setDebugMode(enabled);
  }
  
  if (categories && typeof categories === 'object') {
    // Validate that categories has the right shape before passing to configureDebug
    const validatedCategories: Partial<Record<DebugCategory, boolean>> = {};
    
    // Only include valid categories
    Object.entries(categories).forEach(([key, value]) => {
      if (isValidCategory(key) && typeof value === 'boolean') {
        validatedCategories[key] = value;
      }
    });
    
    Application.configureDebug(validatedCategories);
  }
  
  res.json({
    message: 'Debug configuration updated',
    debugConfig: Application.getDebugConfig()
  });
});

// Start the server
app.listen(3000, () => {
  console.log('Server is running on http://localhost:3000');
  console.log('Available routes:');
  console.log('- GET  /');
  console.log('- GET  /api/info');
  console.log('- GET  /users/:id');
  console.log('- POST /api/data');
  console.log('- GET  /api/products');
  console.log('- GET  /api/products/:id');
  console.log('- POST /api/products');
  console.log('- GET  /debug (shows debug configuration)');
  console.log('- POST /debug (updates debug configuration)');
  console.log('- GET  /error (triggers an error)');
  
  console.log('\nDebug examples:');
  console.log('1. Run with all debugging enabled:');
  console.log('   node dist/examples/simple-server.js --debug');
  console.log('2. Run with only route debugging:');
  console.log('   node dist/examples/simple-server.js --no-debug --debug-route');
  console.log('3. Run in production mode:');
  console.log('   node dist/examples/simple-server.js --production');
  console.log('4. Run with specific debug categories:');
  console.log('   node dist/examples/simple-server.js --no-debug --debug-error --debug-request');
});
