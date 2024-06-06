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

/*
 * items: mapping of itemId -> Item
 * Item: mapping of:
 *      aliases: list of strings; alternative names that can be used to refer to this item.
 *      moveable: whether this can be moved.
 *          TODO: Unused.
 *      writing: Text to display as writing on this panel.
 *      rosetta: (String of) Text that is translated on this panel. Percieving the panel may add these to knowledge.
 *      passive: Sense table, presented passively (i.e. when just looking at the room / container.)
 *          These should be sentence fragments -- they fit into the list.
 *      sense: Sense table, presented actively (i.e. when specifically looking at this item)
 *          These should be complete paragraphs -- they are presented on their own,
 *          so they should include the item itself.
 *      location: roomId where this item is.
 *          TODO: Or something other than a room ID?
 *      action: Additional actions that can be performed on this item. List of objects:
 *          aliases: List of strings that this action matches.
 *          callback: function(item, State) to update the state of the game.
 *          Returns an error string, if there is an error.
 *      lightLevel: light level emitted by this item. Defaults to 0.
 *
 * rooms: mapping of roomId -> Room
 * Room: mapping of:
 *      exits: mapping of string -> roomId.
 *      rad_rate: ambient radiation in the room, rads per second.
 *      senses: Sense table.
 *      droneVolume: drone volume adjustment (typically negative, deciBels)
 *      lightLevel: ambient light level. Mutable, saved; defaults to 0 if unspecified.
 *
 *  Sense table: mapping of sense (canonical) to description.
 */

/// Implementation of the light switch in the hot cell.
function hotCellLightSwitch(self, state) {
    console.log("flipping lightswitch")
    // light to room, on this circuit
    const MAPPINGS = {
        "hot cell light": "hot cell",
    };
    if (self.state) {
        // Turn off.
        self.state = false
        for (const [itemId, roomId] of Object.entries(MAPPINGS)) {
            let room = state.rooms[roomId];
            let item = room.items[itemId];
            delete room.items[itemId];
            // Hold on to it in the nowhere:
            state.rooms["nowhere"].items[itemId] = item;
        }
    } else {
        // Turn on.
        self.state = true
        for (const [itemId, roomId] of Object.entries(MAPPINGS)) {
            // Move it from the nowhere:
            let item = state.rooms["nowhere"].items[itemId];
            delete state.rooms["nowhere"].items[itemId];
            let room = state.rooms[roomId];
            room.items[itemId] = item;
        }
    }
    state.currentDescription = "The cylinder pivots across its base, and clicks."
}


