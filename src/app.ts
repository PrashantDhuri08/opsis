import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { initDb } from "./db/sqlite";
import { chatRoutes } from "./routes/chat";
import { join } from "node:path";

// 1. Initialize SQLite database
initDb();

const htmlFile = Bun.file(join(import.meta.dir, "web", "index.html"));

// 2. Set up Elysia server
const app = new Elysia()
  .use(cors())
  .use(chatRoutes)
  .get("/", () => {
    return new Response(htmlFile, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    });
  })
  .listen(process.env.PORT || 3000);

console.log(
  `🛡️ OpsisAI API is running at: http://${app.server?.hostname}:${app.server?.port}`
);
