import { expect } from "chai";
import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

async function callGetPrice(adapter: any, from: string): Promise<[bigint, boolean, bigint]> {
  const result = await ethers.provider.call({
    from,
    to: await adapter.getAddress(),
    data: adapter.interface.encodeFunctionData("getPrice"),
  });
  const decoded = adapter.interface.decodeFunctionResult("getPrice", result);
  return [decoded.price as bigint, decoded.isTrusted as boolean, decoded.updatedAt as bigint];
}

describe("ChainlinkEquityFeedAdapter - B20 24/5 fix", function () {
  let factory: HardhatEthersSigner;
  let market: any;
  let adapter: any;
  let feed: any;
  let sequencer: any;

  beforeEach(async function () {
    [factory] = await ethers.getSigners();
    const Adapter = await ethers.getContractFactory("ChainlinkEquityFeedAdapter");
    adapter = await Adapter.deploy(await factory.getAddress());
    const MockFeed = await ethers.getContractFactory("MockChainlinkFeed");
    feed = await MockFeed.deploy(2000n * 10n ** 8n, 8, 0);
    sequencer = await MockFeed.deploy(0, 0, 0);
    // sequencer up (answer 0 = up per MockChainlinkFeed logic? Actually adapter checks answer==1 for up? Check _isSequencerUp)
    // In ChainlinkEquityFeedAdapter.sol _isSequencerUp checks answer==1 for up, but MockChainlinkFeed deployed with 0 => will be considered down?
    // Let's set sequencer to answer 1 = up, with fresh updatedAt
    await sequencer.setAnswer(1);
    market = await ethers.Wallet.createRandom();
    // configure market
    await adapter.connect(factory).configure(market.address, ethers.ZeroAddress);
    // register feed with 90000 staleness (25h) as per plan
    await adapter.connect(factory).registerFeed(market.address, await feed.getAddress(), 90000, await sequencer.getAddress());
  });

  async function nextMondayNoonUTC(): Promise<number> {
    const now = await ethers.provider.getBlock("latest").then(b => b!.timestamp);
    // find next Monday 12:00 UTC strictly in the future
    // compute days until next Monday
    const date = new Date(now * 1000);
    const day = date.getUTCDay(); // 0 Sun
    let daysUntilMonday = (1 - day + 7) % 7;
    if (daysUntilMonday === 0) {
      // today is Monday, ensure next Monday is > now + 86400
      const todayNoon = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 12, 0, 0) / 1000;
      if (now < todayNoon) daysUntilMonday = 0;
      else daysUntilMonday = 7;
    }
    // else daysUntilMonday could be 0-6, but for Monday we handled
    let monday = Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 12, 0, 0) / 1000) + daysUntilMonday * 86400;
    if (monday <= now) monday += 7 * 86400;
    return monday;
  }

  it("should trust Monday-Friday and distrust Saturday/Sunday (fixed +3)", async function () {
    const monday = await nextMondayNoonUTC();
    for (let offset = 0; offset < 7; offset++) {
      const ts = monday + offset * 86400;
      const dayName = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"][offset];
      await feed.setAnswerAndTimestamp(2000n * 10n ** 8n, ts);
      await sequencer.setAnswerAndTimestamp(1, ts);
      await ethers.provider.send("evm_setNextBlockTimestamp", [ts]);
      await ethers.provider.send("evm_mine", []);
      const [, isTrusted] = await callGetPrice(adapter, market.address);
      if (offset < 5) {
        expect(isTrusted, `${dayName} should be trusted`).to.equal(true);
      } else {
        expect(isTrusted, `${dayName} should be untrusted`).to.equal(false);
      }
    }
  });

  it("should have correct day mapping: Monday trusted, Saturday untrusted, Sunday untrusted (chronological)", async function () {
    const monday = await nextMondayNoonUTC();
    const saturday = monday + 5 * 86400;
    const sunday = monday + 6 * 86400;

    // Monday
    await feed.setAnswerAndTimestamp(2000n * 10n ** 8n, monday);
    await sequencer.setAnswerAndTimestamp(1, monday);
    await ethers.provider.send("evm_setNextBlockTimestamp", [monday]);
    await ethers.provider.send("evm_mine", []);
    let [, trustedMon] = await callGetPrice(adapter, market.address);
    expect(trustedMon).to.equal(true);

    // Saturday
    await feed.setAnswerAndTimestamp(2000n * 10n ** 8n, saturday);
    await sequencer.setAnswerAndTimestamp(1, saturday);
    await ethers.provider.send("evm_setNextBlockTimestamp", [saturday]);
    await ethers.provider.send("evm_mine", []);
    let [, trustedSat] = await callGetPrice(adapter, market.address);
    expect(trustedSat).to.equal(false);

    // Sunday
    await feed.setAnswerAndTimestamp(2000n * 10n ** 8n, sunday);
    await sequencer.setAnswerAndTimestamp(1, sunday);
    await ethers.provider.send("evm_setNextBlockTimestamp", [sunday]);
    await ethers.provider.send("evm_mine", []);
    let [, trustedSun] = await callGetPrice(adapter, market.address);
    expect(trustedSun).to.equal(false);
  });

  it("should be untrusted when sequencer down regardless of weekday", async function () {
    const monday = await nextMondayNoonUTC();
    await feed.setAnswerAndTimestamp(2000n * 10n ** 8n, monday);
    await sequencer.setAnswerAndTimestamp(0, monday); // 0 = down
    await ethers.provider.send("evm_setNextBlockTimestamp", [monday]);
    await ethers.provider.send("evm_mine", []);
    const [, trusted] = await callGetPrice(adapter, market.address);
    expect(trusted).to.equal(false);
  });

  it("should respect maxStaleness 90000 (25h) not 86700", async function () {
    const monday = await nextMondayNoonUTC();
    // within 90000
    await feed.setAnswerAndTimestamp(2000n * 10n ** 8n, monday - 89999);
    await sequencer.setAnswerAndTimestamp(1, monday);
    await ethers.provider.send("evm_setNextBlockTimestamp", [monday]);
    await ethers.provider.send("evm_mine", []);
    let [, trusted1] = await callGetPrice(adapter, market.address);
    expect(trusted1).to.equal(true);

    // stale >90000
    const later = monday + 10;
    await feed.setAnswerAndTimestamp(2000n * 10n ** 8n, later - 90001);
    await sequencer.setAnswerAndTimestamp(1, later);
    await ethers.provider.send("evm_setNextBlockTimestamp", [later]);
    await ethers.provider.send("evm_mine", []);
    let [, trusted2] = await callGetPrice(adapter, market.address);
    expect(trusted2).to.equal(false);
  });
});
