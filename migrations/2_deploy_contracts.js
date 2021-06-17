const { fromWei, toWei } = web3.utils;

const XCashToken = artifacts.require("XCashToken");

module.exports = async function(deployer, network, [DEPLOYER, ...accounts]) {
  await deployer.deploy(XCashToken);

  let token = await XCashToken.deployed();

  if (network !== "test") {
    console.log('| Token | -------------------------------------------------');
    console.log(`|      Address: ${token.address}`);
    console.log(`|     Deployer: ${DEPLOYER}`);
    console.log(`|        Owner: ${await token.owner()}`);
    console.log(`|         Name: ${await token.name()}`);
    console.log(`|       Symbol: ${await token.symbol()}`);
    console.log(`|     Decimals: ${await token.decimals()}`);
    console.log(`|          Cap: ${fromWei(await token.cap())}`);
    console.log(`| Total supply: ${fromWei(await token.totalSupply())}`);
    console.log('|----------------------------------------------------------');
  }
};
