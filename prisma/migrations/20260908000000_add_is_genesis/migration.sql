-- Badge: add is_genesis flag for Genesis-era members (2017-2018)
ALTER TABLE "badges" ADD COLUMN "is_genesis" BOOLEAN NOT NULL DEFAULT false;
