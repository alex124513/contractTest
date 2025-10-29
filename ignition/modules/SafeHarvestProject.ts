import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("SafeHarvestProjectModule", (m) => {
  const owner = m.getAccount(0);

  const twdt = m.contract("TWDTToken", [owner]);
  const factory = m.contract("BankFactory", [twdt]);

  return { twdt, factory };
});


