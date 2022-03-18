async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);

  console.log("Account balance:", (await deployer.getBalance()).toString());

  const MetaEmpires = await ethers.getContractFactory("MetaEmpires");
  const metaEmpires = await MetaEmpires.deploy(4999, 2, 50, 20);

  console.log("NFT address:", metaEmpires.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
