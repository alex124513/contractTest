### 黑客松 Demo 測試報告 - Test1（建立→銷售→結算→領取）

- **場景目的**: 完整展示平台後端建立專案、投資人前端購買、平台年度結算、投資人領取分紅的 happy path。此為黑客松錄影主流程。

### 故事情境（高中生版）
想像有個農場想蓋溫室，需要一筆錢先把設備準備好。銀行平台負責開一個「專案」，先準備好啟動資金，讓專案能順利開始。一般人（像你我）可以在手機上買「份額」（一份就是一張 NFT，代表你投了多少）。

在這個故事裡，user1 用手機先授權專案可以扣款，然後買了 2 份；為了讓示範快點到「結算分紅」這一步，我們讓平台把剩下的份額也買完（等於專案賣光）。年尾農場有收入，平台用規則計算出投資人能分到的錢。user1 只要按一下「領取」，錢就會從專案轉到他錢包裡，整個流程就像現實中的群眾募資分紅一樣簡單明白。

### 角色與執行端
- **後端/admin（平台）**: 部署與鑄幣、存入工廠資金、建立專案、補買NFT促成售罄、執行年度結算
- **後端/farmer（農夫）**: 僅作為專案參數的農夫身份持有人（本測不需主動操作）
- **前端/user1（投資人）**: approve、buyNFT、claimReward
- **前端/user2（投資人）**: 僅測試用，無操作

### 參數（來自測試程式）
- **totalNFTs**: 5
- **nftPrice**: 100 TWDT（6位小數）
- **buildCost**: 1000 TWDT
- **annualIncome**: 600 TWDT
- **investorShare**: 50%
- **interestRate**: 10（未在本流程使用）
- **premiumRate**: 5（未在本流程使用）
- **工廠啟動資金 requiredFunds**: totalNFTs × price × 3 = 5 × 100 × 3 = 1500 TWDT

### 步驟與函數 I/O
1) 後端：admin 鑄幣與存入工廠
   - `TWDTToken.mint(admin, 1,000,000)` → admin 餘額增加
   - `BankFactory.depositFunds(requiredFunds=1500)`（需先 `approve(factory, 1500)`）
   - 目的：確保工廠有足夠 M 金額啟動專案

2) 後端：admin 建立專案
   - `BankFactory.createProject(name="Hackathon Demo", symbol="HDEMO", farmer, totalNFTs=5, nftPrice=100, buildCost=1000, annualIncome=600, investorShare=50, interestRate=10, premiumRate=5)`
   - 輸出：`projectAddress`
   - 效果：工廠把 1500 TWDT 轉入專案合約

3) 前端：user1 購買 2 份 NFT
   - `TWDTToken.approve(project, 100000)`（給足額度）
   - `SafeHarvestNFT.buyNFT(2)` → `mintedNFTs = 2`

4) 後端：admin 補買 3 份 NFT（達成售罄）
   - `approve(project, ...)` → `SafeHarvestNFT.buyNFT(3)` → `mintedNFTs = 5`

5) 後端：admin 年度結算
   - `SafeHarvestNFT.SafeHarvestCalculator()`
   - 分紅計算：`investorIncome = annualIncome × investorShare% = 600 × 50% = 300`
   - `rewardPerNFT = investorIncome / totalNFTs = 300 / 5 = 60 TWDT`

6) 前端：user1 領取分紅
   - 事前 `pendingRewards[user1] = 60 × 2 = 120 TWDT`
   - `SafeHarvestNFT.claimReward()` → user1 餘額 +120 TWDT、`pendingRewards[user1] = 0`

### 驗證點與期望結果
- 建立專案後，工廠資金已轉入專案（工廠餘額不應再保留此筆）
- 售罄後才能執行 `SafeHarvestCalculator()`
- user1 領取後 `pendingRewards[user1] = 0` 且實得 120 TWDT

### 前端介面建議
- 顯示專案基本資料（價格、總量、已售、年化收益、分潤%）
- 按鈕：Approve → Buy → Claim（Claim 顯示可領金額）
- 情境提示：售罄後平台會進行年度結算，才會產生可領分紅


