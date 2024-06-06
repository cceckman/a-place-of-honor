import Music from "./music.js";
import PERMANENT from "./world.js";
import { pushToLoki } from "./telemetry.js";

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

const START_LOCATION = "home";
const MOVE_VERBS = ["go", "exit", "move"];
const RESTART_VERBS = ["restart", "continue", "yes"];
const DAMAGE_LEVELS = [
    { symptoms: [], nextThreshold: 100 },
    { symptoms: ["You cough."], nextThreshold: 200 },
    { symptoms: ["You feel so thirsty."], nextThreshold: 350 },
    { symptoms: ["Your head aches."], nextThreshold: 500 },
    {
        symptoms: [
            "You cough. You taste blood.",
            "Your stomach turns. You taste acid.",
            "You turn. Which way did you come from? Which is the way ahead?"
        ], nextThreshold: 1000
    },
    {
        symptoms: [
            "Your stomach turns. Vomit wells in your mouth.",
            "Your legs falter. You slip, then recover."
        ], nextThreshold: 5000
    },
    {
        symptoms: [
            "You collapse. You stay still for a moment, then struggle to rise.",
            "You cough. Blood trickles from your mouth.",
            "You spit, but you still taste blood.",
            "Your senses fade in and out. Where are you? Where have you been?"
        ], nextThreshold: 10000
    },
    {
        symptoms: [
            "You collapse. You stay still for a moment, then struggle to rise.",
            "You cough. Blood trickles from your mouth.",
            "You close your eyes for a moment. You struggle to open them again."
        ], nextThreshold: 10000
    },
    { symptoms: [/*At the last threshold, there is only one symptom.*/], nextThreshold: Infinity },
];

const INSPECTIONS = {
    see: ["look", "read"],
    hear: ["listen"],
    smell: ["sniff", "inhale"],
    taste: ["lick"],
    touch: ["feel"],
};

const INTERACTIONS = {
    write: ["paint", "draw"],
}

const DEATH_DESCRIPTION = `<div>You are overcome. Darkness descends and your breathing stops.</div>

<div>Return to the place of honor as a new investigator?<br />("restart")</div>`;

