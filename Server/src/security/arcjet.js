import arcjet, { shield, detectBot, slidingWindow } from "@arcjet/node";
import { max } from "drizzle-orm";

const arcjetKey = process.env.ARCJET_KEY;
const arcjetMode = process.env.ARCJET_ENV === "DRY_RUN" ? "DRY_RUN" : "LIVE";

if (!arcjetKey) {
  throw new Error(
    "ARCJET_KEY environment variable is required for Arcjet authentication."
  );
}

export const httpArk = arcjetKey
  ? arcjet({
      key: process.env.ARCJET_KEY,
      rules: [
        shield({ mode: arcjetMode }),

        detectBot({
          mode: arcjetMode, // Blocks requests. Use "DRY_RUN" to log only
          // Block all bots except the following
          allow: [
            "CATEGORY:SEARCH_ENGINE",

            // See the full list at https://arcjet.com/bot-list
            //"CATEGORY:MONITOR", // Uptime monitoring services
            "CATEGORY:PREVIEW",
          ],
        }),

        slidingWindow({
          mode: arcjetMode,
          interval: "10s",
          max: 50,
        }),
      ],
    })
  : null;

export const wsArk = arcjetKey
  ? arcjet({
      key: process.env.ARCJET_KEY,
      rules: [
        shield({ mode: arcjetMode }),

        detectBot({
          mode: arcjetMode, // Blocks requests. Use "DRY_RUN" to log only
          // Block all bots except the following
          allow: [
            "CATEGORY:SEARCH_ENGINE", // Google, Bing, etc
            // Uncomment to allow these other common bot categories
            // See the full list at https://arcjet.com/bot-list
            //"CATEGORY:MONITOR", // Uptime monitoring services
            //"CATEGORY:PREVIEW", // Link previews e.g. Slack, Discord
          ],
        }),
        slidingWindow({
          mode: arcjetMode,
          interval: "2s",
          max: 5,
        }),
      ],
    })
  : null;
