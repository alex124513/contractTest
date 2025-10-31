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
    // status: 1=正常運作, 2=僅允許提領收益, 3=全面停止
    uint8 public status;
    address public factory;       // 部署本專案的工廠合約位址
    address public farmer;        // 農夫地址（專案擁有者）

    // 投資與收益參數
    uint256 public buildCost;
    uint256 public annualIncome;
    uint256 public investorShare;
    uint256 public interestRate;
    uint256 public premiumRate;

    uint256 public cumulativePrincipal;
    uint256 public remainingPrincipal;
    uint256 public currentYear;
    uint256 public lastComputedBuybackPrice;
    bool public buybackActive;

    mapping(address => uint256) public pendingRewards;

    event NFTPurchased(address indexed buyer, uint256 tokenId, uint256 amount);
    event YearlyReport(uint256 year, uint256 investorIncome);

    constructor(
        address _tokenAddress,  // 💰 TWDT ERC20
        address _owner,         // 平台／專案擁有者
        address _farmer,        // 農夫地址
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
        status = 1; // 默認正常運作
        paymentToken = IERC20(_tokenAddress);
        farmer = _farmer;
        totalNFTs = _totalNFTs;
        nftPrice = _nftPrice;
        buildCost = _buildCost;
        annualIncome = _annualIncome;
        investorShare = _investorShare;
        interestRate = _interestRate;
        premiumRate = _premiumRate;
        remainingPrincipal = _buildCost;
    }

    // 狀態控制：
    // status==1 正常；status==2 僅允許提領收益；status==3 全面停止
    modifier whenOperational() {
        require(status == 1, "Not operational");
        _;
    }

    modifier whenClaimable() {
        require(status == 1 || status == 2, "Claim disabled");
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

    // 允許工廠切換合約狀態（1,2,3）
    function setStatus(uint8 newStatus) external onlyFactory {
        require(newStatus >= 1 && newStatus <= 3, "Invalid status");
        require(status != newStatus, "No state change");
        status = newStatus;
    }

    // 💵 投資人購買 NFT（若合約被鎖定，則無法購買）
    function buyNFT(uint256 amount) external whenOperational {
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
    function SafeHarvestCalculator() public onlyOwner whenOperational whenSoldOut {
        currentYear += 1;
        uint256 investorIncome = (annualIncome * investorShare) / 100;

        cumulativePrincipal += investorIncome;
        if (cumulativePrincipal > buildCost) {
            cumulativePrincipal = buildCost;
        }

        remainingPrincipal = buildCost - cumulativePrincipal;
        lastComputedBuybackPrice = (buildCost * (100 + premiumRate)) / 100;
        uint256 rewardPerNFT = investorIncome / totalNFTs;

        for (uint256 i = 1; i <= totalNFTs; i++) {
            address ownerAddr = ownerOf(i);
            pendingRewards[ownerAddr] += rewardPerNFT;
        }

        emit YearlyReport(currentYear, investorIncome);
    }

    function getFarmerBuyBackPrice() external view returns (uint256) {
        return lastComputedBuybackPrice;
    }

    // 📊 查詢專案完整資料
    function getProjectData() external view returns (
        // 基本資訊
        uint8 currentStatus,
        address projectOwner,
        address projectFarmer,
        // NFT 資訊
        uint256 nftTotalSupply,
        uint256 nftMintedCount,
        uint256 nftPricePerUnit,
        // 金融參數
        uint256 projectBuildCost,
        uint256 projectAnnualIncome,
        uint256 projectInvestorShare,
        uint256 projectInterestRate,
        uint256 projectPremiumRate,
        // 收益狀態
        uint256 projectCurrentYear,
        uint256 projectCumulativePrincipal,
        uint256 projectRemainingPrincipal,
        uint256 projectBuybackPrice,
        bool projectBuybackActive,
        // 合約資訊
        address projectPaymentToken,
        address projectFactory
    ) {
        return (
            status,
            owner(),
            farmer,
            totalNFTs,
            mintedNFTs,
            nftPrice,
            buildCost,
            annualIncome,
            investorShare,
            interestRate,
            premiumRate,
            currentYear,
            cumulativePrincipal,
            remainingPrincipal,
            lastComputedBuybackPrice,
            buybackActive,
            address(paymentToken),
            factory
        );
    }

    // 農夫一次性買回所有 NFT 權益：
    // 1) 由 farmer 轉入 buybackPrice 的 TWDT 到合約
    // 2) 將每個 NFT 的買回收益加入 pendingRewards
    // 3) 將狀態切換到 2（僅允許提領）
    function FarmerBuyBackAll() external whenSoldOut {
        require(msg.sender == farmer, "Only farmer");
        require(status == 1, "Invalid status");
        require(lastComputedBuybackPrice > 0, "Buyback not computed");

        // 收入買回資金
        require(
            paymentToken.transferFrom(msg.sender, address(this), lastComputedBuybackPrice),
            "Buyback fund transfer failed"
        );

        uint256 perNft = lastComputedBuybackPrice / totalNFTs;
        for (uint256 i = 1; i <= totalNFTs; i++) {
            address ownerAddr = ownerOf(i);
            pendingRewards[ownerAddr] += perNft;
        }

        buybackActive = true;
        status = 2; // 僅允許提領
    }

    // 💰 投資人領取收益（若合約被鎖定或未賣光，無法領取）
    function claimReward() public whenClaimable whenSoldOut {
        uint256 amount = pendingRewards[msg.sender];
        require(amount > 0, "No rewards");
        pendingRewards[msg.sender] = 0;
        require(paymentToken.transfer(msg.sender, amount), "Transfer failed");

        // 如進入買回流程，領取後將持有的所有 NFT 轉回給農夫地址
        if (buybackActive) {
            uint256 bal = balanceOf(msg.sender);
            for (uint256 idx = 0; idx < bal; idx++) {
                uint256 tokenId = tokenOfOwnerByIndex(msg.sender, 0);
                _transfer(msg.sender, farmer, tokenId);
            }
        }
    }

    // 🏦 平台提領募資款（若合約被鎖定或未賣光，無法提領）
    function withdrawFunds(address to, uint256 amount) external onlyOwner whenOperational whenSoldOut {
        require(paymentToken.transfer(to, amount), "Withdraw failed");
    }

    // 🔄 NFT Reset 功能：清空所有 NFT 並重新開始
    // ⚠️ 危險：admin 可以強制重置，會銷毀所有現有 NFT
    // 用途：測試時可以快速重置，不需要重新部署合約
    function resetNFTs() external onlyOwner {
        // 銷毀所有現有的 NFT 並清空該持有人的待領分紅
        for (uint256 i = 1; i <= totalNFTs; i++) {
            address ownerAddr = ownerOf(i);
            if (ownerAddr != address(0)) {
                _burn(i);
                pendingRewards[ownerAddr] = 0; // 清空該持有人的待領分紅
            }
        }
        
        // 重置相關狀態
        mintedNFTs = 0;
        buybackActive = false;
        cumulativePrincipal = 0;
        remainingPrincipal = buildCost;
        currentYear = 0;
        lastComputedBuybackPrice = 0;
        status = 1; // 重新設為正常運作
    }
}
