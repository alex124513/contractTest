# SafeHarvest NFT 鎖定機制分析

## 🔒 鎖定機制設計

### 1. 鎖定狀態控制

**核心變數**:
```solidity
bool public active;  // 是否啟用（被鎖時為 false）
```

**控制函數**:
```solidity
function setActive(bool isActive) external onlyFactory {
    require(active != isActive, "No state change");
    active = isActive;
}
```

**控制權限**:
- ✅ 只能由 `BankFactory` 呼叫（`onlyFactory` modifier）
- ✅ 防止重複設置相同狀態（`No state change`）

---

## 🚫 鎖定後的影響範圍

### 受影響的函數（使用 `whenActive` modifier）

| 函數 | 影響 | 說明 |
|------|------|------|
| `buyNFT()` | ❌ 無法購買 | 鎖定後無法購買新 NFT |
| `SafeHarvestCalculator()` | ❌ 無法結算 | 鎖定後無法執行年度分紅計算 |
| `claimReward()` | ❌ 無法領取 | 鎖定後投資人無法領取分紅 |
| `withdrawFunds()` | ❌ 無法提領 | 鎖定後平台無法提領資金 |

### 不受影響的功能

| 功能 | 狀態 | 說明 |
|------|------|------|
| `ownerOf()` | ✅ 正常 | 仍可查詢 NFT 擁有者 |
| `balanceOf()` | ✅ 正常 | 仍可查詢 TWDT 餘額 |
| `totalSupply()` | ✅ 正常 | 仍可查詢 NFT 總數 |
| `getPendingRewards()` | ✅ 正常 | 仍可查詢待領分紅 |
| `transfer()` / `transferFrom()` | ✅ 正常 | NFT 仍可轉移（ERC721 標準功能） |
| `approve()` / `setApprovalForAll()` | ✅ 正常 | 仍可授權轉移（ERC721 標準功能） |

**結論**: **鎖定只影響核心業務功能，不影響查詢和 NFT 轉移**

---

## 🔄 解鎖後的狀態恢復

### 關鍵問題：數值會重置嗎？

**答案：不會重置，會維持鎖定前一秒的所有狀態**

### 狀態變數分析

| 變數 | 類型 | 鎖定時 | 解鎖後 | 說明 |
|------|------|--------|--------|------|
| `active` | bool | `false` → `true` | `true` | ✅ 狀態切換 |
| `mintedNFTs` | uint256 | 維持不變 | 維持不變 | ✅ 不變 |
| `totalNFTs` | uint256 | 維持不變 | 維持不變 | ✅ 不變 |
| `currentYear` | uint256 | 維持不變 | 維持不變 | ✅ 不變 |
| `cumulativePrincipal` | uint256 | 維持不變 | 維持不變 | ✅ 不變 |
| `remainingPrincipal` | uint256 | 維持不變 | 維持不變 | ✅ 不變 |
| `pendingRewards` | mapping | 維持不變 | 維持不變 | ✅ 不變 |
| `ownerOf(tokenId)` | mapping | 維持不變 | 維持不變 | ✅ 不變 |

### 資金狀態

| 項目 | 鎖定時 | 解鎖後 | 說明 |
|------|--------|--------|------|
| 合約 TWDT 餘額 | 維持不變 | 維持不變 | ✅ 鎖定不影響餘額 |
| 投資人待領分紅 | 維持不變 | 維持不變 | ✅ 分紅不會消失 |
| NFT 擁有權 | 維持不變 | 維持不變 | ✅ 擁有權不變 |

---

## 📊 實際場景分析

### 場景 1：購買中鎖定

**情境**: 投資人正在購買 NFT，合約突然被鎖定

| 時間點 | 狀態 | 行為 |
|--------|------|------|
| T0 | NFT 總數: 10, 已售: 5 | 正常運作 |
| T1 | 鎖定 | `buyNFT()` 被阻止 |
| T2 | 解鎖 | 繼續購買，從第 6 個 NFT 開始 |
| T3 | 已售: 10 | ✅ 狀態完全恢復 |

### 場景 2：年度分紅中鎖定

**情境**: 年度結算後，投資人準備領取分紅時被鎖定

