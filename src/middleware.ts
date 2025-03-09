import { Middleware, Request, Response, NextFunction } from './Application';
import { ServerResponse } from 'http';

// Custom type for error handling middleware
export type ErrorHandlerMiddleware = (err: any, req: Request, res: Response, next: NextFunction) => void;
import * as url from 'url';
import * as querystring from 'querystring';

/**
 * Body parser middleware for JSON and URL-encoded form data
 */
export const bodyParser = {
  /**
   * Parses JSON request bodies
   */
  json(): Middleware {
    return (req: Request, res: Response, next: NextFunction) => {
      if (req.headers['content-type'] !== 'application/json') {
        return next();
      }

      let body = '';
      
      req.on('data', (chunk) => {
        body += chunk.toString();
      });
      
      req.on('end', () => {
        try {
          if (body) {
            req.body = JSON.parse(body);
          }
          next();
        } catch (error) {
          next(new Error('Invalid JSON'));
        }
      });
      
      req.on('error', (err) => {
        next(err);
      });
    };
  },
  
  /**
   * Parses URL-encoded form data
   */
  urlencoded(): Middleware {
    return (req: Request, res: Response, next: NextFunction) => {
      if (req.headers['content-type'] !== 'application/x-www-form-urlencoded') {
        return next();
      }

      let body = '';
      
      req.on('data', (chunk) => {
        body += chunk.toString();
      });
      
      req.on('end', () => {
        try {
          req.body = querystring.parse(body);
          next();
        } catch (error) {
          next(new Error('Invalid form data'));
        }
      });
      
      req.on('error', (err) => {
        next(err);
      });
    };
  }
};

/**
 * CORS middleware
 * @param options CORS options
 */
export function cors(options: {
  origin?: string | string[] | boolean;
  methods?: string | string[];
  allowedHeaders?: string | string[];
  exposedHeaders?: string | string[];
  credentials?: boolean;
  maxAge?: number;
} = {}): Middleware {
  const defaultOptions = {
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    allowedHeaders: 'Content-Type,Authorization',
    exposedHeaders: '',
    credentials: false,
    maxAge: 86400 // 24 hours
  };

  const corsOptions = { ...defaultOptions, ...options };

  return (req: Request, res: Response, next: NextFunction) => {
    // Origin
    const origin = Array.isArray(corsOptions.origin) 
      ? corsOptions.origin.join(',') 
      : corsOptions.origin;
    
    res.setHeader('Access-Control-Allow-Origin', origin.toString());

    // Methods
    const methods = Array.isArray(corsOptions.methods) 
      ? corsOptions.methods.join(',') 
      : corsOptions.methods;
    
    res.setHeader('Access-Control-Allow-Methods', methods);

    // Headers
    const allowedHeaders = Array.isArray(corsOptions.allowedHeaders) 
      ? corsOptions.allowedHeaders.join(',') 
      : corsOptions.allowedHeaders;
    
    res.setHeader('Access-Control-Allow-Headers', allowedHeaders);

    // Exposed Headers
    if (corsOptions.exposedHeaders) {
      const exposedHeaders = Array.isArray(corsOptions.exposedHeaders) 
        ? corsOptions.exposedHeaders.join(',') 
        : corsOptions.exposedHeaders;
      
      res.setHeader('Access-Control-Expose-Headers', exposedHeaders);
    }

    // Credentials
    if (corsOptions.credentials) {
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }

    // Max Age
    if (corsOptions.maxAge) {
      res.setHeader('Access-Control-Max-Age', corsOptions.maxAge.toString());
    }

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    next();
  };
}

/**
 * Logger middleware
 * @param options Logger options
 */
export function logger(options: {
  format?: string;
  skip?: (req: Request, res: Response) => boolean;
} = {}): Middleware {
  const defaultOptions = {
    format: ':method :url :status :response-time ms',
    skip: () => false
  };

  const loggerOptions = { ...defaultOptions, ...options };

  return (req: Request, res: Response, next: NextFunction) => {
    // Skip logging if the skip function returns true
    if (loggerOptions.skip && loggerOptions.skip(req, res)) {
      return next();
    }

    // Capture start time
    const start = Date.now();
    const method = req.method || '';
    const urlPath = req.url || '';
    
    // Listen for the 'finish' event which fires when the response is sent
    res.on('finish', () => {
      // Calculate response time
      const responseTime = Date.now() - start;
      
      // Format log message
      let logMessage = loggerOptions.format
        .replace(':method', method)
        .replace(':url', urlPath)
        .replace(':status', res.statusCode.toString())
        .replace(':response-time', responseTime.toString());
      
      // Log the message
      console.log(logMessage);
    });
    
    next();
  };
}

/**
 * Error handler middleware
 */
export function errorHandler(): ErrorHandlerMiddleware {
  return (err: any, req: Request, res: Response, next: NextFunction) => {
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal Server Error';
    
    res.status(statusCode).json({
      error: {
        message,
        status: statusCode
      }
    });
  };
}

