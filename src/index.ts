import path from 'path';
import { initDb } from './db';
import app from './app';

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

initDb();

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

export default app;
