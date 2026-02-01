const { ethers } = require("hardhat");

const INITIAL_USID = ethers.parseEther("10000"); // 10,000 USID
const INITIAL_TOKENS = ethers.parseEther("1000000000"); // 1 billion tokens
const PRECISION = ethers.parseEther("1"); // 1e18

const FEE_DENOMINATOR = 10000n;
const BASE_FEE = 30n; // 0.30%
const MIN_FEE = 10n; // 0.10%
const MAX_FEE = 300n; // 3.00%

const ONE_DAY = 86400;
const ONE_WEEK = 7 * ONE_DAY;
const ONE_MONTH = 30 * ONE_DAY;

const FeeStrategy = {
  CLAIM: 0,
  BURN: 1,
  AIRDROP: 2,
  LP_REWARDS: 3
};

const ZERO_ADDRESS = ethers.ZeroAddress;

module.exports = {
  INITIAL_USID,
  INITIAL_TOKENS,
  PRECISION,
  FEE_DENOMINATOR,
  BASE_FEE,
  MIN_FEE,
  MAX_FEE,
  ONE_DAY,
  ONE_WEEK,
  ONE_MONTH,
  FeeStrategy,
  ZERO_ADDRESS
};
