import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@openzeppelin/hardhat-upgrades";
import "@nomicfoundation/hardhat-verify";
import "hardhat-gas-reporter";
import "hardhat-contract-sizer";
import "solidity-coverage";
import "dotenv/config";

// ═══════════════════════════════════════════════════════════════════════════════
// ENVIRONMENT CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const privateKey = process.env.PRIVATE_KEY || "";
const etherscanApiKey = process.env.ETHERSCAN_API_KEY || "";
const basescanApiKey = process.env.BASESCAN_API_KEY || "";
const polygonscanApiKey = process.env.POLYGONSCAN_API_KEY || "";
const arbiscanApiKey = process.env.ARBISCAN_API_KEY || "";
const optimismApiKey = process.env.OPTIMISM_API_KEY || "";
const bnbscanApiKey = process.env.BNBSCAN_API_KEY || "";
const coinmarketcapApiKey = process.env.COINMARKETCAP_API_KEY || "";

// Validate private key
if (!privateKey) {
  console.warn("⚠️  WARNING: PRIVATE_KEY not set. Deployments will not work.");
}

// ═══════════════════════════════════════════════════════════════════════════════
// NETWORK CONFIGURATIONS
// ═══════════════════════════════════════════════════════════════════════════════

interface NetworkConfig {
  chainId: number;
  url: string;
  accounts: string[];
  gasPrice?: number | "auto";
  gas?: number | "auto";
  timeout?: number;
  httpHeaders?: Record<string, string>;
}

const getAccounts = (): string[] => (privateKey ? [privateKey] : []);

