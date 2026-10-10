-- Default admin recovery email; kept if the owner already set one
INSERT INTO "settings" ("key", "value") VALUES ('recovery_email', 'auraluxe26@gmail.com') ON CONFLICT ("key") DO NOTHING;
