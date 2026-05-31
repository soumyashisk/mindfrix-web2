import { Hono } from "hono";
import { cors } from "hono/cors";
import { handle } from "hono/vercel";
import { Client } from "@notionhq/client";

export const config = {
  runtime: "edge" // Running Hono on Vercel Edge for lightning-fast global response times!
};

const app = new Hono().basePath("/api");

// Enable CORS for frontend requests
app.use(
  "/*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
    credentials: true,
  })
);

app.get("/", (c) => {
  return c.text("🚀 MindFrix Serverless Contact API is active on Vercel!");
});

app.post("/contact", async (c) => {
  try {
    const body = await c.req.json();
    const { founderName, phoneNumber, companyName, emailAddress } = body;

    // Server-side validation
    if (!founderName || typeof founderName !== "string" || !founderName.trim()) {
      return c.json({ success: false, error: "Founder Name is required." }, 400);
    }
    if (!phoneNumber || typeof phoneNumber !== "string" || !phoneNumber.trim()) {
      return c.json({ success: false, error: "Phone Number is required." }, 400);
    }

    const apiKey = process.env.NOTION_API_KEY;
    const databaseId = process.env.NOTION_DATABASE_ID;

    if (!apiKey || !databaseId) {
      return c.json(
        {
          success: false,
          error: "Notion API key or Database ID is not configured in Vercel environment variables."
        },
        500
      );
    }

    // Initialize Notion SDK Client
    const notion = new Client({ auth: apiKey });

    // Map exact columns to Notion properties based on the DB schema:
    // - 'Founder Name' (Title)
    // - 'Business Name' (Rich Text)
    // - 'Phone' (Rich Text)
    // - 'Email' (Rich Text)
    await notion.pages.create({
      parent: { database_id: databaseId },
      properties: {
        "Founder Name": {
          title: [
            {
              text: {
                content: founderName.trim()
              }
            }
          ]
        },
        "Phone": {
          rich_text: [
            {
              text: {
                content: phoneNumber.trim()
              }
            }
          ]
        },
        "Business Name": {
          rich_text: [
            {
              text: {
                content: companyName ? String(companyName).trim() : ""
              }
            }
          ]
        },
        "Email": {
          rich_text: [
            {
              text: {
                content: emailAddress ? String(emailAddress).trim() : ""
              }
            }
          ]
        }
      }
    });

    return c.json({
      success: true,
      message: "Inquiry successfully logged to Notion!"
    });
  } catch (error: any) {
    console.error("❌ Submission Error:", error);
    return c.json(
      {
        success: false,
        error: error.message || "Failed to log entry to Notion."
      },
      500
    );
  }
});

// Export handles for HTTP methods required by Vercel Serverless
export const GET = handle(app);
export const POST = handle(app);
export const OPTIONS = handle(app);

// For local direct execution using Bun (e.g. `bun dev` or `bun api/index.ts`)
if (typeof Bun !== "undefined") {
  const port = parseInt(process.env.PORT || "3000");
  console.log(`🚀 Hono local server running natively on Bun!`);
  console.log(`📍 Listening at http://localhost:${port}`);
  
  Bun.serve({
    port,
    fetch: app.fetch
  });
}
