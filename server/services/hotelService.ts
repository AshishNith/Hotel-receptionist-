import fs from "fs";
import path from "path";
import { GOOGLE_SHEETS_SPREADSHEET_ID } from "../config.js";
import { logToFile } from "../utils.js";
import {
  getSheetsAuthClient,
  readSheetRows,
  appendSheetRow,
  updateSheetRow,
} from "./googleSheetsService.js";

// Inventory definition
const INVENTORY = {
  deluxe: 5,
  executive: 3,
  presidential: 1,
};

const DATA_DIR = path.resolve(process.cwd(), "data");
const BOOKINGS_CSV = path.join(DATA_DIR, "bookings.csv");
const FOOD_ORDERS_CSV = path.join(DATA_DIR, "food_orders.csv");
const ROOMS_JSON = path.join(DATA_DIR, "rooms.json");
const MENU_JSON = path.join(DATA_DIR, "restaurant_menu.json");
const FAQ_CSV = path.join(DATA_DIR, "hotel_faq.csv");

/**
 * Checks if Google Sheets is fully configured and authenticated.
 */
async function isGoogleSheetsActive(): Promise<boolean> {
  if (!GOOGLE_SHEETS_SPREADSHEET_ID) return false;
  try {
    const auth = await getSheetsAuthClient();
    return !!auth;
  } catch {
    return false;
  }
}

// Helper: Ensure CSV file exists with header
function ensureCSVExists(filePath: string, header: string) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, header + "\n", "utf8");
  }
}

// CSV Parser Helper
function parseCSV(content: string): string[][] {
  const lines = content.split(/\r?\n/);
  const result: string[][] = [];
  for (const line of lines) {
    if (!line.trim()) continue;

    const row: string[] = [];
    let insideQuote = false;
    let currentCell = "";

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        insideQuote = !insideQuote;
      } else if (char === "," && !insideQuote) {
        row.push(currentCell.trim());
        currentCell = "";
      } else {
        currentCell += char;
      }
    }
    row.push(currentCell.trim());
    result.push(row);
  }
  return result;
}

// CSV Serializer Helper
function toCSVLine(row: string[]): string {
  return row
    .map((cell) => {
      const stringified = String(cell);
      if (
        stringified.includes(",") ||
        stringified.includes('"') ||
        stringified.includes("\n")
      ) {
        return `"${stringified.replace(/"/g, '""')}"`;
      }
      return stringified;
    })
    .join(",");
}

// Check overlapping dates
function isOverlapping(
  start1: string,
  end1: string,
  start2: string,
  end2: string
): boolean {
  const s1 = new Date(start1).getTime();
  const e1 = new Date(end1).getTime();
  const s2 = new Date(start2).getTime();
  const e2 = new Date(end2).getTime();
  return s1 < e2 && e1 > s2;
}

// Load Rooms Config
export function loadRooms() {
  if (!fs.existsSync(ROOMS_JSON)) return [];
  return JSON.parse(fs.readFileSync(ROOMS_JSON, "utf8"));
}

// Load Restaurant Menu
export function loadMenu() {
  if (!fs.existsSync(MENU_JSON)) return [];
  return JSON.parse(fs.readFileSync(MENU_JSON, "utf8"));
}

