import Application from './Application';
import Router from './Router';
import * as middleware from './middleware';

// Re-export all components for named imports
export { Application, Router, middleware };

// Re-export types from our components
export type {
  Request,
  Response,
  NextFunction,
  Middleware,
  RouteHandler,
  RequestHandler,
  DebugCategory
} from './Application';

// Re-export utility functions
export { isValidCategory } from './Application';

/**
 * Creates a new application instance
 * @returns A new Application instance
 * @example
 * import express from 'framework';
 * const app = express();
 * 
 * app.get('/', (req, res) => {
 *   res.send('Hello World!');
 * });
 * 
 * app.listen(3000, () => {
 *   console.log('Server is running on port 3000');
 * });
 */
function createApplication(): Application {
  return new Application();
}

// Default export for creating a new application
export default createApplication;

