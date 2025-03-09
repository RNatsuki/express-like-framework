import express, { Application } from '../index';

// Create an optimized server for stress testing
const app = express();

// Enable production mode and disable debugging
Application.enableProductionMode();
Application.setDebugMode(false);

// Simple plain text response route
app.get('/', (req, res) => {
  res.status(200).send('OK');
});

// JSON response route
app.get('/json', (req, res) => {
  res.json({
    status: 'success',
    message: 'Hello JSON',
    timestamp: Date.now()
  });
});

// Route with parameters
app.get('/users/:id', (req, res) => {
  res.json({
    id: req.params.id,
    requestedAt: new Date().toISOString()
  });
});

// Echo route - returns whatever was sent in the request body
app.post('/echo', (req, res) => {
  res.json(req.body || { message: 'No body provided' });
});

// Start the server
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
app.listen(PORT, () => {
  console.log(`Stress test server running in PRODUCTION mode on http://localhost:${PORT}`);
  console.log('Debug mode: DISABLED');
  console.log('Available routes for testing:');
  console.log('  GET  / - Simple text response');
  console.log('  GET  /json - JSON response');
  console.log('  GET  /users/:id - Route with parameters');
  console.log('  POST /echo - Echo request body');
});

