# getProjectData() 使用說明

## 📊 函數說明

`getProjectData()` 是一個 **view 函數**，可以在不消耗 gas 的情況下返回專案的所有關鍵資料。

## 🔧 函數簽名

```solidity
function getProjectData() external view returns (
    uint8 currentStatus,
    address projectOwner,
    address projectFarmer,
    uint256 nftTotalSupply,
    uint256 nftMintedCount,
    uint256 nftPricePerUnit,
    uint256 projectBuildCost,
    uint256 projectAnnualIncome,
    uint256 projectInvestorShare,
    uint256 projectInterestRate,
    uint256 projectPremiumRate,
    uint256 projectCurrentYear,
    uint256 projectCumulativePrincipal,
    uint256 projectRemainingPrincipal,
    uint256 projectBuybackPrice,
    bool projectBuybackActive,
    address projectPaymentToken,
    address projectFactory
)
```

## 📋 返回值說明

| 索引 | 變數名 | 說明 | 範例值 |
|-----|--------|------|--------|
| 0 | `currentStatus` | 當前狀態 | 1=正常, 2=僅提領, 3=全面停止 |
| 1 | `projectOwner` | 專案擁有者 | 0x... |
| 2 | `projectFarmer` | 農夫地址 | 0x... |
| 3 | `nftTotalSupply` | NFT 總量 | 100 |
| 4 | `nftMintedCount` | 已發行數量 | 85 |
| 5 | `nftPricePerUnit` | 每份 NFT 價格 | 100000000 (100 TWDT) |
| 6 | `projectBuildCost` | 建造成本 | 1000000000 (1000 TWDT) |
| 7 | `projectAnnualIncome` | 年度收益 | 200000000 (200 TWDT) |
| 8 | `projectInvestorShare` | 投資人分潤% | 50 |
| 9 | `projectInterestRate` | 利率% | 10 |
| 10 | `projectPremiumRate` | 溢酬% | 5 |
| 11 | `projectCurrentYear` | 當前年度 | 1 |
| 12 | `projectCumulativePrincipal` | 累計本金 | 100000000 (100 TWDT) |
| 13 | `projectRemainingPrincipal` | 剩餘本金 | 900000000 (900 TWDT) |
| 14 | `projectBuybackPrice` | 買回價格 | 1050000000 (1050 TWDT) |
| 15 | `projectBuybackActive` | 買回啟動 | true/false |
| 16 | `projectPaymentToken` | 支付代幣地址 | 0x... |
| 17 | `projectFactory` | 工廠合約地址 | 0x... |

## 💻 前端使用範例

### JavaScript/TypeScript (ethers.js)

```javascript
const project = await ethers.getContractAt("SafeHarvestNFT", projectAddress);
const data = await project.getProjectData();

console.log("狀態:", data.currentStatus);
console.log("NFT 總數:", data.nftTotalSupply.toString());
console.log("已售:", data.nftMintedCount.toString());
console.log("價格:", data.nftPricePerUnit.toString());
console.log("建造成本:", data.projectBuildCost.toString());
console.log("年度收益:", data.projectAnnualIncome.toString());
```

### Viem

```typescript
const project = await viem.getContractAt("SafeHarvestNFT", projectAddress);
const data = await project.read.getProjectData();

console.log("狀態:", data[0]);
console.log("NFT 總數:", data[3].toString());
console.log("已售:", data[4].toString());
```

## 🎯 應用場景

1. **專案詳情頁**: 一鍵顯示所有資訊
2. **儀表板**: 匯總多個專案資料
3. **狀態監控**: 即時查看專案健康度
4. **投資決策**: 快速比較不同專案
5. **測試除錯**: 驗證合約狀態

## ⚡ Gas 消耗

- **費用**: 免費（view 函數）
- **速度**: 即時返回
- **網路**: 不需要發送交易

## 🔍 測試範例

測試輸出：
```
📊 getProjectData 結果:
  狀態: 2, 擁有者: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266, 農夫: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8
  NFT 總數: 10, 已售: 0, 價格: 1000
```

## ✅ 優勢

1. **一次查詢**: 代替 18+ 個單獨查詢
2. **節省 RPC 請求**: 降低網路負載
3. **原子性**: 資料一致
4. **易於使用**: 前端友善

**狀態**: ✅ 已實作並通過測試