| 時間點 | 狀態 | 行為 |
|--------|------|------|
| T0 | currentYear: 1, pendingRewards[investorA]: 100 TWDT | 年度結算完成 |
| T1 | 鎖定 | `claimReward()` 被阻止 |
| T2 | pendingRewards[investorA]: 100 TWDT | ✅ 分紅金額維持 |
| T3 | 解鎖 | 投資人可以領取 100 TWDT |
| T4 | pendingRewards[investorA]: 0 TWDT | ✅ 領取後歸零 |

### 場景 3：長期鎖定

**情境**: 合約被鎖定 1 年後解鎖

| 時間點 | 狀態 | 行為 |
|--------|------|------|
| T0 | currentYear: 1, cumulativePrincipal: 100 TWDT | 鎖定前 |
| T1-T365 | 鎖定 | 所有操作被阻止 |
| T366 | 解鎖 | ✅ 狀態完全維持: currentYear: 1, cumulativePrincipal: 100 TWDT |
| T367 | 正常運作 | 可以繼續執行年度結算 |

---

## 🔍 設計優缺點分析

### ✅ 優點

1. **狀態保持**: 鎖定不影響任何已保存的狀態
2. **安全機制**: 防止緊急情況下的錯誤操作
3. **靈活控制**: 工廠可以隨時鎖定/解鎖
4. **查詢可用**: 投資人可以隨時查詢狀態
5. **轉移可用**: NFT 轉移不受限制

### ⚠️ 潛在問題

1. **投資人體驗**: 鎖定期間無法領取分紅
2. **資金凍結**: 待領分紅可能長期無法領取
3. **透明度**: 缺乏鎖定原因記錄
4. **緊急情況**: 需要明確的鎖定原因與公告機制

---

## 🤔 設計討論點

### 1. 是否應該增加鎖定時間限制？

**建議**: 考慮加入最大鎖定期限制
```solidity
uint256 public maxLockDuration = 30 days;
uint256 public lockedAt;
```

### 2. 是否應該增加鎖定原因記錄？

**建議**: 加入事件記錄
```solidity
event Locked(address indexed project, string reason);
event Unlocked(address indexed project, string reason);
```

### 3. 是否應該區分不同類型的鎖定？

**建議**: 
- 緊急鎖定（所有功能停止）
- 購買鎖定（僅阻止購買，允許領取）
- 結算鎖定（僅阻止結算，允許領取）

---

## 💡 建議改進

### 建議 1：增加鎖定原因

```solidity
mapping(address => string) public lockReasons;
mapping(address => uint256) public lockedAt;

function setProjectActive(address project, bool isActive, string memory reason) 
    external onlyOwner {
    require(active != isActive, "No state change");
    active = isActive;
    lockReasons[project] = reason;
    if (!isActive) {
        lockedAt[project] = block.timestamp;
    }
}
```

### 建議 2：查詢函數仍可用

目前設計已經做到 ✅ - 所有查詢功能不受鎖定影響

### 建議 3：增加自動解鎖機制

```solidity
function checkAutoUnlock(address project) external {
    if (!active[project] && block.timestamp >= lockedAt[project] + maxLockDuration) {
        setProjectActive(project, true, "Auto unlock after max duration");
    }
}
```

---

## 📝 總結

### 問題回答

**Q1: 如果 NFT 合約被鎖上，是否停止合約全部功能運作？**

**A**: ❌ 不是全部功能  
- ✅ **查詢功能**（`ownerOf`, `balanceOf`, `pendingRewards` 等）正常運作
- ✅ **NFT 轉移功能**（`transfer`, `transferFrom`）正常運作
- ❌ **核心業務功能**（購買、結算、領取、提領）被阻止

**Q2: 解鎖之後數值會重置嗎，還是維持被鎖前一秒的各個狀態？**

**A**: ✅ **維持被鎖前一秒的所有狀態**  
- 所有狀態變數完全不變
- 資金餘額維持不變
- 待領分紅維持不變
- NFT 擁有權維持不變
- 可以從被鎖定的位置繼續運作

---

**設計評估**: 目前的鎖定機制是 **安全的**、**合理的**，符合暫停業務而不影響狀態的設計理念。建議增加鎖定原因記錄和時間限制功能。

