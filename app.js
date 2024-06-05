import Music from "./music.js";
import PERMANENT from "./world.js";

const DEFAULT_ROOM_SENSES = {
    see: "You see nothing.",
    hear: "You hear nothing.",
    touch: "You feel your shoes and clothes.",
    smell: "You smell nothing.",
    taste: "You taste your mouth.",
};
const DEFAULT_ITEM_SENSES = {
    see: "You cannot see it.",
    hear: "It makes no distinguishable sound.",
    touch: "It has no distinguishable feeling.",
    smell: "It has no distinct smell.",
    taste: "It has no distinct taste.",
};

const START_LOCATION = "outside";
const MOVE_VERBS = ["go", "exit", "move"];
const DAMAGE_THRESHOLDS = {
    0: { symptoms: [], nextThreshold: 100 },
    100: {
        symptoms: ["you cough"],
        nextThreshold: 200,
    },
    200: { symptoms: ["you feel so thirsty"], nextThreshold: Infinity },
};

const INSPECTIONS = {
    "see": ["look", "read"],
    "hear": ["listen"],
    "smell": ["sniff", "inhale"],
    "taste": ["lick"],
    "touch": ["feel"],
}

function canonicalizeSense(verb) {
    const lower = verb.toLowerCase();
    for (const [canon, aliases] of Object.entries(INSPECTIONS)) {
        if (lower === canon || aliases.includes(lower)) {
            return canon;
        }
    }
    return null;
}

async function hideWord(input) {
    input = input.toLowerCase();
    let linear_a_unicode_block = 0x10600;

    // Encode the input string as a Uint8Array (buffer)
    const encoder = new TextEncoder();
    const data = encoder.encode(input);

    // Hash the input using SHA-256
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);

    // Convert the hash buffer to a byte array
    const hashArray = Array.from(new Uint8Array(hashBuffer));

    // Map each byte to a character in the Linear A Unicode block
    let obfuscatedWord = hashArray
        .map((byte) => {
            return String.fromCodePoint(linear_a_unicode_block + byte);
        })
        .slice(0, input.length)
        .join("");

    return obfuscatedWord;
}

// Iterator over words and non-word items.
// Yields either:
// {isWord: true, word: "..."}
// {isWord: false, word: "..."}
function* getWords(original) {
    let buffer = "";
    for (const character of original) {
        // Charles can't figure out how to do Unicode properly,
        // so we're just going to do this to detect "letters":
        if (character.match(/[a-zA-Z]/)) {
            buffer += character
        } else {
            // End-of-word.
            if (buffer.length != 0) {
                yield { isWord: true, word: buffer };
                buffer = "";
            }
            yield { isWord: false, word: character };
        }
    }
    if (buffer.length != 0) {
        yield { isWord: true, word: buffer };
    }
}

/// Obfuscate text, according to the current knowledge.
async function hideText(original, knowledge) {
    // Try to preserve blank spaces and punctuation;
    // "just" get words.
    let output = "";
    for (const { isWord, word } of getWords(original)) {
        if (!isWord) {
            output += word;
        } else if (knowledge.has(word.toLowerCase())) {
            output += word;
        } else {
            output += await hideWord(word);
        }

    }
    return output;
}

class Room {
    constructor(roomid, permanent, saved) {
        const static_room = permanent.rooms[roomid];

        this.rad_rate = static_room.rad_rate;

        // mapping of sense to description
        this.senses = static_room.senses;

        this.exits = static_room.exits;

        this.items = {}; // ID to description
        if (saved !== null && saved !== undefined) {
            for (const [itemid, item] of saved?.items?.entries) {
                if (item.location === roomid) {
                    this.items[itemid] = item;
                }
            }
        }
        // static.rooms[].item contains just item IDs;
        // separate "items" table has the other state
        Object.entries(permanent.items).forEach(([itemId, item]) => {
            if (!saved?.items?.contains(itemId) && item.location == roomid) {
                this.items[itemId] = item;
            }
        });
    }
}

class Player {
    constructor(saved) {
        this.location = saved?.player?.location ?? START_LOCATION;
        this.dosage = saved?.player?.dosage ?? 0;
        this.damage = saved?.player?.damage ?? 0;
        // always set the last dose timer to the current time so that players do not accumulate dosage while the game is closed
        this.lastDoseTimestamp = Date.now();
        this.currentDamageThreshold =
            saved?.player?.currentDamageThreshold ?? DAMAGE_THRESHOLDS[0];
        this.symptoms = saved?.player?.currentDamageThreshold ?? new Set([]);

        // Knowledge is a set of known words.
        // We don't (yet) keep a full translation table, in either direction;
        // we just obfuscate unknown words.
        // We also keep "\n" here so we can preserve newlines in the input >.>
        this.knowledge =
            saved?.player?.knowledge ?? new Set(["place", "honor",
                "\n"]);
    }
}

class State {
    constructor(permanent, saved) {
        this.music = new Music()
        this.rooms = {};
        for (const roomid in permanent.rooms) {
            this.rooms[roomid] = new Room(roomid, permanent, saved);
        }
        this.player = new Player(saved);

        const loading = document.getElementById("loading-indicator");
        loading.remove();
        const main = document.getElementsByTagName("main").item(0);

        this.perception = document.createElement("p");
        this.perception.id = "perception";
        main.appendChild(this.perception);

        this.symptoms = document.createElement("p");
        this.symptoms.id = "symptoms";
        main.appendChild(this.symptoms);

        this.errors = document.createElement("p");
        this.errors.id = "errors";
        main.appendChild(this.errors);

        const form = document.createElement("form");
        form.classList.add("action");
        form.addEventListener("submit", async (ev) => {
            ev.preventDefault();
            await this.act();
        });
        main.appendChild(form);

        this.textin = document.createElement("input");
        this.textin.type = "text";
        this.textin.classList.add("action")
        form.appendChild(this.textin);

        this.button = document.createElement("button");
        this.button.id = "submit";
        this.button.classList.add("action");
        this.button.type = "submit";
        this.button.innerText = "Act.";
        form.appendChild(this.button);

        main.appendChild(this.music.musicToggle);

        this.render();
    }

