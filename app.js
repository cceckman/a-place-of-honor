// Defaults for items:
const NOSOUND_ITEM = "It makes no sound.";
const NOSMELL_ITEM = "It has no distinct smell.";

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
}

const START_LOCATION = "outside";
const MOVE_VERBS = ["go", "exit", "move"];
const CARDINAL_DIRECTIONS = ["north", "south", "east", "west"];
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

function hideWord(original) {
    return original.toUpperCase();
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
function hideText(original, knowledge) {
    // Try to preserve blank spaces and punctuation;
    // "just" get words.
    let output = "";
    for (const { isWord, word } of getWords(original)) {
        if (!isWord) {
            output += word;
        } else if (knowledge.has(word.toLowerCase())) {
            output += word;
        } else {
            output += hideWord(word);
        }

    }
    return output;
}

const WARNING_LINES = [
    "This place is a message... and part of a system of messages... pay attention to it!",
    "Sending this message was important to us. We considered ourselves to be a powerful culture.",
    "This place is not a place of honor... no highly esteemed deed is commemorated here... nothing valued is here.",
    "What is here was dangerous and repulsive to us. This message is a warning about danger.",
    "The danger is in a particular location... it increases towards a center... the center of danger is here... of a particular size and shape, and below us.",
    "The danger is still present, in your time, as it was in ours.",
    "The danger is to the body, and it can kill.",
    "The form of the danger is an emanation of energy.",
    "The danger is unleashed only if you substantially disturb this place physically. This place is best shunned and left uninhabited."
];

const INFOCENTER_PANEL1 = [...WARNING_LINES.slice(0, 2), "not - place -- honor", ...WARNING_LINES.slice(3)];


const PERMANENT = {
    items: {
        monolith1: {
            aliases: ["monolith", "stone", "gray stone monolith"],
            moveable: false,
            writing: WARNING_LINES.slice(0, 5).join("<br />"),
            sense: {
                see: "A gray stone monolith, twice your height, with writing engraved into it. Some of the writing has been worn away. You recognize some of an ancient language.",
                touch: "It is cold and smooth",
                taste: "Stony and mineral-like.",
            },
            location: "outside",
            passive: {
                see: "a gray stone monolith",
            },
        },
        info_text_2: {
            aliases: ["first panel", "second panel", "other panels", "panels"],
            moveable: false,
            location: "information center",
            passive: {
                see: "two stone panels with text",
            },
            sense: {
                see: "A stone panel with some sort of engraving on it. It might be writing, but you do not recognize the characters.",
            }
        },
        info_text_1: {
            aliases: ["last panel", "third panel", "writing", "damaged panel", "altered panel"],
            moveable: false,
            location: "information center",
            passive: {
                see: "a stone panel with damaged or altered text",
            },
            sense: {
                see:
                    "The panel has engraved writing similar to that on the gray monolith. " +
                    "On one of the lines, all of the words but three have been chisiled away. " +
                    "In the margin next to this line, three words have been shallowly scratched into the stone."
            },
            rosetta: "not place honor",
            writing: INFOCENTER_PANEL1.join("<br />")
        },
        berm1: {
            aliases: ["berm", "slope", "earth", "grass"],
            moveable: false,
            sense: {
                "see": "To the west is a berm, a gradual slope of grass-covered earth that rises above your head then levels off. You could climb it. It extends thousands of strides to the north and south.",
                "hear": "The berm is covered in grass, which rustles softly in the gentle breeze.",
                "touch": "The ground is grass-covered, but not soft; it feels well-packed.",
                "smell": "The ground has a slight smell of grass and earth, but not of loam.",
                "taste": "The ground is dusty -- low in clay or loam."
            },
            location: "outside",
            passive: {
                see: "a slope of earth rising above your head to the west",
            },
        },
    },
    rooms: {
        outside: {
            exits: {
                west: "information center",
                berm: "outside",
                "information center": "information center",
            },
            // Rads per second
            rad_rate: 0,
            senses: {},
        },
        "information center": {
            exits: {
                east: "outside",
                outside: "outside",
                west: "hot cell",
                door: "hot cell",
            },
            rad_rate: 0.1,
            senses: {
            },
        },
        "hot cell": {
            exits: { east: "information center" },
            rad_rate: 10,
            senses: {},
        },
    },
};

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
        this.knowledge =
            saved?.player?.knowledge ?? new Set(["place", "honor"]);
    }
}

class State {
    constructor(permanent, saved) {
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
        form.addEventListener("submit", (ev) => {
            ev.preventDefault();
            this.act();
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

    act() {
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
            error = this.inspect(perceptionVerb, restString);
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

    inspect(verb, remainder) {
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
                    this.currentDescription += `<br/>
The text reads:
<blockquote>${hideText(item.writing, this.player.knowledge)}</blockquote>
`;
                }


                if (["see"].includes(verb) && item.rosetta) {
                    let hidden = hideText(item.rosetta, new Set());
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
