// Builds src/lib/emoji/puzzles.json from compact lists. Hand-written and hand-checked: emoji clues
// can't be generated reliably, so this pool is hundreds, not thousands.
import fs from "node:fs";

const compounds = `sunflower ☀️🌻|butterfly 🧈🪰|starfish ⭐🐟|rainbow 🌧️🏹|moonlight 🌙💡|firefly 🔥🪰|football 🦶⚽|snowman ❄️👨|pineapple 🌲🍎|hotdog 🔥🐶|watermelon 💧🍈|cupcake ☕🧁|eyeball 👁️⚽|bookworm 📖🐛|honeymoon 🍯🌙|seahorse 🌊🐴|teapot 🍵🍲|doghouse 🐶🏠|sunglasses ☀️👓|ladybug 👩🐞|spiderweb 🕷️🕸️|goldfish 🥇🐟|starlight ⭐💡|raincoat 🌧️🧥|snowball ❄️⚽|airplane 💨✈️|bathroom 🛁🏠|toothbrush 🦷🖌️|earring 👂💍|sandcastle 🏖️🏰|cowboy 🐄👦|pancake 🍳🍰|notebook 🎵📖|lighthouse 💡🏠|railway 🚂🛣️|handbag ✋👜|bluebird 🔵🐦|blackbird ⚫🐦|greenhouse 🟢🏠|copycat 📋🐱|cheesecake 🧀🍰|horseshoe 🐴👟|doorbell 🚪🔔|newspaper 📰📄|sunburn ☀️🔥|moonwalk 🌙🚶|starship ⭐🚢|fireplace 🔥📍|catwalk 🐱🚶|dragonfly 🐉🪰|houseboat 🏠⛵|waterfall 💧🍂|rainfall 🌧️🍂|snowfall ❄️🍂|sunrise ☀️⬆️|moonstone 🌙🪨|flowerpot 🌸🍲|cornfield 🌽🌾|armchair 💪🪑|daydream ☀️💭|bedbug 🛏️🐛|hotpot 🔥🍲|mailbox 📬📦|postcard 📮🃏|toothpick 🦷⛏️|candlelight 🕯️💡|lunchbox 🍱📦|firewood 🔥🪵|woodpecker 🪵🐦|kingfisher 👑🎣|crossbow ✖️🏹|cowbell 🐄🔔|cowgirl 🐄👧|catfish 🐱🐟|dogfish 🐶🐟|swordfish ⚔️🐟|silverfish 🥈🐟|horsefly 🐴🪰|housefly 🏠🪰|fireman 🔥👨|bedroom 🛏️🚪|wheelchair 🛞🪑|sunday ☀️📅|football 🦶🏈`
  .split("|").map((s) => s.split(" "));

