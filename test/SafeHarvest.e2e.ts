import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { network } from "hardhat";

// Helper: numbers with 6 decimals (TWDT overrides decimals() to 6)
const u6 = (n: bigint) => n * 1_000_000n;

// =============================
// SafeHarvest 專案 E2E 測試（中文注解）
//
// 場景一：專案建立與初次募資（銀行平台 → 專案啟動）
//  - 由工廠（BankFactory）建立 SafeHarvestNFT 專案
//  - 銀行（deployer）用 TWDT 先付款買晒 NFT（用戶唔使出錢包）
//  - 事件與合約餘額檢查
//
// 場景二：第一年收益分配（收益計算與派息）
//  - owner 呼叫 SafeHarvestCalculator()，計算每份 NFT 的分紅
//
// 場景三：投資人領取報酬（Claim 流程）
//  - 用戶領取 pendingRewards，合約 TWDT 餘額相應減少
//
// 場景四：第五年專案買回（結案與本金溢價回收）
//  - 目前屬未來功能，先放 skip 測試骨架
// =============================
describe("SafeHarvest E2E 測試", async function () {
  const { viem } = await network.connect();

  // 場景一 + 場景二 + 場景三（銀行先付款 → 分派 NFT → 年度派息 → 用戶領取）
  it("場景1+2+3：銀行先付款購買 → 分派 → 結算分紅 → 用戶領取", async function () {
    const [deployer, investor] = await viem.getWalletClients();

    // 由銀行(deployer) 鑄造 TWDT 自用（用戶無需出錢包）
    const twdt = await viem.deployContract("TWDTToken", [deployer.account.address]);
    await twdt.write.mint([deployer.account.address, u6(10_000n)]);

    // 建立一個小型專案（3 份 NFT，每份 1 TWDT）
    const factory = await viem.deployContract("BankFactory", [twdt.address]);
    
    // 💰 計算所需資金：3 NFT × 1 TWDT × 3 = 9 TWDT
    const requiredFunds = 3n * u6(1n) * 3n;
    
    // Approve 並存入資金到工廠
    await twdt.write.approve([factory.address, requiredFunds]);
    await factory.write.depositFunds([requiredFunds]);
    
    await factory.write.createProject([
      "SafeHarvest Mini",
      "SHM",
      deployer.account.address,  // farmer address
      3n,            // totalNFTs
      u6(1n),        // nftPrice (1 TWDT)
      u6(10n),       // buildCost
      u6(6n),        // annualIncome
      50n,           // investorShare (%) => 3 TWDT/year
      10n,           // interestRate (%)
      5n,            // premiumRate (%)
    ]);

    const [projectAddr] = await factory.read.getAllProjects();
    const project = await viem.getContractAt("SafeHarvestNFT", projectAddr);

    // 銀行 approve 並一次過買晒 3 份 NFT（用戶唔使俾錢）
    await twdt.write.approve([project.address, u6(10_000n)], { account: deployer.account });
    await project.write.buyNFT([3n], { account: deployer.account });

    const minted = await project.read.mintedNFTs();
    assert.equal(minted, 3n);
    const owner1 = await project.read.ownerOf([1n]);
    assert.equal(owner1.toLowerCase(), deployer.account.address.toLowerCase());
    const total = await project.read.totalNFTs();
    assert.equal(total, 3n);
    const income = await project.read.annualIncome();
    assert.equal(income, u6(6n));
    const share = await project.read.investorShare();
    assert.equal(share, 50n);

    // 募資款應已入專案合約（工廠存入的 9 TWDT + 銀行購買的 3 TWDT）
    const raisedBefore = await twdt.read.balanceOf([project.address]);
    assert.equal(raisedBefore, u6(3n) + requiredFunds, "應包含工廠存入資金");

    // 將 3 份 NFT 轉派俾用戶（唔涉及資金）
    await project.write.transferFrom([deployer.account.address, investor.account.address, 1n], { account: deployer.account });
    await project.write.transferFrom([deployer.account.address, investor.account.address, 2n], { account: deployer.account });
    await project.write.transferFrom([deployer.account.address, investor.account.address, 3n], { account: deployer.account });

    // owner 進行年度結算（分紅計算）
    await project.write.SafeHarvestCalculator();
    const year = await project.read.currentYear();
    assert.equal(year, 1n);

    // 分紅公式備註：
    // rewardPerNFT = (annualIncome * investorShare / 100) / totalNFTs
    // 例： (6 * 50%)/3 = 1 TWDT；用戶有 3 份 → 3 TWDT
    const pendingBefore = await project.read.pendingRewards([investor.account.address]);
    assert.equal(pendingBefore, u6(3n));
    const projBalBefore = await twdt.read.balanceOf([project.address]);
    assert.equal(projBalBefore, u6(3n) + requiredFunds, "應包含工廠存入資金");

    const balBefore = await twdt.read.balanceOf([investor.account.address]);
    await project.write.claimReward({ account: investor.account });
    const balAfter = await twdt.read.balanceOf([investor.account.address]);
    const expected = (income * share / 100n) / total * 3n;
    assert.equal(balAfter - balBefore, expected);
    const pendingAfter = await project.read.pendingRewards([investor.account.address]);
    assert.equal(pendingAfter, 0n);
    const projBalAfter = await twdt.read.balanceOf([project.address]);
    assert.equal(projBalAfter, requiredFunds, "領取後剩餘工廠存入資金");
  });

  // 補充場景：鎖定／解鎖會影響買入、領取、提領
  it("補充：factory 鎖定/解鎖 控制 buy/claim/withdraw", async function () {
    const [deployer, investor] = await viem.getWalletClients();

    const twdt = await viem.deployContract("TWDTToken", [deployer.account.address]);
    await twdt.write.mint([deployer.account.address, u6(1000n)]);  // 給 deployer 足夠資金
    await twdt.write.mint([investor.account.address, u6(100n)]);
    const factory = await viem.deployContract("BankFactory", [twdt.address]);

    // 💰 計算所需資金：1 NFT × 10 TWDT × 3 = 30 TWDT
    const requiredFunds = 1n * u6(10n) * 3n;
    await twdt.write.approve([factory.address, requiredFunds]);
    await factory.write.depositFunds([requiredFunds]);

    await factory.write.createProject([
      "SafeHarvest L",
      "SHL",
      deployer.account.address,  // farmer address
      1n,
      u6(10n),      // price 10 TWDT
      u6(10n),
      u6(10n),
      100n,
      10n,
      5n,
    ]);
    const [addr] = await factory.read.getAllProjects();
    const proj = await viem.getContractAt("SafeHarvestNFT", addr);

    // lock (set status to 3)
    await factory.write.setProjectStatus([addr, 3]);

    // buy should revert when locked
    await twdt.write.approve([addr, u6(20n)], { account: investor.account });
    let reverted = false;
    try {
      await proj.write.buyNFT([1n], { account: investor.account });
    } catch (_) {
      reverted = true;
    }
    assert.equal(reverted, true);

    // unlock and buy (set status to 1)
    await factory.write.setProjectStatus([addr, 1]);
    await proj.write.buyNFT([1n], { account: investor.account });

    // now sold-out, lock again blocks claim/withdraw (set status to 3)
    await factory.write.setProjectStatus([addr, 3]);

    // owner calculator should also be blocked by whenOperational
    let revertedCalc = false;
    try {
      await proj.write.SafeHarvestCalculator();
    } catch (_) {
      revertedCalc = true;
    }
    assert.equal(revertedCalc, true);
  });

  // 場景四（預留）：第五年專案買回（需要未來新增 executeBuyback 功能）
  it.skip("場景4：第五年買回（預留，待 executeBuyback 實作）", async function () {
    // 期望流程：連續執行 5 次 SafeHarvestCalculator() → 累計本金回收
    // 然後 owner 呼叫 executeBuyback() → 向每個 NFT 持有人支付 本金+溢酬
    // 並標記專案完成，禁止再次結算
  });
});


