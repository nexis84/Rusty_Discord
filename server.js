const axios = require('axios');
const Bottleneck = require('bottleneck');
const { EmbedBuilder } = require('discord.js');

// Basic configuration
const USER_AGENT = 'nexis-market-bot/1.0 (https://github.com/nexis84)';
const limiter = new Bottleneck({ minTime: 100 }); // ~10 requests/sec

// Example trade hub region IDs (EVE Online): update as needed
const tradeHubRegions = {
  Jita: 10000002,
  Amarr: 10000043,
  Dodixie: 10000032,
  Rens: 10000030,
  Hek: 10000042
};

/**
 * Fetch market data for an item in trade hubs and send as a Discord embed.
 * Replace or import this function into your bot's command handler.
 *
 * @param {string} itemName - Human readable item name used for title
 * @param {number} typeID - EVE Online type ID
 * @param {TextChannel|CommandInteraction} channel - Channel or interaction to reply to
 * @param {number} quantity - Optional quantity multiplier
 */
async function fetchMarketDataTradeHubs(itemName, typeID, channel, quantity = 1) {
  const embed = new EmbedBuilder()
    .setColor(0x0099ff)
    .setTitle(`📊 Market Orders for "${itemName}"${quantity > 1 ? ` x${quantity}` : ''}`)
    .setDescription('Real-time market prices from major trade hubs')
    .setTimestamp();

  let hasData = false;

  for (const [regionName, regionID] of Object.entries(tradeHubRegions)) {
    try {
      const sellOrdersURL = `https://esi.evetech.net/latest/markets/${regionID}/orders/?datasource=tranquility&order_type=sell&type_id=${typeID}`;
      const buyOrdersURL = `https://esi.evetech.net/latest/markets/${regionID}/orders/?datasource=tranquility&order_type=buy&type_id=${typeID}`;

      const [sellOrdersRes, buyOrdersRes] = await Promise.all([
        limiter.schedule(() => axios.get(sellOrdersURL, { headers: { 'User-Agent': USER_AGENT }, validateStatus: status => status >= 200 && status < 500 })),
        limiter.schedule(() => axios.get(buyOrdersURL, { headers: { 'User-Agent': USER_AGENT }, validateStatus: status => status >= 200 && status < 500 }))
      ]);

      if (sellOrdersRes.status !== 200 || buyOrdersRes.status !== 200) {
        console.error(`[fetchMarketDataTradeHubs] Error fetching data for "${itemName}" in region ${regionName} (statuses: ${sellOrdersRes.status}, ${buyOrdersRes.status})`);
        embed.addFields({ name: regionName.toUpperCase(), value: '⚠️ Error fetching data', inline: true });
        continue;
      }

      const sellOrders = Array.isArray(sellOrdersRes.data) ? sellOrdersRes.data : [];
      const buyOrders = Array.isArray(buyOrdersRes.data) ? buyOrdersRes.data : [];

      let sellPrice = 'N/A';
      let buyPrice = 'N/A';

      if (sellOrders.length > 0) {
        const lowestSellOrder = sellOrders.reduce((min, order) => (order.price < min.price ? order : min), sellOrders[0]);
        sellPrice = parseFloat(lowestSellOrder.price * quantity).toLocaleString(undefined, { minimumFractionDigits: 2 });
      } else {
        sellPrice = 'No Sell Orders';
      }

      if (buyOrders.length > 0) {
        const highestBuyOrder = buyOrders.reduce((max, order) => (order.price > max.price ? order : max), buyOrders[0]);
        buyPrice = parseFloat(highestBuyOrder.price * quantity).toLocaleString(undefined, { minimumFractionDigits: 2 });
      } else {
        buyPrice = 'No Buy Orders';
      }

      embed.addFields({ name: regionName.toUpperCase(), value: `Sell: ${sellPrice} ISK\nBuy: ${buyPrice} ISK`, inline: true });
      hasData = hasData || (sellOrders.length > 0 || buyOrders.length > 0);
    } catch (error) {
      console.error(`[fetchMarketDataTradeHubs] Error fetching market data for "${itemName}" in ${regionName}:`, error && error.message ? error.message : error);
      embed.addFields({ name: regionName.toUpperCase(), value: '❗ Error fetching data', inline: true });
    }
  }

  // Send embed or fallback message
  try {
    if (hasData) {
      await channel.send({ embeds: [embed] });
    } else {
      await channel.send(`❌ No market data found for "${itemName}" in any trade hubs. ❌`);
    }
  } catch (sendErr) {
    console.error('[fetchMarketDataTradeHubs] Error sending message:', sendErr && sendErr.message ? sendErr.message : sendErr);
  }
}

module.exports = { fetchMarketDataTradeHubs };

// Example usage (commented):
// const { Client, GatewayIntentBits } = require('discord.js');
// const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
// client.on('messageCreate', async msg => {
//   if (msg.content.startsWith('!market ')) {
//     const args = msg.content.split(' ').slice(1);
//     const itemName = args.join(' ');
//     const typeID = 34; // replace with actual lookup
//     await fetchMarketDataTradeHubs(itemName, typeID, msg.channel, 1);
//   }
// });
// client.login(process.env.DISCORD_TOKEN);