import { google } from "googleapis";
import { GoogleTokenModel } from "../models/GoogleToken.js";
import {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI,
  GOOGLE_SHEETS_SPREADSHEET_ID,
} from "../config.js";
import { logToFile } from "../utils.js";

// Helper: Cache initialized sheet tabs to avoid redundant check calls
const initializedSheets = new Set<string>();

const SHEET_HEADERS: Record<string, string[]> = {
  Bookings: [
    "BookingID",
    "Name",
    "Phone",
    "Email",
    "RoomType",
    "CheckIn",
    "CheckOut",
    "Guests",
    "TotalPrice",
    "Status",
    "Addons",
    "CallSummary",
    "CallRecordingUrl",
  ],
  FoodOrders: [
    "OrderID",
    "BookingIDOrRoom",
    "ItemsOrdered",
    "TotalPrice",
    "Status",
    "Timestamp",
  ],
  FAQ: ["Topic", "Question", "Answer"],
};

/**
 * Returns an authenticated OAuth2 client for Google Sheets operations
 * using the saved tokens for the "default" admin session.
 */
export async function getSheetsAuthClient() {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_SHEETS_SPREADSHEET_ID) {
    return null;
  }

  const stored = await GoogleTokenModel.findOne({ phoneKey: "default" });
  if (!stored || !stored.access_token) {
    logToFile("[Google Sheets] Stored default OAuth token not found in MongoDB.");
    return null;
  }

  const oAuth = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
  );

  oAuth.setCredentials({
    access_token: stored.access_token,
    refresh_token: stored.refresh_token,
    expiry_date: stored.expiry_date,
    scope: stored.scope,
    token_type: stored.token_type,
  });

  return oAuth;
}

/**
 * Checks if the specified sheet tab exists in the spreadsheet,
 * creates it if missing, and initializes headers.
 */
export async function ensureSheetInitialized(sheetName: string): Promise<void> {
  if (initializedSheets.has(sheetName)) return;

  const auth = await getSheetsAuthClient();
  if (!auth) {
    throw new Error("Google Sheets is not authenticated. Please link Google Account on the dashboard.");
  }

  const sheets = google.sheets({ version: "v4", auth });

  try {
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: GOOGLE_SHEETS_SPREADSHEET_ID,
    });

    const sheetTitles = spreadsheet.data.sheets?.map((s) => s.properties?.title) || [];

    if (!sheetTitles.includes(sheetName)) {
      logToFile(`[Google Sheets] Creating missing sheet tab: ${sheetName}`);
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: GOOGLE_SHEETS_SPREADSHEET_ID,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: { title: sheetName },
              },
            },
          ],
        },
      });

      // Write column headers
      const headers = SHEET_HEADERS[sheetName];
      if (headers) {
        const lastColLetter = String.fromCharCode(65 + headers.length - 1);
        await sheets.spreadsheets.values.update({
          spreadsheetId: GOOGLE_SHEETS_SPREADSHEET_ID,
          range: `'${sheetName}'!A1:${lastColLetter}1`,
          valueInputOption: "RAW",
          requestBody: {
            values: [headers],
          },
        });
        logToFile(`[Google Sheets] Initialized headers for tab: ${sheetName}`);
      }
    } else {
      // Self-healing: Check for missing headers in existing sheet tab!
      const headers = SHEET_HEADERS[sheetName];
      if (headers) {
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: GOOGLE_SHEETS_SPREADSHEET_ID,
          range: `'${sheetName}'!1:1`,
        });
        const currentHeaders = response.data.values?.[0] || [];
        const missingHeaders = headers.filter((h) => !currentHeaders.includes(h));

        if (missingHeaders.length > 0) {
          logToFile(`[Google Sheets] Existing sheet tab '${sheetName}' is missing columns: ${missingHeaders.join(", ")}. Appending...`);
          const updatedHeaders = [...currentHeaders];
          for (const missing of missingHeaders) {
            updatedHeaders.push(missing);
          }
          const lastColLetter = String.fromCharCode(65 + updatedHeaders.length - 1);
          await sheets.spreadsheets.values.update({
            spreadsheetId: GOOGLE_SHEETS_SPREADSHEET_ID,
            range: `'${sheetName}'!A1:${lastColLetter}1`,
            valueInputOption: "RAW",
            requestBody: {
              values: [updatedHeaders],
            },
          });
          logToFile(`[Google Sheets] Updated columns in existing sheet tab: ${sheetName}`);
        }
      }
    }

    initializedSheets.add(sheetName);
  } catch (err: any) {
    logToFile(`[Google Sheets] Failed to initialize tab '${sheetName}': ${err?.message || err}`);
    throw err;
  }
}