const dishes = [
  ["Butter chicken", "🧈🐔", "an Indian curry"], ["Mango lassi", "🥭🥛", "an Indian drink"], ["Fish curry", "🐟🍛", "a dish"],
  ["Egg curry", "🥚🍛", "a dish"], ["Chicken biryani", "🐔🍚", "a rice dish"], ["Banana chips", "🍌🍟", "a snack"],
  ["Lemon rice", "🍋🍚", "a South Indian dish"], ["Chocolate cake", "🍫🎂", "a dessert"], ["Apple pie", "🍎🥧", "a dessert"],
  ["Ice cream", "🧊🍦", "a dessert"], ["French fries", "🇫🇷🍟", "a side dish"], ["Hot chocolate", "🔥🍫", "a drink"],
  ["Orange juice", "🍊🧃", "a drink"], ["Tomato soup", "🍅🍲", "a soup"], ["Chicken soup", "🐔🍲", "a soup"],
  ["Fried rice", "🍳🍚", "a dish"], ["Corn soup", "🌽🍲", "a soup"], ["Peanut butter", "🥜🧈", "a spread"],
  ["Pav bhaji", "🍞🥘", "an Indian street food"], ["Masala dosa", "🌶️🥞", "a South Indian dish"], ["Paneer tikka", "🧀🍢", "an Indian starter"],
  ["Coconut water", "🥥💧", "a drink"], ["Garlic bread", "🧄🍞", "a side dish"], ["Mushroom pizza", "🍄🍕", "a pizza"],
];
const landmarks = [
  ["Eiffel Tower", "🗼🇫🇷", "France"], ["Great Wall of China", "🧱🇨🇳", "China"], ["Taj Mahal", "🕌💍", "India"], ["Big Ben", "🕰️🇬🇧", "the UK"],
  ["Statue of Liberty", "🗽🇺🇸", "the USA"], ["Colosseum", "🏟️🇮🇹", "Italy"], ["Pyramids of Giza", "🔺🇪🇬", "Egypt"], ["Sydney Opera House", "🎭🇦🇺", "Australia"],
  ["Mount Fuji", "🗻🇯🇵", "Japan"], ["Golden Gate Bridge", "🌉🟠", "the USA"], ["Leaning Tower of Pisa", "🗼🍕", "Italy"], ["Gateway of India", "🚪🇮🇳", "India"],
  ["Red Fort", "🔴🏰", "India"], ["Niagara Falls", "💧🍁", "Canada/USA"], ["Burj Khalifa", "🏙️🇦🇪", "the UAE"],
];
// [emoji, title, aliases..., genre, year, tier]
const films = [
  ["3️⃣🤡🎓", "3 Idiots", "three idiots", "comedy-drama about three friends and the pressure to succeed", 2009, "hard"],
  ["🏏🌾☀️🏘️", "Lagaan", "", "sports drama set under British rule", 2001, "hard"],
  ["🤼‍♀️🥇👨‍👧‍👧", "Dangal", "", "sports biopic about a wrestling family", 2016, "hard"],
  ["🏑🇮🇳🏆👩", "Chak De! India", "chak de|chak de india", "sports drama about a women's hockey team", 2007, "hard"],
  ["🚂👰🇨🇭🌼", "Dilwale Dulhania Le Jayenge", "ddlj", "romance that has run in cinemas for decades", 1995, "expert"],
  ["🚗🇪🇸🤿🐂", "Zindagi Na Milegi Dobara", "znmd", "road-trip story about three friends", 2011, "expert"],
  ["👑🎒🗼", "Queen", "", "comedy-drama about a solo honeymoon", 2014, "hard"],
  ["🌊👑💪🐂", "Baahubali", "bahubali|baahubali the beginning", "epic action film", 2015, "hard"],
  ["🚆💃👫", "Jab We Met", "", "romantic comedy that starts at a railway station", 2007, "hard"],
  ["⭐🌍🎨👦", "Taare Zameen Par", "tare zameen par", "drama about a child who sees the world differently", 2007, "hard"],
  ["🛣️🎤👦", "Gully Boy", "", "musical drama about street rap", 2019, "hard"],
  ["🛰️🌾🔌🇮🇳", "Swades", "", "drama about a scientist who returns to his village", 2004, "hard"],
  ["❤️🏝️👬", "Dil Chahta Hai", "", "coming-of-age comedy-drama about three friends", 2001, "expert"],
  ["🏍️💥🕶️", "Dhoom", "", "action thriller about a gang of thieves on bikes", 2004, "hard"],
  ["🏎️🏁💰", "Race", "", "action thriller", 2008, "hard"],
  ["1️⃣🐯🕵️", "Ek Tha Tiger", "", "spy thriller", 2012, "hard"],
  ["🤼👑🥇", "Sultan", "", "sports drama about a wrestler", 2016, "hard"],
  ["👽🚲📻", "PK", "", "satire comedy-drama about an alien", 2014, "hard"],
  ["🕵️‍♀️🇮🇳💍", "Raazi", "", "spy thriller", 2018, "expert"],
  ["🟠⚔️🏰", "Kesari", "", "war drama about a famous last stand", 2019, "expert"],
  ["🦸3️⃣0️⃣📚", "Super 30", "", "biographical drama about a maths teacher", 2019, "hard"],
  ["🚀🔴👩‍🔬", "Mission Mangal", "", "drama about a space mission", 2019, "expert"],
  ["🎓😂🧑‍🤝‍🧑", "Chhichhore", "chichore", "comedy-drama about friends looking back on their youth", 2019, "expert"],
  ["🎹🙈🎬", "Andhadhun", "", "black comedy thriller about a pianist", 2018, "expert"],
  ["🔥💧⚔️", "RRR", "rrr", "period action epic", 2022, "hard"],
  ["🌸🔥🪵", "Pushpa", "pushpa the rise", "action drama about a smuggler", 2021, "expert"],
  ["⛏️👑🔥", "KGF", "kgf chapter 1|k g f", "action drama set in a gold mine", 2018, "expert"],
  ["0️⃣⭐🎭", "Zero", "", "romantic drama", 2018, "hard"],
  ["👑🔥💃", "Padmaavat", "padmavat", "period drama", 2018, "expert"],
  ["🌅❓🙏", "Kal Ho Naa Ho", "", "romantic drama set in New York", 2003, "expert"],
  ["🩺👨‍🎓😂", "Munna Bhai MBBS", "munna bhai mbbs|munnabhai mbbs", "comedy drama about a gangster with a big heart", 2003, "expert"],
  ["🎨🟠🕊️", "Rang De Basanti", "", "drama about friends and a cause", 2006, "expert"],
  ["🍷💔👑", "Devdas", "", "romantic drama", 2002, "expert"],
  ["😊💉🌹", "Anand", "", "classic drama", 1971, "expert"],
  ["👑💃🏰", "Mughal-e-Azam", "mughal e azam|mughale azam", "historical epic", 1960, "expert"],
];

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const cap = (s) => s[0].toUpperCase() + s.slice(1);
const out = [];
const seen = new Set();
const add = (p) => { if (seen.has(p.title.toLowerCase())) return; seen.add(p.title.toLowerCase()); out.push(p); };

for (const [word, emoji] of compounds)
  add({
    emoji, title: cap(word), answers: [word], tier: "medium",
    hints: [`One word, ${word.length} letters`, "Two smaller words joined together", `Starts with "${word.slice(0, 2)}"`],
  });
for (const [title, emoji, what] of dishes)
  add({
    emoji, title, answers: [norm(title)], tier: "medium",
    hints: [`${title.split(" ").length} words, starts with ${title[0]}`, `It's ${what}`, `The first word has ${title.split(" ")[0].length} letters`],
  });
for (const [title, emoji, where] of landmarks)
  add({
    emoji, title, answers: [norm(title)], tier: "hard",
    hints: [`${title.split(" ").length} words, starts with ${title[0]}`, "A famous landmark", `You'll find it in ${where}`],
  });
for (const [emoji, title, aliases, genre, year, tier] of films)
  add({
    emoji, title, answers: [norm(title), ...aliases.split("|").filter(Boolean).map(norm)], tier,
    hints: [`${title.split(" ").length} word${title.split(" ").length > 1 ? "s" : ""}, starts with ${title[0]}`, `A ${genre}`, `Released in ${year}`],
  });
fs.writeFileSync("src/lib/emoji/puzzles.json", JSON.stringify(out));
const by = (t) => out.filter((p) => p.tier === t).length;
console.log("emoji puzzles:", out.length, { medium: by("medium"), hard: by("hard"), expert: by("expert") });
