import Fastify from "fastify";
import bookingRoutes from "./routes/bookings.js";

const app = Fastify({ logger: true });

app.register(bookingRoutes);

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
