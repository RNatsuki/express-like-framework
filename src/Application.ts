import * as http from 'http';
import { IncomingMessage, ServerResponse } from 'http';
import { URL } from 'url';
import { Router } from './Router';

// Define types for the framework

// Define valid debug categories
export type DebugCategory = 'request' | 'route' | 'handler' | 'response' | 'error';

// Debug configuration interface
export interface DebugConfig {
  enabled: boolean;
  request: boolean;
  route: boolean;
  handler: boolean;
  response: boolean;
  error: boolean;
}

// Type guard to check if a string is a valid debug category
export function isValidCategory(category: string): category is DebugCategory {
  return ['request', 'route', 'handler', 'response', 'error'].includes(category);
}
export interface Request extends IncomingMessage {
  params: Record<string, string>;
  query: Record<string, string>;
  body: any;
  path: string;
}

export interface Response extends ServerResponse {
  /**
   * Sets the HTTP status code for the response
   * @param code - The HTTP status code
   * @returns The response object for chaining
   */
  status(code: number): Response;
  
  /**
   * Sends a JSON response
   * @param data - Data to be converted to JSON and sent
   * @returns The response object for chaining
   */
  json(data: any): Response;
  
  /**
   * Sends a string response with Content-Type text/html
   * @param body - The string body to send
   * @returns The response object for chaining
   */
  send(body: string): Response;
}

export type NextFunction = (err?: any) => void;
export type Middleware = (req: Request, res: Response, next: NextFunction) => void;
export type RouteHandler = (req: Request, res: Response, next: NextFunction) => void;
export type RequestHandler = RouteHandler; // Alias for RouteHandler for compatibility

export interface Route {
  method: string;
  path: string;
  handlers: RouteHandler[];
}

export class Application {
  private middlewares: Middleware[] = [];
  private routes: Route[] = [];
  private notFoundHandler: RouteHandler = (req, res) => {
    res.status(404).send('Not Found');
  };

  // Debug configuration with reasonable defaults
  private static debugConfig: DebugConfig = {
    enabled: true, // Default to enabled, will check NODE_ENV at runtime
    request: true,
    route: true,
    handler: true,
    response: true,
    error: true
  };

  /**
   * Logger utility for consistent and configurable logging
   */
  public static logger = {
    debug: (category: DebugCategory, message: string, ...args: any[]): void => {
      // Check NODE_ENV at runtime to allow for environment changes
      const isProduction = process.env.NODE_ENV === 'production';
      if (!isProduction && Application.debugConfig.enabled && Application.debugConfig[category]) {
        console.log(`[${category.toUpperCase()}] ${message}`, ...args);
      }
    },
    info: (message: string, ...args: any[]): void => {
      console.log(`[INFO] ${message}`, ...args);
    },
    warn: (message: string, ...args: any[]): void => {
      console.warn(`[WARN] ${message}`, ...args);
    },
    error: (message: string, ...args: any[]): void => {
      console.error(`[ERROR] ${message}`, ...args);
    }
  };

  /**
  /**
   * Enable or disable debugging globally
   */
  public static setDebugMode(enabled: boolean): void {
    Application.debugConfig.enabled = enabled;
  }
  
  /**
   * Enable production mode (disables all debugging)
   */
  public static enableProductionMode(): void {
    process.env.NODE_ENV = 'production';
    Application.debugConfig.enabled = false;
  }
  /**
  /**
   * Configure specific debug categories
   * @param config Object containing debug configuration options
   */
  public static configureDebug(config: Partial<DebugConfig> | Record<DebugCategory, boolean>): void {
    // Validate config to ensure all properties are valid debug categories
    const validatedConfig: Partial<DebugConfig> = {};
    
    // Process each property in the config object
    Object.entries(config).forEach(([key, value]) => {
      // Skip the 'enabled' property, which is handled separately
      if (key === 'enabled') {
        validatedConfig.enabled = !!value;
        return;
      }
      
      // For debug categories, validate them first
      if (isValidCategory(key)) {
        // TypeScript now knows key is a DebugCategory
        validatedConfig[key] = !!value;
      } else {
        // Log a warning for invalid category but don't throw
        console.warn(`Warning: Ignoring unknown debug category '${key}'`);
      }
    });
    
    Application.debugConfig = {
      ...Application.debugConfig,
      ...validatedConfig
    };
  }
  /**
  /**
   * Get current debug configuration
   * @returns A copy of the current debug configuration
   */
  public static getDebugConfig(): DebugConfig {
    return { ...Application.debugConfig };
  }
  
  /**
   * Enable or disable a specific debug category
   * @param category The debug category to configure
   * @param enabled Whether to enable or disable the category
   */
  public static setDebugCategory(category: DebugCategory, enabled: boolean): void {
    Application.debugConfig[category] = enabled;
  }
  /**
   * Register middleware to be executed for every request
   */
  public use(middleware: Middleware): Application {
    this.middlewares.push(middleware);
    return this;
  }

