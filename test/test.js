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
    it("Contract deploy", async function () {
      [deployer] = await ethers.getSigners();

      const metaEmpires = await deployContract(contractName);

      expect(await metaEmpires.MAX_SUPPLY()).to.be.equal(maxSupply);
      expect(await metaEmpires.MAX_MINT_PER_ADDRESS()).to.be.equal(
        maxMintPerAddress
      );
      expect(await metaEmpires.totalSupply()).to.be.equal(teamReservedMint);
      expect(await metaEmpires.AUCTION_INTERVAL()).to.be.equal(auctionInterval);
    });

    describe("Contract Non Admin Methods", function () {
      let metaEmpires, deployer;

      beforeEach(async function () {
        deployer = await ethers.getSigners();
        metaEmpires = await deployContract(contractName);
      });
      describe("Total Supply", function () {
        it("return supply", async function () {
          expect(await metaEmpires.totalSupply()).to.be.equal(teamReservedMint);
        });

        it("return supply + 1 Mint", async function () {
          const timestamp = await getTimeStamp();
          await setSale(metaEmpires, timestamp);

          await timeJump(60);

          await saleMint(metaEmpires, deployer[1], 2);
          expect(await metaEmpires.totalSupply()).to.be.equal(
            teamReservedMint + 2
          );
        });
      });
      describe("Token URI", function () {
        it("return URI", async function () {
          const URI = "ipfs://ciccio/";
          const ID = 1;
          const tx = await metaEmpires.setBaseURI(URI);
          await tx.wait();
          expect(await metaEmpires.tokenURI(ID)).to.be.equal(URI + ID);
        });

        it("fail on non existing token", async function () {
          const URI = "ipfs://ciccio/";
          const ID = (await metaEmpires.totalSupply()) + 1;
          const tx = await metaEmpires.setBaseURI(URI);
          await tx.wait();
          await expect(metaEmpires.tokenURI(ID)).to.be.revertedWith(
            "ERC721Metadata: URI query for nonexistent token"
          );
        });

        it("return URI of new minted token", async function () {
          const URI = "ipfs://ciccio/";
          const ID = parseInt(await metaEmpires.totalSupply()) + 1;
          const timestamp = await getTimeStamp();

          await setSale(metaEmpires, timestamp);

          await timeJump(60);

          await saleMint(metaEmpires, deployer[1], 1);

          const tx = await metaEmpires.setBaseURI(URI);
          await tx.wait();
          expect(await metaEmpires.tokenURI(ID)).to.be.equal(URI + ID);
        });
      });
      describe("walletOfOwner", function () {
        it("return owner reserved mint", async function () {
          let array = [],
            arrayIDs = [];
          for (let i = 0; i < teamReservedMint; i++) {
            array[i] = i + 1;
          }
          const IDs = await metaEmpires.walletOfOwner(deployer[0].getAddress());

          for (let i = 0; i < IDs.length; i++) {
            arrayIDs[i] = IDs[i].toNumber();
          }

          expect(arrayIDs).to.be.deep.equal(array);
        });

        it("return buyer minted NFT", async function () {
          let array = [],
            arrayIDs = [];
          const supplyIndex = parseInt(await metaEmpires.totalSupply());
          for (let i = 0; i < 2; i++) {
            array[i] = supplyIndex + i + 1;
          }
          const timestamp = await getTimeStamp();

          await setSale(metaEmpires, timestamp);
          await timeJump(60);
          await saleMint(metaEmpires, deployer[1], 2);

          const IDs = await metaEmpires.walletOfOwner(deployer[1].getAddress());

          for (let i = 0; i < IDs.length; i++) {
            arrayIDs[i] = IDs[i].toNumber();
          }

          expect(arrayIDs).to.be.deep.equal(array);
        });

        it("return buyer empty wallet", async function () {
          expect(await metaEmpires.walletOfOwner(deployer[2].getAddress())).to
            .be.empty;
        });
      });
      describe("getAuctionPrice", function () {
        it("return the action price", async function () {
          const mintPrice = 100000;
          const saleDuration = 300;
          const auctionPriceMultiplier = 5;
          const timestamp = await getTimeStamp();

          await setSale(
            metaEmpires,
            timestamp,
            mintPrice,
            saleDuration,
            auctionPriceMultiplier
          );
          expect(await metaEmpires.getAuctionPrice()).to.be.equal(
            mintPrice * auctionPriceMultiplier
          );
          await timeJump(saleDuration / 2);
          expect(await metaEmpires.getAuctionPrice()).to.be.equal(
            mintPrice + (mintPrice * (auctionPriceMultiplier - 1)) / 2
          );
          await timeJump(saleDuration / 2);
          expect(await metaEmpires.getAuctionPrice()).to.be.equal(mintPrice);
        });
      });
      describe("preSaleMintToken", function () {
        let rootHash, claimingAddress, hexProof, leafNodes, merkleTree;
        beforeEach(async function () {
          let whitelistAddresses = [
            await deployer[0].getAddress(),
            await deployer[1].getAddress(),
            await deployer[2].getAddress(),
            await deployer[3].getAddress(),
          ];
          leafNodes = whitelistAddresses.map((addr) => keccak256(addr));
          merkleTree = new MerkleTree(leafNodes, keccak256, {
            sortPairs: true,
          });
          rootHash = merkleTree.getHexRoot();
          claimingAddress = leafNodes[1];
          hexProof = merkleTree.getHexProof(claimingAddress);
        });
        it("mint token", async function () {
          const tokenIndex = parseInt(await metaEmpires.totalSupply());
          const timestamp = await getTimeStamp();
          await setPreSale(metaEmpires, timestamp, rootHash);
          await timeJump(60);
          await preSaleMint(metaEmpires, deployer[1], 2, hexProof);
          expect(
            await metaEmpires.balanceOf(deployer[1].getAddress())
          ).to.be.equal(2);
          expect(
            await metaEmpires.nbOfCEsMintedBy(deployer[1].getAddress())
          ).to.be.equal(2);
          expect(await metaEmpires.ownerOf(tokenIndex + 1)).to.be.equal(
            await deployer[1].getAddress()
          );
          expect(await metaEmpires.ownerOf(tokenIndex + 2)).to.be.equal(
            await deployer[1].getAddress()
          );
        });
        it("revert for invalid proof", async function () {
          const timestamp = await getTimeStamp();
          await setPreSale(metaEmpires, timestamp, rootHash);
          await timeJump(60);
          await expect(
            metaEmpires.connect(deployer[2]).preSaleMintToken(2, hexProof, {
              value: 100000000 * 2,
            })
          ).to.be.revertedWith("User not whitelisted");
        });
        it("revert if pre sale not setted", async function () {
          await expect(
            metaEmpires
              .connect(deployer[1])
              .preSaleMintToken(1, hexProof, { value: 1000000 })
          ).to.be.revertedWith("Pre sale not started yet");
        });
        it("revert if pre sale not started", async function () {
          const timestamp = (await getTimeStamp()) + 10;
          const mintPrice = 100000;
          await setPreSale(metaEmpires, timestamp, rootHash, mintPrice);
          await expect(
            metaEmpires
              .connect(deployer[1])
              .preSaleMintToken(1, hexProof, { value: mintPrice })
          ).to.be.revertedWith("Pre sale not started yet");
        });
        it("revert if pre sale ended", async function () {
          const timestamp = await getTimeStamp();
          const preSaleDuration = 10;
          const mintPrice = 100000;
          await setPreSale(
            metaEmpires,
            timestamp,
            rootHash,
            mintPrice,
            preSaleDuration
          );
          await timeJump(10);
          await expect(
            metaEmpires
              .connect(deployer[1])
              .preSaleMintToken(1, hexProof, { value: mintPrice })
          ).to.be.revertedWith("Pre sale already ended");
        });
        it("revert if max supply reached", async function () {
          const maxSupply = 150;
          const maxMintPerAddress = 75;
          const timestamp = await getTimeStamp();
          const mintPrice = 100000;

          deployer = await ethers.getSigners();
          metaEmpires = await deployContract(
            contractName,
            maxSupply,
            maxMintPerAddress
          );
          await setPreSale(metaEmpires, timestamp, rootHash, mintPrice);
          const tx = await metaEmpires
            .connect(deployer[1])
            .preSaleMintToken(30, hexProof, { value: mintPrice * 30 });
          await tx.wait();
          const tx2 = await metaEmpires
            .connect(deployer[1])
            .preSaleMintToken(30, hexProof, { value: mintPrice * 30 });
          await tx2.wait();

          claimingAddressAcc2 = leafNodes[2];
          hexProofAcc2 = merkleTree.getHexProof(claimingAddressAcc2);
          const tx3 = await metaEmpires
            .connect(deployer[2])
            .preSaleMintToken(40, hexProofAcc2, { value: mintPrice * 40 });
          await tx3.wait();
          await expect(
            metaEmpires
              .connect(deployer[2])
              .preSaleMintToken(1, hexProofAcc2, { value: mintPrice })
          ).to.be.revertedWith("Mint quantity exceeds max supply");
        });
        it("revert if account mint quantity reached", async function () {
          const timestamp = await getTimeStamp();
          const mintPrice = 100000;

          await setPreSale(metaEmpires, timestamp, rootHash, mintPrice);
          const tx = await metaEmpires
            .connect(deployer[1])
            .preSaleMintToken(2, hexProof, { value: mintPrice * 2 });
          await tx.wait();
          await expect(
            metaEmpires
              .connect(deployer[1])
              .preSaleMintToken(1, hexProof, { value: mintPrice })
          ).to.be.revertedWith(
            "Mint quantity exceeds allowance for this address"
          );
        });
        it("revert if quantity is 0", async function () {
          const timestamp = await getTimeStamp();
          const mintPrice = 100000;

          await setPreSale(metaEmpires, timestamp, rootHash, mintPrice);
          await expect(
            metaEmpires
              .connect(deployer[1])
              .preSaleMintToken(0, hexProof, { value: mintPrice })
          ).to.be.revertedWith("Need to mint at least 1 NFT");
        });
        it("revert if price is not met", async function () {
          const timestamp = await getTimeStamp();
          const mintPrice = 100000;

          await setPreSale(metaEmpires, timestamp, rootHash, mintPrice);
          await expect(
            metaEmpires
              .connect(deployer[1])
              .preSaleMintToken(1, hexProof, { value: mintPrice - 1 })
          ).to.be.revertedWith("Price not met");
        });
      });
      describe("saleMintToken", function () {
        it("mint token", async function () {
          const tokenIndex = parseInt(await metaEmpires.totalSupply());
          const timestamp = getTimeStamp();
          await setSale(metaEmpires, timestamp);
          await timeJump(60);
          await saleMint(metaEmpires, deployer[1], 2);
          expect(
            await metaEmpires.balanceOf(deployer[1].getAddress())
          ).to.be.equal(2);
          expect(
            await metaEmpires.nbOfCEsMintedBy(deployer[1].getAddress())
          ).to.be.equal(2);
          expect(await metaEmpires.ownerOf(tokenIndex + 1)).to.be.equal(
            await deployer[1].getAddress()
          );
          expect(await metaEmpires.ownerOf(tokenIndex + 2)).to.be.equal(
            await deployer[1].getAddress()
          );
        });
        it("revert if sale not setted", async function () {
          await expect(
            metaEmpires
              .connect(deployer[1])
              .saleMintToken(1, { value: 1000000 })
          ).to.be.revertedWith("Sale not started yet");
        });
        it("revert if sale not started", async function () {
          const timestamp = (await getTimeStamp()) + 10;
          const mintPrice = 100000;
          await setSale(metaEmpires, timestamp, mintPrice);
          await expect(
            metaEmpires
              .connect(deployer[1])
              .saleMintToken(1, { value: mintPrice })
          ).to.be.revertedWith("Sale not started yet");
        });
        it("revert if sale ended", async function () {
          const timestamp = await getTimeStamp();
          const saleDuration = 10;
          const mintPrice = 100000;
          await setSale(metaEmpires, timestamp, mintPrice, saleDuration);
          await timeJump(10);
          await expect(
            metaEmpires
              .connect(deployer[1])
              .saleMintToken(1, { value: mintPrice })
          ).to.be.revertedWith("Sale already ended");
        });
        it("revert if max supply reached", async function () {
          const maxSupply = 150;
          const maxMintPerAddress = 75;
          const timestamp = await getTimeStamp();
          const mintPrice = 100000;

          deployer = await ethers.getSigners();
          metaEmpires = await deployContract(
            contractName,
            maxSupply,
            maxMintPerAddress
          );
          await setSale(metaEmpires, timestamp, mintPrice);
          const tx = await metaEmpires
            .connect(deployer[1])
            .saleMintToken(30, { value: mintPrice * 30 });
          await tx.wait();
          const tx2 = await metaEmpires
            .connect(deployer[1])
            .saleMintToken(30, { value: mintPrice * 30 });
          await tx2.wait();
          const tx3 = await metaEmpires
            .connect(deployer[2])
            .saleMintToken(40, { value: mintPrice * 40 });
          await tx3.wait();
          await expect(
            metaEmpires
              .connect(deployer[2])
              .saleMintToken(1, { value: mintPrice })
          ).to.be.revertedWith("Mint quantity exceeds max supply");
        });
        it("revert if mint quantity cap reached", async function () {
          const timestamp = await getTimeStamp();
          const mintPrice = 100000;
          const saleDuration = 500;
          const auctionPriceMultiplier = 1;
          const saleMintCap = 51;

          await setSale(
            metaEmpires,
            timestamp,
            mintPrice,
            saleDuration,
            auctionPriceMultiplier,
            saleMintCap
          );
          const tx = await metaEmpires
            .connect(deployer[1])
            .saleMintToken(1, { value: mintPrice * 1 });
          await tx.wait();
          await expect(
            metaEmpires
              .connect(deployer[1])
              .saleMintToken(1, { value: mintPrice })
          ).to.be.revertedWith("Mint cap reached");
        });
        it("revert if account mint quantity reached", async function () {
          const timestamp = await getTimeStamp();
          const mintPrice = 100000;

          await setSale(metaEmpires, timestamp, mintPrice);
          const tx = await metaEmpires
            .connect(deployer[1])
            .saleMintToken(2, { value: mintPrice * 2 });
          await tx.wait();
          await expect(
            metaEmpires
              .connect(deployer[1])
              .saleMintToken(1, { value: mintPrice })
          ).to.be.revertedWith(
            "Mint quantity exceeds allowance for this address"
          );
        });
        it("revert if quantity is 0", async function () {
          const timestamp = await getTimeStamp();
          const mintPrice = 100000;

          await setSale(metaEmpires, timestamp, mintPrice);
          await expect(
            metaEmpires
              .connect(deployer[1])
              .saleMintToken(0, { value: mintPrice })
          ).to.be.revertedWith("Need to mint at least 1 NFT");
        });
        it("revert if price is not met", async function () {
          const timestamp = await getTimeStamp();
          const saleDuration = 300;
          const auctionPriceMultiplier = 5;
          const mintPrice = 100000;

          await setSale(
            metaEmpires,
            timestamp,
            mintPrice,
            saleDuration,
            auctionPriceMultiplier
          );
          await timeJump(60);
          const price = await metaEmpires.getAuctionPrice();
          await expect(
            metaEmpires
              .connect(deployer[1])
              .saleMintToken(1, { value: price - 1 })
          ).to.be.revertedWith("Price not met");
          await metaEmpires
            .connect(deployer[1])
            .saleMintToken(1, { value: price });
        });
      });
      describe("stakeNFT", function () {
        it("stake token", async function () {
          expect(await metaEmpires.isStaked(1)).to.be.false;
          const tx = await metaEmpires.stakeNFT(1);
          await tx.wait();
          expect(await metaEmpires.isStaked(1)).to.be.true;
        });
        it("revert if sender is not owner", async function () {
          await expect(
            metaEmpires.connect(deployer[1]).stakeNFT(1)
          ).to.be.revertedWith("NFT not owned");
        });
        it("revert if token doesn't exist", async function () {
          const tokenIndex = await metaEmpires.totalSupply();
          await expect(metaEmpires.stakeNFT(tokenIndex + 1)).to.be.revertedWith(
            "ERC721: owner query for nonexistent token"
          );
        });
      });
      describe("unStakeNFT", function () {
        beforeEach(async function () {
          const tx = await metaEmpires.stakeNFT(1);
          await tx.wait();
        });
        it("unstake token", async function () {
          expect(await metaEmpires.isStaked(1)).to.be.true;
          const tx = await metaEmpires.unStakeNFT(1);
          await tx.wait();
          expect(await metaEmpires.isStaked(1)).to.be.false;
        });
        it("revert if sender is not owner", async function () {
          await expect(
            metaEmpires.connect(deployer[1]).unStakeNFT(1)
          ).to.be.revertedWith("NFT not owned");
        });
        it("revert if token doesn't exist", async function () {
          const tokenIndex = await metaEmpires.totalSupply();
          await expect(
            metaEmpires.unStakeNFT(tokenIndex + 1)
          ).to.be.revertedWith("ERC721: owner query for nonexistent token");
        });
      });
      describe("transfer", function () {
        describe("transferFrom", function () {
          it("unstake if token is transferred with transferFrom", async function () {
            const tx = await metaEmpires.stakeNFT(1);
            await tx.wait();
            expect(await metaEmpires.isStaked(1)).to.be.true;

            const txTransfer = await metaEmpires.transferFrom(
              deployer[0].getAddress(),
              deployer[1].getAddress(),
              1
            );
            await txTransfer.wait();

            expect(await metaEmpires.ownerOf(1)).to.be.equal(
              await deployer[1].getAddress()
            );
            expect(await metaEmpires.isStaked(1)).to.be.false;
          });

          it("revert if not owner of the NFT", async function () {
            const tx = await metaEmpires.stakeNFT(1);
            await tx.wait();
            expect(await metaEmpires.isStaked(1)).to.be.true;

            await expect(
              metaEmpires
                .connect(deployer[1])
                .transferFrom(
                  deployer[0].getAddress(),
                  deployer[1].getAddress(),
                  1
                )
            ).to.be.revertedWith(
              "ERC721: transfer caller is not owner nor approved"
            );
          });
        });
        describe("safeTransferFrom", function () {
          it("unstake if token is transferred with safeTransferFrom", async function () {
            const tx = await metaEmpires.stakeNFT(1);
            await tx.wait();
            expect(await metaEmpires.isStaked(1)).to.be.true;

            const txTransfer = await metaEmpires[
              "safeTransferFrom(address,address,uint256)"
            ](deployer[0].getAddress(), deployer[1].getAddress(), 1);
            await txTransfer.wait();

            expect(await metaEmpires.ownerOf(1)).to.be.equal(
              await deployer[1].getAddress()
            );
            expect(await metaEmpires.isStaked(1)).to.be.false;
          });

          it("revert if not owner of the NFT", async function () {
            const tx = await metaEmpires.stakeNFT(1);
            await tx.wait();
            expect(await metaEmpires.isStaked(1)).to.be.true;

            await expect(
              metaEmpires
                .connect(deployer[1])
                ["safeTransferFrom(address,address,uint256)"](
                  deployer[0].getAddress(),
                  deployer[1].getAddress(),
                  1
                )
            ).to.be.revertedWith(
              "ERC721: transfer caller is not owner nor approved"
            );
          });
        });
        describe("safeTransferFrom with data", function () {
          it("unstake if token is transferred with transferFrom", async function () {
            const tx = await metaEmpires.stakeNFT(1);
            await tx.wait();
            expect(await metaEmpires.isStaked(1)).to.be.true;

            const txTransfer = await metaEmpires[
              "safeTransferFrom(address,address,uint256,bytes)"
            ](deployer[0].getAddress(), deployer[1].getAddress(), 1, "0x00");
            await txTransfer.wait();

            expect(await metaEmpires.ownerOf(1)).to.be.equal(
              await deployer[1].getAddress()
            );
            expect(await metaEmpires.isStaked(1)).to.be.false;
          });

          it("revert if not owner of the NFT", async function () {
            const tx = await metaEmpires.stakeNFT(1);
            await tx.wait();
            expect(await metaEmpires.isStaked(1)).to.be.true;

            await expect(
              metaEmpires
                .connect(deployer[1])
                ["safeTransferFrom(address,address,uint256,bytes)"](
                  deployer[0].getAddress(),
                  deployer[1].getAddress(),
                  1,
                  "0x00"
                )
            ).to.be.revertedWith(
              "ERC721: transfer caller is not owner nor approved"
            );
          });
        });
      });
    });
    describe("Contract Admin Methods", function () {
      let metaEmpires, deployer;

      beforeEach(async function () {
        deployer = await ethers.getSigners();
        metaEmpires = await deployContract(contractName);
      });

      describe("setBaseURI", function () {
        it("set base URI", async function () {
          const URI = "ipfs://ciccio/";
          const ID = 1;
          const tx = await metaEmpires.setBaseURI(URI);
          await tx.wait();
          expect(await metaEmpires.tokenURI(ID)).to.be.equal(URI + ID);
        });
        it("revert if not owner", async function () {
          const URI = "ipfs://ciccio/";
          await expect(
            metaEmpires.connect(deployer[1]).setBaseURI(URI)
          ).to.be.revertedWith("Ownable: caller is not the owner");
        });
      });

      describe("setPreSale", function () {
        let rootHash, leafNodes, merkleTree;
        beforeEach(async function () {
          let whitelistAddresses = [
            await deployer[0].getAddress(),
            await deployer[1].getAddress(),
            await deployer[2].getAddress(),
            await deployer[3].getAddress(),
          ];
          leafNodes = whitelistAddresses.map((addr) => keccak256(addr));
          merkleTree = new MerkleTree(leafNodes, keccak256, {
            sortPairs: true,
          });
          rootHash = merkleTree.getHexRoot();
        });
        it("set the public sale parameter", async function () {
          const preSaleMintPrice = 100000;
          const preSaleStartTime = await getTimeStamp();
          const preSaleDuration = 300;
          const tx = await metaEmpires.setPreSale(
            preSaleMintPrice,
            preSaleStartTime,
            preSaleDuration,
            rootHash
          );
          await tx.wait();
          expect(await metaEmpires.preSaleMintPrice()).to.be.equal(
            preSaleMintPrice
          );
          expect(await metaEmpires.preSaleStartTime()).to.be.equal(
            preSaleStartTime
          );
          expect(await metaEmpires.preSaleDuration()).to.be.equal(
            preSaleDuration
          );
        });
        it("revert if not owner", async function () {
          const preSaleMintPrice = 100000;
          const preSaleStartTime = await getTimeStamp();
          const preSaleDuration = 300;
          await expect(
            metaEmpires
              .connect(deployer[1])
              .setPreSale(
                preSaleMintPrice,
                preSaleStartTime,
                preSaleDuration,
                rootHash
              )
          ).to.be.revertedWith("Ownable: caller is not the owner");
        });
      });
      describe("setSale", function () {
        it("set the public sale parameter", async function () {
          const saleMintPrice = 100000;
          const saleStartTime = await getTimeStamp();
          const saleDuration = 300;
          const auctionPriceMultiplier = 5;
          const saleMintCap = 3000;
          const tx = await metaEmpires.setSale(
            saleMintPrice,
            saleStartTime,
            saleDuration,
            auctionPriceMultiplier,
            saleMintCap
          );
          expect(await metaEmpires.saleMintPrice()).to.be.equal(saleMintPrice);
          expect(await metaEmpires.saleStartTime()).to.be.equal(saleStartTime);
          expect(await metaEmpires.saleDuration()).to.be.equal(saleDuration);
          expect(await metaEmpires.auctionPriceMultiplier()).to.be.equal(
            auctionPriceMultiplier
          );
          expect(await metaEmpires.saleMintCap()).to.be.equal(saleMintCap);
        });
        it("revert if not owner", async function () {
          const saleMintPrice = 100000;
          const saleStartTime = await getTimeStamp();
          const saleDuration = 300;
          const auctionPriceMultiplier = 5;
          const saleMintCap = 3000;
          await expect(
            metaEmpires
              .connect(deployer[1])
              .setSale(
                saleMintPrice,
                saleStartTime,
                saleDuration,
                auctionPriceMultiplier,
                saleMintCap
              )
          ).to.be.revertedWith("Ownable: caller is not the owner");
        });
      });
      describe("withdraw", function () {
        it("withdraw funds", async function () {
          const provider = waffle.provider;
          const w1 = "0x2f79c1ae4d60bb2dff0389782359e3676712e6e3";
          const w2 = "0xab8483f64d9c6d1ecf9b849ae677dd3315835cb2";
          const w3 = "0x4b20993bc481177ec7e8f571cecae8a9e22c02db";
          const w4 = "0x78731D3Ca6b7E34aC0F824c42a7cC18A495cabaB";
          const w5 = "0x617F2E2fD72FD9D5503197092aC168c91465E7f2";

          const b1 = await provider.getBalance(w1);
          const b2 = await provider.getBalance(w2);
          const b3 = await provider.getBalance(w3);
          const b4 = await provider.getBalance(w4);
          const b5 = await provider.getBalance(w5);
          const timestamp = await getTimeStamp();
          const saleMintPrice = 1000000;

          await setSale(metaEmpires, timestamp, saleMintPrice);
          await saleMint(metaEmpires, deployer[1], 2, saleMintPrice);
          const tx = await metaEmpires.withdraw();
          await tx.wait();
          expect(await provider.getBalance(w1)).to.be.equal(
            parseInt(b1) + (2 * saleMintPrice * 3725) / 10000
          );
          expect(await provider.getBalance(w2)).to.be.equal(
            parseInt(b2) + (2 * saleMintPrice * 3725) / 10000
          );
          expect(await provider.getBalance(w3)).to.be.equal(
            parseInt(b3) + (2 * saleMintPrice * 1500) / 10000
          );
          expect(await provider.getBalance(w4)).to.be.equal(
            parseInt(b4) + (2 * saleMintPrice * 750) / 10000
          );
          expect(await provider.getBalance(w5)).to.be.equal(
            parseInt(b5) + (2 * saleMintPrice * 300) / 10000
          );
        });
        it("withdraw non divisible amount", async function () {
          const provider = waffle.provider;
          const w1 = "0x2f79c1ae4d60bb2dff0389782359e3676712e6e3";
          const w2 = "0xab8483f64d9c6d1ecf9b849ae677dd3315835cb2";
          const w3 = "0x4b20993bc481177ec7e8f571cecae8a9e22c02db";
          const w4 = "0x78731D3Ca6b7E34aC0F824c42a7cC18A495cabaB";
          const w5 = "0x617F2E2fD72FD9D5503197092aC168c91465E7f2";

          const b1 = await provider.getBalance(w1);
          const b2 = await provider.getBalance(w2);
          const b3 = await provider.getBalance(w3);
          const b4 = await provider.getBalance(w4);
          const b5 = await provider.getBalance(w5);
          const timestamp = await getTimeStamp();
          const saleMintPrice = 1;

          await setSale(metaEmpires, timestamp, saleMintPrice);
          await saleMint(metaEmpires, deployer[1], 2, saleMintPrice);
          const tx = await metaEmpires.withdraw();
          await tx.wait();
          expect(await provider.getBalance(w1)).to.be.equal(b1);
          expect(await provider.getBalance(w2)).to.be.equal(b2);
          expect(await provider.getBalance(w3)).to.be.equal(b3);
          expect(await provider.getBalance(w4)).to.be.equal(b4);
          expect(await provider.getBalance(w5)).to.be.equal(b5);
        });
        it("revert if not owner", async function () {
          const timestamp = await getTimeStamp();
          const saleMintPrice = 1000000;

          await setSale(metaEmpires, timestamp, saleMintPrice);
          await saleMint(metaEmpires, deployer[1], 2, saleMintPrice);
          await expect(
            metaEmpires.connect(deployer[1]).withdraw()
          ).to.be.revertedWith("Ownable: caller is not the owner");
        });
      });
    });
  });
};

