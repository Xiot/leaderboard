// eslint-disable-next-line @typescript-eslint/no-var-requires
const proxy = require('http2-proxy');

/** @type {import("snowpack").SnowpackUserConfig } */
module.exports = {
  exclude: ['**/scripts/**/*', '**/src/server/**/*'],
  packageOptions: {
    sourcemap: true,
    external: ['@web/dev-server', '@web/dev-server-core'],
  },
  devOptions: {
    port: 3001,
    secure: true,
    hmr: true,
    open: 'none',
  },
  buildOptions: {
    out: 'dist/client',
    metaUrlPath: 'meta/snowpack',
    sourcemap: true,
    clean: true,
  },
  mount: {
    public: { url: '/', static: true },
    'src/client': { url: '/js' },
  },
  routes: [
    {
      src: '/api/.*',
      dest(req, res) {
        console.log('proxy');
        // return 'foo';
        return proxy
          .web(req, res, {
            protocol: 'http',
            hostname: 'localhost',
            port: 3002,
          })
          .catch(ex => {
            console.log('error', ex);

            return '{}';
          });
      },
      // dest: 'http://localhost:3002/api',
    },
  ],
  // '/api': {
  //   target: 'http://localhost:3002',
  //   xfwd: true,
  // },
  // },
};
