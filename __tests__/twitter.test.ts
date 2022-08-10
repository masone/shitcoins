import { followCashtags, client } from "../twitter";

describe("twitter", () => {
  describe("followCashtags", () => {
    it("follows cashtags", async () => {
      followCashtags(["$btc"]);
      expect(client.tweets.addOrDeleteRules).toBeCalledWith({
        add: [{ tag: "cashtags", value: "$btc" }],
      });
    });

    it("tracks cashtags", async () => {
      const { trackedCashtags } = await followCashtags(["$btc"]);
      expect(Array.from(trackedCashtags)).toEqual(["$btc"]);
    });

    it("keeps track of cashTagsRuleId", async () => {
      const { cashTagsRuleId } = await followCashtags(["$btc"]);
      expect(cashTagsRuleId).toEqual("999");
    });

    it("deletes existing rule", async () => {
      await followCashtags(["$btc"]);

      const { trackedCashtags } = await followCashtags(["$eth"]);
      expect(client.tweets.addOrDeleteRules).toBeCalledWith({
        add: [{ tag: "cashtags", value: "$btc OR $eth" }],
      });
      expect(client.tweets.addOrDeleteRules).toBeCalledWith({
        delete: { ids: ["999"] },
      });
      expect(Array.from(trackedCashtags)).toEqual(["$btc", "$eth"]);
    });
  });
});