const deployContract = async (
  contractName,
  _maxSupply = maxSupply,
  _maxMintPerAddress = maxMintPerAddress,
  _teamReservedMint = teamReservedMint,
  _auctionInterval = auctionInterval
) => {
  MetaEmpires = await ethers.getContractFactory(contractName);
  metaEmpires = await MetaEmpires.deploy(
    _maxSupply,
    _maxMintPerAddress,
    _teamReservedMint,
    _auctionInterval
  );
  return metaEmpires;
};

const setSale = async (
  metaEmpires,
  saleStartTime,
  saleMintPrice = 100000000,
  saleDuration = 300,
  auctionPriceMultiplier = 1,
  saleMintCap = 3000
) => {
  const tx = await metaEmpires.setSale(
    saleMintPrice,
    saleStartTime,
    saleDuration,
    auctionPriceMultiplier,
    saleMintCap
  );
  await tx.wait();
};

const setPreSale = async (
  metaEmpires,
  preSaleStartTime,
  root,
  preSaleMintPrice = 100000000,
  preSaleDuration = 300
) => {
  const tx = await metaEmpires.setPreSale(
    preSaleMintPrice,
    preSaleStartTime,
    preSaleDuration,
    root
  );
  await tx.wait();
};

const saleMint = async (
  metaEmpires,
  account,
  quantity,
  saleMintPrice = 100000000
) => {
  const price = await metaEmpires.getAuctionPrice();
  const tx = await metaEmpires
    .connect(account)
    .saleMintToken(quantity, { value: price * quantity });
  await tx.wait();
};

const preSaleMint = async (
  metaEmpires,
  account,
  quantity,
  proof,
  preSaleMintPrice = 100000000
) => {
  const tx = await metaEmpires
    .connect(account)
    .preSaleMintToken(quantity, proof, { value: preSaleMintPrice * quantity });
  await tx.wait();
};

const getTimeStamp = async () => {
  const blockNumBefore = await ethers.provider.getBlockNumber();
  const blockBefore = await ethers.provider.getBlock(blockNumBefore);
  const timestampBefore = blockBefore.timestamp;
  return timestampBefore;
};

const timeJump = async (amount) => {
  await network.provider.send("evm_increaseTime", [amount]);
  await network.provider.send("evm_mine");
};

main("MetaEmpires");
//main("MetaEmpiresNotOptimized");