// ─── Room Availability ──────────────────────────────────────────
export async function checkRoomAvailability(
  startDate: string,
  endDate: string,
  guestCount: number,
  roomTypePreference?: string
) {
  let bookingsRows: string[][] = [];
  const useSheets = await isGoogleSheetsActive();

  if (useSheets) {
    try {
      const rows = await readSheetRows("Bookings");
      bookingsRows = rows.slice(1); // skip header
    } catch (err: any) {
      logToFile(`[HotelService] Google Sheets read failed, falling back to CSV: ${err?.message || err}`);
      ensureCSVExists(
        BOOKINGS_CSV,
        "BookingID,Name,Phone,Email,RoomType,CheckIn,CheckOut,Guests,TotalPrice,Status,Addons,CallSummary,CallRecordingUrl"
      );
      const bookingsContent = fs.readFileSync(BOOKINGS_CSV, "utf8");
      bookingsRows = parseCSV(bookingsContent).slice(1);
    }
  } else {
    ensureCSVExists(
      BOOKINGS_CSV,
      "BookingID,Name,Phone,Email,RoomType,CheckIn,CheckOut,Guests,TotalPrice,Status,Addons,CallSummary,CallRecordingUrl"
    );
    const bookingsContent = fs.readFileSync(BOOKINGS_CSV, "utf8");
    bookingsRows = parseCSV(bookingsContent).slice(1);
  }

  // Count how many rooms are booked per type during this duration
  const bookedCounts: Record<string, number> = {
    deluxe: 0,
    executive: 0,
    presidential: 0,
  };

  for (const row of bookingsRows) {
    const [_, __, ___, ____, roomType, checkIn, checkOut, _____, ______, status] = row;
    if (status === "Booked" && isOverlapping(startDate, endDate, checkIn, checkOut)) {
      const type = roomType?.toLowerCase();
      const shortType = type?.includes("deluxe")
        ? "deluxe"
        : type?.includes("executive")
        ? "executive"
        : "presidential";
      if (bookedCounts[shortType] !== undefined) {
        bookedCounts[shortType]++;
      }
    }
  }

  // Compile availability status
  const rooms = loadRooms();
  const availability = rooms.map((room: any) => {
    const type = room.type.toLowerCase();
    const totalCapacity = INVENTORY[type as keyof typeof INVENTORY] || 0;
    const booked = bookedCounts[type] || 0;
    const availableCount = Math.max(0, totalCapacity - booked);

    return {
      type: room.type,
      name: room.name,
      price: room.price,
      capacityPerRoom: room.capacity,
      availableCount,
      isAvailable: availableCount > 0 && guestCount <= room.capacity,
      description: room.description,
    };
  });

  // Filter by preference if specified
  if (roomTypePreference) {
    const pref = roomTypePreference.toLowerCase();
    return availability.filter((a) => a.type.toLowerCase() === pref);
  }

  return availability;
}

// ─── Create Reservation ─────────────────────────────────────────
export async function makeRoomReservation(
  name: string,
  phone: string,
  email: string,
  roomType: string,
  checkIn: string,
  checkOut: string,
  guests: number,
  addons: string[] = []
) {
  const cleanPhone = phone.replace(/^\+/, "").trim();
  const type = roomType.toLowerCase();

  // Verify availability first
  const availability = await checkRoomAvailability(checkIn, checkOut, guests, roomType);
  if (availability.length === 0 || !availability[0].isAvailable) {
    return {
      success: false,
      error: `No rooms of type '${roomType}' are available for the selected dates.`,
    };
  }

  // Calculate price
  const rooms = loadRooms();
  const room = rooms.find((r: any) => r.type.toLowerCase() === type);
  if (!room) {
    return { success: false, error: `Invalid room type '${roomType}'.` };
  }

  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);
  const nights = Math.max(
    1,
    Math.round((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24))
  );

  let basePrice = room.price * nights;
  let addonPrice = 0;

  // Addon charges calculations
  for (const addon of addons) {
    const add = addon.toLowerCase();
    if (add.includes("breakfast")) {
      addonPrice += 300 * nights * guests;
    } else if (add.includes("spa")) {
      addonPrice += 1500;
    } else if (add.includes("early")) {
      addonPrice += 1000;
    }
  }

  const totalPrice = basePrice + addonPrice;
  const bookingId = "BK-" + Math.floor(1000 + Math.random() * 9000);

  const row = [
    bookingId,
    name,
    cleanPhone,
    email,
    room.name,
    checkIn,
    checkOut,
    String(guests),
    String(totalPrice),
    "Booked",
    addons.join(";"),
    "", // CallSummary
    "", // CallRecordingUrl
  ];

  const useSheets = await isGoogleSheetsActive();
  if (useSheets) {
    try {
      await appendSheetRow("Bookings", row);
    } catch (err: any) {
      logToFile(`[HotelService] Google Sheets append failed, falling back to CSV: ${err?.message || err}`);
      ensureCSVExists(
        BOOKINGS_CSV,
        "BookingID,Name,Phone,Email,RoomType,CheckIn,CheckOut,Guests,TotalPrice,Status,Addons,CallSummary,CallRecordingUrl"
      );
      fs.appendFileSync(BOOKINGS_CSV, toCSVLine(row) + "\n", "utf8");
    }
  } else {
    ensureCSVExists(
      BOOKINGS_CSV,
      "BookingID,Name,Phone,Email,RoomType,CheckIn,CheckOut,Guests,TotalPrice,Status,Addons,CallSummary,CallRecordingUrl"
    );
    fs.appendFileSync(BOOKINGS_CSV, toCSVLine(row) + "\n", "utf8");
  }

  return {
    success: true,
    bookingId,
    name,
    roomType: room.name,
    checkIn,
    checkOut,
    nights,
    guests,
    totalPrice,
    addons,
  };
}

