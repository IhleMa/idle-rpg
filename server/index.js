import { openDb } from './db.js';
import { createApp } from './app.js';

openDb();
const port = Number(process.env.PORT) || 3000;
createApp().listen(port, () => {
  console.log(`Realms of Ashenvale running at http://localhost:${port}`);
});
