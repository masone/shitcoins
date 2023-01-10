import { Client } from "twitter-api-sdk";
import pino from "pino";

import { narratives } from "./narratives.js";
import { sendEvent } from "./event.js";
import { trackMetric } from "./metric.js";

const logFile = "./out.log";
const logger = pino({}, pino.destination(logFile));

if (process.env.NODE_ENV === "development") {
  logger.level = "debug";
}

export const client = new Client(process.env.TWITTER_BEARER as string);

export async function start() {
  await clear();
  await setup();
  await monitor();
}

async function getRules() {
  return await client.tweets.getRules();
}

async function clear(): Promise<void> {
  const rules = await getRules();
  if (rules.data) {
    await client.tweets.addOrDeleteRules({
      delete: { ids: rules.data.map((rule) => rule.id as string) },
    });
  }
}

async function setup(): Promise<void> {
  if (Object.keys(narratives).length > 5) {
    throw new Error("Too many narratives");
  }

  const rules = Object.keys(narratives).map((key) => {
    return {
      value: narratives[key].map((words) => `"${words}"`).join(" OR "),
      tag: `narrative:${key}`,
    };
  });

  await client.tweets.addOrDeleteRules({
    add: rules,
  });
  logger.debug({ rules }, "narratives");

  sendEvent("setupRules");
}

async function monitor() {
  const stream = client.tweets.searchStream({
    "tweet.fields": [
      "id",
      "created_at",
      "entities",
      "text",
      "in_reply_to_user_id",
    ],
    "user.fields": ["id", "username"],
  });

  for await (const tweet of stream) {
    const text = tweet.data?.text;
    const url = `https://twitter.com/xxx/status/${tweet.data?.id}`;
    const narratives =
      tweet.matching_rules?.map((rule) => rule.tag?.split(":")[1] as string) ||
      [];
    const cashtags =
      [
        ...new Set(
          tweet.data?.entities?.cashtags?.map(
            (tag) => `$${tag.tag.toLowerCase()}`
          )
        ),
      ] || [];

    process.stdout.write(".");

    if (cashtags.length > 3) {
      continue; // spam
    }

    if (tweet.data?.in_reply_to_user_id) {
      track(narratives, 0.02);
      continue;
    }

    if (tweet.data?.text.startsWith("RT @")) {
      track(narratives, 0.1);
      continue;
    }

    track(narratives, 1);

    logger.info({ narratives, cashtags, text, url }, "narrative");
    console.dir(tweet);
  }
}

function track(narratives: string[], weight: number) {
  narratives.forEach((narrative) => {
    trackMetric(narrative, weight);
  });
}
