import fs from "fs";
import path from "path";
import { GOOGLE_SHEETS_SPREADSHEET_ID } from "../config.js";
import { logToFile, parseDateString } from "../utils.js";
import {
  getSheetsAuthClient,
  readSheetRows,
  appendSheetRow,
  updateSheetRow,
} from "./googleSheetsService.js";

const DATA_DIR = path.resolve(process.cwd(), "data");
export const ORDERS_CSV = path.join(DATA_DIR, "orders.csv");
export const ABANDONED_CARTS_CSV = path.join(DATA_DIR, "abandoned_carts.csv");
export const STORE_FAQ_CSV = path.join(DATA_DIR, "store_faq.csv");

/**
 * Checks if Google Sheets is fully configured and authenticated.
 */
export async function isGoogleSheetsActive(): Promise<boolean> {
  if (!GOOGLE_SHEETS_SPREADSHEET_ID) return false;
  try {
    const auth = await getSheetsAuthClient();
    return !!auth;
  } catch {
    return false;
  }
}

// Helper: Ensure CSV file exists with header
export function ensureCSVExists(filePath: string, header: string) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, header + "\n", "utf8");
  }
}

// CSV Parser Helper
export function parseCSV(content: string): string[][] {
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

/**
 * Loads order details for context injection.
 */
export async function getOrderDetails(orderId: string) {
  const useSheets = await isGoogleSheetsActive();
  let rows: string[][] = [];

  if (useSheets) {
    try {
      rows = await readSheetRows("Orders");
    } catch (err: any) {
      logToFile(`[EcommerceService] Google Sheets read failed, falling back to CSV: ${err?.message || err}`);
      ensureCSVExists(ORDERS_CSV, "OrderID,CustomerName,Phone,Email,OrderValue,Status,ShippingAddress,CallSummary,CallRecordingUrl,PaymentMethod,RetryCount,NextRetryTime");
      const content = fs.readFileSync(ORDERS_CSV, "utf8");
      rows = parseCSV(content);
    }
  } else {
    ensureCSVExists(ORDERS_CSV, "OrderID,CustomerName,Phone,Email,OrderValue,Status,ShippingAddress,CallSummary,CallRecordingUrl,PaymentMethod,RetryCount,NextRetryTime");
    const content = fs.readFileSync(ORDERS_CSV, "utf8");
    rows = parseCSV(content);
  }

  if (rows.length <= 1) return null;
  const header = rows[0];
  const orderIdx = header.indexOf("OrderID");
  const nameIdx = header.indexOf("CustomerName");
  const phoneIdx = header.indexOf("Phone");
  const emailIdx = header.indexOf("Email");
  const valIdx = header.indexOf("OrderValue");
  const statusIdx = header.indexOf("Status");
  const addrIdx = header.indexOf("ShippingAddress");
  const summaryIdx = header.indexOf("CallSummary");
  const recIdx = header.indexOf("CallRecordingUrl");
  const payIdx = header.indexOf("PaymentMethod");

  const matchRow = rows.slice(1).find((r) => r[orderIdx]?.toUpperCase() === orderId.toUpperCase());
  if (!matchRow) return null;

  return {
    orderId: matchRow[orderIdx],
    customerName: matchRow[nameIdx],
    phone: matchRow[phoneIdx],
    email: matchRow[emailIdx],
    orderValue: Number(matchRow[valIdx] || 0),
    status: matchRow[statusIdx],
    shippingAddress: matchRow[addrIdx],
    callSummary: matchRow[summaryIdx],
    callRecordingUrl: matchRow[recIdx],
    paymentMethod: matchRow[payIdx],
  };
}

/**
 * Loads abandoned cart details for context injection.
 */
export async function getCartDetails(cartId: string) {
  const useSheets = await isGoogleSheetsActive();
  let rows: string[][] = [];

  if (useSheets) {
    try {
      rows = await readSheetRows("AbandonedCarts");
    } catch (err: any) {
      logToFile(`[EcommerceService] Google Sheets read failed, falling back to CSV: ${err?.message || err}`);
      ensureCSVExists(ABANDONED_CARTS_CSV, "CartID,CustomerName,Phone,Email,CartValue,Status,Items,CallSummary,CallRecordingUrl,DiscountApplied");
      const content = fs.readFileSync(ABANDONED_CARTS_CSV, "utf8");
      rows = parseCSV(content);
    }
  } else {
    ensureCSVExists(ABANDONED_CARTS_CSV, "CartID,CustomerName,Phone,Email,CartValue,Status,Items,CallSummary,CallRecordingUrl,DiscountApplied");
    const content = fs.readFileSync(ABANDONED_CARTS_CSV, "utf8");
    rows = parseCSV(content);
  }

  if (rows.length <= 1) return null;
  const header = rows[0];
  const cartIdx = header.indexOf("CartID");
  const nameIdx = header.indexOf("CustomerName");
  const phoneIdx = header.indexOf("Phone");
  const emailIdx = header.indexOf("Email");
  const valIdx = header.indexOf("CartValue");
  const statusIdx = header.indexOf("Status");
  const itemsIdx = header.indexOf("Items");
  const summaryIdx = header.indexOf("CallSummary");
  const recIdx = header.indexOf("CallRecordingUrl");
  const discIdx = header.indexOf("DiscountApplied");

  const matchRow = rows.slice(1).find((r) => r[cartIdx]?.toUpperCase() === cartId.toUpperCase());
  if (!matchRow) return null;

  return {
    cartId: matchRow[cartIdx],
    customerName: matchRow[nameIdx],
    phone: matchRow[phoneIdx],
    email: matchRow[emailIdx],
    cartValue: Number(matchRow[valIdx] || 0),
    status: matchRow[statusIdx],
    items: matchRow[itemsIdx],
    callSummary: matchRow[summaryIdx],
    callRecordingUrl: matchRow[recIdx],
    discountApplied: matchRow[discIdx],
  };
}

/**
 * 1. Confirm COD Order
 */
export async function confirmCodOrder(orderId: string, confirmed: boolean, reason?: string) {
  const newStatus = confirmed ? "COD Confirmed" : "COD Cancelled";
  const updates = { Status: newStatus };
  const ok = await updateOrder(orderId, updates);
  if (!ok) return { success: false, error: `Order ${orderId} not found.` };
  return { success: true, orderId, status: newStatus, reason: reason || "Updated via AI agent call." };
}

/**
 * 2. Verify Shipping Address
 */
export async function verifyShippingAddress(orderId: string, correctedAddress: string, isCorrect: boolean) {
  const updates: Record<string, string> = {};
  if (isCorrect && correctedAddress) {
    updates.ShippingAddress = correctedAddress;
  }
  const ok = await updateOrder(orderId, updates);
  if (!ok) return { success: false, error: `Order ${orderId} not found.` };
  return { success: true, orderId, isCorrect, shippingAddress: correctedAddress || "Verified as correct." };
}

/**
 * 3. Apply Cart Discount
 */
export async function applyCartDiscount(cartId: string, discountCode: string, discountValue: number) {
  const updates = {
    Status: "Recovered",
    DiscountApplied: `${discountCode} (${discountValue}% Off)`,
  };
  const ok = await updateCart(cartId, updates);
  if (!ok) return { success: false, error: `Cart ${cartId} not found.` };
  return { success: true, cartId, discountCode, discountValue, status: "Recovered" };
}

/**
 * 4. Schedule Redelivery (NDR)
 */
export async function scheduleRedelivery(orderId: string, reattemptDate: string, reattemptTimeSlot: string) {
  const updates = {
    Status: "Re-attempt Scheduled",
    CallSummary: `Scheduled redelivery for ${reattemptDate} in slot: ${reattemptTimeSlot}.`,
  };
  const ok = await updateOrder(orderId, updates);
  if (!ok) return { success: false, error: `Order ${orderId} not found.` };
  return { success: true, orderId, reattemptDate, reattemptTimeSlot, status: "Re-attempt Scheduled" };
}

/**
 * 5. Record Delivery Feedback
 */
export async function recordDeliveryFeedback(orderId: string, rating: number, comments: string) {
  const updates = {
    CallSummary: `CSAT Feedback: Rating ${rating}/5. Customer comments: ${comments}.`,
  };
  const ok = await updateOrder(orderId, updates);
  if (!ok) return { success: false, error: `Order ${orderId} not found.` };
  return { success: true, orderId, rating, comments };
}

/**
 * 6. Track Order Shipment
 */
export async function trackOrderStatus(orderId: string) {
  const order = await getOrderDetails(orderId);
  if (!order) return { success: false, error: `Order ${orderId} not found.` };

  // Mock courier partner details
  const courierMap: Record<string, string> = {
    "Pending COD Confirmation": "Delhivery (Awaiting Confirmation)",
    "COD Confirmed": "BlueDart (Processing)",
    "COD Cancelled": "N/A (Cancelled)",
    "Delivery Failed (NDR)": "Shadowfax (NDR - Address Unreachable)",
    "Re-attempt Scheduled": "Shadowfax (Scheduled Re-attempt)",
    "Delivered": "BlueDart (Delivered)",
  };

  const courier = courierMap[order.status] || "Delhivery";
  const trackingId = "TRK" + Math.floor(100000000 + Math.random() * 900000000);
  const eta = order.status === "Delivered" ? "Delivered" : "3 days from now";

  return {
    success: true,
    orderId,
    customerName: order.customerName,
    status: order.status,
    courier,
    trackingId,
    estimatedDelivery: eta,
  };
}

/**
 * 7. Escalate to Live Agent
 */
export async function escalateToHuman(entityId: string, reason: string) {
  logToFile(`[Escalation Triggered] Entity: ${entityId}, Reason: ${reason}`);
  return {
    success: true,
    message: "Call transfer initiated. Handing over call connection to our live human support team shortly.",
    entityId,
    reason,
  };
}

/**
 * 8. Search Store FAQ (Knowledge Base)
 */
export async function getStoreFaq(query: string) {
  let rows: string[][] = [];
  const useSheets = await isGoogleSheetsActive();

  if (useSheets) {
    try {
      rows = await readSheetRows("StoreFAQ");
      if (rows.length <= 1) {
        ensureCSVExists(STORE_FAQ_CSV, "Topic,Question,Answer");
        const content = fs.readFileSync(STORE_FAQ_CSV, "utf8");
        const localRows = parseCSV(content).slice(1);
        for (const localRow of localRows) {
          await appendSheetRow("StoreFAQ", localRow);
        }
        const refreshed = await readSheetRows("StoreFAQ");
        rows = refreshed.slice(1);
      } else {
        rows = rows.slice(1);
      }
    } catch (err: any) {
      logToFile(`[EcommerceService] FAQ Sheets failed, falling back to CSV: ${err?.message || err}`);
      ensureCSVExists(STORE_FAQ_CSV, "Topic,Question,Answer");
      const content = fs.readFileSync(STORE_FAQ_CSV, "utf8");
      rows = parseCSV(content).slice(1);
    }
  } else {
    ensureCSVExists(STORE_FAQ_CSV, "Topic,Question,Answer");
    const content = fs.readFileSync(STORE_FAQ_CSV, "utf8");
    rows = parseCSV(content).slice(1);
  }

  const words = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  const matches = rows
    .map(([topic, question, answer]) => {
      let score = 0;
      const textToMatch = `${topic} ${question}`.toLowerCase();
      for (const word of words) {
        if (textToMatch.includes(word)) score += 1;
      }
      return { topic, question, answer, score };
    })
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score);

  if (matches.length > 0) {
    return matches.slice(0, 3).map((m) => ({ topic: m.topic, question: m.question, answer: m.answer }));
  }

  return rows.slice(0, 3).map((r) => ({ topic: r[0], question: r[1], answer: r[2] }));
}

