import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import r2Handler from './api/r2-upload';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    Object.assign(process.env, env);

    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        {
          name: 'r2-upload-dev-server',
          configureServer(server) {
            server.middlewares.use('/api/r2-upload', async (req, res, next) => {
              if (req.method === 'POST') {
                let body = '';
                req.on('data', chunk => { body += chunk; });
                req.on('end', async () => {
                  try {
                    (req as any).body = body;
                    const mockRes = {
                      setHeader: (k: string, v: string) => res.setHeader(k, v),
                      status: (code: number) => {
                        res.statusCode = code;
                        return {
                          json: (data: any) => {
                            res.setHeader('Content-Type', 'application/json');
                            res.end(JSON.stringify(data));
                          },
                          end: () => res.end()
                        };
                      }
                    };
                    await r2Handler(req, mockRes);
                  } catch (e: any) {
                    res.statusCode = 500;
                    res.end(JSON.stringify({ error: e?.message || 'Server error' }));
                  }
                });
              } else {
                next();
              }
            });
          }
        }
      ],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
