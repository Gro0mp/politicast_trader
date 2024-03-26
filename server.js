const Alpaca = require("@alpacahq/alpaca-trade-api");
const alpaca = new Alpaca();
const WebSocket = require("ws");

// Server < -- > Data Source

const wss = new WebSocket("wss://stream.data.alpaca.markets/v1beta1/news");

wss.on('open', function() {
    console.log("WebSocket connected");
    const authMsg = {
        action: 'auth',
        key: process.env.APCA_API_KEY_ID,
        secret: process.env.APCA_API_SECRET_KEY
    };
    wss.send(JSON.stringify(authMsg));
});
