import { GoogleGenAI, Modality, Type, FunctionDeclaration } from "@google/genai";
import { GEMINI_API_KEY, GEMINI_MODEL } from "../config.js";
import { KnowledgeBaseModel } from "../models/KnowledgeBase.js";

// ─── Gemini Client ──────────────────────────────────────────────

export function getGeminiClient(): GoogleGenAI {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY environment variable is missing.");
  }
  return new GoogleGenAI({
    apiKey: GEMINI_API_KEY,
    httpOptions: { headers: { "User-Agent": "aistudio-build" } },
  });
}

// ─── System Instruction Builder ─────────────────────────────────

/**
 * Compiles the final system instruction by merging the base persona
 * instruction with any linked knowledge base documents.
 */
export async function getCompiledSystemInstruction(
  baseInstruction: string,
  knowledgeBaseId?: string
): Promise<string> {
  if (!knowledgeBaseId) return baseInstruction;

  try {
    const kb = await KnowledgeBaseModel.findOne({ id: knowledgeBaseId });
    if (!kb || !kb.documents || kb.documents.length === 0) {
      return baseInstruction;
    }

    const docSection = kb.documents
      .map((d) => `### ${d.title}\n${d.content}`)
      .join("\n\n---\n\n");

    return `${baseInstruction}\n\n--- KNOWLEDGE BASE: ${kb.name} ---\nThe following reference documents contain important factual information you should use when answering questions:\n\n${docSection}`;
  } catch (err) {
    console.error("[Gemini] Error loading knowledge base:", err);
    return baseInstruction;
  }
}

export const hotelRoomTools: FunctionDeclaration[] = [
  {
    name: "check_room_availability",
    description: "Queries the hotel database for available rooms based on dates, guest count, and optional room type preference.",
    parametersJsonSchema: {
      type: Type.OBJECT,
      properties: {
        startDate: { type: Type.STRING, description: "Check-in date in YYYY-MM-DD format (e.g. '2026-06-01')" },
        endDate: { type: Type.STRING, description: "Check-out date in YYYY-MM-DD format (e.g. '2026-06-03')" },
        guestCount: { type: Type.INTEGER, description: "Total number of guests staying" },
        roomTypePreference: { type: Type.STRING, description: "Optional preferred room type: 'deluxe', 'executive', or 'presidential'" }
      },
      required: ["startDate", "endDate", "guestCount"]
    }
  },
  {
    name: "make_room_reservation",
    description: "Collects guest details, calculates pricing, and books a room in the hotel database, returning a reservation/booking ID.",
    parametersJsonSchema: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING, description: "Full name of the guest making the reservation" },
        phone: { type: Type.STRING, description: "Phone number of the guest" },
        email: { type: Type.STRING, description: "Email address of the guest" },
        roomType: { type: Type.STRING, description: "Room type to book: 'deluxe', 'executive', or 'presidential'" },
        checkIn: { type: Type.STRING, description: "Check-in date in YYYY-MM-DD format" },
        checkOut: { type: Type.STRING, description: "Check-out date in YYYY-MM-DD format" },
        guests: { type: Type.INTEGER, description: "Number of guests" },
        addons: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "List of optional add-ons to select. Supported: 'breakfast' (Rs. 300/guest/night), 'spa' (Rs. 1500 flat), 'early-check-in' (Rs. 1000 flat)."
        }
      },
      required: ["name", "phone", "email", "roomType", "checkIn", "checkOut", "guests"]
    }
  },
  {
    name: "modify_or_cancel_reservation",
    description: "Modifies reservation details or cancels an existing booking, using the Booking ID and guest phone number to authenticate.",
    parametersJsonSchema: {
      type: Type.OBJECT,
      properties: {
        bookingId: { type: Type.STRING, description: "The Reservation/Booking ID (e.g. 'BK-5423')" },
        phone: { type: Type.STRING, description: "Guest phone number registered with the booking" },
        action: { type: Type.STRING, description: "Operation to execute: 'modify' or 'cancel'" },
        updates: {
          type: Type.OBJECT,
          description: "Required only if action is 'modify'. Details of variables to update.",
          properties: {
            newCheckIn: { type: Type.STRING, description: "Updated check-in date in YYYY-MM-DD format" },
            newCheckOut: { type: Type.STRING, description: "Updated check-out date in YYYY-MM-DD format" },
            newRoomType: { type: Type.STRING, description: "Updated room type: 'deluxe', 'executive', or 'presidential'" },
            newGuests: { type: Type.INTEGER, description: "Updated guest count" },
            newAddons: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Updated add-ons list" }
          }
        }
      },
      required: ["bookingId", "phone", "action"]
    }
  },
  {
    name: "order_food",
    description: "Orders items from the hotel restaurant menu for a specific room or booking, calculating pricing and appending order details.",
    parametersJsonSchema: {
      type: Type.OBJECT,
      properties: {
        bookingIdOrRoom: { type: Type.STRING, description: "The guest's Booking ID or Room number (e.g. 'Room 302' or 'BK-1234')" },
        items: {
          type: Type.ARRAY,
          description: "List of items ordered with quantities",
          items: {
            type: Type.OBJECT,
            properties: {
              itemId: { type: Type.STRING, description: "Item identifier: 'sandwich', 'paneer', 'biryani', 'pizza', 'naan', 'coffee'" },
              quantity: { type: Type.INTEGER, description: "Quantity of this item to order" }
            },
            required: ["itemId", "quantity"]
          }
        }
      },
      required: ["bookingIdOrRoom", "items"]
    }
  },
  {
    name: "get_hotel_faq",
    description: "Queries the hotel policy database/FAQ knowledge base to answer questions regarding check-in times, Wi-Fi passwords, parking, pool hours, etc.",
    parametersJsonSchema: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING, description: "Search query or question (e.g. 'pool timings', 'is parking free')" }
      },
      required: ["query"]
    }
  }
];

export const allToolDeclarations: FunctionDeclaration[] = [
  ...hotelRoomTools,
];

/** Model identifier used for Gemini Live connections. */
export { GEMINI_MODEL };
export { Modality };
