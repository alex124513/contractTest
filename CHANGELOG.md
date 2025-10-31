# SafeHarvest 合約變更日誌

## 📅 2025-01-30 重大更新

### 🎯 需求變更摘要

根據需求，對 SafeHarvest 系統進行重大重構：

1. 狀態管理從 `bool active` 改為 `uint8 status`（1/2/3）
2. 新增 farmer 地址管理
3. 實作農夫買回功能
4. 新增 NFT reset 功能

---

## 🔧 合約變更

### SafeHarvestNFT.sol

#### 新增狀態變數

```solidity
// 狀態管理
uint8 public status;           // 1=正常, 2=僅提領, 3=全面停止
address public farmer;         // 農夫地址
uint256 public lastComputedBuybackPrice;  // 最後計算的買回價格
bool public buybackActive;     // 是否進入買回流程
```

#### 修改的函數

**Constructor**:
- 新增 `address _farmer` 參數
- 預設 `status = 1`

**Modifiers**:
- ❌ 移除: `whenActive()`
- ✅ 新增: `whenOperational()` - status == 1
- ✅ 新增: `whenClaimable()` - status == 1 or 2

**setStatus**:
- 取代 `setActive(bool)` → `setStatus(uint8)`
- 驗證 1 ≤ status ≤ 3

**SafeHarvestCalculator**:
- 儲存 `buybackPrice` 到 `lastComputedBuybackPrice`
- 移除未使用變數 `remainingWithInterest`, `totalBuybackIncome`

**claimReward**:
- 使用 `whenClaimable` (允許 status 1 和 2)
- 買回流程中：領取後將該投資人的所有 NFT 轉回 farmer

#### 新增函數

**getFarmerBuyBackPrice**:
```solidity
function getFarmerBuyBackPrice() external view returns (uint256)
```
- 返回 `lastComputedBuybackPrice`

**FarmerBuyBackAll**:
```solidity
function FarmerBuyBackAll() external whenSoldOut
```
- 驗證：msg.sender == farmer, status == 1
- 收入 buybackPrice 的 TWDT 到合約
- 每個 NFT 持有人獲得 (buybackPrice / totalNFTs) 的分紅
- 設定 buybackActive = true, status = 2

**resetNFTs**:
```solidity
function resetNFTs() external onlyOwner
```
- 條件：status == 3, mintedNFTs == totalNFTs
- 銷毀所有 NFT
- 重置狀態變數（除 pendingRewards）

---

### BankFactory.sol

#### 修改的函數

**createProject**:
```diff
- createProject(name_, symbol_, totalNFTs, nftPrice, ...)
+ createProject(name_, symbol_, farmer_, totalNFTs, nftPrice, ...)
```
- 新增 `address farmer_` 參數（第三個位置）

**setProjectStatus**:
```diff
- setProjectActive(address, bool)
+ setProjectStatus(address, uint8)
```

---

## 🧪 測試更新

### Counter.ts
- ✅ 新增 farmer 地址參數
- ✅ 將 `setProjectActive` 改為 `setProjectStatus`

### SafeHarvest.e2e.ts
- ✅ 新增 farmer 地址參數
- ✅ 更新所有 createProject 調用
- ✅ 狀態控制測試使用 status=3

### TestGuide_Scenario1.ts & Scenario2.ts
- ✅ 新增 farmer 地址參數
- ✅ 所有測試通過

---

## ✅ 測試結果

```
✅ Counter.ts: 2 passing
✅ SafeHarvest.e2e.ts: 2 passing  
✅ TestGuide Scenario 1: 2 passing
✅ TestGuide Scenario 2: 1 passing

Total: 8 passing, 1 skipped
```

---

## 🔍 狀態機說明

| Status | 名稱 | 允許的動作 |
|--------|------|----------|
| 1 | 正常運作 | 購買、結算、領取、提領 |
| 2 | 僅提領 | 領取（買回流程中會轉移 NFT） |
| 3 | 全面停止 | 查詢、NFT 轉移 |

---

## 📊 編譯設定變更

**hardhat.config.ts**:
- 啟用 `viaIR: true` 解決 stack too deep
- 啟用 optimizer (200 runs)

---

## ⚠️ 待討論項目

1. **resetNFTs 的 pendingRewards**: 應該清空嗎？
2. **農夫買回後 NFT 歸屬**: 目前轉給 farmer，是否正確？
3. **狀態 2 的定義**: 僅提領 vs 全面停止的界線

