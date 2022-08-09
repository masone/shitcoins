import * as fs from "fs";
import * as readline from "readline";
import { startOfHour } from 'date-fns'

import asciichart from 'asciichart'

process.on("unhandledRejection", (reason, promise) => {
  console.log("Unhandled rejection at ", promise, reason);
  process.exit(1);
});

var instream = fs.createReadStream('./out.log');

var rl = readline.createInterface({
    input: instream,
    terminal: false
});

interface BucketCount {
  [key: string]: number
}

interface TokenCount {
  [key: string]: BucketCount
}

interface Timeline {
  startTime?: Date
  endTime?: Date
  counts: TokenCount
}

const timeline: Timeline = { counts: {}}

rl.on('line', function(line: string) {
  const json = JSON.parse(line)
  const time = json.time
  const start = startOfHour(time)

  if(json.msg ==="counts"){
    Object.keys(json.counts).forEach(key => {
      const value = parseInt(json.counts[key])
      timeline.counts[key] ||= {}
      timeline.counts[key][start.getTime()] = value
    })
  }

  if(!timeline.startTime) {
    timeline.startTime = start
  }
  timeline.endTime = start
});

rl.on('close', function() {
  const {startTime, endTime} = timeline

  Object.keys(timeline.counts).forEach(key => {
    const counts = Object.values(timeline.counts[key])
    console.log(`===${key}=== from ${startTime} to ${endTime}`)
    console.log(asciichart.plot(counts))
  })

  // todo: fill zeroes
});

