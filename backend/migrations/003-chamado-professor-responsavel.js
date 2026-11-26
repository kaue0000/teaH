exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE usuarios
      ADD COLUMN serie VARCHAR(50);

    ALTER TABLE mensagens
      ADD COLUMN professor_id BIGINT REFERENCES usuarios(id);

    UPDATE mensagens
    SET professor_id = usuario_id;

    ALTER TABLE mensagens
      ALTER COLUMN professor_id SET NOT NULL;

    CREATE INDEX mensagens_professor_id_status_idx
      ON mensagens(professor_id, status);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP INDEX mensagens_professor_id_status_idx;
    ALTER TABLE mensagens DROP COLUMN professor_id;
    ALTER TABLE usuarios DROP COLUMN serie;
  `);
};
