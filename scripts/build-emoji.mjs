// Builds src/lib/emoji/puzzles.json. Hand-written: a good emoji clue is a small joke, which can't be generated.
// Keep answers things most people would recognise; a clue is only fun if the answer lands.
// Line format:  emoji | Title | clue | aliases (comma separated, optional)
// The kind ("Movie", "TV show"...) is shown up front; the rest of the hints are revealed after wrong guesses.
import fs from "node:fs";

const SECTIONS = [
  ["medium", "Famous person", `
💡🔌🧔|Thomas Edison|He gave us the practical light bulb|edison
🍎🌳🧠|Isaac Newton|Gravity, after a falling apple|newton
👅🧠📐|Albert Einstein|E = mc²|einstein
👓🕊️🇮🇳|Mahatma Gandhi|Father of the Nation|gandhi
🏏🐐🇮🇳|Sachin Tendulkar|The Master Blaster|sachin,tendulkar
🏏👑🇮🇳|Virat Kohli|Chasemaster, number 18|kohli
🚁🏏🧤|MS Dhoni|Captain Cool and his helicopter shot|dhoni,mahendra singh dhoni
⚽🐐🇦🇷|Lionel Messi|Argentina's number 10|messi
⚽🇵🇹🕺|Cristiano Ronaldo|Siuuu!|ronaldo,cr7
🚀🚗🐦|Elon Musk|Tesla, SpaceX and X|musk
🍎📱👔|Steve Jobs|Black turtleneck, one more thing|jobs
💻🪟💰|Bill Gates|He started Microsoft|gates
👑🐝🎤|Beyoncé|Queen Bey|beyonce
🎤💔🧣|Taylor Swift|The Eras Tour|taylor
🕺🧤🌙|Michael Jackson|The King of Pop|mj
🥊🦋🐝|Muhammad Ali|Float like a butterfly, sting like a bee|ali
⚡🏃🇯🇲|Usain Bolt|The fastest man ever|bolt
🌙🚶‍♂️🧑‍🚀|Neil Armstrong|One small step|armstrong
🎭🖋️💀|William Shakespeare|To be or not to be|shakespeare
🦁🕶️🇮🇳|Shah Rukh Khan|King of Bollywood|srk
👴🎤🇮🇳|Amitabh Bachchan|The Shahenshah of Bollywood|bachchan
🖼️😏🎨|Leonardo da Vinci|He painted the Mona Lisa|da vinci,leonardo
🚀🇮🇳👨‍🔬|A. P. J. Abdul Kalam|The Missile Man of India|abdul kalam,apj abdul kalam,kalam
👑🇬🇧🐕|Queen Elizabeth II|Seventy years on the throne, and her corgis|queen elizabeth,elizabeth
🏀🐐🇺🇸|Michael Jordan|Number 23 of the Chicago Bulls|jordan
🎾👑🇨🇭|Roger Federer|Swiss master of Wimbledon|federer
🏎️🇬🇧🥇|Lewis Hamilton|Seven-time F1 champion|hamilton
`],
  ["hard", "Famous person", `
⚡🌩️🪁|Benjamin Franklin|A kite, a key and a storm|franklin
📱🔔☎️|Alexander Graham Bell|Mr Watson, come here|graham bell,bell
✈️👬🇺🇸|Wright Brothers|Kitty Hawk, 1903|the wright brothers
🧪☢️👩‍🔬|Marie Curie|Two Nobel Prizes in science|curie
🐒🚢🐢|Charles Darwin|On the Origin of Species|darwin
⚡🌀🔌|Nikola Tesla|Rival of Edison|tesla
🎩🧔🇺🇸|Abraham Lincoln|Honest Abe|lincoln
🕊️⛓️🇿🇦|Nelson Mandela|27 years in prison, then president|mandela
✊🗣️💭|Martin Luther King|I have a dream|martin luther king jr,mlk
🚬🇬🇧✌️|Winston Churchill|We shall fight on the beaches|churchill
👩‍⚕️🪔🌙|Florence Nightingale|The Lady with the Lamp|nightingale
🧕🙏🇮🇳|Mother Teresa|Saint of Kolkata|teresa
⚔️👑🏴|Maharana Pratap|Mewar's king on Chetak|rana pratap
⚔️🐎👸🔥|Rani Lakshmibai|The Queen of Jhansi|rani of jhansi,jhansi ki rani
📖🌺🇮🇳|Rabindranath Tagore|He wrote India's national anthem|tagore
🌌🦽🧠|Stephen Hawking|A Brief History of Time|hawking
💰📈👴|Warren Buffett|The Oracle of Omaha|buffett
📕🪄🇬🇧|J. K. Rowling|She created Hogwarts|jk rowling,rowling
🎬🦈👽|Steven Spielberg|He directed Jaws and E.T.|spielberg
🥋🐉👊|Bruce Lee|Be water, my friend|lee
🍳😡🇬🇧|Gordon Ramsay|It's raw!|ramsay
🌳🧒🗣️|Greta Thunberg|How dare you!|thunberg
🎨👂🌻|Vincent van Gogh|Sunflowers and a missing ear|van gogh
🎵🎹🦻|Ludwig van Beethoven|He composed while deaf|beethoven
🎶🌀🇮🇳|A. R. Rahman|Double Oscar winner|ar rahman,rahman
🎧🌙🇮🇳|Lata Mangeshkar|The Nightingale of India|lata
🏃‍♂️🇮🇳🥇|Neeraj Chopra|Olympic gold with a javelin|neeraj
🏸🥈🇮🇳|P. V. Sindhu|India's badminton star|pv sindhu,sindhu
🏎️🇳🇱🏆|Max Verstappen|Red Bull's Dutch champion|verstappen
`],
  ["medium", "Country", `
🗼🥐🍷|France|Paris and baguettes
🍕🛵🏛️|Italy|Rome and pasta
🗻🍣🌸|Japan|Land of the rising sun
🦘🏄🐨|Australia|Down Under
🍁🏒🦫|Canada|Maple syrup and hockey
🐼🧧🧱|China|The Great Wall
🌮🌵🎺|Mexico|Tacos and sombreros
⚽🎭🦜|Brazil|Rio's carnival
🐫🔺🏜️|Egypt|Pharaohs and the Nile
🍺🚗🌭|Germany|Oktoberfest and autobahns
💃🐂🥘|Spain|Flamenco and paella
🗽🦅🍔|United States|Stars and stripes|usa,america,us
☕🫖👑|United Kingdom|Big Ben and the Queen's guards|uk,britain,england,great britain
🐻🪆❄️|Russia|Matryoshka dolls
🕌🥛💍|India|Home of the Taj Mahal
🧀🍫⌚|Switzerland|Alps, cheese and watches
🌷🧀🚲|Netherlands|Tulips, clogs and bicycles|holland
🏛️🫒⚡|Greece|Zeus and the Olympics
🥝🐑🏉|New Zealand|All Blacks and Hobbiton
🌴🐘🏏|Sri Lanka|Island south of India
`],
  ["hard", "Country", `
🥩💃⚽|Argentina|Tango and Messi
🦁🌍💎|South Africa|Table Mountain and Mandela
🦙🏔️🗿|Peru|Machu Picchu
🛺🌶️🐘|Thailand|Pad thai and tuk-tuks
🥢📱🎵|South Korea|K-pop and kimchi|korea
🌋🏝️🦧|Indonesia|Bali and Komodo dragons
🪵❄️🦌|Finland|Land of Santa and saunas
🧊🌋♨️|Iceland|Fire and ice
🥃🐑🎵|Scotland|Bagpipes and kilts
☘️🍀🍺|Ireland|Shamrocks and St Patrick
🐟⛰️🌌|Norway|Fjords and the Northern Lights
🛕🦁🏔️|Nepal|Everest's home
🐅🌾🛶|Bangladesh|Sundarbans and Dhaka
☕🦁👑|Ethiopia|Birthplace of coffee
🥁🏃‍♂️🦒|Kenya|Safaris and marathon runners
🎸🏖️🌴|Jamaica|Reggae and Usain Bolt
🚬🚙🏖️|Cuba|Cigars, old cars and Havana
🍵🕌🛍️|Turkey|Grand Bazaar and kebabs
`],
  ["medium", "City", `
🗼❤️🥖|Paris|City of Love
🗽🍎🚕|New York|The Big Apple|nyc,new york city
🎡☔🚌|London|Red buses and Big Ben
🎬🌴☀️|Los Angeles|Hollywood's home|la
🚣🎭🌊|Venice|Canals and gondolas
🍝🏟️⚔️|Rome|The Colosseum
🌃🍣🗼|Tokyo|Japan's neon capital
🎰💸🌵|Las Vegas|What happens here stays here|vegas
🏙️🏜️💎|Dubai|Burj Khalifa
🎬🚂🌊|Mumbai|Bollywood and the local trains|bombay
💻☕🌳|Bengaluru|India's Silicon Valley|bangalore,bengaluru
🕌🏛️🍛|Delhi|India Gate|new delhi
🐅🍬📚|Kolkata|City of Joy|calcutta
🏖️🎉🐚|Goa|India's beach party|panaji
`],
  ["medium", "Food", `
🍅🧀🍕|Pizza|Slices from Italy
🥩🍞🍔|Burger|Between two buns|hamburger
🍚🐟🥢|Sushi|Rice, fish and seaweed
🌯🌶️🫘|Burrito|A wrapped Mexican meal
🌭🌭🌭|Hot dog|Sausage in a bun|hotdog
🍫🍰🕯️|Birthday cake|Blow out the candles|cake
🍿🎬🌽|Popcorn|Cinema snack
🥔🧂🍟|French fries|Golden sticks|fries,chips
🍩☕👮|Donut|A ring with a hole|doughnut
🥞🍯🧈|Pancakes|Flat breakfast stack|pancake
🍦🍨☀️|Ice cream|Summer's coldest treat
🥛🍌🥤|Milkshake|Thick, cold and sipped
🍚🍗🌶️|Biryani|India's favourite rice dish|chicken biryani
🧈🐔🍛|Butter chicken|Creamy North Indian curry
🍞🥔🌶️|Vada pav|Mumbai's burger
🫓🍳🥔|Paratha|Stuffed flatbread
☕🥛🫚|Chai|India's daily cup|masala chai,tea
🥟🌶️🏔️|Momos|Himalayan dumplings|momo
🍜🥢😋|Noodles|Long, slurped and stir-fried|ramen
🍎🥧🇺🇸|Apple pie|As American as it gets
`],
  ["medium", "Animal", `
🐴⚫⚪|Zebra|Horse in stripes
🐻🎋🖤|Panda|Eats bamboo all day|giant panda
🐦❄️🤵|Penguin|Bird in a tuxedo
🦒🍃📏|Giraffe|Tallest of them all
🐘👂🌊|Elephant|The biggest land animal
🧑‍🍼🦘🦵|Kangaroo|Baby in the pouch
🐢🏠🐌|Tortoise|Slow, with a house on its back|turtle
🦇🌙🩸|Bat|The only flying mammal
🕸️🦵🦵|Spider|Eight legs
🐝🍯🌼|Bee|Makes honey|honeybee
🦋🐛🌸|Butterfly|Starts as a caterpillar
🦉🌙📚|Owl|Wise and awake at night
🐙🦑🌊|Octopus|Eight arms and three hearts
🐦🌈🗣️|Parrot|Repeats everything you say
🦈🎵😱|Shark|Doo doo doo doo doo doo
🐒🍌🌳|Monkey|Swings from trees
`],
  ["hard", "Animal", `
🦘🐨🌿|Koala|Sleeps in eucalyptus trees
🦔🌹👗|Hedgehog|Spiky and rolls into a ball
🦦💤🌊|Otter|Holds hands while asleep
🦥🐢😴|Sloth|The slowest mammal
🦫🪵💧|Beaver|Builds dams
🦜🌈👃|Toucan|That huge colourful beak
🐫🏜️💧|Camel|Humps and no thirst
🦎🎨🌈|Chameleon|Changes colour
🐋💦🎵|Whale|Biggest animal ever
🐬😄🎶|Dolphin|Clever and clicks
🦚👁️🪭|Peacock|India's national bird
🦩💗🦵|Flamingo|Pink on one leg
🐅🇮🇳👑|Tiger|India's national animal
🐎🦄✨|Unicorn|Magical, with a single horn
🐉🔥🏰|Dragon|Mythical fire-breather
`],
  ["medium", "Job", `
👨‍⚕️🩺💊|Doctor|Say aah
👩‍🏫📚✏️|Teacher|Homework-giver
👨‍🚒🔥🚒|Firefighter|Comes with a long hose|fireman
👮🚓🚨|Police officer|Hands up!|police,policeman,cop
👨‍🍳🍳🔪|Chef|Runs a kitchen|cook
✈️👨‍✈️🧢|Pilot|This is your captain speaking
👩‍🚀🚀🌕|Astronaut|Works in space
👨‍🌾🌾🚜|Farmer|Grows the food
💇✂️💈|Barber|Short back and sides|hairdresser
🦷🪥😬|Dentist|Open wide
⚖️👨‍⚖️📜|Judge|Order in the court|lawyer
🧑‍💻☕🐛|Programmer|Turns coffee into code|software engineer,developer,coder
📸👰💡|Photographer|Say cheese
🎬🪑📢|Film director|Lights, camera, action|director
📰🎤✍️|Journalist|Chases the story|reporter
🧑‍🔧🔧🚗|Mechanic|Fixes your car
`],
  ["medium", "Sport", `
🏏🏟️🧢|Cricket|Bat, ball and stumps
⚽🥅👟|Football|The beautiful game|soccer
🏀⛹️🗑️|Basketball|Hoops and dunks
🎾🟡🥎|Tennis|Love means nothing here
🏸🪶🥅|Badminton|Shuttlecock and net
🏊‍♂️🌊🥽|Swimming|Lanes and laps
🏓🏠🛏️|Table tennis|Ping pong|ping pong
🥊🩸🔔|Boxing|Gloves in the ring
⛳🏌️🐦|Golf|Eighteen holes
🏃‍♂️💨🏅|Athletics|Track and field|running,sprint
♟️👑🧠|Chess|Checkmate
🏎️🏁🛞|Formula One|Racing at 300 km/h|f1,formula 1
🏄🌊🦈|Surfing|Riding the waves
🤼🧘🇮🇳|Kabaddi|Hold your breath and raid
🏒❄️⛸️|Ice hockey|Pucks and skates|hockey
⛷️🏔️❄️|Skiing|Down the slopes
`],
  ["medium", "Brand or app", `
🍎📱💻|Apple|Think different
👟✔️🏃|Nike|Just do it
🍔🍟🤡|McDonald's|I'm lovin' it|mcdonalds
☕🧜‍♀️🥤|Starbucks|Your name misspelt on a cup
📺🍿🔴|Netflix|And chill
📦😊🚚|Amazon|Delivers everything
📷🌄❤️|Instagram|Reels and stories|insta
👻💛📸|Snapchat|Streaks and disappearing pictures|snap
🎵🕺📱|TikTok|Short dance videos
▶️📺🔴|YouTube|Like, share and subscribe
💬🟢📞|WhatsApp|Blue ticks
🎧🟢🎶|Spotify|Your year-end Wrapped
🚗📱🧑‍✈️|Uber|Tap and ride|ola
🍕🛵🔴|Zomato|Your food is on the way|swiggy
🐦⬛❌|Twitter|Now called X|x
🔍🌈🌐|Google|Just search it
🧱🟡🧒|Lego|Build anything with bricks
🥤🐻‍❄️🎅|Coca-Cola|Open happiness|coke
⚡🐂🥤|Red Bull|It gives you wings
🛋️🇸🇪🔧|IKEA|Assemble it yourself|ikea
🏎️🐎🇮🇹|Ferrari|The prancing horse
🔋🚗⚡|Tesla|Electric cars
`],
  ["medium", "Festival or event", `
🪔🎆🍬|Diwali|Festival of lights
🎨💦🌈|Holi|Festival of colours
🎄🎅🎁|Christmas|Ho ho ho
🎃👻🍬|Halloween|Trick or treat
🌙🐑🕌|Eid|Moon sighting and feasts|eid al fitr
🐘🙏🥥|Ganesh Chaturthi|Ganpati Bappa Morya|ganpati
🪁☀️🌾|Makar Sankranti|Kites in January|sankranti,pongal,lohri
💃🥁🌙|Navratri|Nine nights of garba|garba
🎊🍾🕛|New Year's Eve|Five, four, three, two, one|new year,new years eve
🥚🐰🌷|Easter|Egg hunts
💘🌹🍫|Valentine's Day|February 14|valentines day
🦃🍂🇺🇸|Thanksgiving|American November feast
🏅🔥🌍|Olympics|Every four years|olympic games
🏏🏆🇮🇳|IPL|India's cricket league|indian premier league
⚽🏆🌍|World Cup|FIFA's biggest prize|fifa world cup
`],
  ["medium", "Everyday thing", `
🌧️☂️💧|Umbrella|Keeps you dry
☀️🕶️🏖️|Sunglasses|Shades
🔑🚪🏠|House key|Don't lose it|key
📱🔋🔌|Phone charger|Low battery saviour|charger
🚿🧼🫧|Shower|Morning wash
⏰😫🛏️|Alarm clock|Snooze it|alarm
🧳✈️🌍|Holiday|Pack your bags|vacation,trip
💍👰🤵|Wedding|I do
🎂🎈🎉|Birthday|Another year older
📚🎒🏫|School|Bell, homework and uniforms
🚗🚦😤|Traffic jam|Stuck on the road|traffic
😴📖🧑‍🎓|Exam|Last-night study panic|exams
🛒🥦🧾|Grocery shopping|Filling the cart|shopping
🌈☀️🌧️|Rainbow|After the rain
⛄❄️🥕|Snowman|Carrot nose
🌋🔥🪨|Volcano|Lava mountain
🌪️💨🏠|Tornado|Twisting wind
🏰👸🐉|Castle|Moat and towers
`],
  ["hard", "Place", `
🕌💍🇮🇳|Taj Mahal|Agra's love letter
🗼🇫🇷🌃|Eiffel Tower|Paris icon
🗽🔥🇺🇸|Statue of Liberty|New York's green lady
🧱🐉🇨🇳|Great Wall of China|Runs for thousands of kilometres|great wall
🔺🐫☀️|Pyramids of Giza|Pharaohs' tombs|pyramids,great pyramid
🕰️🔔🇬🇧|Big Ben|London's chimes
🏔️🥶🧗|Mount Everest|Top of the world|everest
🌊💦🍁|Niagara Falls|Thundering water on the Canada border
🏟️⚔️🇮🇹|Colosseum|Gladiators fought here
🗿🌊🏝️|Easter Island|Giant stone heads
🌉🌁🇺🇸|Golden Gate Bridge|San Francisco's red span|golden gate
🌏🐠🦈|Great Barrier Reef|Australia's coral wonder
🌴🌊🇮🇳|Kerala|God's own country
🏔️❄️🇮🇳|Kashmir|Paradise on earth
🌵🐫🏰|Rajasthan|Forts and deserts
🏞️🌳🐒|Amazon rainforest|Lungs of the Earth|amazon
🏜️🐫☀️|Sahara|World's biggest hot desert|sahara desert
🐧🧊🌍|Antarctica|The frozen continent
`],
  ["expert", "Famous person", `
🦉🍷⚖️|Socrates|He drank the hemlock
📐💧🛁|Archimedes|Eureka!
🗺️🚢🌎|Christopher Columbus|Sailed in 1492|columbus
⚔️🐘🏔️|Hannibal|Crossed the Alps with elephants
👑🐍🇪🇬|Cleopatra|Last pharaoh of Egypt
🥁🏔️🐎|Genghis Khan|Founder of the Mongol Empire
🕵️🥸📖|Agatha Christie|Queen of Crime|christie
🔭🌍⛪|Galileo Galilei|And yet it moves|galileo
⛵🌊🇵🇹|Vasco da Gama|Sea route to India|da gama
👑⚔️🏰🇮🇳|Akbar|Greatest Mughal emperor
🧘🌳☮️|Buddha|Enlightenment under a tree|gautama buddha
🐎⚔️🚩|Shivaji|Maratha warrior king|chhatrapati shivaji,shivaji maharaj
🧘🌺🇮🇳|Swami Vivekananda|Brothers and sisters of America|vivekananda
🔢♾️🇮🇳|Srinivasa Ramanujan|The man who knew infinity|ramanujan
`],
  ["expert", "Country", `
🍫🧇🚲|Belgium|Waffles and Tintin
🐉🏔️😊|Bhutan|Gross National Happiness
🐎🏕️🌾|Mongolia|Yurts and vast steppe
🍷🐓⚽|Portugal|Pastel de nata and Ronaldo
☕💃🌶️|Colombia|Coffee and Shakira
🎻🎶🏔️|Austria|Mozart's birthplace
🌲🍽️🏖️|Lebanon|Cedars and Beirut
🦁🏔️🌋|Tanzania|Kilimanjaro and Serengeti
🌴🐟🏝️|Maldives|Overwater villas
🛕🐘🌾|Cambodia|Angkor Wat
🪴🐉🏮|Vietnam|Pho and Ha Long Bay
🐢🦎🌋|Ecuador|Galápagos and the equator
`],
  ["expert", "Everyday thing", `
🛌🌙🤫|Night owl|Up at 3 am
🐔🏃‍♂️💨|Chicken out|Back away at the last moment
🔇🎉🎧|Silent disco|Everyone in headphones
🧠🌪️💡|Brainstorm|Ideas flying about
🛏️🥞🍳|Breakfast in bed|A lazy treat
🌅🏃🥵|Morning jog|Early exercise|jogging
🐎🐎💨|Horsepower|How engines are measured
🌶️🌶️🥵|Spicy food|Bring a glass of milk
🧟🛋️📺|Couch potato|Stuck on the sofa watching shows
🪙🔄🤞|Coin toss|Heads or tails|toss
🐑💤🔢|Counting sheep|Trying to fall asleep
`],
  ["medium", "Movie", `
🦁👑|The Lion King|A cub, an uncle and a very bad stampede|lion king
🚢🧊💔|Titanic|"I'll never let go"
🦈🏖️😱|Jaws|You're gonna need a bigger boat
🧙‍♂️💍🌋|The Lord of the Rings|One to rule them all|lord of the rings,lotr
⚡👓🧙‍♂️|Harry Potter|The boy who lived
🦖🏝️🧬|Jurassic Park|Life finds a way
🕷️🧑🏙️|Spider-Man|With great power comes great responsibility|spiderman
🐠🔍🌊|Finding Nemo|A dad crosses the ocean for his son|nemo
❄️👸⛄|Frozen|Let it go
🧸🤠🚀|Toy Story|You've got a friend in me
🏠🎈👴|Up|A widower, a Scout and a talking dog
👻🚫🔫|Ghostbusters|Who you gonna call?
🕰️🚗⚡|Back to the Future|You need 88 miles per hour|back to the future
⭐⚔️🌌|Star Wars|A long time ago, in a galaxy far, far away
🤖🚗💥|Transformers|Robots in disguise
💊🕶️🤖|The Matrix|Red pill or blue pill?|matrix
👩‍🚀🌌🌽|Interstellar|Love and time, across a black hole
💤🌀🏙️|Inception|A dream within a dream
🧞‍♂️🪔🐒|Aladdin|Three wishes and a magic carpet
🌹🐃👸|Beauty and the Beast|Be our guest
🧜‍♀️🐚🦀|The Little Mermaid|Part of your world|little mermaid
🐼🥋🍜|Kung Fu Panda|Skadoosh!
🟢👹🍃|Shrek|Ogres are like onions
🐭👨‍🍳🍲|Ratatouille|Anyone can cook
🚗🏁⚡|Cars|Ka-chow!
😀😢😡🧠|Inside Out|The voices in a girl's head
💀🎸🌼|Coco|Remember me
🦸‍♂️👨‍👩‍👧‍👦🔴|The Incredibles|A family of supers|incredibles
🐒🗼✈️|King Kong|A giant ape up a skyscraper
🥊🐯🏃|Rocky|Philadelphia's favourite boxer
🏃🍫🪶|Forrest Gump|Life is like a box of chocolates
🏎️💨👨‍👨‍👦|Fast and Furious|Family. Always family.|the fast and the furious,fast furious
🦸‍♂️🛡️💎|The Avengers|Earth's mightiest heroes|avengers
🏴‍☠️💀🍾|Pirates of the Caribbean|Why is the rum gone?
👸🍎🌳|Snow White|Mirror, mirror on the wall
3️⃣🤪🎓|3 Idiots|All is well|three idiots
👑🗡️🏔️|Baahubali|Why did Kattappa do it?|bahubali
🤼‍♀️🥇👧👧|Dangal|A father trains his daughters to wrestle
🚂🌾💃|Dilwale Dulhania Le Jayenge|Palat. Palat. Palat.|ddlj
🏏🌧️👑|Lagaan|A cricket match to cancel a tax
🔥💧🏃|RRR|Naatu Naatu
`],
  ["medium", "TV show", `
👑🐉❄️|Game of Thrones|Winter is coming|got
🧪💎🚐|Breaking Bad|A chemistry teacher breaks bad
🛋️☕👫|Friends|I'll be there for you
📎🏢📹|The Office|That's what she said|office
🔦🚲👾|Stranger Things|Something's wrong in Hawkins
🟡🍩👨‍👩‍👧‍👦|The Simpsons|D'oh!|simpsons
🧽🍍🌊|SpongeBob SquarePants|Who lives in a pineapple under the sea?|spongebob
🔴🟢🦑|Squid Game|Red light, green light
💸🎭🇪🇸|Money Heist|Bella ciao|la casa de papel
🐭🧀🐱|Tom and Jerry|The chase never ends
🕵️🎻🇬🇧|Sherlock|Elementary, my dear Watson
🔬🤓🌌|The Big Bang Theory|Bazinga!|big bang theory
🧔🐶🐭|Scooby-Doo|Those meddling kids!|scooby doo
🐱🤖🔔|Doraemon|A robot cat from the future
`],
  ["medium", "Phrase", `
🍰🚶|Piece of cake|Very easy
🌧️🐱🐶|Raining cats and dogs|Very heavy rain
🐘🏠|Elephant in the room|The thing no one mentions
🐦🐦🪨|Kill two birds with one stone|One action, two results
🔨🧊|Break the ice|Get a conversation going
⏰💰|Time is money|Don't waste it
🌙🔁💙|Once in a blue moon|Very rarely
🍎👁️|Apple of my eye|Someone you adore
🦘🔫|Jump the gun|Start too early
🐱👜|Let the cat out of the bag|Reveal a secret
🐕🗣️🌳❌|Barking up the wrong tree|Blaming the wrong person
🦵💔|Break a leg|What you say before someone goes on stage
🥚🐔|Chicken and egg|Which came first?
😭🥛|Crying over spilt milk|No use doing this
🐛🌅🐦|The early bird catches the worm|Getting up first pays off|early bird catches the worm,early bird gets the worm
🍌🏃|Go bananas|Lose your mind
👄🤐🔒|Lips are sealed|I won't tell
🕳️🐇|Down the rabbit hole|Lost in something strange and absorbing|rabbit hole
✋🐎🐎|Hold your horses|Wait a moment
📖⚖️🚫|Don't judge a book by its cover|Looks can deceive
🍒👌|Cherry pick|Choose only the best
🔥🌉|Burn your bridges|Destroy your way back|burning bridges
`],
  ["medium", "Character", `
🍄👨‍🔧🐢|Mario|It's-a me!
🦔💨💍|Sonic|He gotta go fast|sonic the hedgehog
⚡🐭🔴|Pikachu|Pika pika
🦸‍♂️🔴🔵|Superman|Faster than a speeding bullet
🦇🧑🌃|Batman|The world's greatest detective
🧙‍♂️🧔🪄|Gandalf|You shall not pass
🟢🧘‍♂️⭐|Yoda|Do or do not, there is no try
🤖💛🗑️|WALL-E|He cleans up Earth|walle,wall e
🦾🔴👨|Iron Man|He is Tony Stark|ironman
🔨⚡🌩️|Thor|God of thunder
😾🍝📅|Garfield|Hates Mondays, loves lasagna
🐰🥕🗣️|Bugs Bunny|What's up, doc?
🟡👓🍌|Minion|Banana!|minions
🦆💢🧢|Donald Duck|Disney's short-tempered sailor
🐭🎩✨|Mickey Mouse|The face of Disney
🌊👧🐔|Moana|How far she'll go
🧔🏴‍☠️🦜|Jack Sparrow|Captain, if you please|captain jack sparrow
`],

  ["hard", "Movie", `
🎭🦸🤡|Joker|We live in a society
🏹🔥🍽️|The Hunger Games|May the odds be ever in your favour|hunger games
☂️👩‍🦰🎶|Mary Poppins|Practically perfect in every way
🕵️‍♂️🍸0️⃣0️⃣7️⃣|James Bond|Shaken, not stirred|007,bond
🏠👦😱🎄|Home Alone|Keep the change, ya filthy animal
⛏️⚔️🇮🇳|K.G.F|Rocky rises from a gold mine|kgf
🌸🔥🪓|Pushpa|Flower nahi, fire hai
🛣️🎤👦|Gully Boy|Apna time aayega
🏍️💥🕶️|Dhoom|Thieves on superbikes
🌟🎨👦|Taare Zameen Par|Every child is special|taare zameen par
🏑👩🇮🇳|Chak De! India|Women's hockey glory|chak de india,chak de
🧑‍⚕️🤗😂|Munna Bhai MBBS|Jaadu ki jhappi|munnabhai mbbs,munna bhai
`],
  ["hard", "TV show", `
📅🖤✋|Wednesday|An Addams at school
💰❓🎤🇮🇳|Kaun Banega Crorepati|Lock kiya jaye?|kbc
`],
  ["hard", "Book", `
🐇⏰🫖|Alice in Wonderland|We're all mad here|alices adventures in wonderland
🧛‍♂️🏰🦇|Dracula|Bram Stoker's count
🧟‍♂️⚡🔬|Frankenstein|Mary Shelley's creature
🌴📖🐻🐍|The Jungle Book|Bare necessities|jungle book
🐢🐇🏁|The Tortoise and the Hare|Slow and steady wins the race
🧑‍🌾🐄🌱|Jack and the Beanstalk|Fee-fi-fo-fum
`],
  ["hard", "Phrase", `
🐘🧠|An elephant never forgets|Good memory
🍳🥚🥚🥚|Don't put all your eggs in one basket|Spread the risk
🤏🐟🌊|Big fish in a small pond|Important only in a small place
🌳🌲👀🚫|Can't see the wood for the trees|Lost in the details|cant see the forest for the trees,cant see the wood for the trees
🧂🩹|Rub salt in the wound|Make it hurt more|salt in the wound
🐺🐑👕|Wolf in sheep's clothing|Danger dressed as innocence
🐒👀🐒🤸|Monkey see monkey do|Copying without thinking
🤝🍰🍴|Have your cake and eat it too|Want both
🥫🪱|Can of worms|A problem that creates more problems
🍋🍹|When life gives you lemons|Make lemonade
🐈👅|Cat got your tongue|Why so quiet?
🪡🌾|Needle in a haystack|Almost impossible to find
🥶🦶|Cold feet|Nerves before a big step
⛈️🫖|Storm in a teacup|A big fuss about nothing
`],
  ["hard", "Song", `
🐅👁️🥊|Eye of the Tiger|The Rocky III anthem
🧟🕺🌙|Thriller|Michael Jackson, zombies, midnight
🔷🫵💃|Shape of You|Ed Sheeran's biggest
🏆🔥🎶🇮🇳|Jai Ho|Slumdog Millionaire's finale
`],

  ["expert", "Movie", `
🐴🛏️🤵🇮🇹|The Godfather|An offer he can't refuse|godfather
`],
  ["expert", "TV show", `
`],
  ["expert", "Book", `
🦶💍🐉|The Hobbit|There and back again|hobbit
`],
  ["expert", "Phrase", `
🐖🪽|When pigs fly|Never
🛁👶💧|Throw the baby out with the bathwater|Discard the good with the bad
🐦🖐️🌳🌳|A bird in the hand|Is worth two in the bush|a bird in the hand is worth two in the bush,bird in the hand
💨🪞|Smoke and mirrors|Clever deception
🙇🥧|Humble pie|Eat this after being proved wrong|eat humble pie
🥄👄🥇|Born with a silver spoon|Inherited privilege|silver spoon
🐇🎩|Pull a rabbit out of a hat|A sudden surprise fix
🌂⛈️🌞|Save it for a rainy day|Keep some for later|rainy day
🥇🦢🥚|Kill the goose that lays the golden eggs|Destroy your own source of wealth|goose that lays the golden eggs,killing the golden goose
`],
  ["expert", "Character", `
🧤💎🫰|Thanos|Perfectly balanced, as all things should be
🐍🧙‍♂️🚫👃|Voldemort|He who must not be named|lord voldemort
🧸🚗🤪|Mr Bean|Rowan Atkinson's silent chaos
🧔🐺🔪|Wolverine|Adamantium claws
`],
];

const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();
const out = [];
const seen = new Set();
for (const [tier, kind, block] of SECTIONS)
  for (const line of block.trim().split("\n").filter(Boolean)) {
    const [emoji, title, clue, aliases = ""] = line.split("|");
    if (!clue) throw new Error(`bad line: ${line}`);
    if (seen.has(norm(title))) continue;
    seen.add(norm(title));
    const words = title.split(/\s+/).length;
    out.push({
      emoji, title, kind, tier,
      answers: [...new Set([norm(title), ...aliases.split(",").filter(Boolean).map(norm)])],
      hints: [`${words} word${words > 1 ? "s" : ""}`, clue, `Starts with "${title.replace(/^(The|A|An) /, "")[0].toUpperCase()}"`],
    });
  }
fs.writeFileSync("src/lib/emoji/puzzles.json", JSON.stringify(out));
const count = (f) => out.filter(f).length;
console.log("emoji puzzles:", out.length, Object.fromEntries(["medium", "hard", "expert"].map((t) => [t, count((p) => p.tier === t)])), Object.fromEntries([...new Set(out.map((p) => p.kind))].map((k) => [k, count((p) => p.kind === k)])));
