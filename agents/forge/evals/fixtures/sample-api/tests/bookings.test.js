import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  createBooking,
  getBooking,
  listBookings,
  cancelBooking,
  getStats,
  _reset,
} from "../src/services/bookings.js";

describe("Booking Service", () => {
  beforeEach(() => _reset());

  // --- BUG-001: Validation ---

  it("should reject booking with missing petName", () => {
    // FAILS: no validation exists
    assert.throws(
      () => createBooking({ nights: 3, pricePerNight: 50 }),
      { message: /petName is required/ }
    );
  });

  it("should reject booking with negative nights", () => {
    // FAILS: no validation exists
    assert.throws(
      () => createBooking({ petName: "Rex", nights: -1, pricePerNight: 50 }),
      { message: /nights must be positive/ }
    );
  });

  // --- BUG-002: Price calculation ---

  it("should calculate totalPrice correctly", () => {
    // FAILS: off-by-one (nights+1 instead of nights)
    const b = createBooking({ petName: "Rex", nights: 3, pricePerNight: 50 });
    assert.equal(b.totalPrice, 150); // expects 3*50=150, gets 4*50=200
  });

  // --- BUG-003: ID coercion ---

  it("should find booking by string ID from URL params", () => {
    // FAILS: Map.get("1") !== Map.get(1)
    const created = createBooking({ petName: "Rex", nights: 2, pricePerNight: 40 });
    const found = getBooking(String(created.id));
    assert.ok(found, "should find booking by string ID");
    assert.equal(found.id, created.id);
  });

  // --- BUG-004: Sort order ---

  it("should list bookings newest first", () => {
    // FAILS: sorts ascending (oldest first)
    createBooking({ petName: "Rex", nights: 1, pricePerNight: 30 });
    createBooking({ petName: "Luna", nights: 2, pricePerNight: 40 });
    createBooking({ petName: "Max", nights: 3, pricePerNight: 50 });
    const list = listBookings();
    assert.equal(list[0].petName, "Max", "newest booking should be first");
  });

  // --- BUG-005: Double cancel guard ---

  it("should not allow cancelling an already cancelled booking", () => {
    // FAILS: no guard on status
    const b = createBooking({ petName: "Rex", nights: 2, pricePerNight: 40 });
    cancelBooking(b.id);
    assert.throws(
      () => cancelBooking(b.id),
      { message: /already cancelled/ }
    );
  });

  // --- BUG-006: Revenue excludes cancelled ---

  it("should exclude cancelled bookings from revenue", () => {
    // FAILS: revenue counts all bookings
    const b1 = createBooking({ petName: "Rex", nights: 2, pricePerNight: 50 });
    const b2 = createBooking({ petName: "Luna", nights: 3, pricePerNight: 40 });
    cancelBooking(b2.id);
    const stats = getStats();
    // Only the non-cancelled booking should count, regardless of BUG-002 math.
    assert.equal(stats.revenue, b1.totalPrice);
    assert.equal(stats.confirmed, 1);
    assert.equal(stats.cancelled, 1);
  });

  // --- Passing tests (regression guard) ---

  it("should create a booking with all fields", () => {
    const b = createBooking({ petName: "Rex", nights: 2, pricePerNight: 40 });
    assert.ok(b.id);
    assert.equal(b.petName, "Rex");
    assert.equal(b.status, "confirmed");
    assert.ok(b.createdAt);
  });

  it("should return null for non-existent booking", () => {
    const b = getBooking(999);
    assert.equal(b, null);
  });

  it("should filter bookings by status", () => {
    createBooking({ petName: "Rex", nights: 1, pricePerNight: 30 });
    const b2 = createBooking({ petName: "Luna", nights: 2, pricePerNight: 40 });
    cancelBooking(b2.id);
    const confirmed = listBookings({ status: "confirmed" });
    assert.equal(confirmed.length, 1);
    assert.equal(confirmed[0].petName, "Rex");
  });
});
