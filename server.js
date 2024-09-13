const functions = require('firebase-functions');

const fs = require('fs').promises
const PORT = 8000;

const express = require('express');
const cheerio = require('cheerio');
const axios = require('axios');

const app = express();

const Alpaca = require('@alpacahq/alpaca-trade-api');
const alpaca = new Alpaca({
    keyId: process.env.APCA_API_KEY_ID, // Add personal alpaca api key
    secretKey: process.env.APCA_API_SECRET_KEY, // Add personal alpaca secret key
    paper: true,
});
 
//// Check if Stock is Real ////

async function isRealStock(stock) {
    try {
        const data = await fs.readFile("C:/Users/denni/Coding Projects/web-scraper/tickers.jsonl", 'utf8');
        return data.includes(stock);
    } catch (err) {
        console.error("Error reading the stock file:", err);
        return false;
    }
}

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
        const response = await axios.get(url);
        const html = response.data;
        const $ = cheerio.load(html);

        const trades = $('.q-field.issuer-ticker').map((i, el) => $(el).text().trim().split(':')[0]).get();
        const buyOrSell = $('.q-field.tx-type').map((i, el) => $(el).text().trim()).get();
        const companyName = $('.q-fieldset.issuer-name').map((i, el) => $(el).text().trim()).get();
        const dateTraded = $('.q-td.q-column--txDate').map((i, el) => $(el).text().trim()).get();
        const politician = new Politician(name, trades[0], buyOrSell[0], companyName[0], dateTraded[0]);

        /// Check if Stock is Real ///
        const realStock = await isRealStock(politician.getStock());

        /// Get Current Stock Information and Buying Power ///
        let currentStocks = await getCurrentStocks();
        let awaitingStocks = await getAwaitingOrders();
        let buyingPower = await getBuyingPower();

        /// Buy or Sell Stocks ///
        if (!realStock) {
            console.log(`Failed to Buy: ${politician.getStock()} is not a valid stock.`);
        } else if (politician.getPosition() === 'buy') {
            if (currentStocks.includes(politician.getStock().toString())) {
                console.log(`Failed to Buy: ${politician.getStock()} is already in the current portfolio.`);
            } else if (awaitingStocks.includes(politician.getStock().toString())) {
                console.log(`Failed to Buy: ${politician.getStock()} is already in awaiting orders.`);
            } else {
                await alpaca.createOrder({
                    symbol: trades[0].toString(),
                    qty: 1,
                    side: 'buy',
                    type: "market",
                    time_in_force: 'day'
                });
                console.log("Bought Stock: " + politician.getStock() + " from " + politician.getName());
            }
        } else if (politician.getPosition() === 'sell') {
            if (!currentStocks.includes(politician.getStock().toString())) {
                console.log(`Failed to Sell: ${politician.getStock()} is not in the current portfolio.`);
            } else if (politician.getStock() === 'N/A') {
                console.log(`Failed to Sell: Stock symbol is 'N/A'.`);
            } else {
                await alpaca.closePosition(politician.getStock().toString());
                console.log("Sold Stock: " + politician.getStock());
            }
        } else {
            console.log(`Failed: No valid action for ${politician.getStock()} from ${politician.getName()}.`);
        }
    } catch (err) {
        console.error("Error processing URL:", err);
    }
}


async function main() {
    try {
        const urlMap = await fetchPoliticianUrls('https://www.capitoltrades.com/politicians');
        await Promise.all(Array.from(urlMap.entries()).map(([url, name]) => processUrl(url, name)));
        let currentStocks = await getCurrentStocks();
        let awaitingOrders = await getAwaitingOrders()
        console.log("Currently held positions: " + currentStocks)
        console.log("Awaiting Orders: " + awaitingOrders)
        //app.listen(PORT, () => console.log(`Server running on PORT ${PORT}`));
    } catch (err) {
        console.error('Error processing URLs:', err);
    }
}

main()


/// To run the program continuously, must connect with a firebase account.

// exports.trader = functions
//     .runWith({ memory: '4GB'})
//     .pubsub.schedule('0 10 * * 1-5')
//     .timeZone('America/New_York')
//     .onRun(async (ctx) => {
//         console.log('This will run M-F at 10:00 AM Eastern!');
//
//         try {
//             const urlMap = await fetchPoliticianUrls('https://www.capitoltrades.com/politicians');
//             await Promise.all(Array.from(urlMap.entries()).map(([url, name]) => processUrl(url, name)));
//             let currentStocks = await getCurrentStocks();
//             let awaitingOrders = await getAwaitingOrders()
//             console.log("Currently held positions: " + currentStocks)
//             console.log("Awaiting Orders: " + awaitingOrders)
//             //app.listen(PORT, () => console.log(`Server running on PORT ${PORT}`));
//         } catch (err) {
//             console.error('Error processing URL:', err);
//         }
//         return null;
//     });
//
