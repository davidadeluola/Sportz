import arcjet, { shield, detectBot, slidingWindow } from "@arcjet/node";

const arcjetKey = process.env.ARCJET_KEY;
const configuredArcjetEnv = (process.env.ARCJET_ENV || "")
  .replaceAll('"', "")
  .trim()
  .toUpperCase();
const arcjetMode = configuredArcjetEnv === "LIVE" ? "LIVE" : "DRY_RUN";

if (!arcjetKey) {
  throw new Error(
    "ARCJET_KEY environment variable is required for Arcjet authentication."
  );
}

export const httpArk = arcjet({
  key: arcjetKey,
  rules: [
    shield({ mode: arcjetMode }),
    detectBot({
      mode: arcjetMode,
      allow: ["CATEGORY:SEARCH_ENGINE", "CATEGORY:PREVIEW"],
    }),
    slidingWindow({
      mode: arcjetMode,
      interval: "10s",
      max: 50,
    }),
  ],
});

export const wsArk = arcjet({
  key: arcjetKey,
  rules: [
    shield({ mode: arcjetMode }),
    ...(arcjetMode === "LIVE"
      ? [
          detectBot({
            mode: arcjetMode,
            allow: ["CATEGORY:SEARCH_ENGINE", "CATEGORY:PREVIEW"],
          }),
        ]
      : []),
    slidingWindow({
      mode: arcjetMode,
      interval: "2s",
      max: 5,
    }),
  ],
});