    render(error = "") {
        console.log(this);

        if (!this.currentDescription) {
            this.currentDescription = this.renderPassiveSenses();
        }
        this.perception.innerHTML = this.currentDescription;

        const selectedSymptom =
            Array.from(this.player.symptoms)[
            Math.floor(Math.random() * this.player.symptoms.size)
            ] ?? "";
        this.symptoms.innerText = selectedSymptom;
        this.errors.innerText = error;
        if (!error) {
            this.textin.value = "";
        }

        // TODO include (???)
    }

    renderPassiveSense(sense) {
        const room = this.currentRoom();
        let senses = [room.senses[sense]];
        const itemPassives = Object.entries(room.items).map(
            ([_itemId, item]) => {
                return item.passive[sense];
            }
        );
        senses = [...senses, ...itemPassives].filter((sense) => sense);
        if (senses.length > 1) {
            senses[senses.length - 1] = `and ${senses[senses.length - 1]}`;
        }
        if (senses.length === 0) {
            return DEFAULT_ROOM_SENSES[sense];
        }
        return `You ${sense} ${senses.join(", ")}.`;
    }
    renderPassiveSenses() {
        return `
${Object.keys(DEFAULT_ROOM_SENSES)
                .map((sense) => {
                    return this.renderPassiveSense(sense);
                })
                .join("<br />")}
`
    }

    currentRoom() {
        return this.rooms[this.player.location];
    }

    async act() {
        this.applyDose();
        const tokenizedAction = this.textin.value.split(" ");
        const verb = tokenizedAction[0].toLowerCase();
        const restString = tokenizedAction.slice(1).join(" ");
        // const restArray = tokenizedAction.slice(1);
        let error = `I don't know ${verb}`;
        const perceptionVerb = canonicalizeSense(verb);
        if (MOVE_VERBS.includes(verb)) {
            error = this.movePlayer(restString);
        } else if (perceptionVerb) {
            error = await this.inspect(perceptionVerb, restString);
        } else if (!verb) {
            // Empty "enter"; clear the most-recent-output,
            // to go back to the room description.
            this.currentDescription = ""
            error = ""
        }
        this.applyDose();
        this.render(error);
    }

    movePlayer(direction) {
        const destination = this.currentRoom().exits[direction];
        if (destination) {
            this.player.location = destination;
            this.currentDescription = this.renderPassiveSenses();
            return "";
        }
        return `Cannot move to ${direction}`;
    }

    async inspect(verb, remainder) {
        let itemName = remainder.trim().toLowerCase();
        if (!itemName.trim()) {
            this.currentDescription = this.renderPassiveSense(verb);
            return "";
        }

        // Look up the item in the room.
        for (const [_itemId, item] of Object.entries(this.currentRoom().items)) {
            if (item.aliases.includes(itemName)) {
                this.currentDescription = item.sense[verb] ?? DEFAULT_ITEM_SENSES[verb];

                // If this verb allows perceiving writing,
                // and we have writing, output it.
                if (["see"].includes(verb) && item.writing) {
                    let hidden = await hideText(item.writing, this.player.knowledge);
                    hidden = hidden.replace(/(?:\r\n|\r|\n)/g, "<br />");
                    this.currentDescription += `<br/>
The text reads:
<blockquote>${hidden}</blockquote>
`;
                }


                if (["see"].includes(verb) && item.rosetta) {
                    let hidden = await hideText(item.rosetta, new Set());
                    let unhidden = item.rosetta;
                    this.currentDescription += `<br />
You conclude <q>${hidden}</q> means <q>${unhidden}</q>.
`;
                    this.learn(item.rosetta);
                }

                // No error:
                return "";
            }
        }
        return `There is no ${itemName} nearby.`;
    }

    learn(text) {
        for (const { isWord, word } of getWords(text)) {
            if (isWord) {
                this.player.knowledge.add(word.toLowerCase());
            }
        }
    }

    applyDose() {
        // cancel any existing dose callback timer
        if (this.timerID) {
            clearTimeout(this.timerID);
        }

        // record last time dosage was applied
        let now = Date.now();
        let timeSinceLastDosage = now - this.player.lastDoseTimestamp;
        this.player.lastDoseTimestamp = now;
        // update dosage based on time since last dose
        this.player.dosage +=
            (timeSinceLastDosage * this.currentRoom().rad_rate) / 1000;
        // apply dosage to damage
        this.player.damage += (timeSinceLastDosage * this.player.dosage) / 1000;

        // update player's dosage threshold
        if (
            this.player.damage >=
            this.player.currentDamageThreshold.nextThreshold
        ) {
            this.player.currentDamageThreshold =
                DAMAGE_THRESHOLDS[
                this.player.currentDamageThreshold.nextThreshold
                ];
        }

        // select a symptom for the player based on their dosage
        let availableSymptoms = this.player.currentDamageThreshold.symptoms;
        if (availableSymptoms.length) {
            let selectedSymptomIndex = Math.floor(
                Math.random() * availableSymptoms.length
            );
            let selectedSymptom = availableSymptoms[selectedSymptomIndex];
            this.player.symptoms.add(selectedSymptom);
        }

        // compute time until next threshhold at current player.dosage
        // set dosage callback and store timer on state
        this.timerID = setTimeout(this.applyDose.bind(this), 1000);
    }
}

const state = new State(PERMANENT, /*saved = */ undefined);
