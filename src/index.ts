import { initDb } from './db';
import app from './app';

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
