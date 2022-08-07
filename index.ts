import "dotenv/config";

// import {TwitterApi} from 'twitter-api-v2';

// const client = new TwitterApi(process.env.TWITTER_BEARER as string)
// client.readOnly

// const result = await client.v2.post('tweets/search/stream/rules', { query: 'java', max_results: 100 });
// const result = await client.v2.get('tweets/search/stream', { query: 'java', max_results: 100 });
// // const result = await client.v2.get('tweets/search/recent', { query: 'java', max_results: 100 });
// console.log(result.data);

// // since:2022-01-19 until:2022-12-19

import { Client } from "twitter-api-sdk";

const client = new Client(process.env.TWITTER_BEARER as string);
// interface Cashtag {
//   name: string;
//   count: number;
// }
interface Counts {
  [key: string]: number;
}
const counts: Counts = {}
const cashtags = ['$btc', '$eth']

// monitor a list
// find all cashtags
// monitor each cashtag, keep track of count

async function clear(): Promise<void> {
  const rules = await client.tweets.getRules()
  if(rules.data) {
    await client.tweets.addOrDeleteRules({
      delete: { ids: rules.data.map(rule => rule.id as string) }
    })
  }
}

async function add(cashtags: string[]): Promise<void> {
  const rule = await client.tweets.addOrDeleteRules(
    {
      // add: cashtags.map(cashtag => {return { value: cashtag, tag: cashtag}})
      add: [
        {
        value: cashtags.join(" OR "),
        tag: "cashtags"
      }]
    }
  )
  console.log({cashtags, counts})
}

async function monitor() {
  const stream = client.tweets.searchStream({
    "tweet.fields": ["id", "created_at", "entities", "text"],
    "user.fields": ["id", "username"],
  });
  for await (const tweet of stream) {
    const tags = tweet.data?.entities?.cashtags || [];
    if(tags){
      // console.dir(tweet.data);
      // console.log({tags})
      tags.forEach(cashtag => {
        const key = `$${cashtag.tag.toLowerCase()}`
        if(cashtags.includes(key)) {
          counts[key] = ++counts[key] || 1;
        }
      })
    }
    console.log(counts)
  }
}

await clear()
await add(cashtags)

const rules = await client.tweets.getRules()
console.log("Current rules", rules.data)

monitor()
