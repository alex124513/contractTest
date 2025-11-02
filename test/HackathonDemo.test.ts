import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";

// Helper for TWDT decimals (6)
const u6 = (n: bigint) => n * 1_000_000n;

// 黑客松 Demo：四個情景（Test1~Test4）
// - 按照前後端分工：
//   - 後端（admin/平台、farmer/農夫）呼叫管理權限function
//   - 前端（user）只做查詢與被允許的操作（approve/buy/claim/get）

describe("Hackathon Demo Flow (Test1~Test4)", async function () {
  const { viem } = await network.connect();

  // Test1：黑客松主流程（E2E Happy Path）
  // 1) 後端 admin: 部署、鑄幣、存入工廠、建立專案
  // 2) 前端 user1: approve + 購買 2 份 NFT
  // 3) 後端 admin: （補滿銷售）再結算年度分紅
  // 4) 前端 user1: 領取分紅
  it("Test1 - DEMO流程：建立→銷售→結算→領取", async function () {
    const [admin, farmer, user1, user2] = await viem.getWalletClients();

    // 後端：部署 TWDT 並鑄幣
    const twdt = await viem.deployContract("TWDTToken", [admin.account.address]);
    await twdt.write.mint([admin.account.address, u6(1_000_000n)]);
    await twdt.write.mint([user1.account.address, u6(10_000n)]);
    await twdt.write.mint([user2.account.address, u6(10_000n)]);

    // 後端：部署工廠並存入啟動資金（totalNFTs * price * 3）
    const totalNFTs = 5n;
    const price = u6(100n);
    const requiredFunds = totalNFTs * price * 3n;
    const factory = await viem.deployContract("BankFactory", [twdt.address]);
    await twdt.write.approve([factory.address, requiredFunds], { account: admin.account });
    await factory.write.depositFunds([requiredFunds], { account: admin.account });

    // 後端：admin 建立專案（farmer 為農夫）
    await factory.write.createProject([
      "Hackathon Demo",
      "HDEMO",
      farmer.account.address,
      totalNFTs,
      price,
      u6(1_000n), // buildCost
      u6(600n),   // annualIncome
      50n,        // investorShare (%)
      10n,        // interestRate
      5n          // premiumRate
    ], { account: admin.account });
    const [projectAddr] = await factory.read.getAllProjects();
    const project = await viem.getContractAt("SafeHarvestNFT", projectAddr);

    // 前端：user1 approve + 購買 2 份
    await twdt.write.approve([project.address, u6(100_000n)], { account: user1.account });
    await project.write.buyNFT([2n], { account: user1.account });
    assert.equal(await project.read.mintedNFTs(), 2n);

    // 後端：為令年度結算可執行（需售罄），由 admin 補買 3 份
    await twdt.write.approve([project.address, u6(100_000n)], { account: admin.account });
    await project.write.buyNFT([3n], { account: admin.account });
    assert.equal(await project.read.mintedNFTs(), totalNFTs);

    // 後端：admin 執行年度結算
    await project.write.SafeHarvestCalculator({ account: admin.account });
    assert.equal(await project.read.currentYear(), 1n);

    // 前端：user1 領取分紅
    const rewardBefore = await project.read.pendingRewards([user1.account.address]);
    const balBefore = await twdt.read.balanceOf([user1.account.address]);
    await project.write.claimReward({ account: user1.account });
    const balAfter = await twdt.read.balanceOf([user1.account.address]);
    assert.equal(await project.read.pendingRewards([user1.account.address]), 0n);
    assert.equal(balAfter - balBefore, rewardBefore);
  });

  // Test2：狀態控制（鎖定/解鎖/僅提領）與權限
  // - 後端：admin setProjectStatus(3) → 前端購買/結算/提領被阻擋
  // - 後端：解鎖 setProjectStatus(1) → 可操作
  // - 後端：admin 可設為僅提領 setProjectStatus(2) → 仍可 claim
  it("Test2 - 狀態控制：鎖定/解鎖/僅提領", async function () {
    const [admin, farmer, user1] = await viem.getWalletClients();

    const twdt = await viem.deployContract("TWDTToken", [admin.account.address]);
    await twdt.write.mint([admin.account.address, u6(100_000n)]);
    await twdt.write.mint([user1.account.address, u6(10_000n)]);

    const factory = await viem.deployContract("BankFactory", [twdt.address]);
    const requiredFunds = 1n * u6(100n) * 3n;
    await twdt.write.approve([factory.address, requiredFunds], { account: admin.account });
    await factory.write.depositFunds([requiredFunds], { account: admin.account });

    await factory.write.createProject([
      "Lock Demo",
      "LOCK",
      farmer.account.address,
      1n,
      u6(100n),
      u6(100n),
      u6(100n),
      100n,
      10n,
      5n,
    ], { account: admin.account });
    const [addr] = await factory.read.getAllProjects();
    const proj = await viem.getContractAt("SafeHarvestNFT", addr);

    // 前端：正常購買（先解鎖狀態1）
    await twdt.write.approve([addr, u6(200n)], { account: user1.account });
    await proj.write.buyNFT([1n], { account: user1.account });
    assert.equal(await proj.read.mintedNFTs(), 1n);

    // 後端：鎖定（3）
    await factory.write.setProjectStatus([addr, 3], { account: admin.account });

    // 前端：claim 應被阻擋（先未結算，等同 pending=0；這裡主要驗證 whenClaimable 拒絕）
    let blockedClaim = false;
    try {
      await proj.write.claimReward({ account: user1.account });
    } catch (_) {
      blockedClaim = true;
    }
    assert.equal(blockedClaim, true);

    // 後端：解鎖回 1，並結算
    await factory.write.setProjectStatus([addr, 1], { account: admin.account });
    await proj.write.SafeHarvestCalculator({ account: admin.account });

    // 後端：設為僅提領（2）→ 前端仍可 claim
    await factory.write.setProjectStatus([addr, 2], { account: admin.account });
    const pending = await proj.read.pendingRewards([user1.account.address]);
    const b0 = await twdt.read.balanceOf([user1.account.address]);
    await proj.write.claimReward({ account: user1.account });
    const b1 = await twdt.read.balanceOf([user1.account.address]);
    assert.equal(b1 - b0, pending);
  });

  // Test3：農夫一次性買回流程
  // - 前端 user1：買滿所有 NFT（售罄）
  // - 後端 admin：執行年度結算（讓 lastComputedBuybackPrice > 0）
  // - 後端 farmer：approve 專案買回金額 → FarmerBuyBackAll()
  // - 前端 user1：claim 後，自動把 NFT 轉回 farmer
  it("Test3 - 農夫買回與NFT回收", async function () {
    const [admin, farmer, user1] = await viem.getWalletClients();

    const twdt = await viem.deployContract("TWDTToken", [admin.account.address]);
    await twdt.write.mint([admin.account.address, u6(1_000_000n)]);
    await twdt.write.mint([user1.account.address, u6(1_000_000n)]);
    await twdt.write.mint([farmer.account.address, u6(1_000_000n)]);

    const factory = await viem.deployContract("BankFactory", [twdt.address]);
    const total = 3n;
    const pricePer = u6(100n);
    const required = total * pricePer * 3n;
    await twdt.write.approve([factory.address, required], { account: admin.account });
    await factory.write.depositFunds([required], { account: admin.account });

    await factory.write.createProject([
      "Buyback Demo",
      "BBD",
      farmer.account.address,
      total,
      pricePer,
      u6(1_000n),
      u6(600n),
      50n,
      10n,
      5n,
    ], { account: admin.account });
    const [pa] = await factory.read.getAllProjects();
    const proj = await viem.getContractAt("SafeHarvestNFT", pa);

    // 前端：user1 買滿（售罄）
    await twdt.write.approve([pa, u6(1_000_000n)], { account: user1.account });
    await proj.write.buyNFT([total], { account: user1.account });
    assert.equal(await proj.read.mintedNFTs(), total);

    // 後端：admin 先結算，得到 buybackPrice
    await proj.write.SafeHarvestCalculator({ account: admin.account });
    const priceBB = await proj.read.getFarmerBuyBackPrice();
    assert.equal(priceBB > 0n, true);

    // 後端：farmer approve 買回金額給專案，並執行買回
    await twdt.write.approve([pa, priceBB], { account: farmer.account });
    await proj.write.FarmerBuyBackAll({ account: farmer.account });
    assert.equal(await proj.read.buybackActive(), true);

    // 前端：user1 claim 後，NFT 自動轉回 farmer
    const nftsBefore = await proj.read.balanceOf([user1.account.address]);
    const pendingBB = await proj.read.pendingRewards([user1.account.address]);
    const ub0 = await twdt.read.balanceOf([user1.account.address]);
    await proj.write.claimReward({ account: user1.account });
    const ub1 = await twdt.read.balanceOf([user1.account.address]);
    assert.equal(ub1 - ub0, pendingBB);
    assert.equal(await proj.read.balanceOf([user1.account.address]), 0n);
    assert.equal(nftsBefore > 0n, true);
  });

  // Test4：前端讀取資料API + 後端提領資金
  // - 前端：getProjectData1/getProjectData2/getUserProfile/getFactoryBalance
  // - 後端：admin 在售罄且運作中提領部分資金
  it("Test4 - 前端查詢與後端提領", async function () {
    const [admin, farmer, user1] = await viem.getWalletClients();

    const twdt = await viem.deployContract("TWDTToken", [admin.account.address]);
    await twdt.write.mint([admin.account.address, u6(1_000_000n)]);
    await twdt.write.mint([user1.account.address, u6(100_000n)]);

    const factory = await viem.deployContract("BankFactory", [twdt.address]);
    const total = 2n;
    const pricePer = u6(200n);
    const required = total * pricePer * 3n;
    await twdt.write.approve([factory.address, required], { account: admin.account });
    await factory.write.depositFunds([required], { account: admin.account });

    await factory.write.createProject([
      "Read+Withdraw Demo",
      "RWD",
      farmer.account.address,
      total,
      pricePer,
      u6(2_000n),
      u6(1_000n),
      50n,
      10n,
      5n,
    ], { account: admin.account });
    const [pa] = await factory.read.getAllProjects();
    const proj = await viem.getContractAt("SafeHarvestNFT", pa);

    // 前端：讀取基本資料（未售罄）
    const d1 = await proj.read.getProjectData1();
    assert.equal(d1[4], 0n); // mintedNFTs == 0

    // 前端：user1 購買 2 份（售罄）
    await twdt.write.approve([pa, u6(1_000_000n)], { account: user1.account });
    await proj.write.buyNFT([total], { account: user1.account });
    assert.equal(await proj.read.mintedNFTs(), total);

    // 後端：admin 年度結算一次，產生 pendingRewards
    await proj.write.SafeHarvestCalculator({ account: admin.account });

    // 前端：讀取進階資料 & 個人資料
    const d2 = await proj.read.getProjectData2();
    assert.equal(d2[0], 1n); // currentYear == 1
    const profile = await proj.read.getUserProfile([user1.account.address]);
    assert.equal(profile[0], total); // nftCount == total

    // 前端：查看工廠餘額（建立專案後資金已轉入專案，工廠餘額應為 0）
    const factoryBal = await factory.read.getFactoryBalance();
    assert.equal(factoryBal, 0n);

    // 後端：admin 提領部分資金（仍需 status==1 且售罄）
    const adminB0 = await twdt.read.balanceOf([admin.account.address]);
    await proj.write.withdrawFunds([admin.account.address, u6(100n)], { account: admin.account });
    const adminB1 = await twdt.read.balanceOf([admin.account.address]);
    assert.equal(adminB1 - adminB0, u6(100n));
  });
});