export const PERMANENT = {
    items: {
        leader: {
            aliases: ["leader", "shaman", "papa"],
            moveable: false,
            passive: {
                see: "the leader in the center, facing you and speaking to you",
                hear: "the leader asking you a question",
            },
            location: "home",
            sense: {
                see: "The leader addresses you, asking a question, and gesture to the carved tablet they hold.",
                hear: "The leader asks you to go west to the place of honor, and bring back its power to your community."
            }
        },
        leader_tablet: {
            aliases: ["tablet", "stone"],
            moveable: false,
            passive: {
                see: "a stone tablet in the leader's hands",
            },
            writing: "a place of honor",
            location: "home",
            sense: {
                see: "The tablet is chiseled with both ancient runes and a modern script.",
            },
            rosetta: "place honor"
        },
        monolith1: {
            aliases: ["monolith", "stone", "gray stone monolith"],
            moveable: false,
            writing: WARNING_LINES.slice(0, 5).join("\n"),
            sense: {
                see: "A gray stone monolith, twice your height, with writing engraved into it. Some of the writing has been worn away.",
                touch: "The monolith is cold and smooth.",
                taste: "Stony and mineral-like.",
            },
            location: "outside",
            passive: {
                see: "a gray stone monolith",
            },
        },
        info_text_1: {
            aliases: ["first panel", "panels", "panel", "writing", "damaged panel", "altered panel"],
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
            writing: INFOCENTER_PANEL1.join("\n")
        },
        illegible_panels: {
            aliases: ["second panel", "third panel", "other panels", "panels"],
            moveable: false,
            location: "information center",
            passive: {
                see: "two more stone panels with text",
            },
            sense: {
                see: "A stone panel with some sort of engraving on it. It might be writing, but you do not recognize the characters.",
            }
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
        infocenter_hotcell_hole: {
            aliases: ["door", "hole"],
            moveable: false,
            location: "information center",
            passive: {
                "see": "a person-sized hole in the ground near one wall",
                "touch": "a person-sized hole in the ground near one wall",
            },
            sense: {
                "see": "The hole extends down half your height, then parallel to the wall. You could crawl through it.",
                "touch": "The hole extends down the length of your leg, then parallel to the wall. You could crawl through it.",
            }
        },
        hotcell_hole_marker: {
            aliases: ["disc", "disk", "stone", "marker"],
            moveable: true,
            location: "hot cell tunnel",
            /*
            TODO: "Several alternative materials have been suggested for use as Small Subsurface
            Markers including granite, quartz, aluminum, titanium, stainless steel, hastealloy,
            inconel, ceramics, glass (lanthanumborate made by the Corning Glass
            Company), and highly durable plastics (polyethylene).
            ...
             it is likely that rock and metal can be eliminated from the candidate list due to cost"
            */
            passive: {
                "touch": "a hard and smooth disc, head-sized, loose on the ground"
            },
            sense: {
                "touch": "A hard and smooth disc, head-sized, with symbols engraved on it. It is hard, and smoother than stone. The engraving is finer, shallow and narrow, but clear. It is cold.",
                "see": "The disc has more ancient text on it, as well as some unfamiliar symbols, larger than the letters.",
                "hear": "The disc makes a clinking sound when tapped.",
            },
            writing: "danger -- poisonous radioactive waste here -- do not dig or drill"
        },
        hotcell_infocenter_hole: {
            aliases: ["door", "hole"],
            moveable: false,
            location: "hot cell",
            passive: {
                "see": "a person-sized hole in one wall",
                "touch": "a person-sized hole in one wall",
            },
            sense: {
                "see": "The hole is the size of a crawling person. It tracks a gentle upward slope.",
                "touch": "The hole is the size of a crawling person. It tracks a gentle upward slope.",
            }
        },
        hotcell_switch: {
            aliases: ["cylinder", "switch", "button"],
            moveable: false,
            location: "hot cell",
            passive: {
                "see": "a raised cylinder, smaller than your finger, protruding from the wall near the hole",
                "touch": "a raised cylinder, smaller than your finger, protruding from the wall near the hole",
            },
            sense: {
                "see": "A raised cylinder, about the size of your last pinky joint. It is made of an unfamiliar, shiny material.",
                "touch": "A raised cylinder, about the size of your last pinky joint. It is made of an unfamiliar material, not quite metal: smooth, hard, and neither warm nor cold. It seems to shift slightly, vertically, as you touch it.",
                "taste": "A raised cylinder, about the size of your last pinky joint. It is made of an unfamiliar material, bitter-tasting.",
            },
            action: [
                {
                    aliases: ["push", "flip", "activate", "toggle"],
                    callback: hotCellLightSwitch,
                }
            ]
        },
        "hot cell light": {
            aliases: ["light", "ceiling", "whine"],
            moveable: false,
            location: "nowhere",
            passive: {
                "see": "a clear fist-sized globe, glowing yellow, out of reach, in center of the ceiling",
                "hear": "a faint whine coming from the center of the ceiling",
            },
            sense: {
                "see": "A clear fist-sized globe of an unfamiliar material. It gives off a yellow light, enough that you can make out the rest of the room clearly. It is attached to the center of the ceiling, well out of reach.",
                "hear": "A faint high-pitched whine eminates from the center of the ceiling, high above your head."
            },
            lightLevel: 1,
        }
    },
    rooms: {
        nowhere: {
            // Placeholder place for items that don't otherwise have a location.
            rad_rate: Infinity,
            exits: {},
            senses: {
                "see": "You should't be here.",
                "hear": "You should't be here.",
                "smell": "You should't be here.",
                "touch": "You should't be here.",
                "taste": "You should't be here."
            },
            droneVolume: 10
        },
        outside: {
            exits: {
                west: "information center",
                berm: "outside",
                "information center": "information center",
            },
            // Rads per second
            rad_rate: 0,
            senses: {},
            droneVolume: -13,
            lightLevel: 1,
        },
        "information center": {
            exits: {
                east: "outside",
                outside: "outside",
                hole: "hot cell tunnel",
                down: "hot cell tunnel",
                "through the hole": "hot cell tunnel",
                "into the hole": "hot cell tunnel",
                "into hole": "hot cell tunnel",
                "into the hole": "hot cell tunnel",
            },
            rad_rate: 0.01,
            senses: {
                "see": "four stone walls without a roof in a rectangle, with their tops at the edge of your reach",
                "touch": "four stone walls without a roof in a rectangle, with their tops at the edge of your reach"
            },
            droneVolume: -13,
            lightLevel: 1,
        },
        "hot cell tunnel": {
            exits: {
                "towards the wind": "information center",
                "towards the sound": "information center",
                "to the sound": "information center",
                "from the wind": "hot cell",
                "away from the wind": "hot cell",
                "down": "hot cell",
                "up": "information center"
            },
            rad_rate: 0.05,
            senses: {
                "touch": "walls around you, the tunnel before and behind you, sloping gently downwards",
                "hear": "wind from the upper end of the tunnel",
                "smell": "earth",
            },
            droneVolume: -10
        },
        "hot cell": {
            exits: {
                hole: "hot cell tunnel",
                "through the hole": "hot cell tunnel",
                "into the hole": "hot cell tunnel",
                "into hole": "hot cell tunnel",
                "into the hole": "hot cell tunnel",
                "out": "hot cell tunnel",
                "up": "hot cell tunnel",
                "tunnel": "hot cell tunnel",
            },
            rad_rate: 0.5,
            senses: {
                // TODO: Dark at first, have to find a light switch?
                "touch": "the air circulating through an open chamber",
                "smell": "something not quite earthen"
            },
            droneVolume: -10
        },
        home: {
            exits: {
                west: "outside",
                "to the place of honor": "outside",
            },
            rad_rate: 0,
            senses: {
                see: "your community looking at you",
                hear: "the crowd's bated breath",
                touch: "the heat from the crowd around you despite the cold air",
                smell: "hundreds of bodies in close proximity",
                taste: "your own sweat on your lips"
            },
            droneVolume: -Infinity,
            lightLevel: 1,
        }
    }
};

export default PERMANENT;


