const PORT = 8000;

const express = require('express');
const cheerio = require('cheerio');
const axios = require('axios');

const app = express();

const Alpaca = require('@alpacahq/alpaca-trade-api');
const alpaca = new Alpaca({
    keyId: process.env.API_KEY,
    secretKey: process.env.SECRET_API_KEY,
    paper: true,
});

//// Get Current Positions ////

async function getCurrentStocks() {
    // Get a list of all of our positions.
    const currentStocks = [];
    alpaca.getPositions().then((portfolio) => {
        // Print the quantity of shares for each position.
        portfolio.forEach(function (position) {
            //console.log(`${position.qty} shares of ${position.symbol}`);
            currentStocks.push(position.symbol);
        });
        return currentStocks;
    });
}

//// Makes Trades ////

const Trader = {
    buyStock(stock) {
        alpaca.createOrder({
            symbol: stock,
            qty: 2,
            side: 'buy',
            type: 'market',
            time_in_force: 'day'
        })
    },
    sellStock(stock) {
        alpaca.closePosition(stock)
    }
};

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

    for (let i = 1; i < 19; i++) {
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
    //console.log(urlMap);
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
        const buyOrSell = $('.q-field.tx-type').map((i, el) => ({ type: $(el).text().trim() })).get();
        const companyName = $('.q-fieldset.issuer-name').map((i, el) => ({ company: $(el).text().trim() })).get();
        const dateTraded = $('.q-td.q-column--txDate').map((i, el) => ({ date: $(el).text().trim() })).get();

        const politician = new Politician(name,trades[0],buyOrSell[0],companyName[0],dateTraded[0])
        console.log(politician)
        return politician;
    } catch (err) {
        console.log("error")
    }
}


async function main() {
    try {
        const urlMap = await fetchPoliticianUrls('https://www.capitoltrades.com/politicians');
        await Promise.all(Array.from(urlMap.entries()).map(([url, name]) => processUrl(url, name)));
        app.listen(PORT, () => console.log(`Server running on PORT ${PORT}`));
    } catch (err) {
        console.error('Error processing URLs:', err);
    }
}
main();
