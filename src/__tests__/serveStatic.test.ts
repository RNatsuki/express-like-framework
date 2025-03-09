import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Readable, Writable } from 'stream';
import { serveStatic } from '../middleware.js';
import { Request, Response } from '../Application.js';

describe('serveStatic middleware', () => {
  let tempDir: string;
  let publicDir: string;
  let indexDir: string;
  
  // Mock Next function
  const nextMock = jest.fn();
  
  // Setup mock request
  const createMockRequest = (url: string): Request => {
    // Create a partial mock that implements IncomingMessage base type
    const req = new Readable() as unknown as Request;
    
    // Add required properties
    req.url = url;
    req.method = 'GET';
    req.headers = {};
    req.params = {};
    req.query = {};
    req.body = null;
    req.path = url;
    
    return req;
  };
  
  // Setup mock response
  const createMockResponse = (): Response => {
    // Create a base writable stream
    const res = new Writable() as unknown as Response;
    
    // Add internal tracking properties (not part of the actual Response interface)
    const internalProps: any = {
      headerMap: {},
      responseBody: null,
      responseEnded: false
    };
    
    // Mock the status method
    res.status = jest.fn().mockImplementation((code: number) => {
      res.statusCode = code;
      return res;
    });
    
    // Mock the json method
    res.json = jest.fn().mockImplementation((data: any) => {
      internalProps.responseBody = JSON.stringify(data);
      res.setHeader('Content-Type', 'application/json');
      res.end(internalProps.responseBody);
      return res;
    });
    
    // Mock the send method
    res.send = jest.fn().mockImplementation((body: string) => {
      internalProps.responseBody = body;
      res.setHeader('Content-Type', 'text/html');
      res.end(internalProps.responseBody);
      return res;
    });
    
    // Mock the setHeader method from ServerResponse
    res.setHeader = jest.fn().mockImplementation((key: string, value: string) => {
      internalProps.headerMap[key] = value;
      return res;
    });
    
    // Mock the getHeader method from ServerResponse
    res.getHeader = jest.fn().mockImplementation((key: string) => {
      return internalProps.headerMap[key];
    });
    
    // Mock the end method
    res.end = jest.fn().mockImplementation((data?: any) => {
      internalProps.responseBody = data;
      internalProps.responseEnded = true;
      return res;
    });
    
    // Mock writableEnded property (instead of .ended)
    Object.defineProperty(res, 'writableEnded', {
      get: () => internalProps.responseEnded
    });
    
    // Add a getter for headersSent
    Object.defineProperty(res, 'headersSent', {
      get: () => Object.keys(internalProps.headerMap).length > 0
    });
    
    // Add a write method
    res.write = jest.fn();
    
    // Add test helper methods to access internal state
    (res as any).getInternalState = () => ({
      headers: internalProps.headerMap,
      body: internalProps.responseBody,
      ended: internalProps.responseEnded
    });
    
    // Initialize statusCode
    res.statusCode = 200;
    
    return res;
  };
  
  beforeAll(() => {
    // Create temporary directory for test files
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'static-test-'));
    publicDir = path.join(tempDir, 'public');
    indexDir = path.join(publicDir, 'subdir');
    
    // Create test directory structure
    fs.mkdirSync(publicDir, { recursive: true });
    fs.mkdirSync(indexDir, { recursive: true });
    
    // Create test files
    fs.writeFileSync(path.join(publicDir, 'test.txt'), 'This is a text file');
    fs.writeFileSync(path.join(publicDir, 'test.html'), '<html><body>Test HTML</body></html>');
    fs.writeFileSync(path.join(publicDir, 'test.json'), '{"key": "value"}');
    fs.writeFileSync(path.join(indexDir, 'index.html'), '<html><body>Index file</body></html>');
  });
  
  afterAll(() => {
    // Clean up test files
    fs.rmSync(tempDir, { recursive: true, force: true });
  });
  
  beforeEach(() => {
    nextMock.mockClear();
  });
  
  test('should serve text file with correct content type', async () => {
    const middleware = serveStatic(publicDir);
    const req = createMockRequest('/test.txt');
    const res = createMockResponse();
    
    await middleware(req, res, nextMock);
    
    expect(nextMock).not.toBeCalled();
    expect((res as any).getInternalState().headers['Content-Type']).toBe('text/plain');
    expect(res.statusCode).toBe(200);
    // The middleware should pipe a file stream to the response
    // We should not call res.write directly as the middleware pipes the stream
    // to the response object
  });
  
  test('should serve HTML file with correct content type', async () => {
    const middleware = serveStatic(publicDir);
    const req = createMockRequest('/test.html');
    const res = createMockResponse();
    
    await middleware(req, res, nextMock);
    
    expect(nextMock).not.toBeCalled();
    expect((res as any).getInternalState().headers['Content-Type']).toBe('text/html');
    expect(res.statusCode).toBe(200);
  });
  
  test('should serve JSON file with correct content type', async () => {
    const middleware = serveStatic(publicDir);
    const req = createMockRequest('/test.json');
    const res = createMockResponse();
    
    await middleware(req, res, nextMock);
    
    expect(nextMock).not.toBeCalled();
    expect((res as any).getInternalState().headers['Content-Type']).toBe('application/json');
    expect(res.statusCode).toBe(200);
  });
  
  test('should call next for non-existent files', async () => {
    const middleware = serveStatic(publicDir);
    const req = createMockRequest('/non-existent.file');
    const res = createMockResponse();
    
    await middleware(req, res, nextMock);
    
    expect(nextMock).toBeCalledTimes(1);
    expect(res.writableEnded).toBe(false);
  });
  
  test('should prevent directory traversal attacks', async () => {
    const middleware = serveStatic(publicDir);
    const req = createMockRequest('/../package.json');
    const res = createMockResponse();
    
    await middleware(req, res, nextMock);
    
    expect(nextMock).toBeCalledTimes(1);
  });
  
  test('should serve index.html when requesting a directory', async () => {
    const middleware = serveStatic(publicDir, { index: 'index.html' });
    const req = createMockRequest('/subdir/');
    const res = createMockResponse();
    
    await middleware(req, res, nextMock);
    
    expect(nextMock).not.toBeCalled();
    expect((res as any).getInternalState().headers['Content-Type']).toBe('text/html');
    expect(res.statusCode).toBe(200);
  });
  
  test('should call next when directory has no index file', async () => {
    const middleware = serveStatic(publicDir, { index: 'index.html' });
    const req = createMockRequest('/');  // root has no index.html
    const res = createMockResponse();
    
    await middleware(req, res, nextMock);
    
    expect(nextMock).toBeCalledTimes(1);
  });
  
  test('should not serve index file when index option is disabled', async () => {
    const middleware = serveStatic(publicDir, { index: false });
    const req = createMockRequest('/subdir/');
    const res = createMockResponse();
    
    await middleware(req, res, nextMock);
    
    expect(nextMock).toBeCalledTimes(1);
  });
  
  test('should handle URL encoded paths correctly', async () => {
    // Create a file with a space in the name
    fs.writeFileSync(path.join(publicDir, 'test file.txt'), 'File with space in name');
    
    const middleware = serveStatic(publicDir);
    const req = createMockRequest('/test%20file.txt');
    const res = createMockResponse();
    
    await middleware(req, res, nextMock);
    
    expect(nextMock).not.toBeCalled();
    expect((res as any).getInternalState().headers['Content-Type']).toBe('text/plain');
    expect(res.statusCode).toBe(200);
  });
  
  test('should handle error when reading file', async () => {
    // Create a readable stream that emits an error
    const mockStream = new Readable({
      read() {} // Required implementation
    });
    
    // Mock createReadStream to return our controlled stream
    jest.spyOn(fs, 'createReadStream').mockImplementationOnce((_path: any, _options: any) => {
      return mockStream as unknown as fs.ReadStream;
    });
    
    const middleware = serveStatic(publicDir);
    const req = createMockRequest('/test.txt');
    const res = createMockResponse();
    
    // Start the middleware
    const middlewarePromise = middleware(req, res, nextMock);
    
    // Emit the error on the next tick to ensure middleware has time to set up handlers
    process.nextTick(() => {
      mockStream.emit('error', new Error('Read error'));
    });
    
    // Wait for middleware to complete
    await middlewarePromise;
    
    // The error should be passed to next
    expect(nextMock).toHaveBeenCalledWith(expect.any(Error));
    
    // Restore the original implementation
    jest.restoreAllMocks();
  });
});

