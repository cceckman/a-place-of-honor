const DEFAULT_DRONE_VOLUME = -13;

const synth = new Tone.Synth({
    volume: -4,
}).toDestination();
const droneVolume = new Tone.Volume(DEFAULT_DRONE_VOLUME).toDestination();
const droneSynth1 = new Tone.Oscillator({
    type: "triangle",
    frequency: 32.7, // 32.7 hz ~= C1
}).connect(droneVolume);
const droneSynth2 = new Tone.Oscillator({
    type: "sine",
    frequency: 65.4, // 65.4 hz ~= C2
}).connect(droneVolume);
const reverb = new Tone.Reverb();
const chordSynth = new Tone.PolySynth(Tone.MonoSynth).toDestination();
chordSynth.set({
    envelope: {
        attack: 2,
        attackCurve: "bounce",
        decay: 3,
        release: 2,
        sustain: 0.1
    },
    volume: -20
})

const melodySynth = new Tone.Synth({
    volume: -7,
    portamento: 0.05,
    envelope: {
        attack: 0.05,
        decay: 0.2,
        release: 0.5,
        sustain: 0.2,
    },
    oscillator: {
        type: "fatsine",
        count: 2,
    },
})
    .connect(reverb)
    .toDestination();

const arpeggio1Notes = ["C3", "F3", "Bb3", "Eb4", "Bb3", "F3"];
const arpeggio2Notes = ["C3", "A3", "E4", "B4", "E4", "A3"];
const arpeggioNotes = [
    ...arpeggio1Notes,
    ...arpeggio1Notes,
    ...arpeggio2Notes,
    ...arpeggio2Notes,
];
const melodyPart = [
    [{ time: "0:0", note: "Eb6", duration: "2n.", velocity: 1.5 }],
    [{ time: "0:3", note: "D6", duration: "2n", velocity: 1 }],
    [{ time: "1:1:2", note: "Eb6", duration: "16n", velocity: 2 }],
    [{ time: "1:1:3", note: "D6", duration: "16n", velocity: 1.75 }],
    [{ time: "1:2", note: "C6", duration: "2n.", velocity: 1.5 }],
    [{ time: "2:1", note: "Bb5", duration: "4n", velocity: 1 }],
    [{ time: "2:2", note: "Ab5", duration: "4n", velocity: 1 }],
    [{ time: "2:3", note: "G5", duration: "1t", velocity: 1.5 }],
    [{ time: "2:3:3", note: "Bb5", duration: "1t", velocity: 1.5 }],
    [{ time: "3:0:2", note: "C6", duration: "1t", velocity: 2 }]
];

const DEFAULT_DETUNE = 10;

function gaussianRandom(mean = 0, stdev = 1) {
    const u = 1 - Math.random(); // Converting [0,1) to (0,1]
    const v = Math.random();
    const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    // Transform to the desired mean and standard deviation:
    return z * stdev + mean;
}

const instrumentToggles = {
    arpeggio: Tone.Transport,
    droneSynth1,
    droneSynth2,
};

const allInstrumentNames = Object.keys(instrumentToggles);

export default class Music {
    musicOn = false;
    sequence;
    detune = DEFAULT_DETUNE;
    activeInstrumentNames = allInstrumentNames;
    melodyStartTime;
    arpeggioBar = 0;

    constructor() {
        this.musicToggle = document.createElement("button");
        this.musicToggle.id = "music";
        this.musicToggle.classList.add("action");
        this.musicToggle.classList.add("margin-top");
        this.musicToggle.innerText = "Music On";
        this.musicToggle.addEventListener("click", () => {
            this.toggleMusic();
        });

        this.melodysequence = new Tone.Part((time, { note, duration, velocity}) => {
            melodySynth.set({
                detune: gaussianRandom() * this.detune,
            });
            melodySynth.triggerAttackRelease(note, duration, time, velocity);
        }, melodyPart);

        this.sequence = new Tone.Sequence((time, note) => {
            synth.set({
                detune: gaussianRandom() * this.detune,
            });
            this.arpeggioBar =
                note === "C3" ? this.arpeggioBar + 1 : this.arpeggioBar;
            if (
                note === "Eb4" &&
                this.arpeggioBar % 13 === 5
                // Maybe queue up randomly?
                // Math.random() > 0.9 &&
                // time > (this.melodyStartTime ? (this.melodyStartTime + 7) : -Infinity) // Melody roughly takes 7 seconds to complete
            ) {
                this.melodysequence.stop(); // Need to stop sequence to play it again
                this.melodysequence.start();
                this.melodyStartTime = time;
            }
            synth.triggerAttackRelease(note, 0.25, time);
        }, arpeggioNotes).start(0);
    }

    attachControls(parent) {
        parent.appendChild(this.musicToggle);
    }

    instrumentControl(instrumentName, isOn) {
        const instrumentToggle = instrumentToggles[instrumentName];
        if (isOn) {
            instrumentToggle.start();
        } else {
            instrumentToggle.stop();
        }
    }

    toggleMusic() {
        this.musicOn = !this.musicOn;
        this.musicToggle.innerText = this.musicOn ? "Music Off" : "Music On";
        this.toggleInstruments(this.activeInstrumentNames);
    }

    toggleInstruments(instrumentNames, isOn = this.musicOn) {
        for (let instrumentName of instrumentNames) {
            this.instrumentControl(instrumentName, isOn);
        }
    }

    increaseDetune() {
        this.detune += this.detune;
    }

    stopArpeggioAndReduceDrone() {
        this.onlyDrone = true;
        this.toggleInstruments(["arpeggio"], false);
        this.activeInstrumentNames = ["droneSynth1", "droneSynth2"];
        this.setDroneVolume(DEFAULT_DRONE_VOLUME);
    }

    restartArpeggio() {
        this.onlyDrone = false;
        this.detune = DEFAULT_DETUNE;
        this.activeInstrumentNames = allInstrumentNames;
        this.toggleInstruments(["arpeggio"]);
    }

    setDroneVolume(volume) {
        droneVolume.set({ volume: volume });
        this.toggleInstruments(["droneSynth1", "droneSynth2"]);
    }

    triggerMoveChord() {
        if (this.musicOn) {
            chordSynth.triggerAttackRelease(["F5", "Eb6"], "2m");
        }
    }

    triggerDarknessChord() {
        if (this.musicOn) {
            chordSynth.triggerAttackRelease(["Bb1", "C2"], "2m", "+16n", 2);
        }
    }

}