/**
 * 9. Update Order Summary & Recording
 */
export async function updateOrderWithCallSummary(
  orderId: string,
  summary: string,
  recordingUrl: string,
  status?: string
) {
  const updates: Record<string, string> = {
    CallSummary: summary,
    CallRecordingUrl: recordingUrl,
  };
  if (status) {
    updates.Status = status;
  }
  await updateOrder(orderId, updates);
}

/**
 * 10. Update Cart Summary & Recording
 */
export async function updateCartWithCallSummary(
  cartId: string,
  summary: string,
  recordingUrl: string,
  status?: string
) {
  const updates: Record<string, string> = {
    CallSummary: summary,
    CallRecordingUrl: recordingUrl,
  };
  if (status) {
    updates.Status = status;
  }
  await updateCart(cartId, updates);
}

// Internal updates helper for Orders
async function updateOrder(orderId: string, updates: Record<string, string>): Promise<boolean> {
  const useSheets = await isGoogleSheetsActive();

  if (useSheets) {
    try {
      return await updateSheetRow("Orders", "OrderID", orderId, updates);
    } catch (err: any) {
      logToFile(`[EcommerceService] Sheets updateOrder failed, falling back to CSV: ${err?.message || err}`);
    }
  }

  ensureCSVExists(ORDERS_CSV, "OrderID,CustomerName,Phone,Email,OrderValue,Status,ShippingAddress,CallSummary,CallRecordingUrl,PaymentMethod,RetryCount,NextRetryTime");
  const content = fs.readFileSync(ORDERS_CSV, "utf8");
  const rows = parseCSV(content);
  const header = rows[0];
  const dataRows = rows.slice(1);

  const orderIdx = header.indexOf("OrderID");
  let foundIndex = -1;

  for (let i = 0; i < dataRows.length; i++) {
    if (dataRows[i][orderIdx]?.toUpperCase() === orderId.toUpperCase()) {
      foundIndex = i;
      break;
    }
  }

  if (foundIndex === -1) return false;

  const targetRow = dataRows[foundIndex];
  for (const [colName, val] of Object.entries(updates)) {
    const colIdx = header.indexOf(colName);
    if (colIdx !== -1) {
      targetRow[colIdx] = val;
    }
  }

  const newContent = [header, ...dataRows].map((r) => toCSVLine(r)).join("\n") + "\n";
  fs.writeFileSync(ORDERS_CSV, newContent, "utf8");
  return true;
}

