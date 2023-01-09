import metrics from "datadog-metrics";

metrics.init({
  host: "linode",
  prefix: "shitcoins.",
  defaultTags: [`env:${process.env.NODE_ENV}`],
});

export function trackMetric(narrative: string, weight: number) {
  metrics.increment("narrative", weight, [`narrative:${narrative}`]);
}
