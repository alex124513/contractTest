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

  it("factory creates a SafeHarvest project and toggles active state", async function () {
    const [deployer] = await viem.getWalletClients();
    const twdt = await viem.deployContract("TWDTToken", [deployer.account.address]);
    const factory = await viem.deployContract("BankFactory", [twdt.address]);

    // create a project
    await factory.write.createProject([
      "SafeHarvest A",
      "SHA",
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
    const active = await project.read.active();
    assert.equal(total, 10n);
    assert.equal(active, true);

    // toggle active to false via factory
    await factory.write.setProjectActive([projectAddr, false]);
    const activeAfter = await project.read.active();
    assert.equal(activeAfter, false);
  });
});
