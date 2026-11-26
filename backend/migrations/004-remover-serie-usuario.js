exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE usuarios
      DROP COLUMN IF EXISTS serie;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE usuarios
      ADD COLUMN serie VARCHAR(50);
  `);
};
