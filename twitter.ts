import { Client } from "twitter-api-sdk";
import pino from "pino";
import { exec } from "child_process";
import { existsSync } from "fs";
import { notify } from "./email.js";

const logFile = "./out.log";
const logger = pino({}, pino.destination(logFile));

interface Counts {
  [key: string]: number;
}

type CashTagsRuleId = string | undefined;
type SetOfStrings = Set<string>;

interface FollowCashTags {
  trackedCashtags: SetOfStrings;
  cashTagsRuleId: CashTagsRuleId;
  counts: Counts;
}

export const client = new Client(process.env.TWITTER_BEARER as string);
const counts: Counts = {};
let trackedCashtags: SetOfStrings = new Set();
let cashTagsRuleId: CashTagsRuleId;

export function reset() {
  for (const count in counts) {
    delete counts[count];
  }
  trackedCashtags = new Set();
  cashTagsRuleId = undefined;
}

export function loadFromLog() {
  if (!existsSync(logFile)) {
    return;
  }

  exec(`tail -n 1 ${logFile}`, (error, stdout, stderr) => {
    if (error) {
      throw error;
    }
    if (stderr) {
      console.error(stderr);
    }

    if (!stdout) {
      return;
    }

    const json = JSON.parse(stdout);
    if (json.msg !== "counts") {
      logger.info("load failed");
      return;
    }

    trackedCashtags = new Set(Object.keys(json.counts));
    followCashtags(Array.from(trackedCashtags));
    for (const token in json.counts) {
      counts[token] = json.counts[token];
    }

    logger.info({ counts, tokens: [...trackedCashtags] }, "load");
  });
}

export async function getRules() {
  return await client.tweets.getRules();
}

export async function clear(): Promise<void> {
  loadFromLog();
  const rules = await getRules();
  if (rules.data) {
    await client.tweets.addOrDeleteRules({
      delete: { ids: rules.data.map((rule) => rule.id as string) },
    });
  }
}

export async function followUsers(): Promise<void> {
  const users = await client.users.listGetMembers(
    process.env.TWITTER_LIST_ID as string
  );
  const usernames = users.data?.map((user) => user.username) || [];

  await client.tweets.addOrDeleteRules({
    add: [
      {
        value: usernames.map((name) => `from:${name}`).join(" OR "),
        tag: "users",
      },
    ],
  });
  logger.info({ users: usernames }, "users");
}

export async function watchCashtags(): Promise<void> {
  const tags = process.env.WATCH_CASHTAGS?.split(",") || [];
  const query = tags
    .map((tag) => `(${tag} chart good) OR (${tag} accumulation)`)
    .join(" OR ");

  await client.tweets.addOrDeleteRules({
    add: [
      {
        value: query,
        tag: "chart",
      },
    ],
  });

  logger.info({ tags, query }, "watch");
}

export async function followCashtags(tags: string[]): Promise<FollowCashTags> {
  const newCashtags = new Set([
    ...trackedCashtags,
    ...tags.filter(
      (tag) => !process.env.IGNORE_CASHTAGS?.split(",").includes(tag)
    ),
  ]);

  if (newCashtags.size === trackedCashtags.size) {
    return { trackedCashtags, cashTagsRuleId, counts };
  }

  const limit = 70; // 500/7 avg chars per cashtag = ~70
  const chunks = Array.from(newCashtags)
    .map((_, i) => {
      return i % limit === 0
        ? Array.from(newCashtags).slice(i, i + limit)
        : null;
    })
    .filter((e) => {
      return e;
    });

  const rules = await client.tweets.addOrDeleteRules({
    add: chunks.map((chunk) => {
      const query = (chunk || []).join(" OR ");
      logger.info({ tags, query }, "cashtags");

      return {
        value: query,
        tag: "cashtags",
      };
    }),
  });

  if (rules.data) {
    cashTagsRuleId = rules.data[0].id;
  }

  if (cashTagsRuleId) {
    await client.tweets.addOrDeleteRules({
      delete: { ids: [cashTagsRuleId] },
    });
  }

  trackedCashtags = newCashtags;
  tags.forEach((tag) => {
    counts[tag] = 0;
  });

  // const currentRules = await getRules();

  return { trackedCashtags, cashTagsRuleId, counts };
}

export async function monitor() {
  const stream = client.tweets.searchStream({
    "tweet.fields": [
      "id",
      "created_at",
      "entities",
      "text",
      "in_reply_to_user_id",
    ],
    "user.fields": ["id", "username"],
    // expansions: ["author_id"],
  });

  // todo: ignore replies
  // retweeted_status
  // user && in_reply_to_user_id empty -> user shilling?
  // user && in_reply_to_user_id -> user pumping?
  for await (const tweet of stream) {
    const matchingRules = tweet.matching_rules?.map((rule) => rule.tag) || [];
    const cashtags =
      [
        ...new Set(
          tweet.data?.entities?.cashtags?.map(
            (tag) => `$${tag.tag.toLowerCase()}`
          )
        ),
      ] || [];

    // console.dir(tweet, { depth: null });
    logger.debug({ tweet }, "tweet");

    if (matchingRules.includes("users")) {
      await followCashtags(cashtags);
    }

    if (matchingRules.includes("chart")) {
      if (!tweet.data?.in_reply_to_user_id) {
        console.dir(tweet, { depth: null });
        const url = `https://twitter.com/xxx/status/${tweet.data?.id}`;
        notify({ text: tweet.data?.text, url });
      }
    }

    if (cashtags.length < 5) {
      // ignore tweets with too many cashtags
      cashtags.forEach((tag) => {
        if (trackedCashtags.has(tag)) {
          counts[tag] = ++counts[tag];
          logger.info({ counts }, "counts");
        }
        logger.debug({ tag, count: counts[tag] }, "mention");
      });
    }
  }
}
