// Defaults for items:
const NOSOUND_ITEM = "It makes no sound.";
const NOSMELL_ITEM = "It has no distinct smell.";

const DEFAULT_ROOM_SENSES = {
    see: "You see nothing.",
    hear: "You hear nothing.",
    touch: "You feel nothing but whatever is below your feet.",
    smell: "You smell nothing distinct.",
    taste: "You taste nothing distinct.",
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
    "see": ["look"],
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

/// Obfuscate text, according to the current knowledge.
function trashText(original, _knowledge) {
    return original;
}

const PERMANENT = {
    items: {
        monolith1: {
            aliases: ["monolith", "stone", "gray stone monolith"],
            moveable: false,
            writing: "not a place of honor",
            sense: {
                see: "A gray stone monolith, twice your height, with writing on it.",
                touch: "It is cold and smooth",
                taste: "Stony and mineral-like.",
            },
            location: "outside",
            passive: {
                see: "a gray stone monolith",
            },
        },
        berm1: {
            aliases: ["berm", "slope", "earth"],
            moveable: false,
            sense: {
                "see": "To the west is a berm, a slope of grass-covered earth rising above your head. It seems to be level beyond that point. It extends thousands of strides to the north and south.",
                "hear": "It is covered in grass, which rustles softly in the gentle breeze.",
                "touch": "The ground is grass-covered, but not soft; it feels well-packed.",
                "smell": "It has a slight smell of grass and earth, but not of loam.",
                "taste": "It tastes of dirt, low in clay."
            },
            location: "outside",
            passive: {
                see: "a slope of earth rising above your head",
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
            senses: {},
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
        form.class = "action";
        form.addEventListener("submit", (ev) => {
            ev.preventDefault();
            this.act();
        });
        main.appendChild(form);

        this.textin = document.createElement("input");
        this.textin.type = "text";
        this.textin.class = "action";
        form.appendChild(this.textin);

        this.button = document.createElement("button");
        this.button.id = "submit";
        this.button.value = "Act.";
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
        this.perception.innerText = this.currentDescription;

        const selectedSymptom =
            Array.from(this.player.symptoms)[
            Math.floor(Math.random() * this.player.symptoms.size)
            ] ?? "";
        this.symptoms.innerText = selectedSymptom;
        this.errors.innerText = error;
        if (!error) {
            this.textin.value = "";
        }

        // TODO: Trash text
        // TODO Display items
        // TODO include
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
                .join("\n")}
`
    }

    currentRoom() {
        return this.rooms[this.player.location];
    }

    act() {
        // TODO: Parse user input and change the current state, then...
        //
        //
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

                // TODO:
                // If looking (or touching?),
                // include the writing with translation.
                // trashText has a stub.
                /*
                if (item.writing) {
                    this.currentDescription += "The text reads: \n" + trashText(item.writin
                }*/
                // TODO:
                // If there is both "writing" and "translation",
                // print both, and add to the player's knowledge.
                return "";
            }
        }
        return `There is no ${itemName} nearby.`;
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
