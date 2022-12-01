import createServer from 'fastify';
import staticPlugin from 'fastify-static';
import { readFileSync } from 'fs';

import path from 'path';
import { fileURLToPath } from 'url';

import { env } from 'process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function serverRelative(file: string) {
  return path.join(__dirname, file);
}
function fileContents(file: string) {
  return readFileSync(serverRelative(file), 'utf-8');
}

const serverOptions =
  env.HTTP === '1'
    ? {}
    : {
        http2: true,
        https: {
          allowHTTP1: true,
          key: fileContents('../../snowpack.key'),
          cert: fileContents('../../snowpack.crt'),
        },
      };

const app = createServer({
  ...serverOptions,
  logger: {
    prettyPrint: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
    },
  },
});

app.get('/api', async () => {
  return 'Hello World\n';
});

app.get<{ Params: { id: string; year: string } }>('/api/aoc/:id/:year', async req => {
  return readFileSync(serverRelative(`./data/aoc/${req.params.id}/${req.params.year}.json`), 'utf-8');
});

app.setNotFoundHandler((req, res) => {
  res.code(404).send('No dice. ' + req.url) + '\n';
});

app.register(staticPlugin, {
  root: path.join(__dirname, '../client'),
  cacheControl: true,
});

app.listen(port(), (err, address) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`Listening at ${address}`);
});

function port() {
  return parseInt(env.PORT ?? '3002');
}
