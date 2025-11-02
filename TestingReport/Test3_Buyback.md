### 黑客松 Demo 測試報告 - Test3（農夫買回與 NFT 回收）

- **場景目的**: 展示售罄後由平台結算產生買回價，農夫一次性買回，投資人領取後 NFT 自動轉回農夫。

### 故事情境（高中生版）
想像這個農場營運一段時間後，農夫手上現金夠了，想把大家分散的權益買回，等於把專案「收尾」。平台先依規則算出一個買回價格（包含一點額外的補貼，像是感謝投資人的支持）。農夫把錢打到專案裡，系統就會幫每位投資人把應得的金額準備好。

投資人只要按一下「領取」，錢就到自己錢包，同時手上的 NFT 會自動還給農夫（因為專案已經回收完畢）。整個體驗就像公司把股票全數買回，投資人拿到錢、股份也回到公司。

### 角色與執行端
- **後端/admin（平台）**: 執行年度結算產生買回價
- **後端/farmer（農夫）**: approve 買回金額並執行 `FarmerBuyBackAll()`
- **前端/user1（投資人）**: 買滿全部 NFT、最終 `claimReward()`（觸發 NFT 回收）

### 參數（來自測試程式）
- **totalNFTs**: 3
- **nftPrice**: 100 TWDT（6位小數）
- **buildCost**: 1000 TWDT
- **annualIncome**: 600 TWDT
- **investorShare**: 50%
- **premiumRate**: 5%
- **requiredFunds（工廠）**: 3 × 100 × 3 = 900 TWDT

### 步驟與函數 I/O
1) 後端：admin 建立專案；前端 user1 買滿 3 份 → 售罄
   - `buyNFT(3)` → `mintedNFTs = 3`

2) 後端：admin 年度結算，產生買回參數
   - `SafeHarvestCalculator()`
   - 分紅：`investorIncome = 600 × 50% = 300`、`rewardPerNFT = 300 / 3 = 100 TWDT`
   - `getFarmerBuyBackPrice()` = `buildCost × (100 + premiumRate) / 100` = `1000 × 105% = 1050 TWDT`

3) 後端：farmer 買回
   - `approve(project, 1050)` → `FarmerBuyBackAll()`
   - 效果：`buybackActive = true`、`status = 2（僅提領）`
   - 同時每份 NFT 增加買回收益：`1050 / 3 = 350 TWDT/份`

4) 前端：user1 領取
   - user1 在此案例持有 3 份 → 最終 `pendingRewards[user1] = (100 + 350) × 3 = 1350 TWDT`
   - `claimReward()` 後：user1 餘額 +1350 TWDT，且 NFT 自動全數轉回 farmer（user1 NFT 餘額 = 0）

### 驗證點與期望結果
- `getFarmerBuyBackPrice()` > 0 且計算符合 `buildCost × (1 + premiumRate)`
- 執行 `FarmerBuyBackAll()` 後狀態轉為 2，並標記 `buybackActive = true`
- 投資人 `claimReward()`：可領「年度分紅 + 買回金」合計，且 NFT 自動轉回 farmer

### 前端介面建議
- 當 `buybackActive = true` 時，顯示「買回領取」提示，強調領取後 NFT 將回收
- 提供明細：年度分紅 + 買回金（可分行顯示）


