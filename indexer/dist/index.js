"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const http_1 = __importDefault(require("http"));
const server_1 = require("@apollo/server");
const express4_1 = require("@apollo/server/express4");
const drainHttpServer_1 = require("@apollo/server/plugin/drainHttpServer");
const ws_1 = require("ws");
const ws_2 = require("graphql-ws/lib/use/ws");
const schema_1 = require("@graphql-tools/schema");
const schema_2 = require("./graphql/schema");
const resolvers_1 = require("./graphql/resolvers");
const db_1 = require("./db");
const indexer_1 = require("./indexer");
const candles_1 = require("./services/candles");
const trending_1 = require("./services/trending");
const config_1 = require("./config");
async function main() {
    console.log("╔══════════════════════════════════════════════╗");
    console.log("║   HLPMM Protocol Indexer                    ║");
    console.log("║   High-performance subgraph replacement     ║");
    console.log("╚══════════════════════════════════════════════╝");
    // 1. Initialize database
    console.log("[db] Connecting to PostgreSQL and running migrations...");
    await (0, db_1.initDb)();
    console.log("[db] Ready.");
    // 2. Build GraphQL schema
    const schema = (0, schema_1.makeExecutableSchema)({ typeDefs: schema_2.typeDefs, resolvers: resolvers_1.resolvers });
    // 3. Create HTTP + WebSocket servers
    const app = (0, express_1.default)();
    const httpServer = http_1.default.createServer(app);
    // WebSocket server for subscriptions
    const wsServer = new ws_1.WebSocketServer({
        server: httpServer,
        path: "/graphql",
    });
    const serverCleanup = (0, ws_2.useServer)({ schema }, wsServer);
    // 4. Create Apollo Server
    const apollo = new server_1.ApolloServer({
        schema,
        plugins: [
            (0, drainHttpServer_1.ApolloServerPluginDrainHttpServer)({ httpServer }),
            {
                async serverWillStart() {
                    return {
                        async drainServer() {
                            await serverCleanup.dispose();
                        },
                    };
                },
            },
        ],
        introspection: true,
        csrfPrevention: false,
    });
    await apollo.start();
    // 5. Mount middleware
    app.use((0, cors_1.default)());
    app.use(express_1.default.json({ limit: "1mb" }));
    app.use("/graphql", (0, express4_1.expressMiddleware)(apollo, {
        context: async () => ({}),
    }));
    // Health check
    app.get("/health", (_req, res) => {
        res.json({ status: "ok", timestamp: Date.now() });
    });
    // Subgraph-compatible root (some clients query `/` or `/subgraphs/name/...`)
    app.use("/subgraphs/name/hlpmm-protocol/hlpmm", (0, express4_1.expressMiddleware)(apollo, {
        context: async () => ({}),
    }));
    // 6. Start HTTP server
    await new Promise((resolve) => {
        httpServer.listen(config_1.config.port, config_1.config.host, () => resolve());
    });
    console.log(`[server] GraphQL API running at http://${config_1.config.host}:${config_1.config.port}/graphql`);
    console.log(`[server] WebSocket subscriptions at ws://${config_1.config.host}:${config_1.config.port}/graphql`);
    console.log(`[server] Subgraph-compatible endpoint at /subgraphs/name/hlpmm-protocol/hlpmm`);
    // 7. Start indexer + services in background
    (0, indexer_1.startIndexer)().catch((err) => {
        console.error("[indexer] Fatal error:", err);
    });
    (0, candles_1.startCandleService)().catch((err) => {
        console.error("[candles] Fatal error:", err);
    });
    (0, trending_1.startTrendingService)().catch((err) => {
        console.error("[trending] Fatal error:", err);
    });
    // 8. Graceful shutdown
    const shutdown = async () => {
        console.log("\n[shutdown] Gracefully shutting down...");
        (0, indexer_1.stopIndexer)();
        await (0, candles_1.stopCandleService)();
        await (0, trending_1.stopTrendingService)();
        await apollo.stop();
        httpServer.close();
        await (0, db_1.closeDb)();
        console.log("[shutdown] Done.");
        process.exit(0);
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
}
main().catch((err) => {
    console.error("Fatal startup error:", err);
    process.exit(1);
});
//# sourceMappingURL=index.js.map