### 黑客松 Demo 測試報告 - Test4（前端查詢 + 後端提領）

- **場景目的**: 示範前端需使用的查詢 API 及平台提領資金流程，方便 UI 對齊資料顯示。

### 故事情境（高中生版）
把前端想像成一個資訊看板：你打開專案頁面，可以看到專案現在賣了幾份、價格多少、今年到第幾年、你自己有幾張 NFT、還能領多少錢。這些資訊都要靠查詢介面把數據讀回來，前端只需要「顯示得清楚」。

同時，平台方在專案正常、又已經賣完的狀態下，會定期把部分資金轉回公司帳戶（像是提領營運費）。這個測試展示了兩件事：使用者可以看到正確的資料；而平台提領時，只有在條件允許（正常+售罄）才會成功。

### 角色與執行端
- **前端**: `getProjectData1()`、`getProjectData2()`、`getUserProfile(user)`、`getFactoryBalance()`
- **後端/admin**: 售罄後的 `SafeHarvestCalculator()` 與 `withdrawFunds(to, amount)`
- **後端/farmer**: 身份參與，無操作
- **前端/user1**: buyNFT

### 參數（來自測試程式）
- **totalNFTs**: 2
- **nftPrice**: 200 TWDT（6位小數）
- **buildCost**: 2000 TWDT
- **annualIncome**: 1000 TWDT
- **investorShare**: 50%
- **interestRate**: 10
- **premiumRate**: 5
- **requiredFunds**: 2 × 200 × 3 = 1200 TWDT

### 步驟與函數 I/O
1) 後端：admin 建立專案
   - 建立後工廠資金轉入專案 → `getFactoryBalance()` 應為 0

2) 前端：讀基本資料（未售罄）
   - `getProjectData1()` → `mintedNFTs = 0`

3) 前端：user1 購買 2 份（售罄）
   - `approve(project, ...)` → `buyNFT(2)` → `mintedNFTs = 2`

4) 後端：admin 年度結算一次
   - `SafeHarvestCalculator()` → `getProjectData2().currentYear = 1`

5) 前端：讀取用戶快照
   - `getUserProfile(user1)` → `nftCount = 2`、`tokenIds = [...]`、`unclaimedRewards >= 0`

6) 後端：admin 提領資金
   - `withdrawFunds(admin, 100)`（需 status=1 且售罄）→ admin 餘額 +100 TWDT

### 驗證點與期望結果
- 建立後 `getFactoryBalance()` 應為 0（啟動資金已轉專案）
- 售罄且運作中，`withdrawFunds()` 才能成功
- `getProjectData1/2` 與 `getUserProfile` 可提供前端所需展示資料

### 前端介面建議
- 專案頁分成「專案資訊」、「我的資產」兩塊：
  - **專案資訊**：`status`、`totalNFTs`、`mintedNFTs`、`nftPrice`、`buildCost`、`annualIncome`、`investorShare`、`interestRate`、`premiumRate`、`currentYear`、`buybackActive`
  - **我的資產**：NFT 數量、TokenIDs、待領分紅、領取按鈕
- 後台頁面提供提領動作與紀錄


