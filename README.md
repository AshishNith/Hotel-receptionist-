# VoiceLink AI — Low-Latency Autonomous Voice Agents Studio

VoiceLink AI is a production-ready, white-labelable AI calling platform powered by **Gemini Live API** and **VoBiz telephony (SIP streaming)**. It enables businesses to deploy autonomous inbound and outbound voice agents that can converse naturally, query facts, verify details, and execute API actions.

---

## 🚀 Key Features

*   **Real-time Duplex Speech**: Dual-direction low-latency stream handling transcoded from 16kHz L16 (VoBiz) to 24kHz raw PCM (Gemini Live API) and back.
*   **Multi-Agent Persona Engine**: Create custom AI personas with distinct instructions, Gemini prebuilt voices (Zephyr, Puck, Kore, etc.), temperature parameters, and custom silence timeouts.
*   **Per-Persona Tool Assignment**: Fine-grained tool permission controls. Choose which tools (Gmail, Google Calendar, order confirmation webhooks, or FAQ queries) each persona can call.
*   **Bulk Outbound Campaigns**: Create lists of contacts via CSV copy-paste, assign them to any persona, and run automated dialers sequentially with real-time status and error reporting.
*   **Credits & Billing**: Live usage-based credit consumption tracking based on actual call durations in seconds. Cost per minute is customizable in Settings.
*   **Call detail Ledger**: Full analytics page detailing all completed calls. Inspect audio recordings, AI-generated call summaries, full transcripts, and specific tool call logs.
*   **Dynamic Custom Branding**: Configure app names, slogans, initials, logo URLs, and accent theme colors from the Settings page.

---

## 🛠️ Tech Stack

*   **Backend**: Node.js, Express, WebSockets (`ws`), Mongoose (MongoDB)
*   **Frontend**: React (Vite), TailwindCSS, Lucide Icons, React Router
*   **AI Engine**: `@google/genai` (Gemini Live API)
*   **Telephony**: VoBiz SIP Bidirectional Streaming Webhooks

---

## 💻 Local Setup & Development

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` and fill in your variables:
```bash
cp .env.example .env
```
*   `MONGODB_URI`: Connection string for MongoDB (atlas or local).
*   `PORT`: Port (defaults to 3000).

*Note: You can skip setting VoBiz and Gemini credentials in `.env` and configure them directly from the **Settings Page** on the dashboard.*

### 3. Start Development Server
```bash
npm run dev
```
The app will run at `http://localhost:3000`.

---

## 📞 Telephony Integration (VoBiz Webhooks)

To test inbound and outbound calls, your local server must be accessible publicly (e.g., via Ngrok):

1.  Start ngrok tunnel:
    ```bash
    ngrok http 3000
    ```
2.  Set `APP_URL` in `.env` to your public ngrok URL.
3.  On [console.vobiz.ai](https://console.vobiz.ai), configure your incoming call numbers to point to:
    *   `https://<YOUR-NGROK-SUBDOMAIN>.ngrok-free.app/api/vobiz/incoming-call`

---

## 🌐 Deploying to Render.com

This repository is optimized for quick single-instance deployments on **Render**:

1.  Create a new **Web Service** on Render.
2.  Select Node.js environment.
3.  Set the following properties:
    *   **Build Command**: `npm run build`
    *   **Start Command**: `npm start`
4.  Add the environment variables:
    *   `MONGODB_URI`: Point to your MongoDB Atlas cluster.
    *   `NODE_ENV`: `production`
    *   `PORT`: `10000` (Render's default)
    *   `APP_URL`: Your Render Web Service public URL (e.g. `https://your-service.onrender.com`).
5.  Link your VoBiz phone number to point to your new public service webhook path!
