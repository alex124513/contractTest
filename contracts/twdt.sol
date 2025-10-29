// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title TWDTToken
 * @dev 這是一個標準的 ERC20 代幣合約，代號為 TWDT。
 * 它繼承了 OpenZeppelin 的 ERC20 和 Ownable 合約。
 * - ERC20 提供了代幣的標準功能 (transfer, approve 等)。
 * - Ownable 確保只有合約的部署者 (owner) 才能鑄造新幣。
 */
contract TWDTToken is ERC20, Ownable {

    /**
     * @dev 合約的建構子 (Constructor)。
     * 在部署時會執行一次。
     * 這裡我們設定代幣的名稱和代號。
     * * @param initialOwner 合約部署者的地址，將成為合約的 "owner"。
     */
    constructor(address initialOwner) 
        ERC20("Taiwan Dollar Token", "TWDT")  // <-- 這裡設定代幣全名和代號
        Ownable(initialOwner) 
    {
        // 這裡可以選擇在部署時就鑄造一定數量的代幣給部署者
        // 例如：_mint(initialOwner, 1000000 * 10**decimals());
        // 但我們將使用一個公開的 mint 函數，以便日後發行
    }

    /**
     * @dev 覆寫 (override) OpenZeppelin 的 decimals 函數。
     * ERC20 代幣通常有 18 位小數，但穩定幣 (如 TWDT 暗示的)
     * 常常使用 6 位小數 (類似 USDC/USDT)。
     * 您可以根據需求修改這裡。
     */
    function decimals() public view virtual override returns (uint8) {
        return 6; // <-- 這裡設定小數位數 (6位 或 18位 是最常見的)
    }

    /**
     * @dev 鑄造新幣 (Mint)
     * 只有合約的 owner 才能呼叫此函數。
     *
     * @param to 接收新幣的地址
     * @param amount 鑄造的數量 (注意：請傳入包含小數位的完整數字)
     * 例如：若 decimals 為 6，要鑄造 100 顆 TWDT，amount 應為 100 * 10**6 = 100000000
     */
    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }

    // 您也可以根據 SafeHarvest 的需求增加其他功能，例如：
    // - Pausable (暫停功能)
    // - Burnable (銷毀功能)
    // - ...等等
}