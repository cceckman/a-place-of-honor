const synth = new Tone.Synth({
    volume: -4
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

function gaussianRandom(mean = 0, stdev = 1) {
    const u = 1 - Math.random(); // Converting [0,1) to (0,1]
    const v = Math.random();
    const z = Math.sqrt( -2.0 * Math.log( u ) ) * Math.cos( 2.0 * Math.PI * v );
    // Transform to the desired mean and standard deviation:
    return z * stdev + mean;
}

export default class Music {

    musicOn = false;
    sequence;
    detune = 10;

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

    toggleMusic() {
        this.musicOn = !this.musicOn;
        this.musicToggle.innerText = this.musicOn ? "Music Off" : "Music On";
        if (this.musicOn) {
            Tone.Transport.start();
            droneSynth1.start();
            droneSynth2.start();
        } else {
            Tone.Transport.stop();
            droneSynth1.stop();
            droneSynth2.stop();
        }   
    }

    increaseDetune() {
        this.detune += this.detune;
    }

    setDroneVolume(volume) {
        console.log(`new volume: ${volume}`)
        droneVolume.set("volume", volume);
        console.log(droneVolume.get("volume"));
    }

}