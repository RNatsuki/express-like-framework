import * as http from 'http';
import * as url from 'url';
import { Application } from './Application';

// Types from the existing Application
export type Request = http.IncomingMessage & {
  params: Record<string, string>;
  query: Record<string, string>;
  body?: any;
  path: string;
};

export type Response = http.ServerResponse & {
  status: (code: number) => Response;
  send: (body: any) => void;
  json: (body: any) => void;
};

export type NextFunction = (err?: any) => void;
export type Middleware = (req: Request, res: Response, next: NextFunction) => void;
export type RequestHandler = (req: Request, res: Response, next: NextFunction) => void;

export interface Route {
  method: string;
  path: string;
  handlers: RequestHandler[];
}

export class Router {
  private _routes: Route[] = [];
  private middlewares: Middleware[] = [];
  private basePath: string = '';

  constructor() {}
  
  /**
   * Get all registered routes
   */
  get routes(): Route[] {
    return this._routes;
  }

  /**
   * Use middleware for this router
   */
  use(middleware: Middleware): Router {
    this.middlewares.push(middleware);
    return this;
  }

  /**
   * Register a GET route
   */
  get(path: string, ...handlers: RequestHandler[]): Router {
    this.addRoute('GET', path, handlers);
    return this;
  }

  /**
   * Register a POST route
   */
  post(path: string, ...handlers: RequestHandler[]): Router {
    this.addRoute('POST', path, handlers);
    return this;
  }

  /**
   * Register a PUT route
   */
  put(path: string, ...handlers: RequestHandler[]): Router {
    this.addRoute('PUT', path, handlers);
    return this;
  }

  /**
   * Register a DELETE route
   */
  delete(path: string, ...handlers: RequestHandler[]): Router {
    this.addRoute('DELETE', path, handlers);
    return this;
  }

  /**
   * Add a route with the specified HTTP method
   */
  private addRoute(method: string, routePath: string, handlers: RequestHandler[]): void {
    this._routes.push({
      method,
      path: routePath,
      handlers
    });
  }

  /**
   * Match routes and extract URL parameters
   */
  private matchRoute(reqMethod: string, reqPath: string): { route: Route; params: Record<string, string> } | null {
    for (const route of this._routes) {
      if (route.method !== reqMethod) continue;
      
      // Get the full route path (including the base path)
      const fullRoutePath = this.normalizePath(this.basePath + route.path);
      const normalizedReqPath = this.normalizePath(reqPath);
      
      Application.logger.debug('route', `Checking route match: '${fullRoutePath}' against '${normalizedReqPath}'`);

      // For exact path match (no parameters)
      // For exact path match (no parameters)
      if (!route.path.includes(':') && fullRoutePath === normalizedReqPath) {
        Application.logger.debug('route', `Exact path match found for ${fullRoutePath}`);
        return { route, params: {} };
      }
      const routePathSegments = fullRoutePath.split('/').filter(Boolean);
      const reqPathSegments = normalizedReqPath.split('/').filter(Boolean);

      if (routePathSegments.length !== reqPathSegments.length) continue;

      const params: Record<string, string> = {};
      let match = true;

      for (let i = 0; i < routePathSegments.length; i++) {
        const routeSegment = routePathSegments[i];
        const reqSegment = reqPathSegments[i];

        // Check if it's a parameter segment (starts with :)
        if (routeSegment.startsWith(':')) {
          const paramName = routeSegment.slice(1);
          params[paramName] = reqSegment;
        } else if (routeSegment !== reqSegment) {
          match = false;
          break;
        }
      }

      if (match) {
        Application.logger.debug('route', `Parameter path match found for ${fullRoutePath} with params:`, params);
        return { route, params };
      }
    }

    return null;
  }

  /**
   * Normalize a path to ensure consistent formatting with slashes
   * @param routePath The path to normalize
   */
  private normalizePath(routePath: string): string {
    // Add leading slash if not present
    let normalizedPath = routePath.startsWith('/') ? routePath : '/' + routePath;
    
    // Remove trailing slash if present (except for root path)
    if (normalizedPath.length > 1 && normalizedPath.endsWith('/')) {
      normalizedPath = normalizedPath.slice(0, -1);
    }
    
    return normalizedPath;
  }

  /**
   * Set the base path for the router
   */
  setBasePath(basePath: string): Router {
    this.basePath = this.normalizePath(basePath);
    return this;
  }

  /**
   * Handle an incoming request
   * Handle an incoming request
   */
  handle(req: Request, res: Response, done: NextFunction): void {
    const parsedUrl = url.parse(req.url || '/', true);
    const reqPath = parsedUrl.pathname || '/';
    const reqMethod = req.method || 'GET';

    // Only process this request if it starts with our base path
    if (this.basePath !== '/' && !this.normalizePath(reqPath).startsWith(this.basePath)) {
      return done();
    }

    Application.logger.debug('route', `Attempting to match ${reqMethod} ${reqPath} in router with base path: ${this.basePath}`);
    const match = this.matchRoute(reqMethod, reqPath);

    // If no matching route is found, proceed to the next middleware
    if (!match) {
      Application.logger.debug('route', `No matching route found in router for ${reqMethod} ${reqPath}`);
      return done();
    }
    
    Application.logger.debug('route', `Found matching route: ${reqMethod} ${match.route.path}`);

    // Set the parameters on the request object
    req.params = { ...req.params, ...match.params };

    // Chain router middlewares and route handlers
    const handlers = [...this.middlewares, ...match.route.handlers];
    let index = 0;

    const next = (err?: any) => {
      // If there's an error or we've gone through all handlers, call done
      if (err || index >= handlers.length) {
        return done(err);
      }

      // Get the next handler
      const handler = handlers[index++];

      try {
        // Execute the handler
        handler(req, res, next);
      } catch (error) {
        next(error);
      }
    };

    next();
  }
  
  /**
   * Mount this router on an application or another router
   * @param path Base path for the router
   * @param app The application or router to mount on
   */
  mount(path: string, app: any): void {
    this.setBasePath(path);
    
    // Check if we're mounting to an Application or another Router
    if (typeof app.use === 'function') {
      Application.logger.debug('route', `Mounting router at base path: ${this.basePath}`);
      app.use((req: Request, res: Response, next: NextFunction) => {
        // Store original URL and path for restoring later if needed
        const originalUrl = req.url;
        const originalPath = req.path;
        
        // Only process this request if the path matches our base path
        if (this.basePath === '/' || req.path.startsWith(this.basePath)) {
          this.handle(req, res, (err?: any) => {
            // If there was no matching route in this router, continue to next middleware
            next(err);
          });
        } else {
          // Path doesn't match our base, skip to next middleware
          next();
        }
      });
    }
  }
}

export default Router;