function canonicalizeVerb(verb, type = INSPECTIONS) {
    for (const [canon, aliases] of Object.entries(type)) {
        if (verb === canon || aliases.includes(verb)) {
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
            buffer += character;
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

function getLightLevel(items, base = 0) {
    return Object.values(items).reduce((acc, item) => acc + (item.lightLevel ?? 0), base)
}

class Room {
    constructor(roomid, permanent, saved) {
        const static_room = permanent.rooms[roomid];


        // mapping of sense to description
        this.senses = static_room.senses;
        this.exits = static_room.exits;
        this.rad_rate = static_room.rad_rate;
        this.droneVolume = static_room.droneVolume;

        this.lightLevel = saved?.rooms[roomid]?.lightLevel ??
            permanent.rooms[roomid].lightLevel ??
            0;

        this.items = {}; // ID to description
        if (saved !== null && saved !== undefined) {
            for (const [itemid, item] of saved?.items?.entries) {
                if (item.location === roomid) {
                    this.items[itemid] = item;
                }
            }
        }

        this.writeableItem = static_room.writeableItem;
        // static.rooms[].item contains just item IDs;
        // separate "items" table has the other state
        Object.entries(permanent.items).forEach(([itemId, item]) => {
            if (!saved?.items?.contains(itemId) && item.location == roomid) {
                this.items[itemId] = item;
            }
        });
    }

    getLightLevel() {
        return getLightLevel(this.items, this.lightLevel);
    }
}

class Player {
    constructor(saved) {
        this.uuid = crypto.randomUUID();
        this.location = saved?.player?.location ?? START_LOCATION;
        this.dosage = saved?.player?.dosage ?? 0;
        this.damage = saved?.player?.damage ?? 0;
        // always set the last dose timer to the current time so that players do not accumulate dosage while the game is closed
        this.lastDoseTimestamp = Date.now();
        this.currentDamageLevel = saved?.player?.currentDamageThreshold ?? 0;
        this.symptoms = saved?.player?.symptoms ?? new Set([]);
        this.items = {};

        // Knowledge is a set of known words.
        // We don't (yet) keep a full translation table, in either direction;
        // we just obfuscate unknown words.
        // We also keep "\n" here so we can preserve newlines in the input >.>
        this.knowledge =
            saved?.player?.knowledge ?? new Set([]);
    }

    getLightLevel() {
        return getLightLevel(this.items);
    }
}

class State {
    constructor(permanent, saved) {
        // Set up game state:
        this.music = new Music();
        this.rooms = {};
        for (const roomid in permanent.rooms) {
            this.rooms[roomid] = new Room(roomid, permanent, saved);
        }
        this.newInvestigator(saved)
        console.log(this.rooms)

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
        this.textin.classList.add("action");
        form.appendChild(this.textin);

        this.button = document.createElement("button");
        this.button.id = "submit";
        this.button.classList.add("action");
        this.button.type = "submit";
        this.button.innerText = "Act.";
        form.appendChild(this.button);

        main.appendChild(this.music.musicToggle);

        this.lastError = ""
        this.render();
    }

    newInvestigator(saved) {
        this.player = new Player(saved)
        this.currentDescription = "";

        this.music.setDroneVolume(this.currentRoom().droneVolume)
        this.music.restartArpeggio();
    }

    // Functions that act based on sight -- for items, or for rooms --
    // should check the "light level" before having their effect.
    // This is the sum of:
    // - the room's ambient light (e.g. sky)
    // - any items in the room that glow (e.g. lightbulbs)
    //   - multiple sources can sum
    // - any items in the room / state that would _prevent_ light transmission
    //   (...power outage???)
    //
    // If greater than zero, the investigator can see.
    //
    // TODO:
    // - Investigator-carried lights
    // - Investigator blindness, as a -Infinity value
    // TODO: Generalize across senses? An acrid smell or a gas mask,
    // earplugs to cancel hearing... deafness from a "bang"
    getLightLevel() {
        // TODO: implement blindness, summing a player's light-level value.
        return Math.max(this.currentRoom().getLightLevel(), this.player.getLightLevel());
    }

    render() {
        console.log(this);

        // TODO - if player is null that means they died
        // so we can render out the death description
        if (this.player === null) {
            this.currentDescription = DEATH_DESCRIPTION;
            this.symptoms.innerText = "";
        } else {
            const selectedSymptom =
                Array.from(this.player.symptoms)[
                Math.floor(Math.random() * this.player.symptoms.size)
                ] ?? "";
            this.symptoms.innerText = selectedSymptom;
        }

        if (this.currentDescription) {
            this.perception.innerHTML = this.currentDescription;
        } else {
            // Note: we re-render this every time, rather than setting currentDescription,
            // so that we get updates if e.g. items change.
            this.perception.innerHTML = this.renderPassiveSenses();
        }

        this.errors.innerText = this.lastError;
        if (this.lastError === "") {
            // No error in the last input; clear it.
            this.textin.value = "";
        }

        // TODO include (???)
    }

    renderPassiveSense(sense) {
        // TODO: distinguish "active" and "passive" touch.
        // "active" touch would be walking around and poking things, feeling out the walls;
        // "passive" touch would be airflow, temperature, etc.
        if (sense === "see" && this.getLightLevel() <= 0) {
            return `You cannot see.`
        }

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
        let joiner = ", ";
        for (const sense of senses) {
            if (sense.includes(",")) {
                joiner = "; "
                break;
            }
        }

        return `You ${sense} ${senses.join(joiner)}.`;
    }

    renderPassiveSenses() {
        return `
${Object.keys(DEFAULT_ROOM_SENSES)
                .map((sense) => {
                    return this.renderPassiveSense(sense);
                })
                .join("<br />")}
`;
    }

    currentRoom() {
        return this.rooms[this.player.location];
    }

    async act() {
        this.applyDose();

        const tokenizedAction = this.textin.value.split(" ");
        const verb = tokenizedAction[0].toLowerCase();
        const restString = tokenizedAction.slice(1).join(" ").trim().toLowerCase();

        // TODO - if player is null only allow the "restart" action (or "continue", or whatever we call it)
        if (this.player === null) {
            if (RESTART_VERBS.includes(verb)) {
                this.newInvestigator()
                this.lastError = "";
            } else {
                this.lastError = `I can't ${verb}. I am dead.`;
            }
        } else {
            // i.e. player is alive
            // const restArray = tokenizedAction.slice(1);
            const perceptionVerb = canonicalizeVerb(verb, INSPECTIONS);
            const interactionVerb = canonicalizeVerb(verb, INTERACTIONS);
            if (MOVE_VERBS.includes(verb)) {
                this.lastError = this.movePlayer(restString);
            } else if (perceptionVerb) {
                this.lastError = await this.inspect(perceptionVerb, restString);
            } else if (interactionVerb) {
                // TODO (when adding new interactions): refactor for more interaction types
                this.lastError = this.attemptWrite(restString);
            } else if (verb && restString) {
                // Unknown verb, but there's also an object.
                // Try applying the verb to the object.
                // Take the error, or the empty string if Charles forgot to add a return value
                // from the function.
                this.lastError = String(this.itemAction(verb, restString) ?? "");
            } else if (verb) {
                // Unknown action.
                this.lastError = `I don't know ${verb}`;
            } else {
                // Empty "enter"; clear the most-recent-output,
                // to go back to the room description.
                this.currentDescription = "";
                this.lastError = "";
            }
        }
        this.applyDose();
        this.render();

        var logMessage = this.textin.value;
        var tags = {
            user: this.player.uuid, // WARNING: this value will have a very high cardinality
            room: this.player.location,
            damageLevel: this.player.currentDamageLevel.toString(),
            level: this.lastError ? "error" : "info",
            trigger: "action",
        };
        if (this.lastError !== null) {
            pushToLoki(logMessage, tags).catch((error) => {
                console.error("Error:", error);
            });
        }
    }

    // Try to perform the provided action with any items in the room.
    itemAction(verb, rest) {
        const room = this.currentRoom();
        const localItems = [ ...Object.entries(room.items), ...Object.entries(this.player.items )];
        for (const [itemId, item] of localItems) {
            if (!item.aliases.includes(rest)) {
                continue;
            }
            // Found the item:
            console.log(`applying ${verb} to ${itemId}`)
            for (const action of (item.action ?? [])) {
                if (action.aliases.includes(verb)) {
                    // Found it!
                    return action.callback(item, this);
                }
            }
            // Found no such action for this item.
            return `Cannot ${verb} ${rest}`;
        }
        return `Cannot find ${rest}`;
    }

    movePlayer(direction) {
        const destination = this.currentRoom().exits[direction];
        if (destination) {
            this.player.location = destination;
            this.currentDescription = this.renderPassiveSenses();
            this.music.setDroneVolume(this.currentRoom().droneVolume);
            return "";
        }
        if (direction === "") {
            return "Where do you want to go?"
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
        for (const [_itemId, item] of Object.entries(
            this.currentRoom().items
        )) {
            if (item.aliases.includes(itemName)) {
                this.currentDescription =
                    item.sense[verb] ?? DEFAULT_ITEM_SENSES[verb];

                // Special-casing sight:
                if (verb !== "see") {
                    return "";
                }

                // Sight special cases:
                if (this.getLightLevel() <= 0) {
                    this.currentDescription = `You cannot see the ${itemName}.`
                    return ""
                }

                // If this verb allows perceiving writing,
                // and we have writing, output it.
                // TODO: Allow writing-by-touch, for engraved writing
                if (item.writing) {
                    let hidden = await hideText(
                        item.writing,
                        this.player.knowledge
                    );
                    hidden = hidden.replace(/(?:\r\n|\r|\n)/g, "<br />");
                    this.currentDescription += `<br/>
The text reads:
<blockquote>${hidden}</blockquote>
`;
                }
                
                if (item.writtenWords) {
                    this.currentDescription += `<br/>
You see more recent markings describing the symbols for the following words: ${item.writtenWords}`;
                }

                if (item.rosetta && this.learn(item.rosetta)) {
                    let hidden = await hideText(item.rosetta, new Set());
                    let unhidden = item.rosetta;

                    this.currentDescription += `<br />
You conclude <q>${hidden}</q> means <q>${unhidden}</q>.
`;

                }

                // No error:
                return "";
            }
        }
        return `There is no ${itemName} nearby.`;
    }

    attemptWrite(text) {
        const knownWords = Array.from(this.player.knowledge);
        if (knownWords.length === 0) {
            this.currentDescription = "You don't know any words to write.";
            return "";
        }
        if(!text) {
            this.currentDescription = `What would you like to write? You know ${knownWords.join(", ")}`;
            return "";
        }
        if(!knownWords.includes(text)) {
            return `You don't know ${text}. You know ${knownWords.join(", ")}.`;
        }
        const currentRoomWriteableItem = this.currentRoom().items[this.currentRoom().writeableItem];
        if (!currentRoomWriteableItem) {
            return "There is nothing to write on here.";
        }
        if (currentRoomWriteableItem.rosetta.includes(text)) {
            return `${text} is already written here.`;
        }
        currentRoomWriteableItem.rosetta = `${currentRoomWriteableItem.rosetta || ""} ${text}`.trim();
        currentRoomWriteableItem.writtenWords = `${currentRoomWriteableItem.writtenWords || ""} ${text}`.trim();
        this.currentDescription = currentRoomWriteableItem.write;
        return "";
    }

    // Returns true if something new was learned.
    learn(text) {
        const knownBefore = this.player.knowledge.size;
        for (const { isWord, word } of getWords(text)) {
            if (isWord) {
                this.player.knowledge.add(word.toLowerCase());
            }
        }
        // Return "true" if something was learned:
        return this.player.knowledge.size != knownBefore
    }

    killPlayer() {
        this.player = null;
        this.music.stopArpeggioAndReduceDrone();
        this.render();
    }

    applyDose() {
        // cancel any existing dose callback timer
        if (this.timerID) {
            clearTimeout(this.timerID);
        }

        if (this.player === null) {
            return;
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
            DAMAGE_LEVELS[this.player.currentDamageLevel].nextThreshold
        ) {
            this.player.currentDamageLevel = this.player.currentDamageLevel + 1;
            this.music.increaseDetune();

            // Add a symptom from the current level.
            let availableSymptoms =
                DAMAGE_LEVELS[this.player.currentDamageLevel]?.symptoms ?? [];
            if (availableSymptoms.length) {
                let selectedSymptomIndex = Math.floor(
                    Math.random() * availableSymptoms.length
                );
                let selectedSymptom = availableSymptoms[selectedSymptomIndex];
                this.player.symptoms.add(selectedSymptom);
            }

            // Re-render:
            this.render()
        }

        // if there aren't any more damage levels above the current one
        // kill the player
        if (this.player.currentDamageLevel === DAMAGE_LEVELS.length - 1) {
            this.killPlayer();
            return;
        }

        // select a symptom for the player based on their dosage

        // TODO: compute time until next threshhold at current player.dosage
        // set dosage callback and store timer on state
        this.timerID = setTimeout(this.applyDose.bind(this), 1000);
    }
}

// Attach to the window object for debugging:
window.gameState = new State(PERMANENT, /*saved = */ undefined);

