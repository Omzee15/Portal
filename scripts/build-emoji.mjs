// Builds src/lib/emoji/puzzles.json. Hand-written: a good emoji clue is a small joke, which can't be generated.
// Line format:  emoji | Title | clue | aliases (comma separated, optional)
// The kind ("Movie", "TV show"...) is shown up front; the rest of the hints are revealed after wrong guesses.
import fs from "node:fs";

const SECTIONS = [
  ["medium", "Movie", `
🦁👑|The Lion King|A cub, an uncle and a very bad stampede|lion king
🚢🧊💔|Titanic|"I'll never let go"
🦈🏖️😱|Jaws|You're gonna need a bigger boat
👽🚲🌕|E.T.|He only wants to phone home|et,et the extra terrestrial
🧙‍♂️💍🌋|The Lord of the Rings|One to rule them all|lord of the rings,lotr
⚡👓🧙‍♂️|Harry Potter|The boy who lived
🦖🏝️🧬|Jurassic Park|Life finds a way
🕷️🧑🏙️|Spider-Man|With great power comes great responsibility|spiderman
🦇🃏🌃|The Dark Knight|Why so serious?|dark knight,batman
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
🍫🏭🎫|Charlie and the Chocolate Factory|A golden ticket and a very odd host|willy wonka,charlie and the chocolate factory
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
🎈🤡😱|It|Beware of the sewer drain
⚔️💛👰|Kill Bill|Revenge, in a yellow jumpsuit
🏎️💨👨‍👨‍👦|Fast and Furious|Family. Always family.|the fast and the furious,fast furious
🦸‍♂️🛡️💎|The Avengers|Earth's mightiest heroes|avengers
🐻🍯🎈|Winnie the Pooh|A bear of very little brain
🏴‍☠️💀🍾|Pirates of the Caribbean|Why is the rum gone?
🧑‍🚀🥔🔴|The Martian|He has to science the heck out of it|martian
🍝🐶🌹|Lady and the Tramp|The most romantic plate of spaghetti
🦌👑🌲|Bambi|Bring tissues
🐘🎪👂|Dumbo|He flies with his ears
🪵👦👃|Pinocchio|Lying has consequences
👸🍎🌳|Snow White|Mirror, mirror on the wall
🕶️👔🛸|Men in Black|Don't look at the flash
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
👑🇬🇧💍|The Crown|The Windsors, dramatised|crown
🚶🧟|The Walking Dead|Don't get bitten|walking dead
🕵️🎻🇬🇧|Sherlock|Elementary, my dear Watson
🔬🤓🌌|The Big Bang Theory|Bazinga!|big bang theory
🩻🩺💔|Grey's Anatomy|Seattle's most dramatic hospital|greys anatomy
🧔🐶🐭|Scooby-Doo|Those meddling kids!|scooby doo
🐱🤖🔔|Doraemon|A robot cat from the future
🎤😁🏫|Glee|A high-school choir sings its feelings
🐻👨‍🍳🥪|The Bear|Yes, chef|bear
👑📺💼👨‍👧‍👦|Succession|Who gets the company?
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
🐝👒|Bee in your bonnet|Obsessed with an idea
😭🥛|Crying over spilt milk|No use doing this
🐛🌅🐦|The early bird catches the worm|Getting up first pays off|early bird catches the worm,early bird gets the worm
🪣🦶|Kick the bucket|To die
🌟👀|Seeing stars|After a bump on the head
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
🧊🐿️🌰|Scrat|Ice Age's unlucky acorn chaser
🦆💢🧢|Donald Duck|Disney's short-tempered sailor
🐭🎩✨|Mickey Mouse|The face of Disney
👩‍🦰🏹🐻|Merida|Brave's archer princess
🌊👧🐔|Moana|How far she'll go
🧔🏴‍☠️🦜|Jack Sparrow|Captain, if you please|captain jack sparrow
`],

  ["hard", "Movie", `
🦇🔙🐧|Batman Returns|Penguin and Catwoman, one film
👸🇷🇺❄️|Anastasia|A lost Russian princess
🌽⚾👻|Field of Dreams|If you build it, he will come
🐖🕷️🕸️|Charlotte's Web|Some pig
🏫🎸🎤|School of Rock|Jack Black gets a job as a sub
🥋🧓🪰|The Karate Kid|Wax on, wax off|karate kid
🌍🐒🗽|Planet of the Apes|Get your hands off me
🛸🌾🧢|Signs|Mel Gibson, crop circles and tinfoil hats
👻🏺💕|Ghost|Pottery, but romantic
🔝🔫✈️|Top Gun|I feel the need, the need for speed
⛰️🤠💕|Brokeback Mountain|I wish I knew how to quit you
🧙‍♀️🌪️👠|The Wizard of Oz|There's no place like home|wizard of oz
🎬🌆💃🎶|La La Land|Here's to the ones who dream
🐺🏦💰|The Wolf of Wall Street|Jordan Belfort's excess|wolf of wall street
🧠✨🔢|A Beautiful Mind|John Nash's story
🕰️🍊|A Clockwork Orange|Ludwig van and the old ultraviolence|clockwork orange
🍫🇫🇷|Chocolat|A sweet shop scandalises a French village
👊🧼|Fight Club|The first rule is you don't talk about it
✈️🐍😤|Snakes on a Plane|Exactly what it says
🐦😱🏘️|The Birds|Hitchcock's flock|birds
🚿🔪🏨|Psycho|Don't book the Bates Motel
🎭🦸🤡|Joker|We live in a society
🐅🚤🥧|Life of Pi|A boy, a boat and a tiger|life of pi
🌍🛰️🎈|Gravity|Sandra Bullock, alone in orbit
🛸🎹⛰️|Close Encounters of the Third Kind|Five notes to talk to aliens
👶💼|The Boss Baby|Alec Baldwin in a nappy|boss baby
🦁🧙‍♀️🚪❄️|The Chronicles of Narnia|Through the wardrobe|narnia,the lion the witch and the wardrobe
🏹🔥🍽️|The Hunger Games|May the odds be ever in your favour|hunger games
🐶🥩🎬|John Wick|They shouldn't have killed the dog
🏨🇭🇺🎂|The Grand Budapest Hotel|Wes Anderson's pink hotel|grand budapest hotel
☂️👩‍🦰🎶|Mary Poppins|Practically perfect in every way
👸🐸🎷|The Princess and the Frog|Tiana's New Orleans|princess and the frog
🎵🏔️👩‍🏫|The Sound of Music|The hills are alive|sound of music
🕵️‍♂️🍸0️⃣0️⃣7️⃣|James Bond|Shaken, not stirred|007,bond
🌅🧟🛒|Dawn of the Dead|Zombies at the mall
💈🪒🥧|Sweeney Todd|The demon barber
💧🌍🚤|Waterworld|Kevin Costner's floating dystopia
🐟💧👩🏻|The Shape of Water|Del Toro's fish-man romance|shape of water
🏃‍♀️🔴💰|Run Lola Run|Three tries to find the money
🏎️⚔️🏎️🇮🇹|Ford v Ferrari|Le Mans, 1966|le mans 66
🐭👦🏠|Stuart Little|A mouse is adopted
💃🕺🍉|Dirty Dancing|Nobody puts Baby in a corner
🏫👑💅|Mean Girls|On Wednesdays we wear pink
⚖️👩‍🦳💖|Legally Blonde|What, like it's hard?
🤖👩🔒|Ex Machina|Is she conscious?
🚪👁️🧵|Coraline|A door to the Other Mother
🐢🍕🥷|Teenage Mutant Ninja Turtles|Cowabunga|ninja turtles,tmnt
🏝️🏐🧔|Cast Away|WILSON!
👶🚗🎧|Baby Driver|An iPod-powered getaway
🔪🏃🌧️🤖|Blade Runner|Tears in rain
🏠👦😱🎄|Home Alone|Keep the change, ya filthy animal
💀📜🧑‍🏫|Dead Poets Society|O Captain! My Captain!
⛏️⚔️🇮🇳|K.G.F|Rocky rises from a gold mine|kgf
🎹🕶️🔪|Andhadhun|A pianist who may or may not see
🌸🔥🪓|Pushpa|Flower nahi, fire hai
🛣️🎤👦|Gully Boy|Apna time aayega
🌅❓🙏|Kal Ho Naa Ho|Live now, tomorrow may not come
🏍️💥🕶️|Dhoom|Thieves on superbikes
🌟🎨👦|Taare Zameen Par|Every child is special|taare zameen par
🏑👩🇮🇳|Chak De! India|Women's hockey glory|chak de india,chak de
🚗🇪🇸🤿🐂|Zindagi Na Milegi Dobara|A road trip through Spain|znmd
👽📻🧑|PK|An alien asks about religion
🧑‍⚕️🤗😂|Munna Bhai MBBS|Jaadu ki jhappi|munnabhai mbbs,munna bhai
🌠🔄👫|Your Name|Two teens swap bodies|kimi no na wa
🛁🐖🐉|Spirited Away|Chihiro's parents turn into pigs
🐖✈️🇮🇹|Porco Rosso|A pig who flies seaplanes
🌳🚌🐈|My Neighbour Totoro|A giant fluffy forest spirit|my neighbor totoro,totoro
🏠🪳🇰🇷|Parasite|Two Korean families, one basement
`],
  ["hard", "TV show", `
🧢🪒🥃🇬🇧|Peaky Blinders|By order of the...
🧪🧑‍🦳🛸|Rick and Morty|Wubba lubba dub dub
📅🖤✋|Wednesday|An Addams at school
🍕🤖🚀|Futurama|Good news, everyone!
🏠🩺💊|House|Everybody lies
😠👨🚬🥃|Mad Men|Advertising in the 1960s
🏝️✈️❓|Lost|Oceanic Flight 815
👔👔⚖️|Suits|Harvey and Mike
✨😵💊🏫|Euphoria|Teen chaos in glitter
🧛‍♀️🪵🏫|Buffy the Vampire Slayer|Sunnydale's chosen one|buffy
🟡🪨🤠🐎|Yellowstone|Montana ranch drama
🏴‍☠️🪓⚔️|Vikings|Ragnar Lothbrok's raids
🚀👨‍🚀🤖|Star Trek|To boldly go
🕵️⏰💣|24|Jack Bauer, in real time
🐻‍❄️🧊🏠|The Last of Us|Joel, Ellie and a fungus|last of us
🌾🍽️👑|The Great British Bake Off|Soggy bottoms|bake off
💰❓🎤🇮🇳|Kaun Banega Crorepati|Lock kiya jaye?|kbc
🏘️🧑‍💼🪑🇮🇳|Panchayat|A city boy runs a village office
🏘️👨‍👩‍👧‍👦🕵️|The Family Man|A spy with a mortgage|family man
🔫🏡🇮🇳|Mirzapur|Kaleen Bhaiya's empire
🆕👨‍👩‍👧‍👦📹|Modern Family|Mockumentary in LA
🐍🥋🏆|Cobra Kai|The Karate Kid, 34 years on
🧛🌆💘|The Vampire Diaries|Mystic Falls' love triangle|vampire diaries
🔥🍳😡|Hell's Kitchen|Gordon Ramsay shouts|hells kitchen,masterchef
⚫🕳️⏳|Dark|Winden's time travellers
🧙‍♂️🐺🗡️|The Witcher|Toss a coin|witcher
`],
  ["hard", "Book", `
🐋📖⚓|Moby-Dick|The whale wins|moby dick
🐭🐭👨👨|Of Mice and Men|George and Lennie
🔥📖🌡️|Fahrenheit 451|The temperature books burn at
🐦🚫🔫⚖️|To Kill a Mockingbird|Atticus Finch defends a man
🐖🐎🚜|Animal Farm|All animals are equal
👁️📺✍️|Nineteen Eighty-Four|Big Brother is watching|1984
🐇⏰🫖|Alice in Wonderland|We're all mad here|alices adventures in wonderland
🍾🟢💡|The Great Gatsby|Old sport|great gatsby
🖼️🔍🧩|The Da Vinci Code|Robert Langdon in the Louvre|da vinci code
🧛‍♂️🏰🦇|Dracula|Bram Stoker's count
🧟‍♂️⚡🔬|Frankenstein|Mary Shelley's creature
🌴📖🐻🐍|The Jungle Book|Bare necessities|jungle book
🏝️🐖🐚|Lord of the Flies|Boys, a conch and a pig's head
🐱🎩|The Cat in the Hat|Dr Seuss's troublesome guest|cat in the hat
🐢🐇🏁|The Tortoise and the Hare|Slow and steady wins the race
🧑‍🌾🐄🌱|Jack and the Beanstalk|Fee-fi-fo-fum
👑🧒🦊🌹|The Little Prince|What is essential is invisible to the eye|little prince
🧒💨🌎|Around the World in 80 Days|Phileas Fogg's bet|around the world in eighty days
🦁🦁🤨👗|Pride and Prejudice|Mr Darcy and Elizabeth
🌊🧔🐟|The Old Man and the Sea|Hemingway's marlin|old man and the sea
🐑🏜️🪙✨|The Alchemist|A shepherd follows his Personal Legend|alchemist
`],
  ["hard", "Phrase", `
🐘🧠|An elephant never forgets|Good memory
🍳🥚🥚🥚|Don't put all your eggs in one basket|Spread the risk
🤏🐟🌊|Big fish in a small pond|Important only in a small place
🐎🚫👄|Straight from the horse's mouth|From the source itself
🌳🌲👀🚫|Can't see the wood for the trees|Lost in the details|cant see the forest for the trees,cant see the wood for the trees
🐂🍽️🏪|Bull in a china shop|Clumsy in a delicate situation
🧂🩹|Rub salt in the wound|Make it hurt more|salt in the wound
🐺🐑👕|Wolf in sheep's clothing|Danger dressed as innocence
🐒👀🐒🤸|Monkey see monkey do|Copying without thinking
2️⃣🪙🗣️|My two cents|A small opinion|two cents
🤝🍰🍴|Have your cake and eat it too|Want both
🌀🧶|Spin a yarn|Tell a long tale
🥫🪱|Can of worms|A problem that creates more problems
🍋🍹|When life gives you lemons|Make lemonade
✂️🟡🫙|Cut the mustard|Be good enough
🐈👅|Cat got your tongue|Why so quiet?
👃⛏️🪨|Nose to the grindstone|Hard at work
🪡🌾|Needle in a haystack|Almost impossible to find
🥶🦶|Cold feet|Nerves before a big step
🦚🪶|Proud as a peacock|Showing off
⛈️🫖|Storm in a teacup|A big fuss about nothing
🌄🐄🏠|Till the cows come home|For a very long time
🎻🔥🏛️|Fiddling while Rome burns|Busy with nothing during a crisis
`],
  ["hard", "Song", `
☔💜🎸|Purple Rain|Prince's signature
🐅👁️🥊|Eye of the Tiger|The Rocky III anthem
💃👑|Dancing Queen|Young and sweet, only seventeen
🌉🌊🎵|Bridge Over Troubled Water|Simon & Garfunkel's comfort
🏨🌵🎸|Hotel California|You can check out any time you like
🙏🎤💃|Like a Prayer|Madonna, 1989
👑🎤🎭|Bohemian Rhapsody|Is this the real life?
🌧️🎤😁|Singin' in the Rain|A musical classic|singing in the rain
🌀🌊🎤|Rolling in the Deep|Adele's heartbreak
🎵🦁😴|The Lion Sleeps Tonight|In the jungle, the mighty jungle|lion sleeps tonight
🧊🧊👶|Ice Ice Baby|Vanilla Ice's riff
🟡🚢🐙|Yellow Submarine|We all live in one
💎✨🌌|Diamonds|Rihanna: shine bright
👉☀️🎶|Here Comes the Sun|George Harrison's best
☔💃🎤|Umbrella|Ella, ella, eh, eh
🧟🕺🌙|Thriller|Michael Jackson, zombies, midnight
🔷🫵💃|Shape of You|Ed Sheeran's biggest
🏆🔥🎶🇮🇳|Jai Ho|Slumdog Millionaire's finale
`],

  ["expert", "Movie", `
🎓💋👩‍🦳🚌|The Graduate|Plastics, and Mrs Robinson|graduate
🦋🌍🌀|The Butterfly Effect|Small changes, huge results|butterfly effect
📸🧠🔙|Memento|Tattoos, polaroids, backwards
✂️☝️🇮🇪🫏|The Banshees of Inisherin|Two friends fall out on an Irish island|banshees of inisherin
👍👎🤢🤠|The Good, the Bad and the Ugly|That whistle|good the bad and the ugly
🐴🛏️🤵🇮🇹|The Godfather|An offer he can't refuse|godfather
🐟⬆️👨‍👦|Big Fish|A son unpicks his dad's tall tales
🌙💡👦🌊|Moonlight|Three chapters of Chiron's life
🍝🙏❤️|Eat Pray Love|A divorcée's three-country reset
🦫🔁📅|Groundhog Day|Same day, again and again
🌌🌀👁️🦴|2001: A Space Odyssey|I'm sorry, Dave|2001 a space odyssey,2001
🐝🎬⚖️|Bee Movie|Barry B. Benson sues humanity
🏝️🚪🌀|Shutter Island|Is he really a marshal?
🚂❄️🌍|Snowpiercer|A class war on a train
🐜🧑|Ant-Man|Paul Rudd, very small
🏜️🪐🐛|Dune|Fear is the mind-killer
👧👦🌽😈|Children of the Corn|Stephen King's cult kids
🐖🐑🏆|Babe|That'll do, pig
🍔💼💉🕺|Pulp Fiction|Royale with cheese
🔥🏦🔫👮|Heat|De Niro and Pacino in a diner
😱🔪📞|Scream|What's your favourite scary movie?
🪙🔫👴🚫|No Country for Old Men|Call it, friend-o
👶😈🌿🏢|Rosemary's Baby|Polanski's Manhattan
🌃🛣️🚕|Taxi Driver|You talkin' to me?
👽🥚🚀|Alien|In space, no one can hear you scream
🔨🐙🚪🇰🇷|Oldboy|Fifteen years locked up, and a hammer
🚂🧑‍✈️🔪|Murder on the Orient Express|Poirot in the snow
🖤🦢🩰|Black Swan|Natalie Portman unravels
🤫🐑|The Silence of the Lambs|Fava beans and a nice Chianti|silence of the lambs
🔘⏪👶👴|The Curious Case of Benjamin Button|A man ages backwards|benjamin button
🛰️🌌👽📻|Contact|Jodie Foster hears a signal
👩‍🏫🛸🐙🔤|Arrival|Linguists meet heptapods
🖨️⚾💥🏢|Office Space|PC Load Letter?
3️⃣0️⃣🧮🧑‍🏫|Super 30|A maths teacher's coaching class
🟠⚔️🏰|Kesari|21 Sikhs at Saragarhi
🎨🕊️🟠|Rang De Basanti|Friends turn into revolutionaries
👑🏰💃|Mughal-e-Azam|Pyar kiya toh darna kya|mughal e azam
😊💉🌹|Anand|Babumoshai
🐍🔫🇮🇳|Gangs of Wasseypur|Keh ke lunga
🪖🐯🕵️‍♂️|Raazi|A young Indian spy marries in Pakistan
🚗💩👨‍👧|Piku|A daughter, a father and a constipated road trip
`],
  ["expert", "TV show", `
❄️💰🇨🇴|Narcos|Plata o plomo
🧠🍽️🔪|Hannibal|Mads Mikkelsen, elaborately plated
✂️🧠🏢|Severance|Work you is not home you
🌆🌃🚪❓|The Twilight Zone|Rod Serling's fifth dimension|twilight zone
⚪🪷🏝️|The White Lotus|Rich guests behave badly|white lotus
🧑‍⚖️🌵🪙|Better Call Saul|Slippin' Jimmy|saul goodman
🔌📞🚔|The Wire|Baltimore, block by block|wire
🤖👨‍💻🎭|Mr. Robot|Hello, friend|mr robot
👑♟️👩‍🦰|The Queen's Gambit|Beth Harmon's chess|queens gambit
⚫🪞📱|Black Mirror|Tech gone wrong
🔫❄️🪵💰|Fargo|Minnesota nice, then murder
🐈‍⬛🧹🖤|Sabrina the Teenage Witch|Salem talks back|sabrina
🩺😂🧹|Scrubs|Sacred Heart's JD
📡🛸🕵️‍♀️|The X-Files|The truth is out there|x files
🏛️🍕🧑‍💼|Parks and Recreation|Treat yo self|parks and rec
🐙🕵️🌀|Gravity Falls|Dipper and Mabel's summer
🌿💵🏘️|Weeds|A suburban mum sells pot
`],
  ["expert", "Book", `
🐇🐇🌾💧|Watership Down|Rabbits flee a warren
👰🔥🏰|Rebecca|Last night I dreamt I went to Manderley
🏃💡🏠|To the Lighthouse|Woolf's Ramsay family
🐖🐂🕵️‍♂️|The Hound of the Baskervilles|A spectral dog on the moor|hound of the baskervilles
👍🌌📕|The Hitchhiker's Guide to the Galaxy|Don't panic|hitchhikers guide to the galaxy
🥫🥁|The Tin Drum|Oskar refuses to grow up|tin drum
🧤🌾|The Catcher in the Rye|Holden Caulfield|catcher in the rye
📛🌹|The Name of the Rose|Eco's monastery mystery|name of the rose
🏔️🐐🧒🧀|Heidi|A girl and her grandfather in the Alps
🐻🧳🥪|Paddington|A bear from darkest Peru
🦶💍🐉|The Hobbit|There and back again|hobbit
📓👧🏠|The Diary of a Young Girl|Anne Frank|anne frank,diary of anne frank
👨‍👦🛒🔥|The Road|McCarthy's father and son|road
🌊🐙🧔‍♂️🚢|Twenty Thousand Leagues Under the Sea|Captain Nemo's Nautilus|20000 leagues under the sea
🏝️👣🦜|Robinson Crusoe|Man Friday
🌬️⛰️💔|Wuthering Heights|Heathcliff and Cathy
🖼️👴😇|The Picture of Dorian Gray|He stays young; the portrait doesn't|picture of dorian gray,dorian gray
🧱💥🇳🇬|Things Fall Apart|Achebe's Okonkwo
🙏🤏🇮🇳|The God of Small Things|Arundhati Roy's Ayemenem|god of small things
⬜🐅🇮🇳|The White Tiger|Balram's letters to the Chinese premier|white tiger
⏱️🌌🪐|A Brief History of Time|Hawking's bestseller|brief history of time
`],
  ["expert", "Phrase", `
🐄🌕🏃|The cow jumped over the moon|Hey diddle diddle
🐖🪽|When pigs fly|Never
🍯🐝🕸️|You catch more flies with honey|Sweetness persuades
🍵📜🇨🇳|Not for all the tea in China|Absolutely never
⬜🐘|White elephant|A costly, useless possession
🦢🎶|Swan song|A final performance
🌱🟢🚧|Greener grass|Others seem better off|grass is always greener,the grass is always greener
🛁👶💧|Throw the baby out with the bathwater|Discard the good with the bad
🤢🦜|Sick as a parrot|Very disappointed
🐎🏠🚪|Close the stable door after the horse has bolted|Acting too late|bolt the stable door
🐫🪡|Camel through the eye of a needle|An impossibility
🐦🖐️🌳🌳|A bird in the hand|Is worth two in the bush|a bird in the hand is worth two in the bush,bird in the hand
💨🪞|Smoke and mirrors|Clever deception
🙇🥧|Humble pie|Eat this after being proved wrong|eat humble pie
🥄👄🥇|Born with a silver spoon|Inherited privilege|silver spoon
🐇🎩|Pull a rabbit out of a hat|A sudden surprise fix
🌂⛈️🌞|Save it for a rainy day|Keep some for later|rainy day
🔄🧥|Turncoat|Traitor
🥶🩸|Cold-blooded|Without feeling|cold blooded
🦊🐔🏠|Fox in the henhouse|Someone dangerous, let in
🥇🦢🥚|Kill the goose that lays the golden eggs|Destroy your own source of wealth|goose that lays the golden eggs,killing the golden goose
`],
  ["expert", "Character", `
👱‍♀️⚖️💅|Elle Woods|Bend and snap
🧙🍷🐉|Tyrion Lannister|He drinks and he knows things
👨‍🍳🐀🧢|Remy|Ratatouille's chef
🐀🥋🐢|Splinter|Mentor to four turtles
🎩🧪🕶️|Heisenberg|Say my name|walter white
🧤💎🫰|Thanos|Perfectly balanced, as all things should be
😈👑🧚|Maleficent|Mistress of all evil
🐍🧙‍♂️🚫👃|Voldemort|He who must not be named|lord voldemort
🐙🌊🧜‍♀️|Ursula|Poor unfortunate souls
🦁😈🌿|Scar|Long live the king
💨🌊🔥🌍|Aang|The last airbender
🧸🚗🤪|Mr Bean|Rowan Atkinson's silent chaos
🐉🔥👩‍🦳|Daenerys Targaryen|Mother of dragons|daenerys,khaleesi
🎩🍾🌊|Jay Gatsby|Green light across the bay|gatsby
😈🦯🌃|Daredevil|Matt Murdock
🕶️🦷🇬🇧💃|Austin Powers|Yeah, baby!
🧔🐺🔪|Wolverine|Adamantium claws
⚔️⚔️🐺|Geralt of Rivia|Monster hunter|geralt
👴🌾🐖🎶|Old MacDonald|E-I-E-I-O
`],
];

const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();
const out = [];
const seen = new Set();
for (const [tier, kind, block] of SECTIONS)
  for (const line of block.trim().split("\n")) {
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
