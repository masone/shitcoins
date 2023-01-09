import "dotenv/config";

import { start } from "./twitter2.js";
import { notify } from "./email.js";

process.on("unhandledRejection", (reason, promise) => {
  console.log("Unhandled rejection at ", promise, reason);
  process.exit(1);
});

process.on("exit", (code) => {
  notify({ exit: "Shitcoins exited", code });
});

process.title = "shitcoinsnode";

start();
