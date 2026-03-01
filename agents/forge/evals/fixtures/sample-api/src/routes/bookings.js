/** Booking API routes. */

export default async function bookingRoutes(fastify) {
  fastify.post("/api/bookings", async (request, reply) => {
    const { createBooking } = await import("../services/bookings.js");
    const booking = createBooking(request.body);
    return reply.code(201).send(booking);
  });

  fastify.get("/api/bookings/:id", async (request, reply) => {
    const { getBooking } = await import("../services/bookings.js");
    const booking = getBooking(request.params.id);
    if (!booking) return reply.code(404).send({ error: "Not found" });
    return booking;
  });

  fastify.get("/api/bookings", async (request, reply) => {
    const { listBookings } = await import("../services/bookings.js");
    return listBookings(request.query);
  });

  fastify.delete("/api/bookings/:id", async (request, reply) => {
    const { cancelBooking } = await import("../services/bookings.js");
    const result = cancelBooking(request.params.id);
    if (!result) return reply.code(404).send({ error: "Not found" });
    return result;
  });

  fastify.get("/api/stats", async () => {
    const { getStats } = await import("../services/bookings.js");
    return getStats();
  });

  // BUG-007: No health endpoint (should exist at GET /health)
}
