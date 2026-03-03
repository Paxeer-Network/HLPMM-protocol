/** ABI fragments for all contract events + read functions used by the indexer */

export const EventEmitterABI = [
  "event MarketCreated(address indexed pool, address indexed token, uint256 indexed nftId, address creator, string name, string symbol, uint256 timestamp)",
  "event Swap(address indexed pool, address indexed sender, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut, uint256 newReserveUSID, uint256 newReserveToken, uint256 feeAmount, uint256 timestamp)",
  "event FeeClaimed(address indexed pool, uint256 indexed nftId, address indexed recipient, uint256 amount, uint256 timestamp)",
  "event FeeStrategyUpdated(uint256 indexed nftId, uint8 newStrategy, uint256 timestamp)",
];

export const HLPMMFactoryABI = [
  "event MarketCreated(address indexed pool, address indexed token, uint256 indexed nftId, address creator)",
  "function tokenToPool(address token) view returns (address)",
  "function nftToPool(uint256 nftId) view returns (address)",
  "function marketCount() view returns (uint256)",
  "function getAllPools() view returns (address[])",
];

export const MarketNFTABI = [
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
  "event FeeStrategyUpdated(uint256 indexed tokenId, uint8 newStrategy)",
  "event FeesClaimed(uint256 indexed tokenId, address indexed recipient, uint256 amount)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function nftToPool(uint256 tokenId) view returns (address)",
  "function feeStrategy(uint256 tokenId) view returns (uint8)",
  "function totalMinted() view returns (uint256)",
];

export const HLPMMPoolABI = [
  "event Sync(uint256 reserve0, uint256 reserve1)",
  "function token() view returns (address)",
  "function usid() view returns (address)",
  "function nftId() view returns (uint256)",
  "function getReserves() view returns (uint256 reserveUSID, uint256 reserveToken)",
  "function getSpotPrice() view returns (uint256)",
];

export const ERC20ABI = [
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "event Approval(address indexed owner, address indexed spender, uint256 value)",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
];
