import express, { Application, Request, Response } from '../index';
import * as http from 'http';
import { AddressInfo } from 'net';

describe('Express-like Framework', () => {
  let app: Application;
  let server: http.Server;
  let port: number;
  
  beforeEach(() => {
    app = express();
    // Disable debug mode for tests
    Application.setDebugMode(false);
  });
  
  afterEach((done) => {
    if (server) {
      server.close(done);
    } else {
      done();
    }
  });
  
  // Helper to start the server and get the port
  const startServer = () => {
    return new Promise<number>((resolve) => {
      server = app.listen(0, () => {
        const addressInfo = server.address() as AddressInfo;
        port = addressInfo.port;
        resolve(port);
      });
    });
  };
  
  test('should handle GET requests', async () => {
    app.get('/test', (req: Request, res: Response) => {
      res.status(200).send('OK');
    });
    
    await startServer();
    
    const response = await fetch(`http://localhost:${port}/test`);
    const text = await response.text();
    
    expect(response.status).toBe(200);
    expect(text).toBe('OK');
  });
  
  test('should handle route parameters', async () => {
    app.get('/users/:id', (req: Request, res: Response) => {
      res.status(200).json({ id: req.params.id });
    });
    
    await startServer();
    
    const response = await fetch(`http://localhost:${port}/users/123`);
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data).toEqual({ id: '123' });
  });
  
  test('should handle multiple route parameters', async () => {
    app.get('/users/:userId/posts/:postId', (req: Request, res: Response) => {
      res.status(200).json({
        userId: req.params.userId,
        postId: req.params.postId
      });
    });
    
    await startServer();
    
    const response = await fetch(`http://localhost:${port}/users/123/posts/456`);
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data).toEqual({ userId: '123', postId: '456' });
  });
  
  test('should handle 404 for non-existent routes', async () => {
    app.setNotFoundHandler((req, res) => {
      res.status(404).json({ error: 'Not Found', message: `Route not found: ${req.url}` });
    });
    
    await startServer();
    
    const response = await fetch(`http://localhost:${port}/not-found`);
    const data = await response.json();
    
    expect(response.status).toBe(404);
    expect(data.error).toBe('Not Found');
  });
  
  test('should handle different HTTP methods', async () => {
    app.get('/methods', (req, res) => {
      res.status(200).send('GET');
    });
    
    app.post('/methods', (req, res) => {
      res.status(200).send('POST');
    });
    
    app.put('/methods', (req, res) => {
      res.status(200).send('PUT');
    });
    
    app.delete('/methods', (req, res) => {
      res.status(200).send('DELETE');
    });
    
    await startServer();
    
    // Test GET
    let response = await fetch(`http://localhost:${port}/methods`);
    let text = await response.text();
    expect(response.status).toBe(200);
    expect(text).toBe('GET');
    
    // Test POST
    response = await fetch(`http://localhost:${port}/methods`, { method: 'POST' });
    text = await response.text();
    expect(response.status).toBe(200);
    expect(text).toBe('POST');
    
    // Test PUT
    response = await fetch(`http://localhost:${port}/methods`, { method: 'PUT' });
    text = await response.text();
    expect(response.status).toBe(200);
    expect(text).toBe('PUT');
    
    // Test DELETE
    response = await fetch(`http://localhost:${port}/methods`, { method: 'DELETE' });
    text = await response.text();
    expect(response.status).toBe(200);
    expect(text).toBe('DELETE');
  });
  
  test('should process middleware in correct order', async () => {
    const order: string[] = [];
    
    app.use((req, res, next) => {
      order.push('middleware1');
      next();
    });
    
    app.use((req, res, next) => {
      order.push('middleware2');
      next();
    });
    
    app.get('/middleware-test', (req, res) => {
      order.push('route-handler');
      res.status(200).json({ order });
    });
    
    await startServer();
    
    const response = await fetch(`http://localhost:${port}/middleware-test`);
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data.order).toEqual(['middleware1', 'middleware2', 'route-handler']);
  });
  
  test('should handle async middleware and route handlers', async () => {
    app.use(async (req, res, next) => {
      await new Promise(resolve => setTimeout(resolve, 10));
      (req as any).asyncMiddlewareRan = true;
      next();
    });
    
    app.get('/async', async (req, res) => {
      await new Promise(resolve => setTimeout(resolve, 10));
      res.status(200).json({ 
        middlewareRan: (req as any).asyncMiddlewareRan,
        async: true 
      });
    });
    
    await startServer();
    
    const response = await fetch(`http://localhost:${port}/async`);
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data.middlewareRan).toBe(true);
    expect(data.async).toBe(true);
  });
});

