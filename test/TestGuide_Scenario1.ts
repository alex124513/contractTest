import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";

// Helper for TWDT decimals (6)
const u6 = (n: bigint) => n * 1_000_000n;

describe("TestGuide Scenario 1: 單一投資人年度收益", async function () {
  const { viem } = await network.connect();
  const [deployer, investorA] = await viem.getWalletClients();

  console.log("\n========================================");
  console.log("🧪 TestGuide Scenario 1: 單一投資人年度收益");
  console.log("========================================\n");

  // 記錄所有地址
  const addresses = {
    deployer: deployer.account.address,
    investorA: investorA.account.address,
    twdt: "" as string,
    factory: "" as string,
    project: "" as string,
  };

  console.log("📋 初始地址:");
  console.log(`  deployer: ${addresses.deployer}`);
  console.log(`  investorA: ${addresses.investorA}\n`);

  it("步驟 1-3: 部署合約與建立專案", async function () {
    console.log("\n--- 步驟 1: 部署 TWDT Token ---");
    const twdt = await viem.deployContract("TWDTToken", [addresses.deployer]);
    addresses.twdt = twdt.address;
    console.log(`  ✓ TWDT 部署: ${addresses.twdt}`);
    
    const deployerBalanceBefore = await twdt.read.balanceOf([addresses.deployer]);
    console.log(`  deployer 餘額 (部署後): ${deployerBalanceBefore}\n`);

    console.log("--- 步驟 2: Mint 初始 TWDT ---");
    await twdt.write.mint([addresses.deployer, u6(1_000_000n)]);
    const deployerBalanceAfter = await twdt.read.balanceOf([addresses.deployer]);
    console.log(`  ✓ Mint 1,000,000 TWDT to deployer`);
    console.log(`  deployer 餘額: ${deployerBalanceAfter}\n`);

    console.log("--- 步驟 3: 部署 Factory ---");
    const factory = await viem.deployContract("BankFactory", [addresses.twdt]);
    addresses.factory = factory.address;
    console.log(`  ✓ Factory 部署: ${addresses.factory}\n`);

    // 建立專案
    console.log("--- 步驟 4: 建立 SafeHarvest 專案 ---");
    await factory.write.createProject([
      "SafeHarvest Test",
      "SHT",
      3n,             // totalNFTs (修正為 3，符合 TestGuide)
      u6(100n),       // nftPrice: 100 TWDT
      u6(1000n),      // buildCost: 1000 TWDT
      u6(200n),       // annualIncome: 200 TWDT
      50n,            // investorShare: 50%
      10n,            // interestRate: 10%
      5n,             // premiumRate: 5%
    ]);
    console.log("  Input parameters:");
    console.log("    - 總 NFT 數量: 3");
    console.log("    - NFT 價格: 100 TWDT");
    console.log("    - 建造成本: 1000 TWDT");
    console.log("    - 年度收益: 200 TWDT");
    console.log("    - 投資人分潤: 50%");
    console.log("    - 利率: 10%");
    console.log("    - 溢酬: 5%");

    const [projectAddr] = await factory.read.getAllProjects();
    addresses.project = projectAddr;
    console.log(`  ✓ 專案建立: ${addresses.project}\n`);

    const project = await viem.getContractAt("SafeHarvestNFT", projectAddr);
    
    // 驗證專案參數
    const totalNFTs = await project.read.totalNFTs();
    const nftPrice = await project.read.nftPrice();
    const buildCost = await project.read.buildCost();
    const annualIncome = await project.read.annualIncome();
    const investorShare = await project.read.investorShare();
    
    console.log("  ✓ 專案參數驗證:");
    console.log(`    totalNFTs: ${totalNFTs}`);
    console.log(`    nftPrice: ${nftPrice}`);
    console.log(`    buildCost: ${buildCost}`);
    console.log(`    annualIncome: ${annualIncome}`);
    console.log(`    investorShare: ${investorShare}%\n`);

    assert.equal(totalNFTs, 3n, "totalNFTs 應該為 3");
    assert.equal(nftPrice, u6(100n), "nftPrice 應該為 100 TWDT");
    assert.equal(buildCost, u6(1000n), "buildCost 應該為 1000 TWDT");
  });

  it("步驟 5-6: 投資人購買 NFT 與年度結算", async function () {
    const twdt = await viem.getContractAt("TWDTToken", addresses.twdt);
    const project = await viem.getContractAt("SafeHarvestNFT", addresses.project);

    console.log("\n--- 步驟 5: 分配 TWDT 給投資人 ---");
    await twdt.write.transfer([addresses.investorA, u6(1000n)], { account: deployer.account });
    const investorBalanceAfterTransfer = await twdt.read.balanceOf([addresses.investorA]);
    console.log(`  ✓ 轉移 1000 TWDT 給 investorA`);
    console.log(`  investorA 餘額: ${investorBalanceAfterTransfer}\n`);

    console.log("--- 步驟 6: investorA approve 專案合約 ---");
    await twdt.write.approve([addresses.project, u6(1000n)], { account: investorA.account });
    console.log(`  ✓ approve ${addresses.project} 1000 TWDT\n`);

    console.log("--- 步驟 7: investorA 購買 NFT ---");
    console.log("  調用: project.buyNFT(1)");
    console.log(`  caller: ${addresses.investorA}`);
    console.log(`  input: amount = 1`);
    
    await project.write.buyNFT([1n], { account: investorA.account });
    
    const mintedNFTs = await project.read.mintedNFTs();
    const owner1 = await project.read.ownerOf([1n]);
    const projectBalance = await twdt.read.balanceOf([addresses.project]);
    const investorBalanceAfterBuy = await twdt.read.balanceOf([addresses.investorA]);
    
    console.log(`  ✓ NFT 購買成功\n`);
    console.log("  Output:");
    console.log(`    mintedNFTs: ${mintedNFTs}`);
    console.log(`    NFT #1 owner: ${owner1}`);
    console.log(`    專案合約 TWDT 餘額: ${projectBalance}`);
    console.log(`    investorA TWDT 餘額: ${investorBalanceAfterBuy}\n`);

    assert.equal(mintedNFTs, 1n, "應該 mint 1 個 NFT");
    assert.equal(owner1.toLowerCase(), addresses.investorA.toLowerCase(), "NFT 擁有者應該是 investorA");
    assert.equal(projectBalance, u6(100n), "專案應該收到 100 TWDT");

    // 為了完成售罄，investorA 再買 2 個 NFT
    console.log("--- 步驟 7b: investorA 再購買 2 枚 NFT (完成售罄) ---");
    console.log("  調用: project.buyNFT(2)");
    console.log(`  caller: ${addresses.investorA}`);
    console.log(`  input: amount = 2`);
    
    await project.write.buyNFT([2n], { account: investorA.account });
    
    const mintedFinal = await project.read.mintedNFTs();
    console.log(`  ✓ 售罄完成\n`);
    console.log("  Output:");
    console.log(`    mintedNFTs: ${mintedFinal}\n`);

    assert.equal(mintedFinal, 3n, "應該有 3 個 NFT");

    console.log("--- 步驟 8: 年度結算 ---");
    console.log("  調用: project.SafeHarvestCalculator()");
    console.log(`  caller: ${addresses.deployer}`);
    
    await project.write.SafeHarvestCalculator({ account: deployer.account });
    
    const year = await project.read.currentYear();
    const cumulativePrincipal = await project.read.cumulativePrincipal();
    const remainingPrincipal = await project.read.remainingPrincipal();
    const pendingRewards = await project.read.pendingRewards([addresses.investorA]);
    
    console.log(`  ✓ 年度結算完成\n`);
    console.log("  Output:");
    console.log(`    currentYear: ${year}`);
    console.log(`    cumulativePrincipal: ${cumulativePrincipal}`);
    console.log(`    remainingPrincipal: ${remainingPrincipal}`);
    console.log(`    pendingRewards[investorA]: ${pendingRewards}\n`);
    
    // 分紅計算: (200 * 50%) / 3 = 33.33... TWDT per NFT
    const rewardPerNFT = u6(200n * 50n / 100n) / 3n;
    // investorA 擁有 3 個 NFT，所以總分紅 = rewardPerNFT * 3
    const expectedReward = rewardPerNFT * 3n; // 所有 3 個 NFT 的分紅
    console.log(`  分紅計算: (200 × 50%) / 3 = ${rewardPerNFT} TWDT per NFT`);
    console.log(`  investorA 擁有 3 個 NFT，總分紅: ${expectedReward} TWDT\n`);

    assert.equal(year, 1n, "應該是第一年");
    assert.equal(pendingRewards, expectedReward, "投資人應該收到 3 個 NFT 的總分紅");

    console.log("--- 步驟 9: investorA 領取分紅 ---");
    console.log("  調用: project.claimReward()");
    console.log(`  caller: ${addresses.investorA}`);
    
    const balanceBeforeClaim = await twdt.read.balanceOf([addresses.investorA]);
    await project.write.claimReward({ account: investorA.account });
    const balanceAfterClaim = await twdt.read.balanceOf([addresses.investorA]);
    const pendingAfterClaim = await project.read.pendingRewards([addresses.investorA]);
    
    console.log(`  ✓ 分紅領取成功\n`);
    console.log("  Output:");
    console.log(`    investorA 餘額 (領取前): ${balanceBeforeClaim}`);
    console.log(`    investorA 餘額 (領取後): ${balanceAfterClaim}`);
    console.log(`    餘額增加: ${balanceAfterClaim - balanceBeforeClaim}`);
    console.log(`    pendingRewards (領取後): ${pendingAfterClaim}\n`);

    assert.equal(balanceAfterClaim - balanceBeforeClaim, expectedReward, "投資人餘額應該增加 10 TWDT");
    assert.equal(pendingAfterClaim, 0n, "pendingRewards 應該歸零");

    console.log("========================================\n");
    console.log("✅ Scenario 1 測試完成!\n");
    console.log("📊 完整地址清單:");
    console.log(JSON.stringify(addresses, null, 2));
  });
});

