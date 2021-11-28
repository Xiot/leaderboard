/** @type {import("snowpack").SnowpackUserConfig } */
module.exports = {
  exclude: ["scripts/**/*"],
  packageOptions: {
    sourcemap: true,
    external: [
      "@web/dev-server",
      "@web/dev-server-core"
    ]
  },
  devOptions: {
    port: 3001,
    secure: true,
    hmr: true,
    open: 'none',
  },
  buildOptions: {
    out: 'dist',
    metaUrlPath: 'meta/snowpack',
    sourcemap: true,
    clean: true,
  },
  mount: {
    public: {url: '/', static: true},
    src: {url: '/js'}
  }
}