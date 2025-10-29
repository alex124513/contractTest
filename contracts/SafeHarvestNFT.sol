// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract SafeHarvestNFT is ERC721Enumerable, Ownable {
    IERC20 public paymentToken;   // 💰 TWDT token address
    uint256 public nftPrice;      // 每份 NFT 價格 (TWDT 單位)
    uint256 public totalNFTs;     // NFT 總數
    uint256 public mintedNFTs;    // 已發行數量

    // 合約控制
    bool public active;           // 是否啟用（被鎖時為 false）
    address public factory;       // 部署本專案的工廠合約位址

    // 投資與收益參數
    uint256 public buildCost;
    uint256 public annualIncome;
    uint256 public investorShare;
    uint256 public interestRate;
    uint256 public premiumRate;

    uint256 public cumulativePrincipal;
    uint256 public remainingPrincipal;
    uint256 public currentYear;

    mapping(address => uint256) public pendingRewards;

    event NFTPurchased(address indexed buyer, uint256 tokenId, uint256 amount);
    event YearlyReport(uint256 year, uint256 investorIncome);

    constructor(
        address _tokenAddress,  // 💰 TWDT ERC20
        address _owner,         // 平台／專案擁有者
        string memory name_,
        string memory symbol_,
        uint256 _totalNFTs,
        uint256 _nftPrice,
        uint256 _buildCost,
        uint256 _annualIncome,
        uint256 _investorShare,
        uint256 _interestRate,
        uint256 _premiumRate
    ) ERC721(name_, symbol_) Ownable(_owner) {
        factory = msg.sender;
        active = true;
        paymentToken = IERC20(_tokenAddress);
        totalNFTs = _totalNFTs;
        nftPrice = _nftPrice;
        buildCost = _buildCost;
        annualIncome = _annualIncome;
        investorShare = _investorShare;
        interestRate = _interestRate;
        premiumRate = _premiumRate;
        remainingPrincipal = _buildCost;
    }

    // 鎖定控制：當 active == false 時，所有標記了 whenActive 的對外功能會直接 revert
    // 受影響功能：buyNFT、claimReward、withdrawFunds、SafeHarvestCalculator 等
    modifier whenActive() {
        require(active, "Inactive");
        _;
    }

    modifier onlyFactory() {
        require(msg.sender == factory, "Not factory");
        _;
    }

    modifier whenSoldOut() {
        require(mintedNFTs == totalNFTs, "Sale not completed");
        _;
    }

    // 允許工廠切換合約啟用/鎖定狀態
    function setActive(bool isActive) external onlyFactory {
        require(active != isActive, "No state change");
        active = isActive;
    }

    // 💵 投資人購買 NFT（若合約被鎖定，則無法購買）
    function buyNFT(uint256 amount) external whenActive {
        require(mintedNFTs + amount <= totalNFTs, "Exceeds supply");
        uint256 totalCost = nftPrice * amount;

        // 從投資人收取 TWDT
        require(paymentToken.transferFrom(msg.sender, address(this), totalCost), "Payment failed");

        // Mint NFT 給投資人
        for (uint256 i = 0; i < amount; i++) {
            mintedNFTs += 1;
            _mint(msg.sender, mintedNFTs);
            emit NFTPurchased(msg.sender, mintedNFTs, nftPrice);
        }
    }

    // 📈 年度收益計算（由 owner 觸發；鎖定或未賣光時不可執行）
    function SafeHarvestCalculator() public onlyOwner whenActive whenSoldOut {
        currentYear += 1;
        uint256 investorIncome = (annualIncome * investorShare) / 100;

        cumulativePrincipal += investorIncome;
        if (cumulativePrincipal > buildCost) {
            cumulativePrincipal = buildCost;
        }

        remainingPrincipal = buildCost - cumulativePrincipal;
        uint256 remainingWithInterest = (remainingPrincipal * (100 + interestRate)) / 100;
        uint256 buybackPrice = (buildCost * (100 + premiumRate)) / 100;
        uint256 totalBuybackIncome = cumulativePrincipal + investorIncome + buybackPrice;
        uint256 rewardPerNFT = investorIncome / totalNFTs;

        for (uint256 i = 1; i <= totalNFTs; i++) {
            address ownerAddr = ownerOf(i);
            pendingRewards[ownerAddr] += rewardPerNFT;
        }

        emit YearlyReport(currentYear, investorIncome);
    }

    // 💰 投資人領取收益（若合約被鎖定或未賣光，無法領取）
    function claimReward() public whenActive whenSoldOut {
        uint256 amount = pendingRewards[msg.sender];
        require(amount > 0, "No rewards");
        pendingRewards[msg.sender] = 0;
        require(paymentToken.transfer(msg.sender, amount), "Transfer failed");
    }

    // 🏦 平台提領募資款（若合約被鎖定或未賣光，無法提領）
    function withdrawFunds(address to, uint256 amount) external onlyOwner whenActive whenSoldOut {
        require(paymentToken.transfer(to, amount), "Withdraw failed");
    }
}
