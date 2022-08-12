import "dotenv/config";

import { clear, followUsers, monitor } from "./twitter.js";

process.on("unhandledRejection", (reason, promise) => {
  console.log("Unhandled rejection at ", promise, reason);
  process.exit(1);
});

process.on("exit", (code) => {
  if (process.env.NODE_ENV === "productino") {
    fetch(
      "http://maker.ifttt.com/trigger/notify/json/with/key/SiqRRoN-OnAolsmwmhQrG",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ exit: "Shitcoins exited", code }),
      }
    );
  }
});

process.title = "shitcoinsnode";

await clear();
await followUsers();
monitor();
