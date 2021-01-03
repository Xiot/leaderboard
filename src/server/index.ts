import createServer from 'fastify';
import staticPlugin from 'fastify-static';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function serverRelative(file: string) {
  return path.join(__dirname, file);
}
function fileContents(file: string) {
  return readFileSync(serverRelative(file), 'utf-8');
}

const app = createServer({
  http2: true,
  https: {
    allowHTTP1: false,
    key: fileContents('../../snowpack.key'),
    cert: fileContents('../../snowpack.crt'),
  },
  logger: {
    prettyPrint: {
      colorize: true,
      translateTime: 'SYS:standard',
    },
  },
});

app.get('/api', async (req, res) => {
  return 'Hello World';
});

app.get<{ Params: { id: string; year: string } }>('/api/aoc/:id/:year', async (req, res) => {
  console.log('PWD', req.headers);
  console.log('query', req.query);
  return readFileSync(serverRelative(`./data/aoc/${req.params.id}/${req.params.year}.json`), 'utf-8');
});

app.setNotFoundHandler((req, res) => {
  res.code(404).send('No dice. ' + req.url);
});

app.register(staticPlugin, {
  root: path.join(__dirname, '../client'),
  cacheControl: true,
});

app.listen(3002, (err, address) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`Listening at ${address}`);
});
