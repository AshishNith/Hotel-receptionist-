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
  const localTime = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Kolkata' });
  const formattedDate = formatter.format(localTime); // YYYY-MM-DD
  const dayOfWeek = localTime.toLocaleDateString("en-IN", { weekday: "long", timeZone: "Asia/Kolkata" });
  const timeStr = localTime.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" });

  const dateInstruction = `\n\n[System Time Info]\nToday's Date: ${formattedDate}\nDay of the week: ${dayOfWeek}\nCurrent Time: ${timeStr} (IST)\n\nUse this information when checking room availability or creating/modifying reservations.`;
  const instructionWithTime = baseInstruction + dateInstruction;

  if (!knowledgeBaseId) return instructionWithTime;

  try {
    const kb = await KnowledgeBaseModel.findOne({ id: knowledgeBaseId });
    if (!kb || !kb.documents || kb.documents.length === 0) {
      return instructionWithTime;
    }

    const docSection = kb.documents
      .map((d) => `### ${d.title}\n${d.content}`)
      .join("\n\n---\n\n");

    return `${instructionWithTime}\n\n--- KNOWLEDGE BASE: ${kb.name} ---\nThe following reference documents contain important factual information you should use when answering questions:\n\n${docSection}`;
  } catch (err) {
    console.error("[Gemini] Error loading knowledge base:", err);
    return instructionWithTime;
  }
}

export const ecommerceTools: FunctionDeclaration[] = [
  {
    name: "confirm_cod_order",
    description: "Confirms or cancels a Cash on Delivery (COD) order based on the customer's response.",
    parametersJsonSchema: {
      type: Type.OBJECT,
      properties: {
        orderId: { type: Type.STRING, description: "The ID of the order being confirmed (e.g., 'OD-4821')" },
        confirmed: { type: Type.BOOLEAN, description: "Set to true if the customer confirmed their order, false if they wish to cancel it" },
        reason: { type: Type.STRING, description: "Optional explanation provided by the customer for confirmation or cancellation" }
      },
      required: ["orderId", "confirmed"]
    }
  },
  {
    name: "verify_shipping_address",
    description: "Verifies the correctness of the customer's shipping address or records corrections.",
    parametersJsonSchema: {
      type: Type.OBJECT,
      properties: {
        orderId: { type: Type.STRING, description: "The ID of the order being verified" },
        correctedAddress: { type: Type.STRING, description: "The updated/corrected address string if the customer requested modifications" },
        isCorrect: { type: Type.BOOLEAN, description: "Set to true if the address is confirmed correct (either immediately or after corrections), false if unreachable" }
      },
      required: ["orderId", "isCorrect"]
    }
  },
  {
    name: "apply_cart_discount",
    description: "Applies a promotional recovery discount code to the customer's abandoned checkout cart.",
    parametersJsonSchema: {
      type: Type.OBJECT,
      properties: {
        cartId: { type: Type.STRING, description: "The ID of the abandoned cart (e.g., 'CRT-9016')" },
        discountCode: { type: Type.STRING, description: "The discount coupon code to apply (e.g. 'SAVE10', 'DTC10')" },
        discountValue: { type: Type.INTEGER, description: "The percentage discount value (e.g., 10 for 10% off)" }
      },
      required: ["cartId", "discountCode", "discountValue"]
    }
  },
  {
    name: "schedule_redelivery",
    description: "Schedules a redelivery date and time slot for a non-delivered report (NDR) shipment.",
    parametersJsonSchema: {
      type: Type.OBJECT,
      properties: {
        orderId: { type: Type.STRING, description: "The ID of the order requiring redelivery" },
        reattemptDate: { type: Type.STRING, description: "The requested date for redelivery re-attempt in YYYY-MM-DD format" },
        reattemptTimeSlot: { type: Type.STRING, description: "The preferred time slot (e.g., 'morning', 'afternoon', 'evening')" }
      },
      required: ["orderId", "reattemptDate", "reattemptTimeSlot"]
    }
  },
  {
    name: "record_delivery_feedback",
    description: "Records the customer's verbal feedback rating and satisfaction comments post-delivery.",
    parametersJsonSchema: {
      type: Type.OBJECT,
      properties: {
        orderId: { type: Type.STRING, description: "The ID of the delivered order" },
        rating: { type: Type.INTEGER, description: "Customer satisfaction rating on a scale of 1 to 5" },
        comments: { type: Type.STRING, description: "Any verbal comments or feedback provided by the customer" }
      },
      required: ["orderId", "rating"]
    }
  },
  {
    name: "track_order_shipment",
    description: "Retrieves live shipping tracking information, estimated delivery dates, and courier partner details for an order.",
    parametersJsonSchema: {
      type: Type.OBJECT,
      properties: {
        orderId: { type: Type.STRING, description: "The ID of the order to track" }
      },
      required: ["orderId"]
    }
  },
  {
    name: "escalate_to_human",
    description: "Escalates the call and requests transfer to a live support agent when high frustration or complex queries are encountered.",
    parametersJsonSchema: {
      type: Type.OBJECT,
      properties: {
        reason: { type: Type.STRING, description: "The reason for escalating the call to a human agent" }
      },
      required: ["reason"]
    }
  },
  {
    name: "get_store_faq",
    description: "Queries the store FAQ knowledge base to answer customer questions regarding returns, shipping fees, delivery times, warranty, etc.",
    parametersJsonSchema: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING, description: "The search query or question asked by the customer" }
      },
      required: ["query"]
    }
  }
];

export const googleWorkspaceTools: FunctionDeclaration[] = [
  {
    name: "list_upcoming_meetings",
    description: "Lists upcoming calendar events and meetings from the user's primary Google Calendar.",
    parametersJsonSchema: {
      type: Type.OBJECT,
      properties: {
        maxResults: { type: Type.INTEGER, description: "Maximum number of events to return. Defaults to 5." }
      }
    }
  },
  {
    name: "create_calendar_event",
    description: "Schedules a new calendar event in the user's primary Google Calendar.",
    parametersJsonSchema: {
      type: Type.OBJECT,
      properties: {
        summary: { type: Type.STRING, description: "Title or summary of the event" },
        description: { type: Type.STRING, description: "Optional detailed description of the event" },
        startTime: { type: Type.STRING, description: "ISO 8601 formatted start time (e.g. '2026-06-01T10:00:00Z')" },
        endTime: { type: Type.STRING, description: "ISO 8601 formatted end time (e.g. '2026-06-01T11:00:00Z')" }
      },
      required: ["summary", "startTime", "endTime"]
    }
  },
  {
    name: "send_gmail_message",
    description: "Sends an email message via the user's Gmail account.",
    parametersJsonSchema: {
      type: Type.OBJECT,
      properties: {
        recipientEmail: { type: Type.STRING, description: "Recipient's email address" },
        subject: { type: Type.STRING, description: "Subject of the email" },
        body: { type: Type.STRING, description: "Body of the email in plain text or HTML" }
      },
      required: ["recipientEmail", "subject", "body"]
    }
  },
  {
    name: "read_latest_emails",
    description: "Retrieves the user's latest unread email messages from their Gmail inbox.",
    parametersJsonSchema: {
      type: Type.OBJECT,
      properties: {
        maxResults: { type: Type.INTEGER, description: "Maximum number of unread emails to read. Defaults to 3." }
      }
    }
  }
];

export const allToolDeclarations: FunctionDeclaration[] = [
  ...ecommerceTools,
  ...googleWorkspaceTools,
];

/** Model identifier used for Gemini Live connections. */
export { GEMINI_MODEL };
export { Modality };
