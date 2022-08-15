import "dotenv/config";

import * as fs from "fs";
import * as readline from "readline";
import { startOfHour } from "date-fns";
import asciichart from "asciichart";

process.on("unhandledRejection", (reason, promise) => {
  console.log("Unhandled rejection at ", promise, reason);
  process.exit(1);
});

const instream = fs.createReadStream("./out.log");

const rl = readline.createInterface({
  input: instream,
  terminal: false,
});

interface TimeBucket {
  [key: string]: TokenCount;
}

interface TokenCount {
  [key: string]: number;
}

interface Timeline {
  startTime?: Date;
  endTime?: Date;
  tokens: Set<string>;
  counts: TimeBucket;
}

const timeline: Timeline = { counts: {}, tokens: new Set() };

rl.on("line", function (line: string) {
  const json = JSON.parse(line);
  const time = json.time;
  const start = startOfHour(time);

  if (json.msg === "counts") {
    for (const token in json.counts) {
      const value = parseInt(json.counts[token]);
      timeline.tokens.add(token);
      timeline.counts[start.getTime()] ||= {};
      timeline.counts[start.getTime()][token] = value;
    }
  }

  if (!timeline.startTime) {
    timeline.startTime = start;
  }
  timeline.endTime = start;
});

rl.on("close", function () {
  const { startTime, endTime, tokens } = timeline;

  tokens.forEach((token) => {
    if (process.env.IGNORE_CASHTAGS?.includes(token)) {
      return;
    }

    const counts = Object.keys(timeline.counts).map((bucketStartTime) =>
      timeline.counts[bucketStartTime][token] || 0
    );

    const filledHours = Object.entries(timeline.counts).filter(([time]) => {
      const count = timeline.counts[time][token];
      return count > 0;
    }).length;

    const lastCount = counts[counts.length - 1];
    const perHour = lastCount / filledHours;

    if (lastCount < 5) {
      return;
    }
    console.log(`\n=== ${token} ===`);
    console.log(`${lastCount} total`);
    console.log(`${perHour} per hour\n`);

    console.log(asciichart.plot(counts, { height: 10 }));
  });

  console.log(`${startTime} to ${endTime}`);
});
