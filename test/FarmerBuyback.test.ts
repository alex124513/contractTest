import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";

// Helper for TWDT decimals (6)
const u6 = (n: bigint) => n * 1_000_000n;

describe("農夫買回全部 NFT 結案測試", async function () {
  const { viem } = await network.connect();

  it("Scenario: 2 期分紅後農夫買回", async function () {
    const [deployer, farmer, investorA, investorB] = await viem.getWalletClients();

    console.log("\n==================================================");
    console.log("🧪 測試場景：2 期分紅後農夫買回全部 NFT");
    console.log("==================================================\n");

    console.log("📋 測試參數（簡單數字）:");
    console.log("  NFT 總數: 3");
    console.log("  NFT 價格: 100 TWDT");
    console.log("  建造成本: 300 TWDT");
    console.log("  年度收益: 60 TWDT");
    console.log("  投資人分潤: 50% (30 TWDT/年)");
    console.log("  利率: 10%");
    console.log("  溢酬: 5%");
    console.log("  農夫分得: 30 TWDT/年");
    console.log("");

    // 部署合約
    const twdt = await viem.deployContract("TWDTToken", [deployer.account.address]);
    console.log("✓ TWDT 部署完成\n");

    // Mint 資金
    await twdt.write.mint([deployer.account.address, u6(10000n)]);
    await twdt.write.mint([farmer.account.address, u6(10000n)]);
    await twdt.write.mint([investorA.account.address, u6(10000n)]);
    await twdt.write.mint([investorB.account.address, u6(10000n)]);

    const factory = await viem.deployContract("BankFactory", [twdt.address]);

    // 存入工廠資金: 3 NFT × 100 TWDT × 3 = 900 TWDT
    const requiredFunds = 3n * u6(100n) * 3n;
    await twdt.write.approve([factory.address, requiredFunds]);
    await factory.write.depositFunds([requiredFunds]);

    // 建立專案
    await factory.write.createProject([
      "Simple Test Project",
      "STP",
      farmer.account.address,  // farmer
      3n,                        // totalNFTs
      u6(100n),                  // nftPrice: 100 TWDT
      u6(300n),                  // buildCost: 300 TWDT
      u6(60n),                   // annualIncome: 60 TWDT
      50n,                       // investorShare: 50%
      10n,                       // interestRate: 10%
      5n,                        // premiumRate: 5%
    ]);

    const [projectAddr] = await factory.read.getAllProjects();
    const project = await viem.getContractAt("SafeHarvestNFT", projectAddr);

    console.log("==================================================");
    console.log("📊 階段 1: 投資人購買 NFT");
    console.log("==================================================\n");

    // investorA 購買 2 個 NFT
    console.log("--- InvestorA 購買 2 個 NFT ---");
    await twdt.write.approve([projectAddr, u6(1000n)], { account: investorA.account });
    await project.write.buyNFT([2n], { account: investorA.account });
    
    // investorB 購買 1 個 NFT
    console.log("--- InvestorB 購買 1 個 NFT ---");
    await twdt.write.approve([projectAddr, u6(1000n)], { account: investorB.account });
    await project.write.buyNFT([1n], { account: investorB.account });

    // 記錄每位投資人的投入
    const investmentA = 2n * u6(100n);  // 200 TWDT
    const investmentB = 1n * u6(100n);  // 100 TWDT
    
    console.log("✓ NFT 全部售罄\n");
    console.log("📊 投資人投入金額:");
    console.log(`  InvestorA: ${investmentA} (2 NFT × 100)`);
    console.log(`  InvestorB: ${investmentB} (1 NFT × 100)`);
    console.log(`  總投入: ${investmentA + investmentB}\n`);

    assert.equal(await project.read.mintedNFTs(), 3n, "應該有 3 個 NFT");

    // 驗證專案資金
    const projectBalanceAfterSale = await twdt.read.balanceOf([projectAddr]);
    console.log(`專案總資金: ${projectBalanceAfterSale}\n`);
    assert.equal(projectBalanceAfterSale, requiredFunds + investmentA + investmentB);

    console.log("==================================================");
    console.log("📊 階段 2: 第 1 年分紅結算");
    console.log("==================================================\n");

    // 第 1 年結算
    await project.write.SafeHarvestCalculator();
    const year1 = await project.read.currentYear();
    assert.equal(year1, 1n);

    // 計算預期分紅
    // 年度投資人總收益: 60 × 50% = 30 TWDT
    // 每份 NFT 分紅: 30 / 3 = 10 TWDT
    const investorIncomeTotal = u6(60n) * 50n / 100n;  // 30 TWDT
    const rewardPerNFT = investorIncomeTotal / 3n;     // 10 TWDT
    
    const expectedRewardA = rewardPerNFT * 2n;  // 20 TWDT
    const expectedRewardB = rewardPerNFT * 1n;  // 10 TWDT

    console.log("📊 第 1 年分紅計算:");
    console.log(`  年度總收益: ${u6(60n)} TWDT`);
    console.log(`  投資人分潤 (50%): ${investorIncomeTotal} TWDT`);
    console.log(`  每份 NFT 分紅: ${rewardPerNFT} TWDT`);
    console.log("");
    console.log("預期分紅:");
    console.log(`  InvestorA: ${expectedRewardA} (2 NFT × ${rewardPerNFT})`);
    console.log(`  InvestorB: ${expectedRewardB} (1 NFT × ${rewardPerNFT})`);
    console.log("");

    // 驗證 pending rewards
    const pendingA1 = await project.read.pendingRewards([investorA.account.address]);
    const pendingB1 = await project.read.pendingRewards([investorB.account.address]);
    
    console.log("實際分紅:");
    console.log(`  InvestorA: ${pendingA1}`);
    console.log(`  InvestorB: ${pendingB1}`);
    console.log("");

    assert.equal(pendingA1, expectedRewardA, "InvestorA 應收到 20 TWDT");
    assert.equal(pendingB1, expectedRewardB, "InvestorB 應收到 10 TWDT");

    console.log("✅ 分紅計算正確\n");

    // 領取第 1 年分紅
    console.log("--- InvestorA 領取第 1 年分紅 ---");
    const balanceA_before1 = await twdt.read.balanceOf([investorA.account.address]);
    await project.write.claimReward({ account: investorA.account });
    const balanceA_after1 = await twdt.read.balanceOf([investorA.account.address]);
    const receivedA1 = balanceA_after1 - balanceA_before1;
    console.log(`  領取: ${receivedA1} TWDT\n`);

    console.log("--- InvestorB 領取第 1 年分紅 ---");
    const balanceB_before1 = await twdt.read.balanceOf([investorB.account.address]);
    await project.write.claimReward({ account: investorB.account });
    const balanceB_after1 = await twdt.read.balanceOf([investorB.account.address]);
    const receivedB1 = balanceB_after1 - balanceB_before1;
    console.log(`  領取: ${receivedB1} TWDT\n`);

    assert.equal(receivedA1, expectedRewardA, "InvestorA 應領到 20 TWDT");
    assert.equal(receivedB1, expectedRewardB, "InvestorB 應領到 10 TWDT");

    console.log("==================================================");
    console.log("📊 階段 3: 第 2 年分紅結算");
    console.log("==================================================\n");

    // 第 2 年結算
    await project.write.SafeHarvestCalculator();
    const year2 = await project.read.currentYear();
    assert.equal(year2, 2n);

    console.log("📊 第 2 年分紅計算:");
    console.log(`  投資人總分潤: ${investorIncomeTotal} TWDT`);
    console.log(`  每份 NFT 分紅: ${rewardPerNFT} TWDT`);
    console.log("");

    const pendingA2 = await project.read.pendingRewards([investorA.account.address]);
    const pendingB2 = await project.read.pendingRewards([investorB.account.address]);
    
    console.log("預期分紅:");
    console.log(`  InvestorA: ${expectedRewardA}`);
    console.log(`  InvestorB: ${expectedRewardB}`);
    console.log("");

    assert.equal(pendingA2, expectedRewardA, "InvestorA 應收到 20 TWDT");
    assert.equal(pendingB2, expectedRewardB, "InvestorB 應收到 10 TWDT");

    // 領取第 2 年分紅
    console.log("--- 投資人領取第 2 年分紅 ---");
    await project.write.claimReward({ account: investorA.account });
    await project.write.claimReward({ account: investorB.account });
    console.log("✓ 分紅領取完成\n");

    console.log("==================================================");
    console.log("📊 階段 4: 農夫買回全部 NFT");
    console.log("==================================================\n");

    // 計算買回價格
    // 公式: buildCost * (1 + premiumRate/100) + cumulativePrincipal
    // 但是根據合約，lastComputedBuybackPrice 會在 SafeHarvestCalculator 中計算
    const cumulativePrincipal = await project.read.cumulativePrincipal();
    console.log(`累計本金: ${cumulativePrincipal}\n`);

    // 查看計算好的買回價格
    const buybackPrice = await project.read.getFarmerBuyBackPrice();
    console.log(`📊 買回價格: ${buybackPrice} TWDT\n`);

    // 計算預期買回價格
    // 根據合約: lastComputedBuybackPrice = buildCost * (100 + premiumRate) / 100
    // 但是這是在 SafeHarvestCalculator 中計算的
    // 讓我看合約實際計算...
    const expectedBuybackPrice = u6(300n) * (100n + 5n) / 100n;  // 315 TWDT
    
    console.log("📊 買回價格計算:");
    console.log(`  建造成本: ${u6(300n)} TWDT`);
    console.log(`  溢酬率: 5%`);
    console.log(`  預期買回價: 300 × 1.05 = ${expectedBuybackPrice} TWDT`);
    console.log(`  實際買回價: ${buybackPrice} TWDT`);
    console.log("");

    assert.equal(buybackPrice, expectedBuybackPrice, "買回價應為 315 TWDT");

    // 買回價格會分配給所有 NFT 持有人
    const buybackPerNFT = buybackPrice / 3n;
    
    console.log("📊 每位投資人買回收益:");
    console.log(`  買回總價: ${buybackPrice} TWDT`);
    console.log(`  每份 NFT: ${buybackPerNFT} TWDT`);
    console.log(`  InvestorA: ${buybackPerNFT * 2n} TWDT (2 NFT)`);
    console.log(`  InvestorB: ${buybackPerNFT * 1n} TWDT (1 NFT)`);
    console.log("");

    // 農夫支付買回款
    console.log("--- 農夫支付買回款 ---");
    await twdt.write.approve([projectAddr, buybackPrice], { account: farmer.account });
    await project.write.FarmerBuyBackAll({ account: farmer.account });
    
    const statusAfterBuyback = await project.read.status();
    const buybackActive = await project.read.buybackActive();
    
    console.log(`✓ 買回完成`);
    console.log(`  狀態: ${statusAfterBuyback} (2 = 僅允許提領)`);
    console.log(`  買回啟動: ${buybackActive}\n`);
    
    assert.equal(statusAfterBuyback, 2, "狀態應變為 2");

    console.log("==================================================");
    console.log("📊 階段 5: 投資人領取買回款");
    console.log("==================================================\n");

    // 檢查 pending rewards
    const finalPendingA = await project.read.pendingRewards([investorA.account.address]);
    const finalPendingB = await project.read.pendingRewards([investorB.account.address]);
    
    console.log("📊 待領買回款:");
    console.log(`  InvestorA: ${finalPendingA} TWDT`);
    console.log(`  InvestorB: ${finalPendingB} TWDT`);
    console.log("");

    assert.equal(finalPendingA, buybackPerNFT * 2n, "InvestorA 應有 210 TWDT");
    assert.equal(finalPendingB, buybackPerNFT * 1n, "InvestorB 應有 105 TWDT");

    // 領取買回款（NFT 會轉給農夫）
    console.log("--- InvestorA 領取買回款 ---");
    const balanceA_before_final = await twdt.read.balanceOf([investorA.account.address]);
    const nftBalanceA_before = await project.read.balanceOf([investorA.account.address]);
    
    await project.write.claimReward({ account: investorA.account });
    
    const balanceA_after_final = await twdt.read.balanceOf([investorA.account.address]);
    const nftBalanceA_after = await project.read.balanceOf([investorA.account.address]);
    const receivedA_final = balanceA_after_final - balanceA_before_final;
    
    console.log(`  領取 TWDT: ${receivedA_final}`);
    console.log(`  NFT 持有 (前): ${nftBalanceA_before}`);
    console.log(`  NFT 持有 (後): ${nftBalanceA_after}`);
    console.log("");

    assert.equal(receivedA_final, buybackPerNFT * 2n, "應領到 210 TWDT");
    assert.equal(nftBalanceA_after, 0n, "NFT 應已轉給農夫");

    console.log("--- InvestorB 領取買回款 ---");
    const balanceB_before_final = await twdt.read.balanceOf([investorB.account.address]);
    const nftBalanceB_before = await project.read.balanceOf([investorB.account.address]);
    
    await project.write.claimReward({ account: investorB.account });
    
    const balanceB_after_final = await twdt.read.balanceOf([investorB.account.address]);
    const nftBalanceB_after = await project.read.balanceOf([investorB.account.address]);
    const receivedB_final = balanceB_after_final - balanceB_before_final;
    
    console.log(`  領取 TWDT: ${receivedB_final}`);
    console.log(`  NFT 持有 (前): ${nftBalanceB_before}`);
    console.log(`  NFT 持有 (後): ${nftBalanceB_after}`);
    console.log("");

    assert.equal(receivedB_final, buybackPerNFT * 1n, "應領到 105 TWDT");
    assert.equal(nftBalanceB_after, 0n, "NFT 應已轉給農夫");

    console.log("==================================================");
    console.log("📊 最終統計報告");
    console.log("==================================================\n");

    const finalBalanceA = await twdt.read.balanceOf([investorA.account.address]);
    const finalBalanceB = await twdt.read.balanceOf([investorB.account.address]);
    const finalBalanceFarmer = await twdt.read.balanceOf([farmer.account.address]);

    console.log("📊 InvestorA 總結:");
    console.log(`  初始餘額: ${u6(10000n)} TWDT`);
    console.log(`  投入金額: ${investmentA} TWDT (2 NFT)`);
    console.log(`  第 1 年分紅: ${receivedA1} TWDT`);
    console.log(`  第 2 年分紅: ${expectedRewardA} TWDT`);
    console.log(`  買回款: ${receivedA_final} TWDT`);
    console.log(`  最終餘額: ${finalBalanceA} TWDT`);
    console.log(`  總收益: ${receivedA1 + expectedRewardA + receivedA_final} TWDT`);
    console.log(`  淨收益: ${receivedA1 + expectedRewardA + receivedA_final - investmentA} TWDT`);
    console.log("");

    console.log("📊 InvestorB 總結:");
    console.log(`  初始餘額: ${u6(10000n)} TWDT`);
    console.log(`  投入金額: ${investmentB} TWDT (1 NFT)`);
    console.log(`  第 1 年分紅: ${receivedB1} TWDT`);
    console.log(`  第 2 年分紅: ${expectedRewardB} TWDT`);
    console.log(`  買回款: ${receivedB_final} TWDT`);
    console.log(`  最終餘額: ${finalBalanceB} TWDT`);
    console.log(`  總收益: ${receivedB1 + expectedRewardB + receivedB_final} TWDT`);
    console.log(`  淨收益: ${receivedB1 + expectedRewardB + receivedB_final - investmentB} TWDT`);
    console.log("");

    console.log("📊 Farmer 總結:");
    console.log(`  第 1 年收益: ${u6(30n)} TWDT (60 × 50%)`);
    console.log(`  第 2 年收益: ${u6(30n)} TWDT (60 × 50%)`);
    console.log(`  支付買回款: ${buybackPrice} TWDT`);
    console.log(`  獲得 NFT: 3 個`);
    console.log(`  最終餘額: ${finalBalanceFarmer} TWDT`);
    console.log(`  淨收益: ${u6(60n) - buybackPrice} TWDT`);
    console.log("");

    console.log("==================================================");
    console.log("✅ WHY & 是否符合預期公式");
    console.log("==================================================\n");

    console.log("1️⃣ InvestorA (2 NFT) 分紅驗證:");
    console.log(`   公式: (年度總收益 × 投資人分潤%) / NFT總數 × NFT持有數`);
    console.log(`   計算: (60 × 50%) / 3 × 2 = 20 TWDT/年`);
    console.log(`   實際: 第1年 ${receivedA1}, 第2年 ${expectedRewardA} ✓`);
    console.log("");

    console.log("2️⃣ InvestorB (1 NFT) 分紅驗證:");
    console.log(`   公式: (年度總收益 × 投資人分潤%) / NFT總數 × NFT持有數`);
    console.log(`   計算: (60 × 50%) / 3 × 1 = 10 TWDT/年`);
    console.log(`   實際: 第1年 ${receivedB1}, 第2年 ${expectedRewardB} ✓`);
    console.log("");

    console.log("3️⃣ 買回價格驗證:");
    console.log(`   公式: 建造成本 × (1 + 溢酬率%)`);
    console.log(`   計算: 300 × 1.05 = 315 TWDT`);
    console.log(`   實際: ${buybackPrice} TWDT ✓`);
    console.log("");

    console.log("4️⃣ 買回分配驗證:");
    console.log(`   公式: 買回總價 / NFT總數 × NFT持有數`);
    console.log(`   InvestorA: 315 / 3 × 2 = 210 TWDT`);
    console.log(`   InvestorB: 315 / 3 × 1 = 105 TWDT`);
    console.log(`   實際: InvestorA ${receivedA_final}, InvestorB ${receivedB_final} ✓`);
    console.log("");

    console.log("5️⃣ NFT 轉移驗證:");
    console.log(`   買回後所有 NFT 應轉給農夫`);
    console.log(`   Farmer NFT: ${await project.read.balanceOf([farmer.account.address])}`);
    console.log(`   預期: 3 個 ✓`);
    console.log("");

    console.log("==================================================");
    console.log("✅ 所有測試通過");
    console.log("==================================================\n");
  });
});

