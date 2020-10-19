const Markup = require("telegraf/markup");
const { sessionInit } = require("../sessionInit");
const { transactionInit } = require("../transactionInit");
const { dbLock } = require("../dbLock/dbLock");
const { toggleLock } = require("../dbLock/toggleLock");
const { isBanned } = require("../utils/isBanned");

module.exports.textHandler = async bot => {
  bot.on("text", async ctx => {
    if (ctx.chat.type == "private") {
      privateChat(ctx);
    } else if (ctx.chat.type == "group" || "supergroup") {
      await groupChat(ctx);
    }
  });
};

// Default answer to unknown messages
const privateChat = ctx => {
  ctx.reply(
    `Hello ${ctx.from.first_name} this is ORB bot.\nSee /help for more info.`,
    Markup.keyboard([
      ["/balance", "/help"],
      ["/deposit", "/withdraw"]
    ])
      .oneTime()
      .resize()
      .extra()
  );
};

const groupChat = async ctx => {
  /// Listen for Tip Message from Group Chat
  // RegEx "[number] honk";
  // Example: "10 honk" , " 10honk" , "10 HoNk";

  const re = /[0-9]+ *honk/gi;
  const reComma = /(\d{0,3},)?(\d{3},)?\d{0,3} *honk/i;
  const reDot = /\d*\.?\d* *honk/gi;
  const reClown = /🤡/g;
  const reCircus = /🎪/g;

//  const makeMatch = /\/challenge +[0-9]+/g;
  const makeMatch = /[0-9]+ challenge/gi;

  let text = ctx.message.text;

  if (ctx.message.reply_to_message) {
//    let text = ctx.message.text;
    const banMsg = '🤷‍♂️ Your account has been suspended!';

    if (parseFloat(text.match(reDot)) || parseFloat(text.match(reComma))) {
      text = text.includes(".") ? text.match(reDot)[0] : text.match(reComma)[0];

      if (text.includes(".")) {
        // With dot "[number].[number] honk"
        ctx.replyWithMarkdown(
          `*${ctx.from.first_name}* the lowest amount to give/send/tip is 1 ORB. Please check your amount and try again.`
        );
      } else if (text.includes(",")) {
        // With comma "[number],[number] honk"
        let amount = text.replace(/,/g, "");

        if (isBanned(ctx.from.id)) return ctx.reply(banMsg);
        const tipResult = await tip(ctx, amount);
        ctx.replyWithMarkdown(tipResult);
      } else if (text.match(re)) {
        //"[number] honk"
        let amount = ctx.message.text.match(re)[0].split(" ")[0];

        if (isBanned(ctx.from.id)) return ctx.reply(banMsg);
        const tipResult = await tip(ctx, amount);
        ctx.replyWithMarkdown(tipResult);
      }
    } else if (text.match(reClown) || text.match(reCircus)) {
      // reClown && reCircus
      let amount = 0;
      if (text.match(reClown)) {
        const matchArray = text.match(reClown);
        amount += matchArray.length * 1000;
      }

      if (text.match(reCircus)) {
        const matchArray = text.match(reCircus);
        amount += matchArray.length * 10000;
      }

      if (isBanned(ctx.from.id)) return ctx.reply(banMsg);
      const tipResult = await tip(ctx, amount);
      ctx.replyWithMarkdown(tipResult);
    } else if (text.match(challenge)) {
//      let amount = ctx.message.text.match(re)[0].split(" ")[0];
      // setting challenge amount to 1 for testing purposes
      let amount = 1;
      if (isBanned(ctx.from.id)) return ctx.reply(banMsg);
      const challengeResult = await challenge(ctx, amount);
      ctx.replyWithMarkdown(challengeResult.msg,
        Markup.inlineKeyboard([
          [{
            text: `⚔️ Accept Duel for ${amount} Orb ⚔️`,
            url: challengeResult.url
          }]
        ]).extra()
      );
    }
  }
};

const challenge = async (ctx, amount) => {
  challengeAmount = parseInt(amount);
  const fromUser = ctx.from;
  const toUser = ctx.message.reply_to_message.from;

  if (fromUser.id === toUser.id) return `Cannot battle self`;
//  toggleLock(ctx, toUser.id);
//  toggleLock(ctx, fromUser.id);

  try {
    await dbLock(ctx, fromUser.id);
    if (fromUser.id !== toUser.id) await dbLock(ctx, toUser.id);
  } catch (err) {
    console.log("testHandler:: 🗝 dbLock error while trying make tip:", err);
    return `*${fromUser.first_name}* sorry, try later.`;
  }

  if (toUser.is_bot) {
    if (fromUser.id !== toUser.id) toggleLock(ctx, toUser.id);
    toggleLock(ctx, fromUser.id);
    return `*${fromUser.first_name}* you can't challenge a bot`;
  }

  let playersCombinedMatchID = fromUser.id + toUser.id;
  let challengeUrl = `http://s3-ap-southeast-1.amazonaws.com/test.sphere.com/index.html?match=${playersCombinedMatchID}&amount=${amount}`
  let msg = `${fromUser.first_name} challenges ${toUser.first_name} to ${challengeAmount} ORB`
  return {
    msg: msg,
    url: challengeUrl
  };
}

const tip = async (ctx, amount) => {
  amount = parseInt(amount);
  const fromUser = ctx.from;
  const toUser = ctx.message.reply_to_message.from;

  if (fromUser.id === toUser.id) return `*${fromUser.first_name}*  👏`;
  try {
    await dbLock(ctx, fromUser.id);
    if (fromUser.id !== toUser.id) await dbLock(ctx, toUser.id);
  } catch (err) {
    console.log("testHandler:: 🗝 dbLock error while trying make tip:", err);
    return `*${fromUser.first_name}* sorry, try later.`;
  }
  await sessionInit(ctx);

  // Tip to bot deprecated
  if (toUser.is_bot) {
    if (fromUser.id !== toUser.id) toggleLock(ctx, toUser.id);
    toggleLock(ctx, fromUser.id);
    return `*${fromUser.first_name}* you can't tip to bot`;
  }

  const transactionSuccess = await transactionInit(amount, ctx, toUser);

  if (fromUser.id !== toUser.id) toggleLock(ctx, toUser.id);
  toggleLock(ctx, fromUser.id);

  let msg = "";
  if (transactionSuccess) {
    msg += `*${fromUser.first_name}* sent ${amount.toLocaleString(
      "en-US"
    )} ORB to *${toUser.first_name}*`;
  } else {
    console.log("Need more ORB");
    msg += `*${fromUser.first_name}* you need more ORB`;
  }
  return msg;
};
