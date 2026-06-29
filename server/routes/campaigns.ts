import { Router } from "express";
import { CampaignModel } from "../models/Campaign.js";
import { initiateOutboundCall } from "../services/vobizService.js";
import { APP_URL } from "../config.js";
import { CallLogModel } from "../models/CallLog.js";

const router = Router();

// GET /api/campaigns — List all campaigns
router.get("/", async (_req, res) => {
  try {
    const campaigns = await CampaignModel.find({}).sort({ createdAt: -1 });
    res.json({ success: true, data: campaigns });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/campaigns/:id — Get details of a single campaign
router.get("/:id", async (req, res) => {
  try {
    const campaign = await CampaignModel.findOne({ id: req.params.id });
    if (!campaign) {
      return res.status(404).json({ success: false, message: "Campaign not found." });
    }
    res.json({ success: true, data: campaign });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/campaigns — Create a new campaign
router.post("/", async (req, res) => {
  const { name, personaId, contacts } = req.body;
  if (!name || !personaId || !Array.isArray(contacts)) {
    return res.status(400).json({ success: false, message: "Missing required fields (name, personaId, contacts)." });
  }

  const campaignId = `camp_${Date.now()}`;
  const newCampaign = new CampaignModel({
    id: campaignId,
    name,
    personaId,
    status: "draft",
    contacts: contacts.map((c: any) => ({
      name: c.name,
      phone: c.phone,
      bookingId: c.bookingId || "",
      status: "pending"
    })),
    createdAt: new Date()
  });

  try {
    await newCampaign.save();
    res.json({ success: true, data: newCampaign });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/campaigns/:id/start — Start/resume a campaign
router.post("/:id/start", async (req, res) => {
  try {
    const campaign = await CampaignModel.findOne({ id: req.params.id });
    if (!campaign) {
      return res.status(404).json({ success: false, message: "Campaign not found." });
    }

    if (campaign.status === "completed") {
      return res.status(400).json({ success: false, message: "Cannot start a completed campaign." });
    }

    campaign.status = "running";
    await campaign.save();

    const appUrl = APP_URL || `${req.protocol}://${req.get("host")}`;
    
    // Start background processor
    void executeCampaignBackground(campaign.id, appUrl);

    res.json({ success: true, data: campaign });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/campaigns/:id/pause — Pause a running campaign
router.post("/:id/pause", async (req, res) => {
  try {
    const campaign = await CampaignModel.findOne({ id: req.params.id });
    if (!campaign) {
      return res.status(404).json({ success: false, message: "Campaign not found." });
    }

    if (campaign.status !== "running") {
      return res.status(400).json({ success: false, message: "Campaign is not running." });
    }

    campaign.status = "paused";
    await campaign.save();

    res.json({ success: true, data: campaign });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/campaigns/:id — Delete a campaign
router.delete("/:id", async (req, res) => {
  try {
    const result = await CampaignModel.deleteOne({ id: req.params.id });
    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: "Campaign not found." });
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * Background loop to process campaign contacts sequentially
 */
async function executeCampaignBackground(campaignId: string, appUrl: string) {
  console.log(`[Campaign ${campaignId}] Starting execution...`);
  
  while (true) {
    // Re-fetch campaign to get fresh state and check if paused/stopped
    const campaign = await CampaignModel.findOne({ id: campaignId });
    if (!campaign || campaign.status !== "running") {
      console.log(`[Campaign ${campaignId}] Paused, stopped, or deleted. Exiting background loop.`);
      break;
    }

    // Find first pending contact
    const contactIndex = campaign.contacts.findIndex(c => c.status === "pending");
    if (contactIndex === -1) {
      // Check if all contacts are processed
      const activeOrPending = campaign.contacts.some(c => c.status === "pending" || c.status === "calling");
      if (!activeOrPending) {
        campaign.status = "completed";
        campaign.completedAt = new Date();
        await campaign.save();
        console.log(`[Campaign ${campaignId}] Execution completed!`);
      }
      break;
    }

    const contact = campaign.contacts[contactIndex];
    console.log(`[Campaign ${campaignId}] Dialing contact: ${contact.name} (${contact.phone})`);
    
    // Mark as calling
    campaign.contacts[contactIndex].status = "calling";
    await campaign.save();

    try {
      const callState = await initiateOutboundCall(
        contact.phone,
        campaign.personaId,
        appUrl,
        contact.bookingId
      );

      // Save call ID
      campaign.contacts[contactIndex].callId = callState.callId;
      await campaign.save();

      // Poll until the call is completed, failed, or we hit a timeout (5 mins)
      const startTime = Date.now();
      let callFinished = false;
      
      while (Date.now() - startTime < 5 * 60 * 1000) {
        await new Promise((resolve) => setTimeout(resolve, 4000));

        // Re-fetch campaign state
        const currentCampaign = await CampaignModel.findOne({ id: campaignId });
        if (!currentCampaign || currentCampaign.status !== "running") {
          break;
        }

        // Check call status in CallLogModel
        const log = await CallLogModel.findOne({ callId: callState.callId });
        if (log && (log.status === "completed" || log.status === "failed")) {
          // Re-fetch to update
          const updatedCampaign = await CampaignModel.findOne({ id: campaignId });
          if (updatedCampaign) {
            updatedCampaign.contacts[contactIndex].status = log.status === "completed" ? "completed" : "failed";
            await updatedCampaign.save();
          }
          callFinished = true;
          break;
        }
      }

      if (!callFinished) {
        // Set to failed due to timeout
        const updatedCampaign = await CampaignModel.findOne({ id: campaignId });
        if (updatedCampaign) {
          updatedCampaign.contacts[contactIndex].status = "failed";
          updatedCampaign.contacts[contactIndex].errorMessage = "Call timed out or hung up without response.";
          await updatedCampaign.save();
        }
      }
    } catch (err: any) {
      console.error(`[Campaign ${campaignId}] Call error:`, err.message);
      const updatedCampaign = await CampaignModel.findOne({ id: campaignId });
      if (updatedCampaign) {
        updatedCampaign.contacts[contactIndex].status = "failed";
        updatedCampaign.contacts[contactIndex].errorMessage = err.message || "Failed to dial";
        await updatedCampaign.save();
      }
    }

    // Add a delay between dials
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
}

export default router;
