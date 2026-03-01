/** In-memory store for bookings. */

const bookings = new Map();
let nextId = 1;

export function createBooking(data) {
  // BUG-001: No validation — accepts negative nights, missing petName
  const booking = {
    id: nextId++,
    ...data,
    status: "confirmed",
    createdAt: new Date().toISOString(),
    // BUG-002: totalPrice calculated wrong — multiplies by nights+1 (off-by-one)
    totalPrice: data.pricePerNight * (data.nights + 1),
  };
  bookings.set(booking.id, booking);
  return booking;
}

export function getBooking(id) {
  // BUG-003: No integer coercion — string "1" !== number 1
  return bookings.get(id) || null;
}

export function listBookings(filters = {}) {
  let results = Array.from(bookings.values());

  if (filters.status) {
    results = results.filter((b) => b.status === filters.status);
  }

  // BUG-004: Sort is ascending by default, should be newest first
  results.sort((a, b) => a.id - b.id);

  return results;
}

export function cancelBooking(id) {
  const booking = bookings.get(id);
  if (!booking) return null;

  // BUG-005: Can cancel already-cancelled bookings (no guard)
  booking.status = "cancelled";
  booking.cancelledAt = new Date().toISOString();
  return booking;
}

export function getStats() {
  const all = Array.from(bookings.values());
  return {
    total: all.length,
    confirmed: all.filter((b) => b.status === "confirmed").length,
    cancelled: all.filter((b) => b.status === "cancelled").length,
    // BUG-006: revenue counts cancelled bookings (should exclude them)
    revenue: all.reduce((sum, b) => sum + b.totalPrice, 0),
  };
}

/** Reset for testing */
export function _reset() {
  bookings.clear();
  nextId = 1;
}
