require("dotenv").config();

require("@nomiclabs/hardhat-etherscan");
require("@nomiclabs/hardhat-waffle");
require("hardhat-gas-reporter");
require("solidity-coverage");

task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

const { PRIVATE_KEY, WEB3_INFURA_PROJECT_ID, ETHERSCAN_TOKEN } = process.env;

module.exports = {
  solidity: "0.8.11",
  settings: {
    optimizer: {
      enabled: true,
      runs: 1000,
    },
  },
  networks: {
    rinkeby: {
      url: `https://rinkeby.infura.io/v3/${WEB3_INFURA_PROJECT_ID}`,
      accounts: [`${PRIVATE_KEY}`],
    },
    ropsten: {
      url: `https://ropsten.infura.sio/v3/${WEB3_INFURA_PROJECT_ID}`,
      accounts: [`${PRIVATE_KEY}`],
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
  },
  etherscan: {
    apiKey: ETHERSCAN_TOKEN,
  },
  mocha: {
    timeout: 40000,
  },
};
