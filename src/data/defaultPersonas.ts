import type { Persona } from "../types";

/**
 * Client-side fallback persona list. Only used if the server is unreachable.
 * The actual source of truth is server/defaults/personas.ts which seeds MongoDB.
 */
export const AVAILABLE_PERSONAS: Persona[] = [
  {
    id: "order_confirm",
    name: "Order Confirmation Agent",
    role: "Order Confirmation Agent",
    description: "Calls customers after placing an order to confirm details, verify the shipping address, and approve or cancel the order.",
    voice: "Kore",
    systemInstruction: "You are an Order Confirmation and Address Verification Agent. Your goal is to call the customer, confirm their order details, verify their shipping address, and update the order status.",
    accentColor: "emerald",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/30",
    avatar: "📞",
    initialGreeting: "Hello, I'm calling regarding your recent order. Am I speaking with the right person?",
    phoneNumber: "",
  },
  {
    id: "cart_recovery",
    name: "Cart Recovery Agent",
    role: "Cart Recovery Specialist",
    description: "Contacts customers who abandoned their checkout to answer objections and recover the sale with a limited-time discount.",
    voice: "Puck",
    systemInstruction: "You are a Cart Recovery Agent. Your goal is to contact customers who abandoned their checkout, address their concerns, and help them complete their purchase.",
    accentColor: "indigo",
    bgColor: "bg-indigo-500/10",
    borderColor: "border-indigo-500/30",
    avatar: "🛒",
    initialGreeting: "Hi! I noticed you were looking at some items but didn't finish checkout. Is there anything I can help you with?",
    phoneNumber: "",
  },
  {
    id: "delivery_feedback",
    name: "Delivery Feedback Agent",
    role: "Delivery & Feedback Agent",
    description: "Calls after a delivery failure to schedule a re-attempt, or post-delivery to capture satisfaction ratings.",
    voice: "Aoede",
    systemInstruction: "You are a Post-Delivery Feedback and RTO Prevention Agent. Your goal is to handle delivery issues and collect customer satisfaction feedback.",
    accentColor: "rose",
    bgColor: "bg-rose-500/10",
    borderColor: "border-rose-500/30",
    avatar: "📦",
    initialGreeting: "Hello, I'm calling regarding your recent delivery. I'd like to check in with you.",
    phoneNumber: "",
  },
  {
    id: "inbound_support",
    name: "Inbound Support Agent",
    role: "Customer Support Agent",
    description: "Handles incoming support inquiries, answers FAQs, and provides order tracking updates.",
    voice: "Zephyr",
    systemInstruction: "You are a Customer Support and Order Tracking Agent. Your goal is to help customers with inquiries, track orders, and answer FAQs.",
    accentColor: "cyan",
    bgColor: "bg-cyan-500/10",
    borderColor: "border-cyan-500/30",
    avatar: "💁‍♀️",
    initialGreeting: "Thank you for calling! How can I assist you today?",
    phoneNumber: "",
  },
];
