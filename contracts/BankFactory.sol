// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./SafeHarvestNFT.sol";

contract BankFactory {
    address public owner;
    address public paymentToken; // TWDT 合約地址
    address[] public allProjects;

    event ProjectCreated(address indexed projectAddress, address indexed creator);

    constructor(address _paymentToken) {
        owner = msg.sender;
        paymentToken = _paymentToken;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not authorized");
        _;
    }

    // 建立一個新的 SafeHarvest 專案
    function createProject(
        string memory name_,
        string memory symbol_,
        uint256 totalNFTs,
        uint256 nftPrice,
        uint256 buildCost,
        uint256 annualIncome,
        uint256 investorShare,
        uint256 interestRate,
        uint256 premiumRate
    ) external onlyOwner returns (address) {
        SafeHarvestNFT newProject = new SafeHarvestNFT(
            paymentToken,   // TWDT 合約
            owner,          // 專案 Owner（平台方）
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

        allProjects.push(address(newProject));
        emit ProjectCreated(address(newProject), msg.sender);
        return address(newProject);
    }

    // 取得所有專案清單
    function getAllProjects() external view returns (address[] memory) {
        return allProjects;
    }

    // 鎖定/解除鎖定專案（僅限工廠 Owner；目前僅支援鎖定成 false）
    function setProjectActive(address project, bool isActive) external onlyOwner {
        SafeHarvestNFT(project).setActive(isActive);
    }
}
