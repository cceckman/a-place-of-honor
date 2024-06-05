const synth = new Tone.Synth().toDestination();

const arpeggioNotes = ["C3", "F3", "Bb3", "Eb4", "Bb3", "F3" ];

export default class Music {

    musicOn = false;
    sequence;

    constructor() {
        this.musicToggle = document.createElement("button");
        this.musicToggle.id = "music";
        this.musicToggle.classList.add("action");
        this.musicToggle.classList.add("margin-top");
        this.musicToggle.innerText = "Music On";
        this.musicToggle.addEventListener("click", () => {
            this.toggleMusic();
        });
    }

    playArpeggio() {
        this.sequence = new Tone.Sequence((time, note) => {
            synth.triggerAttackRelease(note, 0.25, time);
        }, arpeggioNotes).start(0);
        Tone.Transport.start();
        // if (this.arpeggioIndex > arpeggioNotes.length || (this.previousToneNow && (this.previousToneNow + 1) > Tone.now())) {
        //     return;
        // }
        // console.log(`this.previousToneNow: ${this.previousToneNow} toneNow: ${Tone.now()}`);
        // now = Tone.now();
        // synth.triggerAttackRelease(arpeggioNotes[this.arpeggioIndex], "1n");
        // this.arpeggioIndex = this.arpeggioIndex + 1;
        // console.log(this.arpeggioIndex);
    }

    toggleMusic() {
        this.musicOn = !this.musicOn;
        this.musicToggle.innerText = this.musicOn ? "Music Off" : "Music On";
        if (this.musicOn) {
            this.playArpeggio();
        } else {
            Tone.Transport.stop();
            this.sequence.stop();
        }
        
    }
}