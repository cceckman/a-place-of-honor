Design notes

===

Here are some interesting choices we made during development.

## Make an engine

We looked a bit at Twine, but we thought that there were enough interesting mechanics in here
that we didn't want to layer on learning a new tool.
We individually / collectively have enough JS experience to feel confident in
implementing what we need to.

## Senses

Our model for perception includes all five senses: sight, sound, smell, taste, and touch.
They aren't entirely equal; for instance, sight/sound/smell are generally passive,
while taste and touch are more active. However, all are represented.

One of the ideas / constraints we discussed was the ability to play the game
either through a text-based interface, or a voice-based interface.
Representing all senses aligns with this.

This also plays into our notion of radiation damage. Smelling or tasting a radiation source
gives a higher effective dosage than looking at it.

## Two notions of time

We debated how to accumulate radiation damage.

The primary interface is turn-based:
the player takes discrete actions, and gets discrete feedback. We could implement
radiation damage based on the number of turns spent in a location / spent interacting
with an item.

Alternatively, we could accumulate radiation damage based on a real-time clock.
A player taking longer to make a decision, while the investigator is in a
high-rad environment, would accumulate more damage on the investigator.

We decided the latter was the more interesting choice. We also decided it would be
interesting to use make this slightly opaque to the player: any negative health
effects are reported ~immediately on meeting the threshold.

## Health and damage mechanics

We decided that mundane sources of danger -- sharp objects, pits -- would not be interesting
to implement.

We discussed other forms of damage, e.g. blindness ("you put a radiation source into
a beryllium container") or deafness ("the machine went bang") as future addition.

