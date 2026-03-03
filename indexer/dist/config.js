"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, "../.env") });
exports.config = {
    rpcUrl: process.env.RPC_URL || "https://public-rpc.paxeer.app/rpc",
    rpcWsUrl: process.env.RPC_WS_URL || "",
    contracts: {
        eventEmitter: process.env.EVENT_EMITTER_ADDRESS || "0x83Fbd4b98fF5E42cbe2A2B51E6c658B8a8f142F6",
        marketNFT: process.env.MARKET_NFT_ADDRESS || "0x68c92DD2cE0CB45F7Ed596DA4afbFAE69bd9Da08",
        factory: process.env.HLPMM_FACTORY_ADDRESS || "0xEF283FF45379e2d47Ce8db0C613125072c1A1c58",
        usid: process.env.USID_ADDRESS || "0x6C32c255EeBD6A72B56ee82454d7140020919652",
    },
    startBlock: parseInt(process.env.START_BLOCK || "659127", 10),
    batchSize: parseInt(process.env.BATCH_SIZE || "1000", 10),
    concurrency: parseInt(process.env.CONCURRENCY || "6", 10),
    port: parseInt(process.env.PORT || "8200", 10),
    host: process.env.HOST || "0.0.0.0",
    databaseUrl: process.env.DATABASE_URL || "postgresql://postgres:NPJcncTeYwlMsjVZvEVwMJWDZQiHrzqn@tramway.proxy.rlwy.net:38555/railway",
};
//# sourceMappingURL=config.js.map