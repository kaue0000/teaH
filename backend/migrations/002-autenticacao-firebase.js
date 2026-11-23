exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE usuarios
      DROP COLUMN senha_hash,
      ADD COLUMN firebase_uid VARCHAR(128) NOT NULL UNIQUE;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE usuarios
      DROP COLUMN firebase_uid,
      ADD COLUMN senha_hash TEXT;
  `);
};
