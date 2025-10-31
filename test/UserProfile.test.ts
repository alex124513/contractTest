import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";

// Helper for 6-decimals
const u6 = (n: bigint) => n * 1_000_000n;

describe("SafeHarvestNFT.getUserProfile", async function () {
  const { viem } = await network.connect();

  it("should return count, unclaimed rewards and tokenIds", async function () {
    const [deployer, farmer, investor, other] = await viem.getWalletClients();

    // Deploy TWDT and mint balances
    const twdt = await viem.deployContract("TWDTToken", [deployer.account.address]);
    await twdt.write.mint([investor.account.address, u6(1_000_000n)]);
    await twdt.write.mint([other.account.address, u6(1_000_000n)]);

    // Parameters
    const totalNFTs = 5n;
    const nftPrice = u6(1000n);
    const buildCost = u6(10_000n);
    const annualIncome = u6(6_000n);
    const investorShare = 50n; // 50%
    const interestRate = 0n;
    const premiumRate = 10n;

    // Deploy SafeHarvestNFT directly
    const nft = await viem.deployContract("SafeHarvestNFT", [
      twdt.address,
      deployer.account.address,
      farmer.account.address,
      "SafeHarvest",
      "SHN",
      totalNFTs,
      nftPrice,
      buildCost,
      annualIncome,
      investorShare,
      interestRate,
      premiumRate,
    ]);

    // Investor buys 2 NFTs
    await twdt.write.approve([nft.address, nftPrice * 2n], { account: investor.account });
    await nft.write.buyNFT([2n], { account: investor.account });

    // Other buys the rest to sold-out
    await twdt.write.approve([nft.address, nftPrice * (totalNFTs - 2n)], { account: other.account });
    await nft.write.buyNFT([totalNFTs - 2n], { account: other.account });

    // Run yearly calculator
    await nft.write.SafeHarvestCalculator();

    const investorIncome = (annualIncome * investorShare) / 100n; // 6000 * 50% = 3000
    const rewardPerNFT = investorIncome / totalNFTs; // 3000/5 = 600

    const [count, unclaimed, tokenIds] = await nft.read.getUserProfile([investor.account.address]);

    assert.equal(count, 2n);
    assert.equal(unclaimed, rewardPerNFT * 2n);
    assert.equal(Number(tokenIds.length), 2);

    for (const id of tokenIds) {
      const owner = await nft.read.ownerOf([id]);
      assert.equal(owner.toLowerCase(), investor.account.address.toLowerCase());
    }
  });
});


