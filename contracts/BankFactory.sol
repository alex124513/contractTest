// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./SafeHarvestNFT.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract BankFactory {
    address public owner;
    address public paymentToken; // TWDT 合約地址
    address[] public allProjects;

    event ProjectCreated(address indexed projectAddress, address indexed creator);
    event FactoryFundsReceived(address indexed from, uint256 amount);

    constructor(address _paymentToken) {
        owner = msg.sender;
        paymentToken = _paymentToken;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not authorized");
        _;
    }

    // 💰 存入資金到工廠（由 owner 執行）
    function depositFunds(uint256 amount) external {
        IERC20 token = IERC20(paymentToken);
        require(
            token.transferFrom(msg.sender, address(this), amount),
            "Transfer failed"
        );
        emit FactoryFundsReceived(msg.sender, amount);
    }

    // 📊 查詢工廠餘額
    function getFactoryBalance() external view returns (uint256) {
        return IERC20(paymentToken).balanceOf(address(this));
    }

    // 建立一個新的 SafeHarvest 專案
    function createProject(
        string memory name_,
        string memory symbol_,
        address farmer_,
        uint256 totalNFTs,
        uint256 nftPrice,
        uint256 buildCost,
        uint256 annualIncome,
        uint256 investorShare,
        uint256 interestRate,
        uint256 premiumRate
    ) external onlyOwner returns (address) {
        // 💰 計算所需資金：NFT 全部賣光的金額 × 3
        uint256 requiredFunds = (totalNFTs * nftPrice) * 3;
        
        // 檢查工廠餘額是否足夠
        uint256 factoryBalance = IERC20(paymentToken).balanceOf(address(this));
        require(
            factoryBalance >= requiredFunds,
            "Insufficient factory funds"
        );

        // 部署新專案
        SafeHarvestNFT newProject = new SafeHarvestNFT(
            paymentToken,   // TWDT 合約
            owner,          // 專案 Owner（平台方）
            farmer_,        // 農夫地址
            name_,
            symbol_,
            totalNFTs,
            nftPrice,
            buildCost,
            annualIncome,
            investorShare,
            interestRate,
            premiumRate
        );

        // 轉賬 M 金額到專案合約
        IERC20 token = IERC20(paymentToken);
        require(
            token.transfer(address(newProject), requiredFunds),
            "Transfer to project failed"
        );

        allProjects.push(address(newProject));
        emit ProjectCreated(address(newProject), msg.sender);
        return address(newProject);
    }

    // 取得所有專案清單
    function getAllProjects() external view returns (address[] memory) {
        return allProjects;
    }

    // 設定專案狀態（1=正常,2=僅提領,3=全面停止）
    function setProjectStatus(address project, uint8 newStatus) external onlyOwner {
        SafeHarvestNFT(project).setStatus(newStatus);
    }
}