// Mainnet Networks
const MAINNET_NETWORKS: Record<string, NetworkConfig> = {
  // Paxeer Network (Primary)
  "paxeer-network": {
    chainId: 125,
    url: process.env.PAXEER_RPC_URL || "https://mainnet-beta.rpc.hyperpaxeer.com/rpc",
    accounts: getAccounts(),
    timeout: 60000,
  },
  
  // Ethereum Mainnet
  "ethereum": {
    chainId: 1,
    url: process.env.ETHEREUM_RPC_URL || `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
    accounts: getAccounts(),
    gasPrice: "auto",
  },
  
  // Polygon (Matic)
  "polygon": {
    chainId: 137,
    url: process.env.POLYGON_RPC_URL || "https://polygon-rpc.com",
    accounts: getAccounts(),
    gasPrice: "auto",
  },
  
  // Arbitrum One
  "arbitrum": {
    chainId: 42161,
    url: process.env.ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc",
    accounts: getAccounts(),
  },
  
  // Optimism
  "optimism": {
    chainId: 10,
    url: process.env.OPTIMISM_RPC_URL || "https://mainnet.optimism.io",
    accounts: getAccounts(),
  },
  
  // Base
  "base": {
    chainId: 8453,
    url: process.env.BASE_RPC_URL || "https://mainnet.base.org",
    accounts: getAccounts(),
  },
  
  // BNB Smart Chain
  "bsc": {
    chainId: 56,
    url: process.env.BSC_RPC_URL || "https://bsc-dataseed1.binance.org",
    accounts: getAccounts(),
  },
  
  // Avalanche C-Chain
  "avalanche": {
    chainId: 43114,
    url: process.env.AVALANCHE_RPC_URL || "https://api.avax.network/ext/bc/C/rpc",
    accounts: getAccounts(),
  },
  
  // Fantom Opera
  "fantom": {
    chainId: 250,
    url: process.env.FANTOM_RPC_URL || "https://rpc.ftm.tools",
    accounts: getAccounts(),
  },
  
  // Gnosis Chain (xDai)
  "gnosis": {
    chainId: 100,
    url: process.env.GNOSIS_RPC_URL || "https://rpc.gnosischain.com",
    accounts: getAccounts(),
  },
  
  // Celo
  "celo": {
    chainId: 42220,
    url: process.env.CELO_RPC_URL || "https://forno.celo.org",
    accounts: getAccounts(),
  },
  
  // Moonbeam
  "moonbeam": {
    chainId: 1284,
    url: process.env.MOONBEAM_RPC_URL || "https://rpc.api.moonbeam.network",
    accounts: getAccounts(),
  },
  
  // zkSync Era
  "zksync": {
    chainId: 324,
    url: process.env.ZKSYNC_RPC_URL || "https://mainnet.era.zksync.io",
    accounts: getAccounts(),
  },
  
  // Linea
  "linea": {
    chainId: 59144,
    url: process.env.LINEA_RPC_URL || "https://rpc.linea.build",
    accounts: getAccounts(),
  },
  
  // Scroll
  "scroll": {
    chainId: 534352,
    url: process.env.SCROLL_RPC_URL || "https://rpc.scroll.io",
    accounts: getAccounts(),
  },
  
  // Mantle
  "mantle": {
    chainId: 5000,
    url: process.env.MANTLE_RPC_URL || "https://rpc.mantle.xyz",
    accounts: getAccounts(),
  },
};

// Testnet Networks
const TESTNET_NETWORKS: Record<string, NetworkConfig> = {
  // Paxeer Testnet
  "paxeer-testnet": {
    chainId: 126,
    url: process.env.PAXEER_TESTNET_RPC_URL || "https://testnet.rpc.hyperpaxeer.com/rpc",
    accounts: getAccounts(),
  },
  
  // Ethereum Sepolia
  "sepolia": {
    chainId: 11155111,
    url: process.env.SEPOLIA_RPC_URL || `https://eth-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
    accounts: getAccounts(),
  },
  
  // Ethereum Goerli (deprecated but still used)
  "goerli": {
    chainId: 5,
    url: process.env.GOERLI_RPC_URL || `https://eth-goerli.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
    accounts: getAccounts(),
  },
  
  // Polygon Mumbai
  "mumbai": {
    chainId: 80001,
    url: process.env.MUMBAI_RPC_URL || "https://rpc-mumbai.maticvigil.com",
    accounts: getAccounts(),
  },
  
  // Polygon Amoy (new testnet)
  "amoy": {
    chainId: 80002,
    url: process.env.AMOY_RPC_URL || "https://rpc-amoy.polygon.technology",
    accounts: getAccounts(),
  },
  
  // Arbitrum Sepolia
  "arbitrum-sepolia": {
    chainId: 421614,
    url: process.env.ARBITRUM_SEPOLIA_RPC_URL || "https://sepolia-rollup.arbitrum.io/rpc",
    accounts: getAccounts(),
  },
  
  // Optimism Sepolia
  "optimism-sepolia": {
    chainId: 11155420,
    url: process.env.OPTIMISM_SEPOLIA_RPC_URL || "https://sepolia.optimism.io",
    accounts: getAccounts(),
  },
  
  // Base Sepolia
  "base-sepolia": {
    chainId: 84532,
    url: process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org",
    accounts: getAccounts(),
  },
  
  // BSC Testnet
  "bsc-testnet": {
    chainId: 97,
    url: process.env.BSC_TESTNET_RPC_URL || "https://data-seed-prebsc-1-s1.binance.org:8545",
    accounts: getAccounts(),
  },
  
  // Avalanche Fuji
  "fuji": {
    chainId: 43113,
    url: process.env.FUJI_RPC_URL || "https://api.avax-test.network/ext/bc/C/rpc",
    accounts: getAccounts(),
  },
  
  // Fantom Testnet
  "fantom-testnet": {
    chainId: 4002,
    url: process.env.FANTOM_TESTNET_RPC_URL || "https://rpc.testnet.fantom.network",
    accounts: getAccounts(),
  },
  
  // Linea Testnet
  "linea-testnet": {
    chainId: 59140,
    url: process.env.LINEA_TESTNET_RPC_URL || "https://rpc.goerli.linea.build",
    accounts: getAccounts(),
  },
  
  // Scroll Sepolia
  "scroll-sepolia": {
    chainId: 534351,
    url: process.env.SCROLL_SEPOLIA_RPC_URL || "https://sepolia-rpc.scroll.io",
    accounts: getAccounts(),
  },
};

// Local Networks
const LOCAL_NETWORKS: Record<string, NetworkConfig> = {
  "localhost": {
    chainId: 31337,
    url: "http://127.0.0.1:8545",
    accounts: getAccounts(),
  },
  "hardhat": {
    chainId: 31337,
    url: "http://127.0.0.1:8545",
    accounts: getAccounts(),
  },
};

// Combine all networks
const networks = {
  ...MAINNET_NETWORKS,
  ...TESTNET_NETWORKS,
  ...LOCAL_NETWORKS,
};

// ═══════════════════════════════════════════════════════════════════════════════
// ETHERSCAN / BLOCK EXPLORER CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const etherscan = {
  apiKey: {
    // Paxeer
    "paxeer-network": "empty",
    "paxeer-testnet": "empty",
    
    // Ethereum
    mainnet: etherscanApiKey,
    sepolia: etherscanApiKey,
    goerli: etherscanApiKey,
    
    // Polygon
    polygon: polygonscanApiKey,
    polygonMumbai: polygonscanApiKey,
    polygonAmoy: polygonscanApiKey,
    
    // Arbitrum
    arbitrumOne: arbiscanApiKey,
    arbitrumSepolia: arbiscanApiKey,
    
    // Optimism
    optimisticEthereum: optimismApiKey,
    optimismSepolia: optimismApiKey,
    
    // Base
    base: basescanApiKey,
    baseSepolia: basescanApiKey,
    
    // BSC
    bsc: bnbscanApiKey,
    bscTestnet: bnbscanApiKey,
    
    // Others
    avalanche: process.env.SNOWTRACE_API_KEY || "",
    avalancheFujiTestnet: process.env.SNOWTRACE_API_KEY || "",
    fantom: process.env.FTMSCAN_API_KEY || "",
    fantomTestnet: process.env.FTMSCAN_API_KEY || "",
    gnosis: process.env.GNOSISSCAN_API_KEY || "",
    moonbeam: process.env.MOONSCAN_API_KEY || "",
  },
  customChains: [
    {
      network: "paxeer-network",
      chainId: 125,
      urls: {
        apiURL: "https://paxscan.paxeer.app/api/",
        browserURL: "https://paxscan.paxeer.app/",
      },
    },
    {
      network: "paxeer-testnet",
      chainId: 126,
      urls: {
        apiURL: "https://testnet.paxscan.paxeer.app/api/",
        browserURL: "https://testnet.paxscan.paxeer.app/",
      },
    },
    {
      network: "base",
      chainId: 8453,
      urls: {
        apiURL: "https://api.basescan.org/api",
        browserURL: "https://basescan.org",
      },
    },
    {
      network: "baseSepolia",
      chainId: 84532,
      urls: {
        apiURL: "https://api-sepolia.basescan.org/api",
        browserURL: "https://sepolia.basescan.org",
      },
    },
    {
      network: "linea",
      chainId: 59144,
      urls: {
        apiURL: "https://api.lineascan.build/api",
        browserURL: "https://lineascan.build",
      },
    },
    {
      network: "scroll",
      chainId: 534352,
      urls: {
        apiURL: "https://api.scrollscan.com/api",
        browserURL: "https://scrollscan.com",
      },
    },
    {
      network: "mantle",
      chainId: 5000,
      urls: {
        apiURL: "https://explorer.mantle.xyz/api",
        browserURL: "https://explorer.mantle.xyz",
      },
    },
    {
      network: "polygonAmoy",
      chainId: 80002,
      urls: {
        apiURL: "https://api-amoy.polygonscan.com/api",
        browserURL: "https://amoy.polygonscan.com",
      },
    },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// SOLIDITY COMPILER CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const solidity = {
  compilers: [
    {
      version: "0.8.20",
      settings: {
        optimizer: {
          enabled: true,
          runs: 200,
        },
        viaIR: true,
        evmVersion: "paris",
        metadata: {
          bytecodeHash: "ipfs",
        },
      },
    },
    {
      version: "0.8.19",
      settings: {
        optimizer: {
          enabled: true,
          runs: 200,
        },
      },
    },
    {
      version: "0.7.6",
      settings: {
        optimizer: {
          enabled: true,
          runs: 200,
        },
      },
    },
    {
      version: "0.6.6",
      settings: {
        optimizer: {
          enabled: true,
          runs: 200,
        },
      },
    },
    {
      version: "0.5.16",
      settings: {
        optimizer: {
          enabled: true,
          runs: 200,
        },
      },
    },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// HARDHAT CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const config: HardhatUserConfig = {
  solidity,
  networks,
  etherscan,
  
  // Gas Reporter
  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
    currency: "USD",
    coinmarketcap: coinmarketcapApiKey,
    outputFile: process.env.GAS_REPORT_FILE || undefined,
    noColors: process.env.GAS_REPORT_FILE ? true : false,
    excludeContracts: ["mocks/", "test/"],
  },
  
  // Contract Sizer
  contractSizer: {
    alphaSort: true,
    disambiguatePaths: false,
    runOnCompile: process.env.CONTRACT_SIZER === "true",
    strict: true,
    only: [],
  },
  
  // Paths
  paths: {
    sources: "./contracts",
    tests: "./tests",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  
  // Mocha
  mocha: {
    timeout: 100000,
    parallel: false,
  },
  
  // Sourcify
  sourcify: {
    enabled: true,
  },
};

export default config;