// ─── Modify or Cancel Booking ──────────────────────────────────
export async function modifyOrCancelReservation(
  bookingId: string,
  phone: string,
  action: "modify" | "cancel",
  updates?: {
    newCheckIn?: string;
    newCheckOut?: string;
    newRoomType?: string;
    newGuests?: number;
    newAddons?: string[];
  }
) {
  const cleanPhone = phone.replace(/^\+/, "").trim();
  const useSheets = await isGoogleSheetsActive();

  if (useSheets) {
    try {
      if (action === "cancel") {
        const success = await updateSheetRow("Bookings", "BookingID", bookingId, {
          Status: "Cancelled",
        });
        if (!success) {
          return {
            success: false,
            error: `No booking found matching Booking ID '${bookingId}' and Phone Number '${phone}'.`,
          };
        }
        return {
          success: true,
          message: `Reservation '${bookingId}' has been successfully cancelled.`,
        };
      }

      if (action === "modify" && updates) {
        const rows = await readSheetRows("Bookings");
        const dataRows = rows.slice(1);

        let foundIndex = -1;
        for (let i = 0; i < dataRows.length; i++) {
          const [id, _, rowPhone] = dataRows[i];
          if (id.toUpperCase() === bookingId.toUpperCase() && rowPhone === cleanPhone) {
            foundIndex = i;
            break;
          }
        }

        if (foundIndex === -1) {
          return {
            success: false,
            error: `No booking found matching Booking ID '${bookingId}' and Phone Number '${phone}'.`,
          };
        }

        const targetRow = dataRows[foundIndex];
        const [
          id,
          name,
          ph,
          email,
          roomType,
          checkIn,
          checkOut,
          guestsStr,
          totalPriceStr,
          status,
          addonsStr,
        ] = targetRow;

        const checkInVal = updates.newCheckIn || checkIn;
        const checkOutVal = updates.newCheckOut || checkOut;
        const guestsVal = updates.newGuests || parseInt(guestsStr);
        const roomTypeVal = updates.newRoomType || roomType;
        const addonsVal = updates.newAddons || (addonsStr ? addonsStr.split(";") : []);

        const rooms = loadRooms();
        const room = rooms.find(
          (r: any) =>
            r.name.toLowerCase() === roomTypeVal.toLowerCase() ||
            r.type.toLowerCase() === roomTypeVal.toLowerCase()
        );
        if (!room) {
          return { success: false, error: `Invalid room type preference '${roomTypeVal}'.` };
        }

        const checkInDate = new Date(checkInVal);
        const checkOutDate = new Date(checkOutVal);
        const nights = Math.max(
          1,
          Math.round((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24))
        );

        const bookedCounts: Record<string, number> = {
          deluxe: 0,
          executive: 0,
          presidential: 0,
        };
        for (let i = 0; i < dataRows.length; i++) {
          if (i === foundIndex) continue;
          const [_, __, ___, ____, rType, cIn, cOut, _____, ______, statusVal] = dataRows[i];
          if (statusVal === "Booked" && isOverlapping(checkInVal, checkOutVal, cIn, cOut)) {
            const type = rType.toLowerCase();
            const shortType = type.includes("deluxe")
              ? "deluxe"
              : type.includes("executive")
              ? "executive"
              : "presidential";
            bookedCounts[shortType]++;
          }
        }

        const shortType = room.type.toLowerCase();
        const totalCapacity = INVENTORY[shortType as keyof typeof INVENTORY] || 0;
        const booked = bookedCounts[shortType] || 0;
        const availableCount = Math.max(0, totalCapacity - booked);

        if (availableCount <= 0 || guestsVal > room.capacity) {
          return {
            success: false,
            error: `Room of type '${room.name}' is not available for the updated dates.`,
          };
        }

        let basePrice = room.price * nights;
        let addonPrice = 0;
        for (const addon of addonsVal) {
          const add = addon.toLowerCase();
          if (add.includes("breakfast")) addonPrice += 300 * nights * guestsVal;
          else if (add.includes("spa")) addonPrice += 1500;
          else if (add.includes("early")) addonPrice += 1000;
        }
        const totalPrice = basePrice + addonPrice;

        await updateSheetRow("Bookings", "BookingID", bookingId, {
          RoomType: room.name,
          CheckIn: checkInVal,
          CheckOut: checkOutVal,
          Guests: String(guestsVal),
          TotalPrice: String(totalPrice),
          Addons: addonsVal.join(";"),
        });

        return {
          success: true,
          bookingId,
          name,
          roomType: room.name,
          checkIn: checkInVal,
          checkOut: checkOutVal,
          guests: guestsVal,
          totalPrice,
          addons: addonsVal,
        };
      }
    } catch (err: any) {
      logToFile(`[HotelService] Google Sheets modify failed, falling back to CSV: ${err?.message || err}`);
    }
  }

  // Fallback to local CSV
  ensureCSVExists(
    BOOKINGS_CSV,
    "BookingID,Name,Phone,Email,RoomType,CheckIn,CheckOut,Guests,TotalPrice,Status,Addons,CallSummary,CallRecordingUrl"
  );

  const bookingsContent = fs.readFileSync(BOOKINGS_CSV, "utf8");
  const bookingsRows = parseCSV(bookingsContent);
  const header = bookingsRows[0];
  const dataRows = bookingsRows.slice(1);

  let foundIndex = -1;

  for (let i = 0; i < dataRows.length; i++) {
    const [id, _, rowPhone] = dataRows[i];
    if (id.toUpperCase() === bookingId.toUpperCase() && rowPhone === cleanPhone) {
      foundIndex = i;
      break;
    }
  }

  if (foundIndex === -1) {
    return {
      success: false,
      error: `No booking found matching Booking ID '${bookingId}' and Phone Number '${phone}'.`,
    };
  }

  const targetRow = dataRows[foundIndex];

  if (action === "cancel") {
    targetRow[9] = "Cancelled";
    const newContent = [header, ...dataRows].map((r) => toCSVLine(r)).join("\n") + "\n";
    fs.writeFileSync(BOOKINGS_CSV, newContent, "utf8");
    return { success: true, message: `Reservation '${bookingId}' has been successfully cancelled.` };
  }

  if (action === "modify" && updates) {
    const [
      id,
      name,
      ph,
      email,
      roomType,
      checkIn,
      checkOut,
      guestsStr,
      totalPriceStr,
      status,
      addonsStr,
    ] = targetRow;

    const checkInVal = updates.newCheckIn || checkIn;
    const checkOutVal = updates.newCheckOut || checkOut;
    const guestsVal = updates.newGuests || parseInt(guestsStr);
    const roomTypeVal = updates.newRoomType || roomType;
    const addonsVal = updates.newAddons || (addonsStr ? addonsStr.split(";") : []);

    const rooms = loadRooms();
    const room = rooms.find(
      (r: any) =>
        r.name.toLowerCase() === roomTypeVal.toLowerCase() ||
        r.type.toLowerCase() === roomTypeVal.toLowerCase()
    );
    if (!room) {
      return { success: false, error: `Invalid room type preference '${roomTypeVal}'.` };
    }

    const checkInDate = new Date(checkInVal);
    const checkOutDate = new Date(checkOutVal);
    const nights = Math.max(
      1,
      Math.round((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24))
    );

    const bookedCounts: Record<string, number> = {
      deluxe: 0,
      executive: 0,
      presidential: 0,
    };
    for (let i = 0; i < dataRows.length; i++) {
      if (i === foundIndex) continue;
      const [_, __, ___, ____, rType, cIn, cOut, _____, ______, statusVal] = dataRows[i];
      if (statusVal === "Booked" && isOverlapping(checkInVal, checkOutVal, cIn, cOut)) {
        const type = rType.toLowerCase();
        const shortType = type.includes("deluxe")
          ? "deluxe"
          : type.includes("executive")
          ? "executive"
          : "presidential";
        bookedCounts[shortType]++;
      }
    }

    const shortType = room.type.toLowerCase();
    const totalCapacity = INVENTORY[shortType as keyof typeof INVENTORY] || 0;
    const booked = bookedCounts[shortType] || 0;
    const availableCount = Math.max(0, totalCapacity - booked);

    if (availableCount <= 0 || guestsVal > room.capacity) {
      return {
        success: false,
        error: `Room of type '${room.name}' is not available for the updated dates.`,
      };
    }

    let basePrice = room.price * nights;
    let addonPrice = 0;
    for (const addon of addonsVal) {
      const add = addon.toLowerCase();
      if (add.includes("breakfast")) addonPrice += 300 * nights * guestsVal;
      else if (add.includes("spa")) addonPrice += 1500;
      else if (add.includes("early")) addonPrice += 1000;
    }
    const totalPrice = basePrice + addonPrice;

    targetRow[4] = room.name;
    targetRow[5] = checkInVal;
    targetRow[6] = checkOutVal;
    targetRow[7] = String(guestsVal);
    targetRow[8] = String(totalPrice);
    targetRow[10] = addonsVal.join(";");

    const newContent = [header, ...dataRows].map((r) => toCSVLine(r)).join("\n") + "\n";
    fs.writeFileSync(BOOKINGS_CSV, newContent, "utf8");

    return {
      success: true,
      bookingId,
      name,
      roomType: room.name,
      checkIn: checkInVal,
      checkOut: checkOutVal,
      guests: guestsVal,
      totalPrice,
      addons: addonsVal,
    };
  }

  return { success: false, error: "Invalid action parameters." };
}

