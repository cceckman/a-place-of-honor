const DEFAULT_DRONE_VOLUME = -4;

const synth = new Tone.Synth({
    volume: DEFAULT_DRONE_VOLUME
}).toDestination();
const droneVolume = new Tone.Volume(-13).toDestination();
const droneSynth1 = new Tone.Oscillator({
    type: "triangle",
    frequency: 32.7, // 32.7 hz ~= C1
}).connect(droneVolume);
const droneSynth2 = new Tone.Oscillator({
    type: "sine",
    frequency: 65.4, // 65.4 hz ~= C2
}).connect(droneVolume);

const arpeggio1Notes = [ "C3", "F3", "Bb3", "Eb4", "Bb3", "F3" ];
const arpeggio2Notes = [ "C3", "A3", "E4", "B4", "E4", "A3" ];
const arpeggioNotes = [ ...arpeggio1Notes, ...arpeggio1Notes, ...arpeggio2Notes, ...arpeggio2Notes ];

const DEFAULT_DETUNE = 10;

function gaussianRandom(mean = 0, stdev = 1) {
    const u = 1 - Math.random(); // Converting [0,1) to (0,1]
    const v = Math.random();
    const z = Math.sqrt( -2.0 * Math.log( u ) ) * Math.cos( 2.0 * Math.PI * v );
    // Transform to the desired mean and standard deviation:
    return z * stdev + mean;
}

const instrumentToggles = {
    arpeggio: Tone.Transport,
    droneSynth1,
    droneSynth2
}

const allInstrumentNames = Object.keys(instrumentToggles);

export default class Music {

    musicOn = false;
    sequence;
    detune = DEFAULT_DETUNE;
    activeInstrumentNames = allInstrumentNames;

    constructor() {
        this.musicToggle = document.createElement("button");
        this.musicToggle.id = "music";
        this.musicToggle.classList.add("action");
        this.musicToggle.classList.add("margin-top");
        this.musicToggle.innerText = "Music On";
        this.musicToggle.addEventListener("click", () => {
            this.toggleMusic();
        });
        this.sequence = new Tone.Sequence((time, note) => {
            synth.set({
                detune: gaussianRandom() * this.detune
            })
            synth.triggerAttackRelease(note, 0.25, time);
        }, arpeggioNotes).start(0);

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
        this.toggleInstruments([ "arpeggio" ], false);
        this.activeInstrumentNames = [ "droneSynth1", "droneSynth2" ];
        this.setDroneVolume(DEFAULT_DRONE_VOLUME);
    }

    restartArpeggio() {
        this.onlyDrone = false;
        this.detune = DEFAULT_DETUNE;
        this.activeInstrumentNames = allInstrumentNames;
        this.toggleInstruments([ "arpeggio" ])
    }

    setDroneVolume(volume) {
        droneVolume.set({ volume: volume });
        this.toggleInstruments([ "droneSynth1", "droneSynth2" ]);
    }

}