/**
 * Reads all rows from the specified sheet tab.
 */
export async function readSheetRows(sheetName: string): Promise<string[][]> {
  const auth = await getSheetsAuthClient();
  if (!auth) {
    throw new Error("Google Sheets is not authenticated.");
  }

  await ensureSheetInitialized(sheetName);

  const sheets = google.sheets({ version: "v4", auth });

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: GOOGLE_SHEETS_SPREADSHEET_ID,
      range: `'${sheetName}'!A:Z`,
    });

    return response.data.values || [];
  } catch (err: any) {
    logToFile(`[Google Sheets] Error reading rows from tab '${sheetName}': ${err?.message || err}`);
    throw err;
  }
}

/**
 * Appends a new row values to the specified sheet tab.
 */
export async function appendSheetRow(sheetName: string, values: string[]): Promise<void> {
  const auth = await getSheetsAuthClient();
  if (!auth) {
    throw new Error("Google Sheets is not authenticated.");
  }

  await ensureSheetInitialized(sheetName);

  const sheets = google.sheets({ version: "v4", auth });

  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: GOOGLE_SHEETS_SPREADSHEET_ID,
      range: `'${sheetName}'!A:A`,
      valueInputOption: "RAW",
      requestBody: {
        values: [values],
      },
    });
    logToFile(`[Google Sheets] Successfully appended new row to tab '${sheetName}'.`);
  } catch (err: any) {
    logToFile(`[Google Sheets] Error appending row to tab '${sheetName}': ${err?.message || err}`);
    throw err;
  }
}

/**
 * Updates columns of a row matching a specific key values (e.g. BookingID).
 */
export async function updateSheetRow(
  sheetName: string,
  keyColumnName: string,
  keyValue: string,
  updates: Record<string, string>
): Promise<boolean> {
  const auth = await getSheetsAuthClient();
  if (!auth) {
    throw new Error("Google Sheets is not authenticated.");
  }

  await ensureSheetInitialized(sheetName);

  const sheets = google.sheets({ version: "v4", auth });

  try {
    const rows = await readSheetRows(sheetName);
    if (rows.length === 0) return false;

    const headers = rows[0];
    const keyIndex = headers.indexOf(keyColumnName);
    if (keyIndex === -1) {
      throw new Error(`Key column '${keyColumnName}' not found in sheet '${sheetName}'.`);
    }

    let rowIndex = -1;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][keyIndex]?.toUpperCase() === keyValue?.toUpperCase()) {
        rowIndex = i + 1; // 1-indexed for Sheets, and row 1 is header
        break;
      }
    }

    if (rowIndex === -1) {
      logToFile(`[Google Sheets] Key value '${keyValue}' not found in column '${keyColumnName}' for tab '${sheetName}'`);
      return false;
    }

    const rowRange = `'${sheetName}'!A${rowIndex}:Z${rowIndex}`;
    const currentRowValues = rows[rowIndex - 1];

    for (const [colName, val] of Object.entries(updates)) {
      const colIndex = headers.indexOf(colName);
      if (colIndex !== -1) {
        currentRowValues[colIndex] = val;
      }
    }

    // Pad row with empty values to avoid array bounds issues
    const maxCols = Math.max(headers.length, currentRowValues.length);
    const finalValues = Array.from({ length: maxCols }, (_, idx) => currentRowValues[idx] || "");

    await sheets.spreadsheets.values.update({
      spreadsheetId: GOOGLE_SHEETS_SPREADSHEET_ID,
      range: rowRange,
      valueInputOption: "RAW",
      requestBody: {
        values: [finalValues],
      },
    });

    logToFile(`[Google Sheets] Successfully updated row ${rowIndex} in tab '${sheetName}'.`);
    return true;
  } catch (err: any) {
    logToFile(`[Google Sheets] Error updating row in tab '${sheetName}': ${err?.message || err}`);
    throw err;
  }
}