// ─── Food Ordering Service ──────────────────────────────────────
export async function orderFood(
  bookingIdOrRoom: string,
  items: { itemId: string; quantity: number }[]
) {
  const menu = loadMenu();
  let totalOrderPrice = 0;
  const orderDetails: string[] = [];

  for (const item of items) {
    const menuItem = menu.find((m: any) => m.id.toLowerCase() === item.itemId.toLowerCase());
    if (!menuItem) {
      return { success: false, error: `Food item '${item.itemId}' is not available in the menu.` };
    }
    const linePrice = menuItem.price * item.quantity;
    totalOrderPrice += linePrice;
    orderDetails.push(`${menuItem.name} (x${item.quantity})`);
  }

  const orderId = "FD-" + Math.floor(1000 + Math.random() * 9000);
  const timestamp = new Date().toISOString();

  const row = [
    orderId,
    bookingIdOrRoom,
    orderDetails.join(";"),
    String(totalOrderPrice),
    "Ordered",
    timestamp,
  ];

  const useSheets = await isGoogleSheetsActive();
  if (useSheets) {
    try {
      await appendSheetRow("FoodOrders", row);
    } catch (err: any) {
      logToFile(`[HotelService] Google Sheets FoodOrders write failed, falling back to CSV: ${err?.message || err}`);
      ensureCSVExists(
        FOOD_ORDERS_CSV,
        "OrderID,BookingIDOrRoom,ItemsOrdered,TotalPrice,Status,Timestamp"
      );
      fs.appendFileSync(FOOD_ORDERS_CSV, toCSVLine(row) + "\n", "utf8");
    }
  } else {
    ensureCSVExists(
      FOOD_ORDERS_CSV,
      "OrderID,BookingIDOrRoom,ItemsOrdered,TotalPrice,Status,Timestamp"
    );
    fs.appendFileSync(FOOD_ORDERS_CSV, toCSVLine(row) + "\n", "utf8");
  }

  return {
    success: true,
    orderId,
    roomOrBooking: bookingIdOrRoom,
    itemsOrdered: orderDetails,
    totalPrice: totalOrderPrice,
    status: "Ordered",
    timestamp,
  };
}

