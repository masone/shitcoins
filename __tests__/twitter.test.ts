import { followCashtags, client, reset } from "../twitter";

describe("twitter", () => {
  beforeEach(() => {
    process.env.IGNORE_CASHTAGS = "";
    reset();
  });

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

    it("does not allow duplicates", async () => {
      await followCashtags(["$btc", "$btc"]);
      const { trackedCashtags } = await followCashtags(["$btc"]);
      expect(Array.from(trackedCashtags)).toEqual(["$btc"]);
    });

    it("keeps track of cashTagsRuleId", async () => {
      const { cashTagsRuleId } = await followCashtags(["$btc"]);
      expect(cashTagsRuleId).toEqual("999");
    });

    it("ignores configured cashtags", async () => {
      process.env.IGNORE_CASHTAGS = "$btc,$eth";
      const { trackedCashtags } = await followCashtags([
        "$btc",
        "$foo",
        "$bar",
      ]);
      expect(client.tweets.addOrDeleteRules).toBeCalledWith({
        add: [{ tag: "cashtags", value: "$foo OR $bar" }],
      });
      expect(Array.from(trackedCashtags)).toEqual(["$foo", "$bar"]);
    });

    it("creates multiple rules when limit is reached", async () => {
      await followCashtags(Array.from({ length: 80 }, (_, i) => `$TKN${i}`));
      expect(client.tweets.addOrDeleteRules).toBeCalledWith(
        expect.objectContaining({
          add: [expect.anything(), expect.anything()],
        })
      );
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