// Internal updates helper for Carts
async function updateCart(cartId: string, updates: Record<string, string>): Promise<boolean> {
  const useSheets = await isGoogleSheetsActive();

  if (useSheets) {
    try {
      return await updateSheetRow("AbandonedCarts", "CartID", cartId, updates);
    } catch (err: any) {
      logToFile(`[EcommerceService] Sheets updateCart failed, falling back to CSV: ${err?.message || err}`);
    }
  }

  ensureCSVExists(ABANDONED_CARTS_CSV, "CartID,CustomerName,Phone,Email,CartValue,Status,Items,CallSummary,CallRecordingUrl,DiscountApplied");
  const content = fs.readFileSync(ABANDONED_CARTS_CSV, "utf8");
  const rows = parseCSV(content);
  const header = rows[0];
  const dataRows = rows.slice(1);

  const cartIdx = header.indexOf("CartID");
  let foundIndex = -1;

  for (let i = 0; i < dataRows.length; i++) {
    if (dataRows[i][cartIdx]?.toUpperCase() === cartId.toUpperCase()) {
      foundIndex = i;
      break;
    }
  }

  if (foundIndex === -1) return false;

  const targetRow = dataRows[foundIndex];
  for (const [colName, val] of Object.entries(updates)) {
    const colIdx = header.indexOf(colName);
    if (colIdx !== -1) {
      targetRow[colIdx] = val;
    }
  }

  const newContent = [header, ...dataRows].map((r) => toCSVLine(r)).join("\n") + "\n";
  fs.writeFileSync(ABANDONED_CARTS_CSV, newContent, "utf8");
  return true;
}