// ─── Hotel FAQ Search (Knowledge Base) ──────────────────────────
export async function getHotelFaq(query: string) {
  let rows: string[][] = [];
  const useSheets = await isGoogleSheetsActive();

  if (useSheets) {
    try {
      const sheetsRows = await readSheetRows("FAQ");

      // Seed FAQ tab from local CSV if empty (only has header or empty)
      if (sheetsRows.length <= 1) {
        logToFile("[HotelService] FAQ Google Sheet tab is empty. Pre-seeding from hotel_faq.csv...");
        ensureCSVExists(FAQ_CSV, "Topic,Question,Answer");
        const faqContent = fs.readFileSync(FAQ_CSV, "utf8");
        const localFaqRows = parseCSV(faqContent).slice(1); // skip header

        for (const localRow of localFaqRows) {
          try {
            await appendSheetRow("FAQ", localRow);
          } catch (seedErr) {
            logToFile(`[HotelService] FAQ pre-seeding failed for row: ${seedErr}`);
          }
        }

        // Re-read after pre-seeding completes
        const refreshedRows = await readSheetRows("FAQ");
        rows = refreshedRows.slice(1);
      } else {
        rows = sheetsRows.slice(1);
      }
    } catch (err: any) {
      logToFile(`[HotelService] FAQ Google Sheets read failed, falling back to CSV: ${err?.message || err}`);
      ensureCSVExists(FAQ_CSV, "Topic,Question,Answer");
      const faqContent = fs.readFileSync(FAQ_CSV, "utf8");
      rows = parseCSV(faqContent).slice(1);
    }
  } else {
    ensureCSVExists(FAQ_CSV, "Topic,Question,Answer");
    const faqContent = fs.readFileSync(FAQ_CSV, "utf8");
    rows = parseCSV(faqContent).slice(1);
  }

  const words = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2);

  const matches = rows
    .map(([topic, question, answer]) => {
      let score = 0;
      const textToMatch = `${topic} ${question}`.toLowerCase();

      for (const word of words) {
        if (textToMatch?.includes(word)) score += 1;
      }

      return { topic, question, answer, score };
    })
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score);

  if (matches.length > 0) {
    return matches
      .slice(0, 3)
      .map((m) => ({ topic: m.topic, question: m.question, answer: m.answer }));
  }

  // Fallback return first 3 FAQs if no keywords matched
  return rows.slice(0, 3).map((r) => ({ topic: r[0], question: r[1], answer: r[2] }));
}

