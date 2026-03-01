import Fastify from "fastify";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import bookingRoutes from "./routes/bookings.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = Fastify({ logger: true });

app.register(bookingRoutes);

// Serve frontend
app.get("/", async (request, reply) => {
  const fs = await import("fs");
  const html = fs.readFileSync(join(__dirname, "../frontend/index.html"), "utf-8");
  reply.type("text/html").send(html);
});

const start = async () => {
  try {
    await app.listen({ port: 3099, host: "0.0.0.0" });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();

export { app };