  /**
   * Register a GET route handler
   */
  public get(path: string, ...handlers: RouteHandler[]): Application {
    this.routes.push({ method: 'GET', path, handlers });
    return this;
  }

  /**
   * Register a POST route handler
   */
  public post(path: string, ...handlers: RouteHandler[]): Application {
    this.routes.push({ method: 'POST', path, handlers });
    return this;
  }

  /**
   * Register a PUT route handler
   */
  public put(path: string, ...handlers: RouteHandler[]): Application {
    this.routes.push({ method: 'PUT', path, handlers });
    return this;
  }

  /**
   * Register a DELETE route handler
   */
  public delete(path: string, ...handlers: RouteHandler[]): Application {
    this.routes.push({ method: 'DELETE', path, handlers });
    return this;
  }

  /**
   * Register a PATCH route handler
   */
  public patch(path: string, ...handlers: RouteHandler[]): Application {
    this.routes.push({ method: 'PATCH', path, handlers });
    return this;
  }

  /**
   * Mount a Router instance at the specified path
   * @param path The base path to mount the router on
   * @param router The Router instance to mount
   */
  public mount(path: string, router: Router): Application {
    // Normalize the path to ensure it starts with a slash
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    
    // Set the base path on the router
    router.setBasePath(normalizedPath);
    
    // Add a middleware that delegates to the router's handle method
    this.use((req: Request, res: Response, next: NextFunction) => {
      // Check if the request path starts with the router's base path
      const url = new URL(req.url || '/', `http://${req.headers.host}`);
      const pathname = url.pathname;
      
      if (pathname.startsWith(normalizedPath)) {
        router.handle(req, res, next);
      } else {
        // If path doesn't match, skip to the next middleware
        next();
      }
    });
    
    return this;
  }
  
  /**
   * Set a custom 404 Not Found handler
   * This handler will only be called if no route matched and no middleware sent a response
   */
  public setNotFoundHandler(handler: RouteHandler): Application {
    this.notFoundHandler = handler;
    return this;
  }

  /**
   * Start the HTTP server
   */
  public listen(port: number, callback?: () => void): http.Server {
    const server = http.createServer(this.handleRequest.bind(this));
    
    server.listen(port, () => {
      Application.logger.info(`Server is running on http://localhost:${port}`);
      if (callback) callback();
    });
    
    return server;
  }

  /**
   * Handle incoming HTTP requests
   */
  private handleRequest(req: IncomingMessage, res: ServerResponse): void {
    // Enhance request and response objects
    const request = this.enhanceRequest(req);
    const response = this.enhanceResponse(res);
    
    // Create middleware chain
    const chain = [...this.middlewares];
    
    // Find matching route
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    Application.logger.debug('request', `Processing ${req.method} request for ${url.pathname}`);
    
    // First log all routes for debugging purposes
    Application.logger.debug('route', `Registered routes:`, this.routes.map(r => `${r.method} ${r.path}`));
    
    const route = this.routes.find(r => 
      r.method === req.method && this.matchRoute(r.path, url.pathname)
    );
    
    if (route) {
      Application.logger.debug('route', `Route matched: ${route.method} ${route.path}`);
      // Extract route params
      request.params = this.extractParams(route.path, url.pathname);
      
      // Add all handlers from the route to the middleware chain
      Application.logger.debug('request', `Adding ${route.handlers.length} route handlers to middleware chain`);
      
      // Debug each handler to better understand what's being executed
      route.handlers.forEach((handler, idx) => {
        Application.logger.debug('handler', `Handler #${idx + 1} info:`, {
          name: handler.name || 'anonymous',
          toString: handler.toString().substring(0, 100) + '...',
          length: handler.length
        });
        chain.push(handler);
      });
    } else {
      Application.logger.debug('route', `No matching route found for ${req.method} ${url.pathname}`);
    }
    
    // Execute middleware chain
    let index = 0;
    Application.logger.debug('request', `Starting middleware chain execution with ${chain.length} handlers`);
    
    const next: NextFunction = (err?: any) => {
      if (err) {
        Application.logger.debug('error', `Error in middleware chain:`, err);
        return this.handleError(err, request, response);
      }
      
      const middleware = chain[index++];
      if (middleware) {
        Application.logger.debug('request', `Executing middleware #${index} of ${chain.length}`);
        
        // Add more detailed debugging about the handler being executed
        const isRouteHandler = index > this.middlewares.length;
        Application.logger.debug('handler', `${isRouteHandler ? 'Route handler' : 'Middleware'} details:`, {
          name: middleware.name || 'anonymous',
          type: isRouteHandler ? 'route handler' : 'middleware',
          position: index,
          paramCount: middleware.length,
          source: middleware.toString().substring(0, 150) + '...'
        });
        
        try {
          Application.logger.debug('handler', `About to call handler ${middleware.name || 'anonymous'}`);
          middleware(request, response, next);
          Application.logger.debug('handler', `Handler ${middleware.name || 'anonymous'} execution completed`);
        } catch (err) {
          Application.logger.debug('error', `Exception caught in middleware #${index}:`, err);
          next(err);
        }
      } else {
        Application.logger.debug('request', `End of middleware chain reached`);
        // We're done with the middleware chain
        
        // If no route matched and response hasn't been sent, call the not found handler
        if (!hasRoute && !isResponseEnded()) {
          Application.logger.debug('request', `No route matched and no response sent, executing not found handler`);
          this.notFoundHandler(request, response, () => {});
        }
      }
    };
    
    // Always execute middleware chain first, even if no route matched
    // This allows global middleware to run in all cases
    // The notFoundHandler will be called only if no route matched and no middleware ended the response
    let hasRoute = !!route;
    
    // Helper function to check if response has been sent
    const isResponseEnded = () => {
      return response.writableEnded || response.headersSent;
    };
    
    // Start the middleware chain
    next();
    
    // Note: We don't check for 404 here since the next() function executes middleware asynchronously.
    // The not found handler will be called at the end of the middleware chain if needed (in the next function).
  }
  