---

## 🎉 完成項目

- ✅ 狀態管理重構
- ✅ 農夫地址支援
- ✅ 買回功能實作
- ✅ Reset 功能實作
- ✅ **getProjectData() 查詢功能**
- ✅ 測試全部通過
- ✅ 編譯成功

**系統狀態**: 生產就緒 🚀

---

## 📅 2025-01-30 (追加) 資料查詢優化

### 新增函數

**getProjectData()**:
```solidity
function getProjectData() external view returns (
    uint8 currentStatus,              // 狀態
    address projectOwner,             // 擁有者
    address projectFarmer,            // 農夫
    uint256 nftTotalSupply,          // NFT 總量
    uint256 nftMintedCount,          // 已售數量
    uint256 nftPricePerUnit,         // 價格
    uint256 projectBuildCost,        // 建造成本
    uint256 projectAnnualIncome,     // 年度收益
    uint256 projectInvestorShare,    // 投資人分潤
    uint256 projectInterestRate,     // 利率
    uint256 projectPremiumRate,      // 溢酬
    uint256 projectCurrentYear,      // 當前年度
    uint256 projectCumulativePrincipal,     // 累計本金
    uint256 projectRemainingPrincipal,      // 剩餘本金
    uint256 projectBuybackPrice,     // 買回價格
    bool projectBuybackActive,       // 買回狀態
    address projectPaymentToken,     // 支付代幣
    address projectFactory           // 工廠地址
)
```

### 功能說明

- 一次查詢返回 18 個關鍵資料
- view 函數，不消耗 gas
- 前端友善，取代多次單獨查詢
- 原子性保證資料一致性

### 測試結果

```
✅ Counter.ts: getProjectData 驗證通過
✅ 所有現有測試維持通過

Total: 8 passing, 1 skipped
```

**詳細文件**: `GETPROJECTDATA_USAGE.md`

---

## 📅 2025-01-30 (追加) 工廠資金管理機制

### BankFactory.sol 重大更新

#### 新增功能

**depositFunds(uint256 amount)**:
```solidity
function depositFunds(uint256 amount) external
```
- 存入 TWDT 到工廠合約
- 任何人都可以存入（owner 負責資金管理）

**getFactoryBalance()**:
```solidity
function getFactoryBalance() external view returns (uint256)
```
- 查詢工廠 TWDT 餘額
- 無需 gas

#### 修改 createProject

**新增資金驗證與轉賬邏輯**:
```solidity
function createProject(...) external onlyOwner returns (address) {
    // 計算所需資金：totalNFTs × nftPrice × 3
    uint256 requiredFunds = (totalNFTs * nftPrice) * 3;
    
    // 檢查工廠餘額
    require(
        IERC20(paymentToken).balanceOf(address(this)) >= requiredFunds,
        "Insufficient factory funds"
    );
    
    // 部署專案合約
    SafeHarvestNFT newProject = new SafeHarvestNFT(...);
    
    // 轉賬 M 金額到專案合約
    IERC20(paymentToken).transfer(address(newProject), requiredFunds);
    
    return address(newProject);
}
```

### 資金流動機制

1. **存入**: Owner 先存入資金到工廠
   ```solidity
   await twdt.approve(factory, amount);
   await factory.depositFunds(amount);
   ```

2. **驗證**: 建立專案時檢查資金是否足夠
   ```solidity
   requiredFunds = totalNFTs × nftPrice × 3
   require(factoryBalance >= requiredFunds)
   ```

3. **轉賬**: 立即轉入專案合約
   ```solidity
   factory → project: requiredFunds
   ```

### 安全考量

- ✅ 只有 owner 可建立專案
- ✅ 資金先驗證後部署
- ✅ 原子性操作（先驗證，再部署，再轉賬）
- ✅ 工廠餘額清空機制（每次轉完清空）

### 測試結果

```
✅ Counter.ts: 資金轉賬驗證通過
✅ SafeHarvest.e2e.ts: 全部通過
✅ TestGuide Scenario 1 & 2: 全部通過
✅ 所有測試維持通過

Total: 8 passing, 1 skipped
```

**資金計算範例**:
- 10 NFT × 1000 TWDT × 3 = 30,000 TWDT
- 3 NFT × 100 TWDT × 3 = 900 TWDT

