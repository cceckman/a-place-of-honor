async function obfuscateWord(input) {
    input = input.toLowerCase();
    let linear_a_unicode_block = 0x10600;

    // Encode the input string as a Uint8Array (buffer)
    const encoder = new TextEncoder();
    const data = encoder.encode(input);

    // Hash the input using SHA-256
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);

    // Convert the hash buffer to a byte array
    const hashArray = Array.from(new Uint8Array(hashBuffer));

    // Map each byte to a character in the Linear A Unicode block
    let obfuscatedWord = hashArray
        .map((byte) => {
            return String.fromCodePoint(linear_a_unicode_block + byte);
        })
        .slice(0, input.length)
        .join("");

    return obfuscatedWord;
}