/**
 * Updates an existing reservation row in Google Sheets and local bookings.csv with Call Summary & Call Recording URL.
 */
export async function updateBookingWithCallSummary(
  bookingId: string,
  summary: string,
  recordingUrl: string
): Promise<void> {
  const useSheets = await isGoogleSheetsActive();
  if (useSheets) {
    try {
      await updateSheetRow("Bookings", "BookingID", bookingId, {
        CallSummary: summary,
        CallRecordingUrl: recordingUrl,
      });
    } catch (err: any) {
      logToFile(`[HotelService] Google Sheets update failed for booking ${bookingId}: ${err?.message || err}`);
    }
  }

  // Always update local CSV fallback
  try {
    ensureCSVExists(
      BOOKINGS_CSV,
      "BookingID,Name,Phone,Email,RoomType,CheckIn,CheckOut,Guests,TotalPrice,Status,Addons,CallSummary,CallRecordingUrl"
    );
    const content = fs.readFileSync(BOOKINGS_CSV, "utf8");
    const rows = parseCSV(content);
    if (rows.length > 0) {
      const header = rows[0];
      const dataRows = rows.slice(1);

      const callSummaryIdx = header.indexOf("CallSummary");
      const recordingUrlIdx = header.indexOf("CallRecordingUrl");

      let updated = false;
      for (const row of dataRows) {
        if (row[0]?.toUpperCase() === bookingId.toUpperCase()) {
          if (callSummaryIdx !== -1) row[callSummaryIdx] = summary;
          if (recordingUrlIdx !== -1) row[recordingUrlIdx] = recordingUrl;
          updated = true;
          break;
        }
      }

      if (updated) {
        const newContent = [header, ...dataRows].map((r) => toCSVLine(r)).join("\n") + "\n";
        fs.writeFileSync(BOOKINGS_CSV, newContent, "utf8");
        logToFile(`[HotelService] Local bookings.csv updated for booking ${bookingId}`);
      }
    }
  } catch (csvErr: any) {
    logToFile(`[HotelService] Failed to update local CSV for booking ${bookingId}: ${csvErr?.message || csvErr}`);
  }
}
