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

export const PERMANENT = {
    items: {
        monolith1: {
            aliases: ["monolith", "stone", "gray stone monolith"],
            moveable: false,
            writing: WARNING_LINES.slice(0, 5).join("\n"),
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
            writing: INFOCENTER_PANEL1.join("\n")
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
            drone_volume: -4,
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
                "see": "four stone walls without a roof in a rectangle, with their tops just at your reach",
                "touch": "four stone walls without a roof in a rectangle, with their tops just at your reach"
            },
            drone_volume: 0,
        },
        "hot cell": {
            exits: { east: "information center" },
            rad_rate: 10,
            senses: {},
            drone_volume: 8
        },
    },
};

export default PERMANENT;


