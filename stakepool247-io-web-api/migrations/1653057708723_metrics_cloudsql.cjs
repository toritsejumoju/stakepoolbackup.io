/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = pgm => {
    pgm.sql(`
        CREATE TABLE metrics (
            "time" timestamp NOT NULL,
            uid text NOT NULL,
            device_id text NOT NULL,
            metric_name text NOT NULL,
            metric_value double precision NULL
        );

        -- Create index on time column for performance (replaces TimescaleDB hypertable)
        CREATE INDEX idx_metrics_time ON metrics ("time");

        -- Create composite index for common queries
        CREATE INDEX idx_metrics_uid_time ON metrics (uid, "time");
        CREATE INDEX idx_metrics_device_time ON metrics (device_id, "time");
    `)
};

exports.down = pgm => {
    pgm.dropTable('metrics');
};