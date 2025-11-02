### 黑客松 Demo 測試報告 - Test2（狀態控制：鎖定/解鎖/僅提領）

- **場景目的**: 驗證平台可用狀態碼控制前端行為：3=全面停止（禁止買入/結算/提領）、1=正常運作、2=僅允許提領。

### 故事情境（高中生版）
想像專案像一間正在營業的店。平日正常營業（狀態1），大家可以買東西、結帳、拿回找零。有時店要整修或遇到突發狀況，店長會把門先關起來（狀態3），這時候不能進去買、也不會結帳。等到修好再開門，恢復正常。

還有一種情況是「只出不進」（狀態2）：不再賣新東西，也不再結帳計算新的分紅，但之前結算好的錢還是可以來領。這個測試就是告訴前端：不同狀態時，畫面上的按鈕會被關閉或打開，避免用戶做錯事。

### 角色與執行端
- **後端/admin（平台）**: setProjectStatus(1/2/3)、執行結算
- **後端/farmer（農夫）**: 僅身份參與
- **前端/user1（投資人）**: approve、buyNFT、claimReward（受狀態影響）

### 參數（來自測試程式）
- **totalNFTs**: 1
- **nftPrice**: 100 TWDT（6位小數）
- **buildCost**: 100 TWDT
- **annualIncome**: 100 TWDT
- **investorShare**: 100%
- **interestRate**: 10
- **premiumRate**: 5
- **requiredFunds**: 1 × 100 × 3 = 300 TWDT

### 步驟與函數 I/O
1) 後端：admin 建立專案並售出 1 份
   - `depositFunds(300)` → `createProject(...)`
   - 前端 user1：`approve` → `buyNFT(1)` → `mintedNFTs = 1`

2) 後端：admin 鎖定專案（3）
   - `setProjectStatus(project, 3)`
   - 前端 user1 嘗試 `claimReward()` → 失敗（whenClaimable/whenSoldOut/狀態檢查）

3) 後端：admin 解鎖（1）並執行年度結算
   - `setProjectStatus(project, 1)` → `SafeHarvestCalculator()`
   - 分紅：`investorIncome = 100 × 100% = 100`、`rewardPerNFT = 100 / 1 = 100 TWDT`

4) 後端：admin 設為僅提領（2）
   - `setProjectStatus(project, 2)`
   - 前端 user1 `claimReward()` → user1 餘額 +100 TWDT、`pendingRewards[user1] = 0`

### 驗證點與期望結果
- 狀態=3：買入/結算/提領均應被阻擋
- 狀態=1：恢復正常後，可結算產生分紅
- 狀態=2：不可買入/結算，但允許提領既有分紅

### 前端介面建議
- 依狀態碼動態關閉/開啟按鈕：1=全部開啟、2=只開 Claim、3=全部關閉
- 顯示狀態提示文字，避免用戶誤操作


