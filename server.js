const PORT = 8000;

const express = require('express');
const cheerio = require('cheerio');
const axios = require('axios');

const app = express();

const Alpaca = require('@alpacahq/alpaca-trade-api');
const {readFile} = require("node:fs");
const alpaca = new Alpaca({
    keyId: process.env.APCA_API_KEY_ID,
    secretKey: process.env.APCA_API_SECRET_KEY,
    paper: true,
});

//// Get Current Positions ////

async function getCurrentStocks() {
    // Get a list of all of our positions.
    let currentStocks = [];
    try {
        let portfolio = await alpaca.getPositions();
        // Print the quantity of shares for each position.
        portfolio.forEach(function (position) {
            //console.log(`${position.qty} shares of ${position.symbol}`);
            currentStocks.push(position.symbol);
        });
        //console.log(currentStocks)
        return currentStocks;
    } catch (error) {
        console.error("Error fetching positions: ", error);
    }
}

//getCurrentStocks()

/// Get Current Awaiting Orders ///

async function getAwaitingOrders() {
    let awaitingOrders = [];
    try {
        let orders = await alpaca.getOrders()
        let i = 0;
        // Print the quantity of shares for each position.
        orders.forEach(function (position) {
            if (!awaitingOrders.includes(orders[i].symbol)) {
                awaitingOrders.push(orders[i].symbol);
            }
            i++;
        });
        //console.log(awaitingOrders)
        return awaitingOrders;
    } catch (error) {
        console.error("Error fetching positions: ", error);
    }
}

//getAwaitingOrders()

//// Get Current Buying Power ////

async function getBuyingPower() {
    let buyingPower = 0;
    try {
        let account = await alpaca.getAccount();
        buyingPower = account.buying_power
        //console.log(`$${buyingPower} is available as buying power.`)
        return buyingPower
    } catch (error) {
        console.error("Error fetching buying power: ", error)
    }
}

//getBuyingPower()

//// Create Politician Class ////

class Politician {
    constructor(name, stock, buyOrSell, companyName, dateTraded) {
        this.values = [name, stock, buyOrSell, companyName, dateTraded];
    }
    getName() {
        return this.values[0];
    }
    getStock() {
        return this.values[1];
    }
    getPosition() {
        return this.values[2];
    }
    getCompanyName() {
        return this.values[3];
    }
    getDate() {
        return this.values[4];
    }
}

//// Get URL's ////

async function fetchPoliticianUrls(politicianUrl) {
    // Creates a map to store the name and corresponding url of
    // politician.
    const urlMap = new Map();

    for (let i = 1; i < 2; i++) {
        // Loads the necessary website materials
        const response = await axios(politicianUrl + "?page=" + i.toString());
        const html = response.data;
        const $ = cheerio.load(html);
        // Fills map with information on each politician.
        $('.index-card-link').each(function () {
            const url = $(this).attr('href');
            const name = $(this).find('.q-cell.cell--name').text();
            urlMap.set(`https://www.capitoltrades.com${url}`, name.trim());
        });
    }
    return urlMap;
}

//// Get URL Information ////

async function processUrl(url, name) {
    try {
        /// Get Politician Trade Information ////
        const response = await axios.get(url);
        const html = response.data;
        const $ = cheerio.load(html);

        const trades = $('.q-field.issuer-ticker').map((i, el) => $(el).text().trim().split(':')[0]).get();
        const buyOrSell = $('.q-field.tx-type').map((i, el) => $(el).text().trim()).get();
        const companyName = $('.q-fieldset.issuer-name').map((i, el) => $(el).text().trim()).get();
        const dateTraded = $('.q-td.q-column--txDate').map((i, el) => $(el).text().trim()).get();
        const politician = new Politician(name,trades[0],buyOrSell[0],companyName[0],dateTraded[0])

        /// Get Current Stock Information and Buying Power ////
        let currentStocks = await getCurrentStocks();
        let awaitingStocks = await getAwaitingOrders();
        let buyingPower = await getBuyingPower();
        let realStock = false;

        readFile("C://Users//denni//Coding Projects//web-scraper//all_tickers.txt", function (err, data) {
            if (err) throw err;
            if(data.includes(politician.getStock())) {
                realStock = true;
            }
        });

        /// Buy or Sell Stocks ///
        if (!currentStocks.includes(politician.getStock().toString()) && !awaitingStocks.includes(politician.getStock().toString()) && politician.getPosition() === 'buy' && politician.getStock() !== 'N/A' && realStock === true) {
            alpaca.createOrder({
                symbol: trades[0].toString(),
                // notional: buyingPower * 0.9,
                qty: 1,
                side: 'buy',
                type: "market",
                time_in_force: 'day'
            })
            console.log("Bought Stock: " + politician.getStock() + " from " + politician.getName())
        } else if (currentStocks.includes(politician.getStock().toString()) && politician.getPosition() === 'sell'  && politician.getStock() !== 'N/A') {
            alpaca.closePosition(politician.getStock().toString())
            console.log("Sold Stock: " + politician.getStock())
        }
    } catch (err) {
        console.log("error")
    }
}


async function main() {
    try {
        const urlMap = await fetchPoliticianUrls('https://www.capitoltrades.com/politicians');
        await Promise.all(Array.from(urlMap.entries()).map(([url, name]) => processUrl(url, name)));
        let currentStocks = await getCurrentStocks();
        console.log("Currently held positions: " + currentStocks)
        app.listen(PORT, () => console.log(`Server running on PORT ${PORT}`));
    } catch (err) {
        console.error('Error processing URLs:', err);
    }
}

//main()