  /**
   * Handle errors in middleware or route handlers
   */
  private handleError(err: any, req: Request, res: Response): void {
    Application.logger.error('Error:', err);
    res.status(500).send('Internal Server Error');
  }
  
  /**
   * Enhance the request object with additional properties and methods
   */
  private enhanceRequest(req: IncomingMessage): Request {
    const request = req as Request;
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    
    // Initialize properties
    request.params = {};
    request.query = Object.fromEntries(url.searchParams);
    request.body = {};
    request.path = url.pathname;
    
    return request;
  }
  
  /**
   * Enhance the response object with additional methods
   */
  private enhanceResponse(res: ServerResponse): Response {
    const response = res as Response;
    
    // Add status method
    response.status = function(code: number): Response {
      this.statusCode = code;
      return this;
    };
    
    // Add json method
    response.json = function(data: any): Response {
      Application.logger.debug('response', `json() method called with data:`, typeof data);
      this.setHeader('Content-Type', 'application/json');
      Application.logger.debug('response', `About to call this.end() in json() method`);
      this.end(JSON.stringify(data));
      Application.logger.debug('response', `Finished json() method execution`);
      return this;
    };
    
    // Add send method
    response.send = function(body: string): Response {
      Application.logger.debug('response', `send() method called with body:`, body.substring(0, 50) + (body.length > 50 ? '...' : ''));
      this.setHeader('Content-Type', 'text/html');
      Application.logger.debug('response', `About to call this.end() in send() method`);
      this.end(body);
      Application.logger.debug('response', `Finished send() method execution`);
      return this;
    };
    
    return response;
  }
  
  /**
   * Check if a route path matches a URL pathname
   */
  private matchRoute(routePath: string, urlPath: string): boolean {
    Application.logger.debug('route', `Checking route: '${routePath}' against URL path: '${urlPath}'`);
    
    // Special case for root path
    if (routePath === '/') {
      const isRootMatch = urlPath === '/' || urlPath === '';
      Application.logger.debug('route', `Root path special case: ${isRootMatch ? 'MATCHED ✓' : 'NOT MATCHED ✗'}`);
      return isRootMatch;
    }
    
    // Convert route path to regex pattern
    const pattern = routePath
      .replace(/\/+$/, '')  // Remove trailing slashes
      .replace(/:(\w+)/g, '([^/]+)')  // Replace :param with capture group
      .replace(/\//g, '\\/');  // Escape forward slashes
    
    const regex = new RegExp(`^${pattern}$`);
    Application.logger.debug('route', `Generated regex pattern: ${regex}`);
    
    const isMatch = regex.test(urlPath);
    Application.logger.debug('route', `Result: ${isMatch ? 'MATCHED ✓' : 'NOT MATCHED ✗'}`);
    
    return isMatch;
  }
  
  /**
   * Extract parameters from URL based on route path
   */
  private extractParams(routePath: string, urlPath: string): Record<string, string> {
    const params: Record<string, string> = {};
    
    // Extract parameter names from route path
    const paramNames = (routePath.match(/:\w+/g) || [])
      .map(param => param.substring(1));
    
    // Extract parameter values from URL
    const pattern = routePath
      .replace(/\/+$/, '')  // Remove trailing slashes
      .replace(/:(\w+)/g, '([^/]+)')  // Replace :param with capture group
      .replace(/\//g, '\\/');  // Escape forward slashes
    
    const regex = new RegExp(`^${pattern}$`);
    const matches = urlPath.match(regex);
    
    if (matches) {
      // Skip the first match (full string match)
      matches.slice(1).forEach((value, index) => {
        const name = paramNames[index];
        params[name] = value;
      });
    }
    
    return params;
  }
}

export default Application;

