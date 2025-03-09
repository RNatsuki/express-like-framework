import { Middleware, Request, Response, NextFunction } from './Application';
import { ServerResponse } from 'http';

// Custom type for error handling middleware
export type ErrorHandlerMiddleware = (err: any, req: Request, res: Response, next: NextFunction) => void;
import * as url from 'url';
import * as querystring from 'querystring';
import * as fs from 'fs';
import * as path from 'path';

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
 * Mapping of file extensions to MIME types
 */
const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain',
  '.pdf': 'application/pdf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'font/eot',
  '.otf': 'font/otf',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav'
};

/**
 * Static file middleware that serves files from a specified directory
 * @param root Directory path from which to serve static files
 * @param options Configuration options for the static middleware
 */
export function serveStatic(root: string, options: {
  index?: string | false;
  dotfiles?: 'allow' | 'deny' | 'ignore';
  etag?: boolean;
  maxAge?: number;
} = {}): Middleware {
  const defaultOptions = {
    index: 'index.html',
    dotfiles: 'ignore' as const,
    etag: true,
    maxAge: 0
  };

  const staticOptions = { ...defaultOptions, ...options };

  // Normalize and resolve the root directory path
  const rootPath = path.resolve(root);

  return (req: Request, res: Response, next: NextFunction) => {
    // Skip non-GET and non-HEAD requests
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return next();
    }

    // Get the pathname from the URL
    const parsedUrl = url.parse(req.url || '');
    const pathname = parsedUrl.pathname || '';
    
    // Decode and normalize the path
    let filePath = path.normalize(decodeURIComponent(pathname));
    
    // Prevent directory traversal attacks
    if (filePath.includes('..')) {
      return next(new Error('Invalid file path'));
    }
    
    // Remove leading slash if present
    if (filePath.startsWith('/')) {
      filePath = filePath.substring(1);
    }
    
    // Resolve the absolute file path
    const absolutePath = path.join(rootPath, filePath);
    
    // Check if the path is a dotfile (starts with .)
    const fileName = path.basename(absolutePath);
    if (fileName.startsWith('.')) {
      if (staticOptions.dotfiles === 'deny') {
        res.status(403).send('Forbidden');
        return;
      }
      if (staticOptions.dotfiles === 'ignore') {
        return next();
      }
      // 'allow' continues to serve the file
    }

    // Check if the file exists and is accessible
    fs.stat(absolutePath, (err, stats) => {
      if (err) {
        if (err.code === 'ENOENT') {
          // File not found, move to next middleware
          return next();
        }
        // Server error
        return next(err);
      }

      // If it's a directory and we have an index option
      if (stats.isDirectory()) {
        if (staticOptions.index === false) {
          return next();
        }
        
        // Try to serve the index file
        const indexPath = path.join(absolutePath, staticOptions.index as string);
        fs.stat(indexPath, (err, indexStats) => {
          if (err || !indexStats.isFile()) {
            return next();
          }
          
          // If index file exists, serve it
          serveFile(indexPath, req, res, next, staticOptions);
        });
      } else if (stats.isFile()) {
        // Serve the file directly
        serveFile(absolutePath, req, res, next, staticOptions);
      } else {
        // Not a file or directory
        return next();
      }
    });
  };
}

/**
 * Helper function to serve a file with appropriate headers
 */
function serveFile(
  filePath: string, 
  req: Request, 
  res: Response, 
  next: NextFunction, 
  options: { etag?: boolean; maxAge?: number }
): void {
  // Get file extension and set content type
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  
  // Set appropriate headers
  res.setHeader('Content-Type', contentType);
  
  // Set cache control headers
  if (options.maxAge) {
    res.setHeader('Cache-Control', `public, max-age=${options.maxAge}`);
  }
  
  // Only stream file for GET requests (HEAD requests only need headers)
  if (req.method === 'HEAD') {
    fs.stat(filePath, (err, stats) => {
      if (err) return next(err);
      res.setHeader('Content-Length', stats.size);
      res.end();
    });
    return;
  }
  
  // Create read stream
  const fileStream = fs.createReadStream(filePath);
  
  // Handle errors in the stream
  fileStream.on('error', (err) => {
    next(err);
  });
  
  // Pipe the file to the response
  fileStream.pipe(res);
}
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

