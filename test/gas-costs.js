const { expect } = require("chai");
const { ethers } = require("hardhat");
const { MerkleTree } = require("merkletreejs");
const keccak256 = require("keccak256");

const maxSupply = 4999;
const maxMintPerAddress = 2;
const teamReservedMint = 50;
const auctionInterval = 20;

const main = (contractName) => {
  describe("Meta Empires", function () {
    it("Deploy and use functions", async () => {
      it("Contract deploy", async function () {
        [deployer] = await ethers.getSigners();

        MetaEmpires = await ethers.getContractFactory(contractName);
        metaEmpires = await MetaEmpires.deploy(
          maxSupply,
          maxMintPerAddress,
          teamReservedMint,
          auctionInterval
        );
        const tx = await metaEmpires.setBaseURI(
          "ipfs://34895345093475jfef98n4q39'848r9mqy4/"
        );
        await tx.wait();
        const whitelistAddresses = [
          await deployer[0].getAddress(),
          await deployer[1].getAddress(),
          await deployer[2].getAddress(),
          await deployer[3].getAddress(),
        ];
        const leafNodes = whitelistAddresses.map((addr) => keccak256(addr));
        const merkleTree = new MerkleTree(leafNodes, keccak256, {
          sortPairs: true,
        });
        const rootHash = merkleTree.getHexRoot();
        const claimingAddress = leafNodes[1];
        const hexProof = merkleTree.getHexProof(claimingAddress);
        const preSaleStartTime = await getTimeStamp();
        await metaEmpires.setPreSale(
          1000000000,
          preSaleStartTime,
          30000,
          rootHash
        );
        await metaEmpires.connect(deployer[1]).preSaleMintToken(2, hexProof, {
          value: 2000000000,
        });
        await metaEmpires.setSale(100000000, timestamp, 300000, 5, 3000);
        await metaEmpires
          .connect(deployer[1])
          .saleMintToken(2, { value: 1000000000 });
        await metaEmpires.stakeNFT(1);
        await metaEmpires.unStakeNFT(1);
        await metaEmpires.transferFrom(
          deployer[0].getAddress(),
          deployer[1].getAddress(),
          1
        );
        await metaEmpires.withdraw();
      });
    });
  });
};

const getTimeStamp = async () => {
  const blockNumBefore = await ethers.provider.getBlockNumber();
  const blockBefore = await ethers.provider.getBlock(blockNumBefore);
  const timestampBefore = blockBefore.timestamp;
  return timestampBefore;
};

main("MetaEmpires");
