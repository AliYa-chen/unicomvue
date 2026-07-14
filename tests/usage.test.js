import assert from "node:assert/strict";
import { test } from "node:test";
import { buildCardsFromOcs } from "../src/domain/usage.js";

test("buildCardsFromOcs converts, deduplicates, filters, and sorts OCS resources", () => {
  const unlimitedFlow = {
    feePolicyId: "unlimited",
    feePolicyName: "畅享无限流量",
    elemType: "3",
    limited: "1",
    flowType: "1",
    typemark: "0",
    use: "1024",
    total: "0",
    remain: "0",
  };
  const cards = buildCardsFromOcs({
    resources: [
      {
        details: [
          unlimitedFlow,
          {
            feePolicyId: "limited",
            feePolicyName: "2GB 月包",
            elemType: "3",
            limited: "0",
            flowType: "1",
            use: "512",
            total: "2048",
            remain: "1536",
          },
          {
            feePolicyId: "hidden",
            elemType: "3",
            hide: true,
          },
          {
            feePolicyId: "not-flow",
            elemType: "2",
          },
        ],
      },
      {
        userResource: "30",
        remainResource: "70",
        details: [{ feePolicyId: "voice-detail" }],
      },
      {
        userResource: "2",
        remainResource: "8",
        details: [{ feePolicyId: "sms-detail" }],
      },
    ],
    unshared: [
      { details: [{ ...unlimitedFlow, feePolicyName: "重复项" }] },
      null,
      null,
    ],
  });

  assert.deepEqual(cards.map((card) => card.id), [
    "voice",
    "sms",
    "flow:feePolicyId:unlimited",
    "flow:feePolicyId:limited",
  ]);

  assert.deepEqual(cards[0], {
    id: "voice",
    kind: "voice",
    title: "语音",
    subtitle: "（已用）",
    mainValue: "30分钟",
    smallTotal: "总：100分钟",
    unlimited: false,
    percent: 30,
    canUseText: "剩：70分钟",
  });
  assert.equal(cards[1].mainValue, "2条");
  assert.equal(cards[1].percent, 20);

  const unlimitedCard = cards[2];
  assert.equal(unlimitedCard.title, "畅享无限流量");
  assert.equal(unlimitedCard.mainValue, "1.00GB");
  assert.equal(unlimitedCard.smallTotal, "总量：∞");
  assert.equal(unlimitedCard.percent, 100);
  assert.equal(unlimitedCard.badges[1].text, "共享");

  const limitedCard = cards[3];
  assert.equal(limitedCard.mainValue, "512.00MB");
  assert.equal(limitedCard.smallTotal, "总：2.00GB");
  assert.equal(limitedCard.canUseText, "剩：1.50GB");
  assert.equal(limitedCard.percent, 25);
});

test("buildCardsFromOcs returns no cards for missing resources", () => {
  assert.deepEqual(buildCardsFromOcs(null), []);
  assert.deepEqual(buildCardsFromOcs({ resources: "invalid" }), []);
});
