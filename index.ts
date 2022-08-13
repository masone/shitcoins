import "dotenv/config";

import { clear, followUsers, watchCashtags, monitor } from "./twitter.js";
import { notify } from "./email.js";

process.on("unhandledRejection", (reason, promise) => {
  console.log("Unhandled rejection at ", promise, reason);
  process.exit(1);
});

process.on("exit", (code) => {
  notify({ exit: "Shitcoins exited", code });
});

process.title = "shitcoinsnode";

await clear();
await followUsers();
await watchCashtags();
monitor();
