// Fixed choices shared by validation and the listing form.
const PROPERTY_TYPES = ['apartment', 'studio', 'house', 'villa', 'cabin', 'room'];

// Cover illustrations shipped in public/img/covers/<name>.svg
const COVERS = ['skyline', 'harbour', 'beach', 'mountain', 'forest', 'village'].flatMap((scene) =>
  ['day', 'dusk', 'night'].map((time) => `${scene}-${time}`)
);

const MAX_NIGHTS = 30;

module.exports = { PROPERTY_TYPES, COVERS, MAX_NIGHTS };
