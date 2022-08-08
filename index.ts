import "dotenv/config";

import { clear, followUsers, monitor } from "./twitter.js";

process.on("unhandledRejection", (reason, promise) => {
  console.log("Unhandled rejection at ", promise, reason);
  process.exit(1);
});

await clear();
await followUsers();
monitor();

// curl -X POST -H "Content-Type: application/json" -d '{"this":[{"is":{"some":["test","data"]}}]}' http://maker.ifttt.com/trigger/{event}/json/with/key/{webhooks_key}
