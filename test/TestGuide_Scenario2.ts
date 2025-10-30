import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";

// Helper for TWDT decimals (6)
const u6 = (n: bigint) => n * 1_000_000n;

describe("TestGuide Scenario 2: 多投資人按 NFT 數量分紅", async function () {
  const { viem } = await network.connect();
  const [deployer, investorA, investorB] = await viem.getWalletClients();

  console.log("\n========================================");
  console.log("🧪 TestGuide Scenario 2: 多投資人按 NFT 數量分紅");
  console.log("========================================\n");

  // 記錄所有地址
  const addresses = {
    deployer: deployer.account.address,
    investorA: investorA.account.address,
    investorB: investorB.account.address,
    twdt: "" as string,
    factory: "" as string,
    project: "" as string,
  };

  console.log("📋 初始地址:");
  console.log(`  deployer: ${addresses.deployer}`);
  console.log(`  investorA: ${addresses.investorA}`);
  console.log(`  investorB: ${addresses.investorB}\n`);

  it("部署與設置", async function () {
    console.log("\n--- 部署 TWDT Token ---");
    const twdt = await viem.deployContract("TWDTToken", [addresses.deployer]);
    addresses.twdt = twdt.address;
    console.log(`  ✓ TWDT: ${addresses.twdt}`);
    
    await twdt.write.mint([addresses.deployer, u6(1_000_000n)]);
    console.log(`  ✓ Mint 1,000,000 TWDT to deployer\n`);

    console.log("--- 部署 Factory ---");
    const factory = await viem.deployContract("BankFactory", [addresses.twdt]);
    addresses.factory = factory.address;
    console.log(`  ✓ Factory: ${addresses.factory}\n`);

    console.log("--- 建立 SafeHarvest 專案 ---");
    await factory.write.createProject([
      "Multi-Investor Project",
      "MIP",
      3n,             // totalNFTs (修正為 3)
      u6(100n),       // nftPrice: 100 TWDT
      u6(1000n),      // buildCost: 1000 TWDT
      u6(300n),       // annualIncome: 300 TWDT
      50n,            // investorShare: 50%
      10n,            // interestRate: 10%
      5n,             // premiumRate: 5%
    ]);
    console.log("  Parameters:");
    console.log("    - 總 NFT: 3");
    console.log("    - 價格: 100 TWDT");
    console.log("    - 建造成本: 1000 TWDT");
    console.log("    - 年度收益: 300 TWDT");
    console.log("    - 投資人分潤: 50% (150 TWDT/year)");

    const [projectAddr] = await factory.read.getAllProjects();
    addresses.project = projectAddr;
    console.log(`  ✓ Project: ${addresses.project}\n`);
  });

  it("多投資人購買與分紅計算", async function () {
    const twdt = await viem.getContractAt("TWDTToken", addresses.twdt);
    const project = await viem.getContractAt("SafeHarvestNFT", addresses.project);

    console.log("\n--- 分配 TWDT 給投資人 ---");
    await twdt.write.transfer([addresses.investorA, u6(1000n)], { account: deployer.account });
    await twdt.write.transfer([addresses.investorB, u6(1000n)], { account: deployer.account });
    console.log(`  ✓ investorA: 1000 TWDT`);
    console.log(`  ✓ investorB: 1000 TWDT\n`);

    console.log("--- Approve ---");
    await twdt.write.approve([addresses.project, u6(1000n)], { account: investorA.account });
    await twdt.write.approve([addresses.project, u6(1000n)], { account: investorB.account });
    console.log(`  ✓ investorA approve`);
    console.log(`  ✓ investorB approve\n`);

    console.log("--- investorA 購買 2 枚 NFT ---");
    console.log("  調用: project.buyNFT(2)");
    console.log(`  caller: ${addresses.investorA}`);
    console.log(`  input: amount = 2`);
    
    await project.write.buyNFT([2n], { account: investorA.account });
    
    const mintedAfterA = await project.read.mintedNFTs();
    const owner1 = await project.read.ownerOf([1n]);
    const owner2 = await project.read.ownerOf([2n]);
    
    console.log(`  ✓ NFT 購買成功\n`);
    console.log("  Output:");
    console.log(`    mintedNFTs: ${mintedAfterA}`);
    console.log(`    NFT #1 owner: ${owner1}`);
    console.log(`    NFT #2 owner: ${owner2}\n`);

    assert.equal(mintedAfterA, 2n, "應該有 2 個 NFT");
    assert.equal(owner1.toLowerCase(), addresses.investorA.toLowerCase(), "NFT #1 屬於 investorA");
    assert.equal(owner2.toLowerCase(), addresses.investorA.toLowerCase(), "NFT #2 屬於 investorA");

    console.log("--- investorB 購買 1 枚 NFT ---");
    console.log("  調用: project.buyNFT(1)");
    console.log(`  caller: ${addresses.investorB}`);
    console.log(`  input: amount = 1`);
    
    await project.write.buyNFT([1n], { account: investorB.account });
    
    const mintedAfterB = await project.read.mintedNFTs();
    const owner3 = await project.read.ownerOf([3n]);
    
    console.log(`  ✓ NFT 購買成功\n`);
    console.log("  Output:");
    console.log(`    mintedNFTs: ${mintedAfterB}`);
    console.log(`    NFT #3 owner: ${owner3}\n`);

    assert.equal(mintedAfterB, 3n, "應該有 3 個 NFT");
    assert.equal(owner3.toLowerCase(), addresses.investorB.toLowerCase(), "NFT #3 屬於 investorB");

    console.log("--- 年度結算 ---");
    console.log("  調用: project.SafeHarvestCalculator()");
    console.log(`  caller: ${addresses.deployer}`);
    
    await project.write.SafeHarvestCalculator({ account: deployer.account });
    
    const year = await project.read.currentYear();
    const pendingRewardsA = await project.read.pendingRewards([addresses.investorA]);
    const pendingRewardsB = await project.read.pendingRewards([addresses.investorB]);
    
    console.log(`  ✓ 年度結算完成\n`);
    console.log("  Output:");
    console.log(`    currentYear: ${year}`);
    console.log(`    pendingRewards[investorA]: ${pendingRewardsA}`);
    console.log(`    pendingRewards[investorB]: ${pendingRewardsB}\n`);
    
    // 分紅計算: (300 * 50%) / 3 = 50 TWDT per NFT
    const rewardPerNFT = u6(300n * 50n / 100n) / 3n;
    const expectedRewardA = rewardPerNFT * 2n; // 2 NFTs
    const expectedRewardB = rewardPerNFT * 1n; // 1 NFT
    
    console.log("  分紅計算:");
    console.log(`    年度投資人總收益: 300 × 50% = 150 TWDT`);
    console.log(`    每份 NFT 分紅: 150 / 3 = ${rewardPerNFT} TWDT`);
    console.log(`    investorA (2 NFTs): ${expectedRewardA} TWDT`);
    console.log(`    investorB (1 NFT): ${expectedRewardB} TWDT\n`);

    assert.equal(year, 1n, "應該是第一年");
    assert.equal(pendingRewardsA, expectedRewardA, "investorA 應該收到 100 TWDT");
    assert.equal(pendingRewardsB, expectedRewardB, "investorB 應該收到 50 TWDT");

    console.log("--- investorA 領取分紅 ---");
    console.log("  調用: project.claimReward()");
    console.log(`  caller: ${addresses.investorA}`);
    
    const balanceBeforeA = await twdt.read.balanceOf([addresses.investorA]);
    await project.write.claimReward({ account: investorA.account });
    const balanceAfterA = await twdt.read.balanceOf([addresses.investorA]);
    const pendingAfterA = await project.read.pendingRewards([addresses.investorA]);
    
    console.log(`  ✓ investorA 領取成功\n`);
    console.log("  Output:");
    console.log(`    investorA 餘額 (領取前): ${balanceBeforeA}`);
    console.log(`    investorA 餘額 (領取後): ${balanceAfterA}`);
    console.log(`    餘額增加: ${balanceAfterA - balanceBeforeA}`);
    console.log(`    pendingRewards (領取後): ${pendingAfterA}\n`);

    assert.equal(balanceAfterA - balanceBeforeA, expectedRewardA, "investorA 餘額應該增加 100 TWDT");
    assert.equal(pendingAfterA, 0n, "investorA pending 應該歸零");

    console.log("--- investorB 領取分紅 ---");
    console.log("  調用: project.claimReward()");
    console.log(`  caller: ${addresses.investorB}`);
    
    const balanceBeforeB = await twdt.read.balanceOf([addresses.investorB]);
    await project.write.claimReward({ account: investorB.account });
    const balanceAfterB = await twdt.read.balanceOf([addresses.investorB]);
    const pendingAfterB = await project.read.pendingRewards([addresses.investorB]);
    
    console.log(`  ✓ investorB 領取成功\n`);
    console.log("  Output:");
    console.log(`    investorB 餘額 (領取前): ${balanceBeforeB}`);
    console.log(`    investorB 餘額 (領取後): ${balanceAfterB}`);
    console.log(`    餘額增加: ${balanceAfterB - balanceBeforeB}`);
    console.log(`    pendingRewards (領取後): ${pendingAfterB}\n`);

    assert.equal(balanceAfterB - balanceBeforeB, expectedRewardB, "investorB 餘額應該增加 50 TWDT");
    assert.equal(pendingAfterB, 0n, "investorB pending 應該歸零");

    console.log("========================================\n");
    console.log("✅ Scenario 2 測試完成!\n");
    console.log("📊 完整地址清單:");
    console.log(JSON.stringify(addresses, null, 2));
  });
});

