import { Client } from "twitter-api-sdk";
import pino from "pino";

const logger = pino({}, pino.destination("out.log"));

interface Counts {
  [key: string]: number;
}

const client = new Client(process.env.TWITTER_BEARER as string);
// const users = [
//   "from:Bitcoin8News",
//   "from:VolumeAnalyzer",
//   "from:CrypnalApp",
//   "from:btc_price_",
//   "from:RisingSun_Crypo",
//   "from:BTCPriceUpdate",
//   "from:BTCtoCAD",
//   "from:Lord_Defi22",
//   "from:MinuShib",
//   "from:Ethereum8News",
//   "from:WhaleTrades",
//   "from:bot_ethereum_",
// ];
const counts: Counts = {};
let trackedCashtags: Set<string> = new Set();

export async function getRules() {
  return await client.tweets.getRules();
}

export async function clear(): Promise<void> {
  const rules = await getRules();
  if (rules.data) {
    await client.tweets.addOrDeleteRules({
      delete: { ids: rules.data.map((rule) => rule.id as string) },
    });
  }
}

export async function followUsers(): Promise<void> {
  const users = await client.users.listGetMembers(process.env.TWITTER_LIST_ID as string);
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
  // const rules = await getRules();
}

export async function followCashtags(tags: string[]): Promise<void> {
  const newCashtags = new Set([...trackedCashtags, ...tags]);

  if (newCashtags.size === trackedCashtags.size) {
    return;
  }

  await client.tweets.addOrDeleteRules({
    add: [
      {
        value: Array.from(newCashtags).join(" OR "),
        tag: "cashtags",
      },
    ],
  });

  newCashtags.forEach((tag) => {
    counts[tag] = 0;
  });
  trackedCashtags = newCashtags;

  // const rules = await getRules();
  logger.info({ tags, trackedCashtags }, "cashtags");
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
    if (matchingRules.includes("users")) {
      await followCashtags(cashtags);
    }

    logger.debug({ tweet }, "tweet");
    cashtags.forEach((tag) => {
      if (trackedCashtags.has(tag)) {
        counts[tag] = ++counts[tag];
        logger.info({ counts }, "counts");
      }
      logger.debug({ tag, count: counts[tag] }, "mention");
    });
  }
}
