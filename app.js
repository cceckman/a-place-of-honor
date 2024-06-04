// Defaults for items:
const NOSOUND_ITEM = "It makes no sound.";
const NOSMELL_ITEM = "It has no distinct smell.";

const DEFAULT_ROOM_SENSES = {
    see: "You see nothing.",
    hear: "You hear nothing.",
    touch: "You feel nothing but whatever is below your feet.",
    smell: "You detect no distinct smell.",
    taste: "You detect no distinct taste.",
};
const START_LOCATION = "outside";
const MOVE_VERBS = ["go", "exit", "move"];
const CARDINAL_DIRECTIONS = ["north", "south", "east", "west"];

const PERMANENT = {
    items: {
        monolith1: {
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
            moveable: false,
            sense: {},
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
            rad_rate: 1,
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

        this.presentation = document.createElement("p");
        this.presentation.id = "presentation";
        main.appendChild(this.presentation);

        const form = document.createElement("form");
        form.addEventListener("submit", (ev) => {
            ev.preventDefault();
            this.act();
        });
        main.appendChild(form);

        this.textin = document.createElement("input");
        this.textin.type = "text";
        this.textin.id = "action";
        form.appendChild(this.textin);

        this.button = document.createElement("button");
        this.button.id = "submit";
        this.button.value = "Act.";
        this.button.type = "submit";
        this.button.innerText = "Act.";
        form.appendChild(this.button);

        this.render();
    }

    render(error) {
        console.log(this);
        const room = this.currentRoom();
        const text = `
You are at: ${this.player.location}.

${Object.keys(DEFAULT_ROOM_SENSES)
    .map((sense) => {
        return this.renderPassiveSense(sense);
    })
    .join("\n")}
//
// TODO: Add health indicator here

${error || ""}
        `;

        // TODO: Trash text
        // TODO Display items
        // TODO include

        if (!error) {
            this.textin.value = "";
        }
        this.presentation.innerText = text;
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

    currentRoom() {
        return this.rooms[this.player.location];
    }

    act() {
        // TODO: Parse user input and change the current state, then...
        //
        //
        applyDose();
        const tokenizedAction = this.textin.value.split(" ");
        let error = `I don't know ${tokenizedAction[0]}`;
        if (MOVE_VERBS.includes(tokenizedAction[0])) {
            error = this.movePlayer(tokenizedAction.slice(1).join(" "));
        }
        applyDose();
        this.render(error);
    }

    movePlayer(direction) {
        const destination = this.currentRoom().exits[direction];
        if (destination) {
            this.player.location = destination;
            return "";
        }
        return `Cannot move to ${direction}`;
    }

    applyDose() {
        // cancel any existing dose callback timer

        // record last time dosage was applied
        let now = Date.now();
        let timeSinceLastDosage = now - this.player.lastDoseTimestamp;
        this.player.lastDoseTimestamp = now;
        // update dosage based on time since last dose
        this.player.dosage +=
            (timeSinceLastDosage * this.currentRoom().rad_rate) / 1000;
        // apply dosage to damage
        this.player.damage += (timeSinceLastDosage * this.player.dosage) / 1000;

        // compute time until next threshhold at current player.dosage
        // set dosage callback and store timer on state
    }
}

const state = new State(PERMANENT, /*saved = */ undefined);
