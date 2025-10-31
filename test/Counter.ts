import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { network } from "hardhat";

describe("TWDT / BankFactory / SafeHarvestNFT (ganache)", async function () {
  const { viem } = await network.connect();

  it("deploys TWDTToken and mints to an account", async function () {
    const [deployer, investor] = await viem.getWalletClients();
    const twdt = await viem.deployContract("TWDTToken", [deployer.account.address]);

    // mint 1_000_000 units (considering decimals inside the contract logic)
    await twdt.write.mint([investor.account.address, 1_000_000n]);
    const bal = await twdt.read.balanceOf([investor.account.address]);
    assert.equal(bal, 1_000_000n);
  });

  it("factory creates a SafeHarvest project and toggles status", async function () {
    const [deployer, farmer] = await viem.getWalletClients();
    const twdt = await viem.deployContract("TWDTToken", [deployer.account.address]);
    const factory = await viem.deployContract("BankFactory", [twdt.address]);

    // 💰 計算所需資金：10 NFT × 1000 價格 × 3 = 30,000 TWDT
    const requiredFunds = 10n * 1_000n * 3n;
    
    // Mint 資金給 deployer
    await twdt.write.mint([deployer.account.address, requiredFunds]);
    
    // Approve factory 使用資金
    await twdt.write.approve([factory.address, requiredFunds]);
    
    // 存入資金到工廠
    await factory.write.depositFunds([requiredFunds]);
    
    const factoryBalance = await factory.read.getFactoryBalance();
    assert.equal(factoryBalance, requiredFunds, "工廠餘額應等於所需資金");

    // create a project
    await factory.write.createProject([
      "SafeHarvest A",
      "SHA",
      farmer.account.address,  // farmer address
      10n,       // totalNFTs
      1_000n,    // nftPrice
      10_000n,   // buildCost
      2_000n,    // annualIncome
      50n,       // investorShare (%)
      10n,       // interestRate (%)
      5n,        // premiumRate (%)
    ]);

    const projects = await factory.read.getAllProjects();
    assert.equal(projects.length, 1);
    const projectAddr = projects[0];

    const project = await viem.getContractAt("SafeHarvestNFT", projectAddr);
    const total = await project.read.totalNFTs();
    const status = await project.read.status();
    assert.equal(total, 10n);
    assert.equal(status, 1); // 1 = normal operation

    // ✅ 驗證資金已轉入專案合約
    const projectBalance = await twdt.read.balanceOf([projectAddr]);
    assert.equal(projectBalance, requiredFunds, "專案應收到所需資金");
    
    // ✅ 驗證工廠餘額已清空
    const factoryBalanceAfter = await factory.read.getFactoryBalance();
    assert.equal(factoryBalanceAfter, 0n, "工廠餘額應為零");

    // set status to 2 via factory
    await factory.write.setProjectStatus([projectAddr, 2]);
    const statusAfter = await project.read.status();
    assert.equal(statusAfter, 2);

    // test getProjectData
    const projectData = await project.read.getProjectData();
    console.log('\n📊 getProjectData 結果:');
    console.log(`  狀態: ${projectData[0]}, 擁有者: ${projectData[1]}, 農夫: ${projectData[2]}`);
    console.log(`  NFT 總數: ${projectData[3]}, 已售: ${projectData[4]}, 價格: ${projectData[5]}`);
    assert.equal(projectData[0], 2); // 狀態為 2
    assert.equal(projectData[1].toLowerCase(), deployer.account.address.toLowerCase()); // owner
    assert.equal(projectData[2].toLowerCase(), farmer.account.address.toLowerCase()); // farmer
    assert.equal(projectData[3], 10n); // totalNFTs
  });
});
