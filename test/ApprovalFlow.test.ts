import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";

// Helper for TWDT decimals (6)
const u6 = (n: bigint) => n * 1_000_000n;

describe("Approval Flow: 投資人 TWDT Approve 流程測試", async function () {
  const { viem } = await network.connect();

  it("投資人未 approve 前無法購買 NFT", async function () {
    const [deployer, investor] = await viem.getWalletClients();

    console.log("\n========================================");
    console.log("🧪 測試場景：未 approve 前購買失敗");
    console.log("========================================\n");

    // 部署合約
    const twdt = await viem.deployContract("TWDTToken", [deployer.account.address]);
    await twdt.write.mint([deployer.account.address, u6(10000n)]);  // mint 給 deployer
    await twdt.write.mint([investor.account.address, u6(1000n)]);   // mint 給 investor

    const factory = await viem.deployContract("BankFactory", [twdt.address]);

    // 💰 計算所需資金並存入
    const requiredFunds = 10n * u6(100n) * 3n;
    await twdt.write.approve([factory.address, requiredFunds]);
    await factory.write.depositFunds([requiredFunds]);

    // 建立專案
    await factory.write.createProject([
      "Test Project",
      "TP",
      deployer.account.address,  // farmer
      10n,                        // totalNFTs
      u6(100n),                   // nftPrice
      u6(1000n),                  // buildCost
      u6(200n),                   // annualIncome
      50n,                        // investorShare
      10n,                        // interestRate
      5n,                         // premiumRate
    ]);

    const [projectAddr] = await factory.read.getAllProjects();
    const project = await viem.getContractAt("SafeHarvestNFT", projectAddr);

    console.log("📋 測試設定:");
    console.log(`  investor: ${investor.account.address}`);
    console.log(`  project: ${projectAddr}`);
    console.log(`  投資人餘額: ${await twdt.read.balanceOf([investor.account.address])}\n`);

    // 嘗試購買 NFT（未 approve）
    console.log("--- 測試 1: 未 approve 時嘗試購買 ---");
    let reverted = false;
    try {
      await project.write.buyNFT([1n], { account: investor.account });
    } catch (error: any) {
      reverted = true;
      console.log(`  ✓ 購買失敗（如預期）`);
      console.log(`  錯誤訊息: ${error.message}\n`);
    }
    assert.equal(reverted, true, "未 approve 時應該失敗");

    // 檢查合約餘額未變化
    const balanceBefore = await twdt.read.balanceOf([projectAddr]);
    assert.equal(balanceBefore, requiredFunds, "專案餘額應保持不變（只有工廠存入資金）");

    // 現在進行 approve
    console.log("--- 測試 2: 執行 approve ---");
    await twdt.write.approve([projectAddr, u6(1000n)], { account: investor.account });
    
    const allowance = await twdt.read.allowance([investor.account.address, projectAddr]);
    console.log(`  ✓ approve 成功`);
    console.log(`  allowance: ${allowance}\n`);
    assert.equal(allowance, u6(1000n), "allowance 應該是 1000 TWDT");

    // 再次嘗試購買
    console.log("--- 測試 3: approve 後購買 ---");
    await project.write.buyNFT([1n], { account: investor.account });
    
    const minted = await project.read.mintedNFTs();
    const owner = await project.read.ownerOf([1n]);
    const balanceAfter = await twdt.read.balanceOf([projectAddr]);
    
    console.log(`  ✓ 購買成功`);
    console.log(`  mintedNFTs: ${minted}`);
    console.log(`  NFT #1 owner: ${owner}`);
    console.log(`  專案餘額: ${balanceAfter}`);
    
    assert.equal(minted, 1n, "應該有 1 個 NFT 被 mint");
    assert.equal(
      owner.toLowerCase(),
      investor.account.address.toLowerCase(),
      "NFT 擁有者應該是投資人"
    );
    assert.equal(
      balanceAfter,
      requiredFunds + u6(100n),
      "專案餘額應該增加 100 TWDT"
    );

    // 檢查 allowance 減少
    const allowanceAfter = await twdt.read.allowance([investor.account.address, projectAddr]);
    console.log(`  剩餘 allowance: ${allowanceAfter}\n`);
    assert.equal(
      allowanceAfter,
      u6(900n),
      "allowance 應該減少到 900 TWDT"
    );

    console.log("========================================\n");
    console.log("✅ Approval Flow 測試完成!\n");
  });

  it("allowance 不足時購買失敗", async function () {
    const [deployer, investor] = await viem.getWalletClients();

    console.log("\n========================================");
    console.log("🧪 測試場景：allowance 不足");
    console.log("========================================\n");

    const twdt = await viem.deployContract("TWDTToken", [deployer.account.address]);
    await twdt.write.mint([deployer.account.address, u6(10000n)]);
    await twdt.write.mint([investor.account.address, u6(1000n)]);

    const factory = await viem.deployContract("BankFactory", [twdt.address]);

    const requiredFunds = 10n * u6(100n) * 3n;
    await twdt.write.approve([factory.address, requiredFunds]);
    await factory.write.depositFunds([requiredFunds]);

    await factory.write.createProject([
      "Test Project 2",
      "TP2",
      deployer.account.address,
      10n,
      u6(100n),
      u6(1000n),
      u6(200n),
      50n,
      10n,
      5n,
    ]);

    const [projectAddr] = await factory.read.getAllProjects();
    const project = await viem.getContractAt("SafeHarvestNFT", projectAddr);

    // approve 小額度
    await twdt.write.approve([projectAddr, u6(50n)], { account: investor.account });

    // 嘗試購買 2 個 NFT（需要 200 TWDT，但 allowance 只有 50）
    console.log("--- 測試：購買 2 個 NFT（需要 200 TWDT），但 allowance 只有 50 ---");
    let reverted = false;
    try {
      await project.write.buyNFT([2n], { account: investor.account });
    } catch (error: any) {
      reverted = true;
      console.log(`  ✓ 購買失敗（如預期）`);
    }
    assert.equal(reverted, true, "allowance 不足時應該失敗");

    // 檢查沒有 NFT 被 mint
    const minted = await project.read.mintedNFTs();
    assert.equal(minted, 0n, "不應該有 NFT 被 mint");

    console.log("✅ Allowance 不足測試完成!\n");
  });
});

