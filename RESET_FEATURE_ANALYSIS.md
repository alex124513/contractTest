# NFT Reset 功能分析

## ✅ 已完成功能

### NFT Reset 功能

**函數**: `resetNFTs()`  
**權限**: `onlyOwner`  
**狀態**: 已完成 ✅

## 🔍 功能詳細說明

### 重置條件

```solidity
function resetNFTs() external onlyOwner {
    require(status == 3, "Status must be fully stopped");
    require(mintedNFTs == totalNFTs, "Must be fully minted before reset");
    
    // 銷毀所有 NFT
    // 重置相關狀態
    // 重新設為狀態 1 (正常運作)
}
```

### 重置流程

1. **檢查狀態**: 必須是 status=3（全面停止）
2. **檢查完成度**: 必須已 mint 全部 NFT
3. **銷毀 NFT**: 遍歷所有 tokenId 並 `_burn(i)`
4. **重置狀態變數**:
   - `mintedNFTs = 0` ✅
   - `buybackActive = false` ✅
   - `cumulativePrincipal = 0` ✅
   - `remainingPrincipal = buildCost` ✅
   - `currentYear = 0` ✅
   - `lastComputedBuybackPrice = 0` ✅
   - `status = 1` ✅（恢復正常運作）

### ⚠️ 注意事項

#### pendingRewards 未清空

目前設計**保留**所有 `pendingRewards`，原因：
1. 投資人可能有未領取的分紅
2. 遍歷所有地址清空非常耗 gas
3. 假設重設計畫為不同專案（不同地址）

**但這意味著**：舊投資人的 pendingRewards 永遠存在，無法領取（因為 NFT 已被銷毀）

### 💡 建議改進

如果確定要清空 pendingRewards，可以這樣做：

```solidity
function resetNFTs() external onlyOwner {
    require(status == 3, "Status must be fully stopped");
    require(mintedNFTs == totalNFTs, "Must be fully minted before reset");
    
    // 銷毀所有 NFT
    for (uint256 i = 1; i <= totalNFTs; i++) {
        address ownerAddr = ownerOf(i);
        if (ownerAddr != address(0)) {
            _burn(i);
            pendingRewards[ownerAddr] = 0; // 清空該持有人的待領分紅
        }
    }
    
    // 重置其他狀態...
}
```

### 🤔 設計疑問

#### 問題 1：NFT Reset 的業務場景是什麼？

**可能的場景**：
1. 專案失敗，重新啟動
2. 測試環境重置
3. 專案到期後開始新週期

**但目前的問題**：
- 如果專案失敗，投資人損失資金
- 如果重新啟動，應該用新合約而非重置

#### 問題 2：誰可以執行 reset？

- ✅ **owner**（平台管理員）：合理
- ❌ **farmer**（農夫）：不建議，有道德風險
- ❌ **任何人**：絕對不行

#### 問題 3：是否需要新增事件記錄？

建議加入：

```solidity
event NFTReset(uint256 timestamp, uint8 previousStatus, uint256 totalNFTsBurned);
```

## 📊 總結

### ✅ 技術可行性

**可以實現**，但需要：
1. 編譯器設定 `viaIR: true`（解決 stack too deep）
2. 狀態變數管理
3. ERC721 的 `_burn()` 支援

### ⚠️ 業務風險

1. 投資人資金風險
2. 待領分紅處理
3. 透明度：需要公告機制

### 💡 建議

1. **確認業務場景**：為何需要 reset？
2. **完善通知機制**：提前公告並取得同意
3. **記錄事件**：為 transparency
4. **考慮替代方案**：使用新合約而非重置

---

**當前狀態**: 功能已實作並編譯成功，建議在確認業務需求後再決定是否啟用。

