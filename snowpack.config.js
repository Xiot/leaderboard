/** @type {import("snowpack").SnowpackUserConfig } */
module.exports = {
  exclude: ['**/scripts/**/*', '**/src/server/**/*'],
  installOptions: {
    sourceMap: true,
    externalPackage: ['@web/dev-server', '@web/dev-server-core'],
  },
  devOptions: {
    port: 3001,
    secure: true,
    hmr: true,
    open: 'none',
  },
  buildOptions: {
    out: 'dist/client',
    metaDir: 'meta/snowpack',
    sourceMaps: true,
    clean: true,
  },
  mount: {
    public: { url: '/', static: true },
    'src/client': { url: '/js' },
  },
  proxy: {
    '/api': {
      target: 'http://localhost:3002',
      xfwd: true,
    },
  },
};
