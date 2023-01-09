import { Client } from "twitter-api-sdk";
import pino from "pino";

import { sendEvent } from "./event.js"
import metrics from "datadog-metrics";
metrics.init({
  host: "linode",
  prefix: "shitcoins.",
  defaultTags: [`env:${process.env.NODE_ENV}`],
});

const logFile = "./out.log";
const logger = pino({}, pino.destination(logFile));

if (process.env.NODE_ENV === "development") {
  logger.level = "debug";
}

export const client = new Client(process.env.TWITTER_BEARER as string);

const narratives: KeywordMap = {
  // test: ["$eth"],
  redacted: ["redacted cartel", "$btrfly", "$dinero", "@redactedcartel"],
  stablecoins: [
    "crvusd",
    "$gho",
    "$dinero",
    "dpxUsd",
    "stablecoin wars",
    "stable wars",
    "decentralized stablecoin",
    "algo stablecoins",
    "algorithmic stablecoins",
    "algo stables",
    "algorithmic stables",
  ],
  liquidStaking: [
    "liquid staking",
    "liquid staking derivative",
    "staking derivatives",
    "fraxeth",
    "lsd tokens",
    "lsd coins",
    "LSD narrative",
    "lsd season",
    "lsd szn",
    "@LidoFinance",
    "@staderlabs",
  ],
  liquidStakingTokens: ["$btrfly", "$ldo", "$sd", "$rpl", "$wise", "$ankr"],
  // perps: ["$gmx", "$myc", "$dpx", "$umami"],
  // ai: ["ai tokens", "ai coins", "$FET", "$ORAI", "$AGIX", "$OCEAN"],
  // eigen: ["eigenlayer", "$eigen"],
  // zkevm: [],// https://twitter.com/JackNiewold/status/1550600243888144384
  // layer3: [], // https://twitter.com/ThorHartvigsen/status/1601925264656588800
  // layer2: ["layer 2"],
  // layer0: ["layer zero"],
  // nftfi: ["financial nfts"],
  // privacy: ["privacy coins", "$xmr", "$zec", "$dash"],
  // infrastructure: ["$link"]
  // real world asset
  // wallets One of the biggest contenders is the #Radix $XRD wallet developed by @radixdlt
.
};

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

type KeywordMap = Record<string, string[]>;

async function setup(): Promise<void> {
  const rules = Object.keys(narratives).map((key) => {
    return {
      value: narratives[key].map((words) => `"${words}"`).join(" OR "),
      tag: `narrative:${key}`,
    };
  });
  await client.tweets.addOrDeleteRules({
    add: rules,
  });

  sendEvent("setupRules")
  logger.debug({ rules }, "narratives");
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
    // expansions: ["author_id"],
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

    process.stdout.write(".")

    if (cashtags.length > 3) {
      continue; // spam
    }

    if (tweet.data?.in_reply_to_user_id) {
      track(narratives, 0.05)
      continue
    }

    if (tweet.data?.text.startsWith("RT @")) {
      track(narratives, 0.1)
      continue
    }

    track(narratives, 1)

    logger.info({ narratives, cashtags, text, url }, "narrative");
    console.dir(tweet);
  }
}

function track(narratives: string[], weight: number) {
  narratives.forEach((narrative) => {
    metrics.increment(
      "narrative",
      weight,
      [`narrative:${narrative}`]
    );
  })
}
